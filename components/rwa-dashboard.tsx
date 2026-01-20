"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, Percent, Activity } from "lucide-react"
import { CurrencyDisplay } from "@/components/currency-display"
import { useBucketBalances } from "@/hooks/use-bucket-balances"
import { rwaIntegration } from "@/lib/rwa-integration"
import { useEffect, useState } from "react"

export function RWADashboard() {
  const { 
    buckets, 
    totalRWAValue, 
    isYieldPollingActive
  } = useBucketBalances()
  
  const [tvl, setTvl] = useState(0)
  const [networkConfig] = useState(rwaIntegration.getNetworkConfig())

  useEffect(() => {
    const updateTVL = async () => {
      try {
        const totalValueLocked = await rwaIntegration.getTotalValueLocked()
        setTvl(totalValueLocked)
      } catch (error) {
        console.error('Error updating TVL:', error)
      }
    }

    updateTVL()
    const interval = setInterval(updateTVL, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Calculate RWA stats from real bucket data
  const rwaStats = {
    totalRWAValue,
    totalYieldEarned: buckets.reduce((sum, bucket) => sum + (bucket.totalYieldEarned || 0), 0),
    avgAPY: buckets.length > 0 
      ? buckets.reduce((sum, bucket) => sum + (bucket.apy || 0), 0) / buckets.length 
      : 0,
    rwaEnabled: buckets.some(bucket => bucket.isYielding || (bucket.rwaTokenBalance ?? 0) > 0),
    activeRWABuckets: buckets.filter(bucket => bucket.isYielding || (bucket.rwaTokenBalance ?? 0) > 0).length
  }

  // Don't show dashboard if no RWA activity
  if (!rwaStats.rwaEnabled && totalRWAValue === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card className="glass-card border-green-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total RWA Value
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            <CurrencyDisplay amount={rwaStats.totalRWAValue} fromCurrency="USD" />
          </div>
          <p className="text-xs text-muted-foreground">
            Across {rwaStats.activeRWABuckets} yield-bearing buckets
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card border-blue-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Yield Earned
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-400">
            +<CurrencyDisplay amount={rwaStats.totalYieldEarned} fromCurrency="USD" />
          </div>
          <p className="text-xs text-muted-foreground">
            Lifetime yield generation
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card border-purple-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Average APY
          </CardTitle>
          <Percent className="h-4 w-4 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {rwaStats.avgAPY.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            Weighted across RWA tokens
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Protocol TVL
          </CardTitle>
          <Activity className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            <CurrencyDisplay amount={tvl} fromCurrency="USD" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {networkConfig.network}
            </Badge>
            {networkConfig.isTestnet && (
              <Badge variant="secondary" className="text-xs">
                Testnet
              </Badge>
            )}
            {isYieldPollingActive && (
              <Badge variant="outline" className="text-xs text-green-400 border-green-500/20">
                Live
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}