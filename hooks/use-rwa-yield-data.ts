/**
 * Hook for fetching real RWA yield data from contracts
 */

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { rwaIntegration, type RWABalance } from '@/lib/rwa-integration'
import { useBucketBalances } from './use-bucket-balances'

export interface RWAYieldSummary {
  totalYieldEarned: number
  totalCurrentValue: number
  averageAPY: number
  monthlyYieldProjection: number
  yieldToday: number
  lastUpdated: Date
}

export interface BucketRWAData {
  bucketName: string
  usdyBalance?: RWABalance
  musdBalance?: RWABalance
  usdeBalance?: RWABalance
  methBalance?: RWABalance
  totalYield: number
  totalValue: number
  weightedAPY: number
}

export function useRWAYieldData() {
  const { address } = useAccount()
  const { buckets, totalRWAValue, totalPendingYield } = useBucketBalances()
  
  const [yieldSummary, setYieldSummary] = useState<RWAYieldSummary | null>(null)
  const [bucketRWAData, setBucketRWAData] = useState<BucketRWAData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRWAYieldData = useCallback(async () => {
    if (!address) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch RWA balances for all yield-bearing buckets
      const yieldBuckets = ['billings', 'savings', 'growth', 'instant'] as const
      const bucketData: BucketRWAData[] = []
      
      let totalYieldEarned = 0
      let totalCurrentValue = 0
      let totalWeightedAPY = 0
      let totalValueForAPY = 0

      for (const bucketName of yieldBuckets) {
        try {
          // Fetch all RWA token balances for this bucket
          const [usdyBalance, musdBalance, usdeBalance, methBalance] = await Promise.all([
            rwaIntegration.getUSDYBalance(bucketName),
            rwaIntegration.getMUSDBalance(bucketName),
            rwaIntegration.getUSDEBalance(bucketName),
            rwaIntegration.getMETHBalance(bucketName)
          ])

          // Calculate totals for this bucket
          const bucketYield = (usdyBalance?.yieldEarned || 0) + 
                             (musdBalance?.yieldEarned || 0) + 
                             (usdeBalance?.yieldEarned || 0) + 
                             (methBalance?.yieldEarned || 0)

          const bucketValue = (usdyBalance?.currentValue || 0) + 
                             (musdBalance?.currentValue || 0) + 
                             (usdeBalance?.currentValue || 0) + 
                             (methBalance?.currentValue || 0)

          // Calculate weighted APY for this bucket
          let bucketWeightedAPY = 0
          if (bucketValue > 0) {
            const usdyWeight = (usdyBalance?.currentValue || 0) / bucketValue
            const musdWeight = (musdBalance?.currentValue || 0) / bucketValue
            const usdeWeight = (usdeBalance?.currentValue || 0) / bucketValue
            const methWeight = (methBalance?.currentValue || 0) / bucketValue

            bucketWeightedAPY = (usdyWeight * 4.5) + // USDY APY
                               (musdWeight * 3.2) + // mUSD APY
                               (usdeWeight * 8.0) + // USDe APY
                               (methWeight * 10.0)  // mETH APY
          }

          bucketData.push({
            bucketName,
            usdyBalance: usdyBalance?.currentValue > 0 ? usdyBalance : undefined,
            musdBalance: musdBalance?.currentValue > 0 ? musdBalance : undefined,
            usdeBalance: usdeBalance?.currentValue > 0 ? usdeBalance : undefined,
            methBalance: methBalance?.currentValue > 0 ? methBalance : undefined,
            totalYield: bucketYield,
            totalValue: bucketValue,
            weightedAPY: bucketWeightedAPY
          })

          // Add to overall totals
          totalYieldEarned += bucketYield
          totalCurrentValue += bucketValue
          totalWeightedAPY += bucketWeightedAPY * bucketValue
          totalValueForAPY += bucketValue
        } catch (bucketError) {
          console.warn(`Error fetching RWA data for ${bucketName}:`, bucketError)
          // Add empty bucket data to maintain consistency
          bucketData.push({
            bucketName,
            totalYield: 0,
            totalValue: 0,
            weightedAPY: 0
          })
        }
      }

      // Calculate overall weighted APY
      const averageAPY = totalValueForAPY > 0 ? totalWeightedAPY / totalValueForAPY : 0

      // Calculate monthly projection (APY / 12)
      const monthlyYieldProjection = totalCurrentValue * (averageAPY / 100) / 12

      // Estimate daily yield (very rough approximation)
      const yieldToday = totalCurrentValue * (averageAPY / 100) / 365

      const summary: RWAYieldSummary = {
        totalYieldEarned,
        totalCurrentValue,
        averageAPY,
        monthlyYieldProjection,
        yieldToday,
        lastUpdated: new Date()
      }

      setYieldSummary(summary)
      setBucketRWAData(bucketData)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch RWA yield data'
      setError(errorMessage)
      console.error('Error fetching RWA yield data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address])

  // Fetch data on mount and when address changes
  useEffect(() => {
    if (address) {
      fetchRWAYieldData()
    } else {
      setYieldSummary(null)
      setBucketRWAData([])
    }
  }, [address, fetchRWAYieldData])

  // Refresh data every 60 seconds
  useEffect(() => {
    if (!address) return

    const interval = setInterval(fetchRWAYieldData, 60000)
    return () => clearInterval(interval)
  }, [address, fetchRWAYieldData])

  return {
    yieldSummary,
    bucketRWAData,
    isLoading,
    error,
    refreshData: fetchRWAYieldData,
    // Legacy compatibility with existing bucket balances
    totalRWAValue,
    totalPendingYield
  }
}