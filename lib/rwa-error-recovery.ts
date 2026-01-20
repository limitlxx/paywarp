/**
 * RWA Error Recovery Utilities
 * Provides comprehensive error recovery mechanisms for RWA operations
 * Implements circuit breaker patterns and graceful degradation
 */

import { rwaErrorHandler, type ErrorState } from './rwa-error-handler'
import { yieldPollingService } from './yield-polling-service'
import { rwaIntegration } from './rwa-integration'
import type { BucketType } from './types'

export interface RecoveryConfig {
  maxRetries: number
  retryDelayMs: number
  circuitBreakerThreshold: number
  circuitBreakerTimeoutMs: number
  healthCheckIntervalMs: number
}

export interface RecoveryStatus {
  isRecovering: boolean
  lastRecoveryAttempt: Date | null
  recoveryAttempts: number
  circuitBreakerOpen: boolean
  healthCheckStatus: 'healthy' | 'degraded' | 'failed'
}

export class RWAErrorRecovery {
  private config: RecoveryConfig
  private recoveryStatus: Map<string, RecoveryStatus> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null
  private circuitBreakers: Map<string, { openTime: Date; failureCount: number }> = new Map()

  constructor(config?: Partial<RecoveryConfig>) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 2000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeoutMs: 60000, // 1 minute
      healthCheckIntervalMs: 30000, // 30 seconds
      ...config
    }

    this.startHealthChecks()
  }

  /**
   * Attempt to recover from RWA service failures
   */
  async attemptRecovery(operationKey: string): Promise<boolean> {
    const status = this.getRecoveryStatus(operationKey)
    
    if (status.isRecovering) {
      console.log(`[RWAErrorRecovery] Recovery already in progress for ${operationKey}`)
      return false
    }

    if (this.isCircuitBreakerOpen(operationKey)) {
      console.log(`[RWAErrorRecovery] Circuit breaker open for ${operationKey}, skipping recovery`)
      return false
    }

    if (status.recoveryAttempts >= this.config.maxRetries) {
      console.log(`[RWAErrorRecovery] Max recovery attempts reached for ${operationKey}`)
      this.openCircuitBreaker(operationKey)
      return false
    }

    // Start recovery process
    this.updateRecoveryStatus(operationKey, {
      isRecovering: true,
      lastRecoveryAttempt: new Date(),
      recoveryAttempts: status.recoveryAttempts + 1,
      circuitBreakerOpen: false,
      healthCheckStatus: 'degraded'
    })

    try {
      // Wait before retry
      await this.delay(this.config.retryDelayMs * status.recoveryAttempts)

      // Attempt recovery based on operation type
      const success = await this.executeRecovery(operationKey)

      if (success) {
        console.log(`[RWAErrorRecovery] Recovery successful for ${operationKey}`)
        this.clearRecoveryStatus(operationKey)
        this.closeCircuitBreaker(operationKey)
        return true
      } else {
        console.warn(`[RWAErrorRecovery] Recovery failed for ${operationKey}`)
        this.updateRecoveryStatus(operationKey, {
          ...status,
          isRecovering: false,
          healthCheckStatus: 'failed'
        })
        return false
      }
    } catch (error) {
      console.error(`[RWAErrorRecovery] Recovery error for ${operationKey}:`, error)
      this.updateRecoveryStatus(operationKey, {
        ...status,
        isRecovering: false,
        healthCheckStatus: 'failed'
      })
      
      // Increment circuit breaker failure count
      this.incrementCircuitBreakerFailures(operationKey)
      
      return false
    }
  }

  /**
   * Check if RWA services are healthy
   */
  async performHealthCheck(): Promise<{ [key: string]: 'healthy' | 'degraded' | 'failed' }> {
    const healthStatus: { [key: string]: 'healthy' | 'degraded' | 'failed' } = {}
    
    // Check yield polling service
    try {
      if (yieldPollingService.isActive()) {
        const yields = yieldPollingService.getCurrentYields()
        const hasValidData = Object.values(yields).some(bucket => 
          bucket.lastUpdated && (Date.now() - bucket.lastUpdated.getTime()) < 60000
        )
        healthStatus['yield-polling'] = hasValidData ? 'healthy' : 'degraded'
      } else {
        healthStatus['yield-polling'] = 'failed'
      }
    } catch (error) {
      healthStatus['yield-polling'] = 'failed'
    }

    // Check RWA integration
    try {
      const networkConfig = rwaIntegration.getNetworkConfig()
      healthStatus['rwa-integration'] = networkConfig.rwaSupported ? 'healthy' : 'failed'
    } catch (error) {
      healthStatus['rwa-integration'] = 'failed'
    }

    // Check individual bucket operations
    const buckets: BucketType[] = ['billings', 'savings', 'growth', 'instant']
    for (const bucket of buckets) {
      try {
        await rwaIntegration.getCurrentYield(bucket)
        healthStatus[`bucket-${bucket}`] = 'healthy'
      } catch (error) {
        healthStatus[`bucket-${bucket}`] = 'failed'
      }
    }

    return healthStatus
  }

  /**
   * Get recovery status for an operation
   */
  getRecoveryStatus(operationKey: string): RecoveryStatus {
    return this.recoveryStatus.get(operationKey) || {
      isRecovering: false,
      lastRecoveryAttempt: null,
      recoveryAttempts: 0,
      circuitBreakerOpen: false,
      healthCheckStatus: 'healthy'
    }
  }

  /**
   * Get overall system health status
   */
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'failed'
    services: { [key: string]: 'healthy' | 'degraded' | 'failed' }
    recoveryOperations: string[]
    circuitBreakers: string[]
  }> {
    const services = await this.performHealthCheck()
    const recoveryOperations = Array.from(this.recoveryStatus.keys()).filter(
      key => this.recoveryStatus.get(key)?.isRecovering
    )
    const circuitBreakers = Array.from(this.circuitBreakers.keys()).filter(
      key => this.isCircuitBreakerOpen(key)
    )

    // Determine overall health
    const serviceStatuses = Object.values(services)
    const failedCount = serviceStatuses.filter(status => status === 'failed').length
    const degradedCount = serviceStatuses.filter(status => status === 'degraded').length
    
    let overall: 'healthy' | 'degraded' | 'failed'
    if (failedCount > serviceStatuses.length / 2) {
      overall = 'failed'
    } else if (failedCount > 0 || degradedCount > 0) {
      overall = 'degraded'
    } else {
      overall = 'healthy'
    }

    return {
      overall,
      services,
      recoveryOperations,
      circuitBreakers
    }
  }

  /**
   * Force recovery for all failed operations
   */
  async forceRecoveryAll(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {}
    
    // Get all operations in error state
    const errorOperations = Array.from(this.recoveryStatus.keys())
    
    for (const operationKey of errorOperations) {
      try {
        results[operationKey] = await this.attemptRecovery(operationKey)
      } catch (error) {
        console.error(`[RWAErrorRecovery] Force recovery failed for ${operationKey}:`, error)
        results[operationKey] = false
      }
    }

    return results
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear()
    console.log('[RWAErrorRecovery] All circuit breakers reset')
  }

  /**
   * Stop all recovery operations
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    
    this.recoveryStatus.clear()
    this.circuitBreakers.clear()
    
    console.log('[RWAErrorRecovery] Shutdown complete')
  }

  // Private methods

  private async executeRecovery(operationKey: string): Promise<boolean> {
    // Determine recovery strategy based on operation type
    if (operationKey.includes('yield-polling')) {
      return this.recoverYieldPolling()
    } else if (operationKey.includes('convertTo')) {
      return this.recoverRWAConversion(operationKey)
    } else if (operationKey.includes('getCurrentYield')) {
      return this.recoverYieldFetching(operationKey)
    } else {
      // Generic recovery - just test if error handler can clear the error
      return rwaErrorHandler.recoverFromErrorState(operationKey, async () => {
        // Simple health check
        return Promise.resolve()
      })
    }
  }

  private async recoverYieldPolling(): Promise<boolean> {
    try {
      // Restart yield polling if it's not active
      if (!yieldPollingService.isActive()) {
        // We need a user address to restart polling
        // This would typically come from the application state
        console.warn('[RWAErrorRecovery] Cannot restart yield polling without user address')
        return false
      }
      
      // Try to refresh yields
      await yieldPollingService.refreshYields()
      return true
    } catch (error) {
      console.error('[RWAErrorRecovery] Yield polling recovery failed:', error)
      return false
    }
  }

  private async recoverRWAConversion(operationKey: string): Promise<boolean> {
    try {
      // Extract bucket type from operation key
      const bucketMatch = operationKey.match(/convertTo\w+-(\w+)/)
      if (!bucketMatch) return false
      
      const bucket = bucketMatch[1] as BucketType
      
      // Test conversion with minimal amount
      const testResult = await rwaIntegration.convertToUSDY(0.01, bucket)
      return testResult.success
    } catch (error) {
      console.error('[RWAErrorRecovery] RWA conversion recovery failed:', error)
      return false
    }
  }

  private async recoverYieldFetching(operationKey: string): Promise<boolean> {
    try {
      // Extract bucket type from operation key
      const bucketMatch = operationKey.match(/getCurrentYield-(\w+)/)
      if (!bucketMatch) return false
      
      const bucket = bucketMatch[1] as BucketType
      
      // Test yield fetching
      await rwaIntegration.getCurrentYield(bucket)
      return true
    } catch (error) {
      console.error('[RWAErrorRecovery] Yield fetching recovery failed:', error)
      return false
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthStatus = await this.performHealthCheck()
        
        // Update recovery status based on health checks
        for (const [service, status] of Object.entries(healthStatus)) {
          const currentStatus = this.getRecoveryStatus(service)
          this.updateRecoveryStatus(service, {
            ...currentStatus,
            healthCheckStatus: status
          })
          
          // Attempt automatic recovery for failed services
          if (status === 'failed' && !currentStatus.isRecovering) {
            this.attemptRecovery(service).catch(error => {
              console.error(`[RWAErrorRecovery] Auto-recovery failed for ${service}:`, error)
            })
          }
        }
      } catch (error) {
        console.error('[RWAErrorRecovery] Health check failed:', error)
      }
    }, this.config.healthCheckIntervalMs)
  }

  private updateRecoveryStatus(operationKey: string, status: RecoveryStatus): void {
    this.recoveryStatus.set(operationKey, status)
  }

  private clearRecoveryStatus(operationKey: string): void {
    this.recoveryStatus.delete(operationKey)
  }

  private isCircuitBreakerOpen(operationKey: string): boolean {
    const breaker = this.circuitBreakers.get(operationKey)
    if (!breaker) return false
    
    // Check if timeout has passed
    const timeoutPassed = Date.now() - breaker.openTime.getTime() > this.config.circuitBreakerTimeoutMs
    if (timeoutPassed) {
      this.closeCircuitBreaker(operationKey)
      return false
    }
    
    return breaker.failureCount >= this.config.circuitBreakerThreshold
  }

  private openCircuitBreaker(operationKey: string): void {
    const existing = this.circuitBreakers.get(operationKey)
    this.circuitBreakers.set(operationKey, {
      openTime: new Date(),
      failureCount: existing?.failureCount || this.config.circuitBreakerThreshold
    })
    console.warn(`[RWAErrorRecovery] Circuit breaker opened for ${operationKey}`)
  }

  private closeCircuitBreaker(operationKey: string): void {
    this.circuitBreakers.delete(operationKey)
    console.log(`[RWAErrorRecovery] Circuit breaker closed for ${operationKey}`)
  }

  private incrementCircuitBreakerFailures(operationKey: string): void {
    const existing = this.circuitBreakers.get(operationKey)
    const failureCount = (existing?.failureCount || 0) + 1
    
    this.circuitBreakers.set(operationKey, {
      openTime: existing?.openTime || new Date(),
      failureCount
    })
    
    if (failureCount >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker(operationKey)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const rwaErrorRecovery = new RWAErrorRecovery()

// Export utility functions
export const attemptRWARecovery = (operationKey: string): Promise<boolean> => {
  return rwaErrorRecovery.attemptRecovery(operationKey)
}

export const getRWASystemHealth = () => {
  return rwaErrorRecovery.getSystemHealth()
}

export const forceRWARecovery = () => {
  return rwaErrorRecovery.forceRecoveryAll()
}