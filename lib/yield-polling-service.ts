/**
 * Yield Polling Service for RWA Integration
 * Fetches pending yields from all RWA contracts every 30 seconds
 * Provides event system for UI reactivity
 */

import { rwaIntegration, type YieldData, type RWABalance } from './rwa-integration'
import { withYieldCaching, rwaErrorHandler } from './rwa-error-handler'
import type { BucketType } from './types'

export interface BucketYields {
  billings: BucketYieldInfo
  savings: BucketYieldInfo
  growth: BucketYieldInfo
  instant: BucketYieldInfo
}

export interface BucketYieldInfo {
  pending: number
  apy: number
  tokenBalance: number
  totalYieldEarned: number
  lastUpdated: Date
  isYielding: boolean
}

export interface YieldUpdateEvent {
  type: 'yield-update'
  data: BucketYields
  timestamp: Date
}

export type YieldUpdateCallback = (yields: BucketYields) => void

export class YieldPollingService {
  private pollingInterval: NodeJS.Timeout | null = null
  private callbacks: Set<YieldUpdateCallback> = new Set()
  private currentYields: BucketYields | null = null
  private isPolling = false
  private readonly POLLING_INTERVAL_MS = 30000 // 30 seconds
  private userAddress: string | null = null

  constructor() {
    this.initializeEmptyYields()
  }

  /**
   * Start polling for yield updates
   */
  startPolling(address: string): void {
    if (this.isPolling && this.userAddress === address) {
      return // Already polling for this address
    }

    this.stopPolling() // Stop any existing polling
    this.userAddress = address
    this.isPolling = true

    // Fetch initial data immediately
    this.fetchYieldData()

    // Set up polling interval
    this.pollingInterval = setInterval(() => {
      this.fetchYieldData()
    }, this.POLLING_INTERVAL_MS)

    console.log(`[YieldPollingService] Started polling for address: ${address}`)
  }

  /**
   * Stop polling for yield updates
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    this.isPolling = false
    this.userAddress = null
    console.log('[YieldPollingService] Stopped polling')
  }

  /**
   * Get current yields (cached data)
   */
  getCurrentYields(): BucketYields {
    return this.currentYields || this.getEmptyYields()
  }

  /**
   * Subscribe to yield updates
   */
  onYieldUpdate(callback: YieldUpdateCallback): () => void {
    this.callbacks.add(callback)

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Get bucket yields for all RWA-enabled buckets
   */
  async getBucketYields(): Promise<BucketYields> {
    if (!this.userAddress) {
      return this.getEmptyYields()
    }

    return withYieldCaching(
      async () => {
        const bucketTypes: BucketType[] = ['billings', 'savings', 'growth', 'instant']
        const yieldPromises = bucketTypes.map(async (bucketType) => {
          return this.fetchBucketYieldInfo(bucketType)
        })

        const [billings, savings, growth, instant] = await Promise.all(yieldPromises)

        return {
          billings,
          savings,
          growth,
          instant,
        }
      },
      this.userAddress
    )
  }

  /**
   * Force refresh yield data
   */
  async refreshYields(): Promise<BucketYields> {
    const yields = await this.getBucketYields()
    this.updateCurrentYields(yields)
    return yields
  }

  /**
   * Check if service is currently polling
   */
  isActive(): boolean {
    return this.isPolling
  }

  /**
   * Get polling status information
   */
  getStatus() {
    return {
      isPolling: this.isPolling,
      userAddress: this.userAddress,
      lastUpdate: this.currentYields?.billings.lastUpdated || null,
      callbackCount: this.callbacks.size,
    }
  }

  // Private methods

  private async fetchYieldData(): Promise<void> {
    if (!this.userAddress) {
      console.warn('[YieldPollingService] No user address set, skipping yield fetch')
      return
    }

    try {
      const yields = await this.getBucketYields()
      this.updateCurrentYields(yields)
      
      // Clear any error state on successful fetch
      rwaErrorHandler.clearAllErrorStates()
    } catch (error) {
      console.error('[YieldPollingService] Error in fetchYieldData:', error)
      
      // Preserve error state and use cached data if available
      rwaErrorHandler.preserveErrorState('yield-polling', {
        userAddress: this.userAddress,
        lastAttempt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Try to get cached yields as fallback
      try {
        const cachedYields = await withYieldCaching(
          async () => {
            throw error // Re-throw to trigger cache fallback
          },
          this.userAddress
        )
        this.updateCurrentYields(cachedYields)
      } catch (cacheError) {
        console.error('[YieldPollingService] Failed to get cached yields:', cacheError)
        // Use empty yields as last resort
        this.updateCurrentYields(this.getEmptyYields())
      }
    }
  }

  private async fetchBucketYieldInfo(bucketType: BucketType): Promise<BucketYieldInfo> {
    const operationKey = `fetchBucketYield-${bucketType}`
    
    try {
      // Use RWA error handler for resilient yield fetching
      const yieldData = await rwaErrorHandler.handleRWAContractFailure(
        async () => {
          return await rwaIntegration.getCurrentYield(bucketType)
        },
        async () => {
          // Fallback: return basic yield data
          console.warn(`[YieldPollingService] Yield fetch failed for ${bucketType}, using fallback data`)
          return {
            currentAPY: 0,
            totalYieldEarned: 0,
            yieldToday: 0,
            projectedYearlyYield: 0,
            lastAccrualTime: new Date()
          }
        },
        operationKey
      )
      
      // Fetch RWA balances with error handling
      const [usdyBalance, musdBalance] = await Promise.allSettled([
        rwaIntegration.getUSDYBalance(bucketType),
        rwaIntegration.getMUSDBalance(bucketType)
      ])

      // Extract balance data with fallbacks
      const usdyData = usdyBalance.status === 'fulfilled' ? usdyBalance.value : this.getEmptyRWABalance()
      const musdData = musdBalance.status === 'fulfilled' ? musdBalance.value : this.getEmptyRWABalance()

      // Calculate total token balance and pending yield
      const totalTokenBalance = usdyData.tokenAmount + musdData.tokenAmount
      const totalYieldEarned = usdyData.yieldEarned + musdData.yieldEarned
      const pendingYield = yieldData.yieldToday || 0

      return {
        pending: Math.max(0, pendingYield), // Ensure non-negative
        apy: Math.max(0, yieldData.currentAPY), // Ensure non-negative
        tokenBalance: Math.max(0, totalTokenBalance), // Ensure non-negative
        totalYieldEarned: Math.max(0, totalYieldEarned), // Ensure non-negative
        lastUpdated: new Date(),
        isYielding: totalTokenBalance > 0,
      }
    } catch (error) {
      console.error(`[YieldPollingService] Error fetching yield for ${bucketType}:`, error)
      
      // Record error state for this bucket
      rwaErrorHandler.preserveErrorState(operationKey, {
        bucketType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      })
      
      return this.getEmptyBucketYieldInfo()
    }
  }

  private updateCurrentYields(yields: BucketYields): void {
    const hasChanged = !this.currentYields || this.hasYieldsChanged(this.currentYields, yields)
    
    this.currentYields = yields

    if (hasChanged) {
      // Notify all subscribers
      const event: YieldUpdateEvent = {
        type: 'yield-update',
        data: yields,
        timestamp: new Date(),
      }

      this.callbacks.forEach((callback) => {
        try {
          callback(yields)
        } catch (error) {
          console.error('[YieldPollingService] Error in yield update callback:', error)
        }
      })

      console.log('[YieldPollingService] Yield data updated and callbacks notified')
    }
  }

  private hasYieldsChanged(oldYields: BucketYields, newYields: BucketYields): boolean {
    const buckets: (keyof BucketYields)[] = ['billings', 'savings', 'growth', 'instant']
    
    return buckets.some((bucket) => {
      const oldBucket = oldYields[bucket]
      const newBucket = newYields[bucket]
      
      return (
        Math.abs(oldBucket.pending - newBucket.pending) > 0.01 ||
        Math.abs(oldBucket.apy - newBucket.apy) > 0.01 ||
        Math.abs(oldBucket.tokenBalance - newBucket.tokenBalance) > 0.01 ||
        Math.abs(oldBucket.totalYieldEarned - newBucket.totalYieldEarned) > 0.01
      )
    })
  }

  private initializeEmptyYields(): void {
    this.currentYields = this.getEmptyYields()
  }

  private getEmptyYields(): BucketYields {
    const emptyBucketInfo = this.getEmptyBucketYieldInfo()
    
    return {
      billings: { ...emptyBucketInfo },
      savings: { ...emptyBucketInfo },
      growth: { ...emptyBucketInfo },
      instant: { ...emptyBucketInfo },
    }
  }

  private getEmptyBucketYieldInfo(): BucketYieldInfo {
    return {
      pending: 0,
      apy: 0,
      tokenBalance: 0,
      totalYieldEarned: 0,
      lastUpdated: new Date(0), // Use epoch time for empty state
      isYielding: false,
    }
  }

  private getEmptyRWABalance(): RWABalance {
    return {
      usdcAmount: 0,
      tokenAmount: 0,
      currentValue: 0,
      yieldEarned: 0,
    }
  }
}

// Export singleton instance
export const yieldPollingService = new YieldPollingService()

// Export hook for React components
export function useYieldPolling(address?: string) {
  const [yields, setYields] = React.useState<BucketYields>(yieldPollingService.getCurrentYields())
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (!address) {
      yieldPollingService.stopPolling()
      return
    }

    setIsLoading(true)
    yieldPollingService.startPolling(address)

    // Subscribe to yield updates
    const unsubscribe = yieldPollingService.onYieldUpdate((newYields) => {
      setYields(newYields)
      setIsLoading(false)
    })

    // Get initial data
    yieldPollingService.refreshYields().then(() => {
      setIsLoading(false)
    })

    return () => {
      unsubscribe()
      yieldPollingService.stopPolling()
    }
  }, [address])

  return {
    yields,
    isLoading,
    isActive: yieldPollingService.isActive(),
    refreshYields: () => yieldPollingService.refreshYields(),
    status: yieldPollingService.getStatus(),
  }
}

// Add React import for the hook
import React from 'react'