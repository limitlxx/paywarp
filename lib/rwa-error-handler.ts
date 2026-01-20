/**
 * RWA Error Handler and Fallback Service
 * Handles RWA contract failures and provides fallback mechanisms
 * Implements yield data caching for offline scenarios
 * Preserves error state during failed operations
 */

import type { BucketType } from './types'
import type { BucketYields, BucketYieldInfo } from './yield-polling-service'
import type { ConversionResult, YieldData, RWABalance } from './rwa-integration'

export interface ErrorState {
  isError: boolean
  errorType: 'network' | 'contract' | 'validation' | 'timeout' | 'unknown'
  errorMessage: string
  timestamp: Date
  retryCount: number
  lastSuccessfulOperation?: Date
}

export interface CachedYieldData {
  yields: BucketYields
  timestamp: Date
  isStale: boolean
  staleness: 'fresh' | 'recent' | 'stale' | 'expired'
}

export interface FallbackConfig {
  maxRetries: number
  retryDelayMs: number
  cacheExpiryMs: number
  staleThresholdMs: number
  enableFallbackOperations: boolean
}

export class RWAErrorHandler {
  private errorStates: Map<string, ErrorState> = new Map()
  private yieldCache: Map<string, CachedYieldData> = new Map()
  private config: FallbackConfig
  private listeners: Set<(error: ErrorState) => void> = new Set()

  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      cacheExpiryMs: 5 * 60 * 1000, // 5 minutes
      staleThresholdMs: 30 * 1000, // 30 seconds
      enableFallbackOperations: true,
      ...config
    }
  }

  /**
   * Handle RWA contract failure with fallback to USDC operations
   */
  async handleRWAContractFailure<T>(
    operation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationKey: string
  ): Promise<T> {
    try {
      // Attempt primary RWA operation
      const result = await this.executeWithRetry(operation, operationKey)
      
      // Clear error state on success
      this.clearErrorState(operationKey)
      
      return result
    } catch (error) {
      // Log the error and update error state
      const errorState = this.updateErrorState(operationKey, error as Error)
      
      // Notify listeners
      this.notifyErrorListeners(errorState)
      
      if (this.config.enableFallbackOperations) {
        try {
          console.warn(`[RWAErrorHandler] RWA operation failed, falling back to USDC operations for ${operationKey}`)
          return await fallbackOperation()
        } catch (fallbackError) {
          console.error(`[RWAErrorHandler] Both RWA and fallback operations failed for ${operationKey}:`, fallbackError)
          throw new Error(`Operation failed: ${(error as Error).message}. Fallback also failed: ${(fallbackError as Error).message}`)
        }
      } else {
        throw error
      }
    }
  }

  /**
   * Handle yield data caching during polling failures
   */
  async handleYieldPollingFailure(
    pollingOperation: () => Promise<BucketYields>,
    userAddress: string
  ): Promise<BucketYields> {
    const cacheKey = `yields-${userAddress}`
    
    try {
      // Attempt to fetch fresh yield data
      const yields = await pollingOperation()
      
      // Cache successful result
      this.cacheYieldData(cacheKey, yields)
      
      // Clear error state on success
      this.clearErrorState(cacheKey)
      
      return yields
    } catch (error) {
      // Update error state
      this.updateErrorState(cacheKey, error as Error)
      
      // Return cached data if available
      const cachedData = this.getCachedYieldData(cacheKey)
      if (cachedData) {
        console.warn(`[RWAErrorHandler] Yield polling failed, returning cached data (${cachedData.staleness})`)
        return cachedData.yields
      }
      
      // Return empty yields as last resort
      console.error(`[RWAErrorHandler] Yield polling failed and no cached data available, returning empty yields`)
      return this.getEmptyYields()
    }
  }

  /**
   * Preserve error state during failed operations
   */
  preserveErrorState(operationKey: string, userState: any): void {
    const errorState = this.errorStates.get(operationKey)
    if (errorState) {
      // Store user state in error context for recovery
      const preservedState = {
        ...errorState,
        preservedUserState: userState,
        preservedAt: new Date()
      }
      this.errorStates.set(operationKey, preservedState as ErrorState)
    }
  }

  /**
   * Recover from error state when conditions improve
   */
  async recoverFromErrorState(
    operationKey: string,
    recoveryOperation: () => Promise<any>
  ): Promise<boolean> {
    const errorState = this.errorStates.get(operationKey)
    if (!errorState) {
      return true // No error state to recover from
    }

    try {
      // Attempt recovery operation
      await recoveryOperation()
      
      // Clear error state on successful recovery
      this.clearErrorState(operationKey)
      
      console.log(`[RWAErrorHandler] Successfully recovered from error state for ${operationKey}`)
      return true
    } catch (error) {
      // Update retry count
      errorState.retryCount++
      this.errorStates.set(operationKey, errorState)
      
      console.warn(`[RWAErrorHandler] Recovery attempt failed for ${operationKey} (attempt ${errorState.retryCount})`)
      return false
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyErrorMessage(error: Error): string {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network connection issue. Please check your internet connection and try again.'
    }
    
    if (message.includes('contract') || message.includes('unavailable')) {
      return 'RWA service is temporarily unavailable. Your funds are safe and operations will continue with standard functionality.'
    }
    
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again in a moment.'
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'Invalid input. Please check your values and try again.'
    }
    
    if (message.includes('insufficient')) {
      return 'Insufficient balance for this operation.'
    }
    
    // Generic fallback message
    return 'An error occurred. Please try again or contact support if the issue persists.'
  }

  /**
   * Check if operation is in error state
   */
  isInErrorState(operationKey: string): boolean {
    return this.errorStates.has(operationKey)
  }

  /**
   * Get error state for operation
   */
  getErrorState(operationKey: string): ErrorState | null {
    return this.errorStates.get(operationKey) || null
  }

  /**
   * Subscribe to error state changes
   */
  onError(listener: (error: ErrorState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Clear all error states (for testing or reset)
   */
  clearAllErrorStates(): void {
    this.errorStates.clear()
    this.yieldCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now()
    const cacheEntries = Array.from(this.yieldCache.values())
    
    return {
      totalEntries: cacheEntries.length,
      freshEntries: cacheEntries.filter(entry => entry.staleness === 'fresh').length,
      staleEntries: cacheEntries.filter(entry => entry.staleness === 'stale').length,
      expiredEntries: cacheEntries.filter(entry => entry.staleness === 'expired').length,
      oldestEntry: cacheEntries.length > 0 ? Math.min(...cacheEntries.map(e => e.timestamp.getTime())) : null,
      newestEntry: cacheEntries.length > 0 ? Math.max(...cacheEntries.map(e => e.timestamp.getTime())) : null
    }
  }

  // Private helper methods

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationKey: string
  ): Promise<T> {
    const errorState = this.errorStates.get(operationKey)
    const retryCount = errorState?.retryCount || 0
    
    if (retryCount >= this.config.maxRetries) {
      throw new Error(`Max retries (${this.config.maxRetries}) exceeded for ${operationKey}`)
    }
    
    try {
      return await operation()
    } catch (error) {
      if (retryCount < this.config.maxRetries - 1) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * (retryCount + 1)))
        
        // Update retry count
        this.updateErrorState(operationKey, error as Error, retryCount + 1)
        
        // Retry
        return this.executeWithRetry(operation, operationKey)
      }
      
      throw error
    }
  }

  private updateErrorState(operationKey: string, error: Error, retryCount = 0): ErrorState {
    const errorType = this.categorizeError(error)
    
    const errorState: ErrorState = {
      isError: true,
      errorType,
      errorMessage: this.getUserFriendlyErrorMessage(error),
      timestamp: new Date(),
      retryCount,
      lastSuccessfulOperation: this.errorStates.get(operationKey)?.lastSuccessfulOperation
    }
    
    this.errorStates.set(operationKey, errorState)
    return errorState
  }

  private clearErrorState(operationKey: string): void {
    const currentState = this.errorStates.get(operationKey)
    if (currentState) {
      // Keep record of last successful operation
      const clearedState: ErrorState = {
        isError: false,
        errorType: 'unknown',
        errorMessage: '',
        timestamp: new Date(),
        retryCount: 0,
        lastSuccessfulOperation: new Date()
      }
      this.errorStates.set(operationKey, clearedState)
    }
  }

  private categorizeError(error: Error): ErrorState['errorType'] {
    const message = error.message.toLowerCase()
    
    if (message.includes('network') || message.includes('connection')) {
      return 'network'
    }
    if (message.includes('contract') || message.includes('unavailable')) {
      return 'contract'
    }
    if (message.includes('timeout')) {
      return 'timeout'
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation'
    }
    
    return 'unknown'
  }

  private cacheYieldData(cacheKey: string, yields: BucketYields): void {
    const now = new Date()
    const cachedData: CachedYieldData = {
      yields,
      timestamp: now,
      isStale: false,
      staleness: 'fresh'
    }
    
    this.yieldCache.set(cacheKey, cachedData)
  }

  private getCachedYieldData(cacheKey: string): CachedYieldData | null {
    const cached = this.yieldCache.get(cacheKey)
    if (!cached) {
      return null
    }
    
    const now = Date.now()
    const age = now - cached.timestamp.getTime()
    
    // Update staleness
    if (age > this.config.cacheExpiryMs) {
      cached.staleness = 'expired'
      cached.isStale = true
    } else if (age > this.config.staleThresholdMs) {
      cached.staleness = 'stale'
      cached.isStale = true
    } else if (age > this.config.staleThresholdMs / 2) {
      cached.staleness = 'recent'
      cached.isStale = false
    } else {
      cached.staleness = 'fresh'
      cached.isStale = false
    }
    
    return cached
  }

  private getEmptyYields(): BucketYields {
    const emptyBucketInfo: BucketYieldInfo = {
      pending: 0,
      apy: 0,
      tokenBalance: 0,
      totalYieldEarned: 0,
      lastUpdated: new Date(0), // Use epoch time for empty state
      isYielding: false
    }
    
    return {
      billings: { ...emptyBucketInfo },
      savings: { ...emptyBucketInfo },
      growth: { ...emptyBucketInfo },
      instant: { ...emptyBucketInfo }
    }
  }

  private notifyErrorListeners(errorState: ErrorState): void {
    this.listeners.forEach(listener => {
      try {
        listener(errorState)
      } catch (error) {
        console.error('[RWAErrorHandler] Error in error listener:', error)
      }
    })
  }
}

// Export singleton instance
export const rwaErrorHandler = new RWAErrorHandler()

// Export utility functions for common error handling patterns
export const withRWAFallback = async <T>(
  rwaOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>,
  operationKey: string
): Promise<T> => {
  return rwaErrorHandler.handleRWAContractFailure(rwaOperation, fallbackOperation, operationKey)
}

export const withYieldCaching = async (
  pollingOperation: () => Promise<BucketYields>,
  userAddress: string
): Promise<BucketYields> => {
  return rwaErrorHandler.handleYieldPollingFailure(pollingOperation, userAddress)
}

export const getUserFriendlyError = (error: Error): string => {
  return rwaErrorHandler.getUserFriendlyErrorMessage(error)
}