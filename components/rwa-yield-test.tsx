"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp, DollarSign, RefreshCw } from "lucide-react"
import { useRWAYieldData } from "@/hooks/use-rwa-yield-data"
import { useAccount } from "wagmi"

export function RWAYieldTest() {
  const { address } = useAccount()
  const { yieldSummary, bucketRWAData, isLoading, error, refreshData } = useRWAYieldData()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshData()
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!address) {
    return (
      <Card className="glass-card border-purple-500/20">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Connect wallet to test RWA yield data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card border-purple-500/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-foreground">RWA Yield Test</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="glass-card border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400">
              <p className="text-sm font-medium">Error:</p>
              <p className="text-xs">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span className="ml-2 text-muted-foreground">Loading RWA data...</span>
            </div>
          ) : yieldSummary ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <p className="text-xs text-muted-foreground">Total Yield Earned</p>
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    ${yieldSummary.totalYieldEarned.toFixed(2)}
                  </p>
                  <p className="text-xs text-green-400">
                    ${yieldSummary.yieldToday.toFixed(4)} today
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-muted-foreground">Average APY</p>
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {yieldSummary.averageAPY.toFixed(1)}%
                  </p>
                  <p className="text-xs text-blue-400">
                    ${yieldSummary.monthlyYieldProjection.toFixed(2)}/month
                  </p>
                </div>
              </div>

              {/* Bucket Breakdown */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Bucket RWA Positions</h4>
                {bucketRWAData.map((bucket) => (
                  <div key={bucket.bucketName} className="p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground capitalize">{bucket.bucketName}</span>
                      <span className="text-sm text-muted-foreground">{bucket.weightedAPY.toFixed(1)}% APY</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Total Value:</span>
                        <span className="ml-1 text-foreground">${bucket.totalValue.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Yield Earned:</span>
                        <span className="ml-1 text-green-400">${bucket.totalYield.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* RWA Token Breakdown */}
                    <div className="mt-2 space-y-1">
                      {bucket.usdyBalance && (
                        <div className="flex justify-between text-xs">
                          <span className="text-purple-400">USDY:</span>
                          <span className="text-foreground">${bucket.usdyBalance.currentValue.toFixed(2)} (+${bucket.usdyBalance.yieldEarned.toFixed(2)})</span>
                        </div>
                      )}
                      {bucket.musdBalance && (
                        <div className="flex justify-between text-xs">
                          <span className="text-blue-400">mUSD:</span>
                          <span className="text-foreground">${bucket.musdBalance.currentValue.toFixed(2)} (+${bucket.musdBalance.yieldEarned.toFixed(2)})</span>
                        </div>
                      )}
                      {bucket.usdeBalance && (
                        <div className="flex justify-between text-xs">
                          <span className="text-green-400">USDe:</span>
                          <span className="text-foreground">${bucket.usdeBalance.currentValue.toFixed(2)} (+${bucket.usdeBalance.yieldEarned.toFixed(2)})</span>
                        </div>
                      )}
                      {bucket.methBalance && (
                        <div className="flex justify-between text-xs">
                          <span className="text-orange-400">mETH:</span>
                          <span className="text-foreground">${bucket.methBalance.currentValue.toFixed(2)} (+${bucket.methBalance.yieldEarned.toFixed(2)})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Last updated: {yieldSummary.lastUpdated.toLocaleTimeString()}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No RWA yield data available</p>
              <p className="text-xs text-muted-foreground mt-1">Make a deposit to start earning yield</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}