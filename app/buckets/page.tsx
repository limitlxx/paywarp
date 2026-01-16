"use client"

import { BottomNav } from "@/components/bottom-nav"
import { AuthGuard } from "@/components/auth-guard"
import { BucketCard } from "@/components/bucket-card"
import { RWADashboard } from "@/components/rwa-dashboard"
import { Droplet, Zap, PiggyBank, TrendingUp, Wallet, Plus, ArrowRightLeft, RefreshCw, AlertCircle } from "lucide-react"
import { DepositModal } from "@/components/modals/deposit-modal"
import { TransferModal } from "@/components/modals/transfer-modal"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/hooks/use-wallet"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMobileCapabilities, useMobileRenderOptimization, useMobilePerformanceMonitoring } from "@/lib/mobile-optimization"
import { useLoadingManager } from "@/lib/loading-state-manager"
import { useAnimationPerformanceMonitoring } from "@/lib/animation-optimizer"
import { NetworkGuard } from "@/components/network-guard"
import { DashboardHeader } from "@/components/dashboard-header"
import { useBucketBalances } from "@/hooks/use-bucket-balances"
import { useAccount } from "wagmi"

export default function BucketsPage() {
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const { address, isConnected } = useAccount()
  
  // Performance optimizations
  const capabilities = useMobileCapabilities()
  const { observeElement } = useMobileRenderOptimization()
  const { recordRenderTime } = useMobilePerformanceMonitoring()
  const { metrics: animationMetrics } = useAnimationPerformanceMonitoring()
  const loadingManager = useLoadingManager()
  
  // Get real bucket data from contract
  const { 
    buckets: contractBuckets, 
    formattedTotalBalance,
    splitConfig,
    nonce,
    isLoading, 
    isError,
    hasData,
    refetch: refreshBalances
  } = useBucketBalances()
  
  const { connect } = useWallet()

  // Debug: Log bucket data
  useEffect(() => {
    if (address) {
      console.log('📊 BUCKETS PAGE - CONTRACT DATA:')
      console.log('  Address:', address)
      console.log('  Has Data:', hasData)
      console.log('  Total Balance:', formattedTotalBalance, 'USDC')
      console.log('  Nonce:', nonce.toString())
      console.log('  Buckets:', contractBuckets.map(b => `${b.name}: ${b.formattedBalance}`))
      console.log('  Split Config:', splitConfig)
    }
  }, [address, hasData, formattedTotalBalance, nonce, contractBuckets, splitConfig])

  // Memoized bucket icons for performance
  const bucketIcons = useMemo(() => ({
    billings: Droplet,
    savings: PiggyBank,
    growth: TrendingUp,
    instant: Zap,
    spendable: Wallet,
  }), [])

  // Memoized bucket colors
  const bucketColors = useMemo(() => ({
    billings: "#EF4444",
    savings: "#3B82F6",
    growth: "#EAB308",
    instant: "#22C55E",
    spendable: "#94A3B8",
  }), [])

  // Memoized bucket descriptions
  const bucketDescriptions = useMemo(() => ({
    billings: "Automated expenses & bills",
    savings: "Long-term goal oriented funds",
    growth: "DeFi yield optimization",
    instant: "Team payroll & salaries",
    spendable: "Available for immediate use",
  }), [])

  // Transform contract buckets to display format
  const transformedBuckets = useMemo(() => {
    if (!contractBuckets || contractBuckets.length === 0) return []
    
    return contractBuckets.map(bucket => {
      const balance = Number(bucket.formattedBalance)
      const totalBal = Number(formattedTotalBalance)
      const percentage = totalBal > 0 ? Math.round((balance / totalBal) * 100) : 0
      
      return {
        id: bucket.name as "billings" | "savings" | "growth" | "instant" | "spendable",
        name: bucket.name.charAt(0).toUpperCase() + bucket.name.slice(1),
        balance: balance,
        percentage: percentage,
        color: bucketColors[bucket.name as keyof typeof bucketColors],
        icon: bucketIcons[bucket.name as keyof typeof bucketIcons],
        isYielding: bucket.isYielding,
        description: bucketDescriptions[bucket.name as keyof typeof bucketDescriptions],
        apy: bucket.isYielding ? 4.5 : undefined, // TODO: Get real APY from contract
        lastUpdated: new Date(),
        usdyBalance: bucket.yieldBalance > 0n ? Number(bucket.formattedYield) : undefined,
        musdBalance: undefined,
        totalYieldEarned: bucket.yieldBalance > 0n ? Number(bucket.formattedYield) : undefined,
        currentRWAValue: undefined,
      }
    })
  }, [contractBuckets, formattedTotalBalance, bucketColors, bucketIcons, bucketDescriptions])

  // Performance monitoring
  useEffect(() => {
    const startTime = performance.now()
    return () => {
      const renderTime = performance.now() - startTime
      recordRenderTime(renderTime)
    }
  }, [recordRenderTime])

  // Optimized refresh handler with loading state
  const handleRefresh = async () => {
    await loadingManager.withLoading(
      async () => { await refreshBalances() },
      {
        type: 'balance',
        description: 'Refreshing bucket balances',
        critical: false,
      }
    )
  }

  // Optimized connect handler
  const handleConnect = async () => {
    try {
      await loadingManager.withLoading(
        async () => { await connect() },
        {
          type: 'network',
          description: 'Connecting wallet',
          critical: true,
        }
      )
    } catch (err) {
      console.error('Failed to connect wallet:', err)
    }
  }

  // Memoized fallback buckets for better performance
  const fallbackBuckets = useMemo(() => [
    {
      id: "billings" as const,
      name: "Billings",
      balance: isConnected ? 0 : 12450,
      percentage: 45,
      color: "#EF4444",
      icon: Droplet,
      description: "Automated expenses & bills",
      apy: undefined,
      lastUpdated: new Date(),
      usdyBalance: undefined,
      musdBalance: undefined,
      totalYieldEarned: undefined,
      currentRWAValue: undefined,
    },
    {
      id: "savings" as const,
      name: "Savings",
      balance: isConnected ? 0 : 45230,
      percentage: 82,
      color: "#3B82F6",
      icon: PiggyBank,
      isYielding: true,
      description: "Long-term goal oriented funds",
      apy: 4.5,
      lastUpdated: new Date(),
      usdyBalance: undefined,
      musdBalance: undefined,
      totalYieldEarned: undefined,
      currentRWAValue: undefined,
    },
    {
      id: "growth" as const,
      name: "Growth",
      balance: isConnected ? 0 : 28120,
      percentage: 35,
      color: "#EAB308",
      icon: TrendingUp,
      isYielding: true,
      description: "DeFi yield optimization",
      apy: 12.8,
      lastUpdated: new Date(),
      usdyBalance: undefined,
      musdBalance: undefined,
      totalYieldEarned: undefined,
      currentRWAValue: undefined,
    },
    {
      id: "instant" as const,
      name: "Instant",
      balance: isConnected ? 0 : 15800,
      percentage: 60,
      color: "#22C55E",
      icon: Zap,
      description: "Team payroll & salaries",
      apy: 2.5,
      lastUpdated: new Date(),
      usdyBalance: undefined,
      musdBalance: undefined,
      totalYieldEarned: undefined,
      currentRWAValue: undefined,
    },
    {
      id: "spendable" as const,
      name: "Spendable",
      balance: isConnected ? 0 : 22989.9,
      percentage: 100,
      color: "#94A3B8",
      icon: Wallet,
      description: "Available for immediate use",
      apy: undefined,
      lastUpdated: new Date(),
      usdyBalance: undefined,
      musdBalance: undefined,
      totalYieldEarned: undefined,
      currentRWAValue: undefined,
    },
  ], [isConnected])

  // Determine which buckets to display
  const displayBuckets = useMemo(() => {
    // If we have real contract data, use it
    if (transformedBuckets.length > 0 && hasData) {
      return transformedBuckets
    }
    
    // Otherwise show fallback buckets
    return fallbackBuckets
  }, [transformedBuckets, hasData, fallbackBuckets])

  // Mobile-optimized grid classes
  const gridClasses = useMemo(() => {
    if (capabilities.screenSize === 'small') {
      return "grid grid-cols-1 gap-4"
    } else if (capabilities.screenSize === 'medium') {
      return "grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
    } else {
      return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
    }
  }, [capabilities.screenSize])

  return (
    <AuthGuard>
      <NetworkGuard>
        <div className="min-h-screen gradient-bg pb-24">
        {/* <SimpleHeader /> */}
        <DashboardHeader />

        <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Buckets</h1>
              <p className="text-muted-foreground">
                {isConnected 
                  ? "Manage your budget allocations and track yields" 
                  : "Connect your wallet to view real bucket balances"}
              </p>
              
              {/* Performance indicators for development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-muted-foreground/60 space-y-1">
                  <div>Performance: {capabilities.performanceLevel} | Connection: {capabilities.connectionType}</div>
                  <div>Animation FPS: {animationMetrics.fps} | Buckets: {transformedBuckets.length} | Has Data: {hasData ? 'Yes' : 'No'}</div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {isConnected && (
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  className="glass border-purple-500/30 text-white h-12 px-4 font-bold gap-2 hover:bg-white/5 transition-all"
                  disabled={isLoading}
                  style={{
                    minHeight: capabilities.hasTouch ? '44px' : 'auto', // Touch-friendly
                  }}
                >
                  <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                  {capabilities.screenSize === 'small' ? '' : 'Refresh'}
                </Button>
              )}
              {isConnected && (
                <Button
                  onClick={() => setIsTransferOpen(true)}
                  variant="outline"
                  className="glass border-purple-500/30 text-white h-12 px-6 font-bold gap-2 hover:bg-white/5 transition-all"
                  disabled={isLoading}
                  style={{
                    minHeight: capabilities.hasTouch ? '44px' : 'auto',
                  }}
                >
                  <ArrowRightLeft className="w-5 h-5" />
                  {capabilities.screenSize === 'small' ? '' : 'Transfer'}
                </Button>
              )}
              <Button
                onClick={isConnected ? () => setIsDepositOpen(true) : handleConnect}
                className="gradient-primary text-white border-0 h-12 px-6 font-bold gap-2 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform"
                disabled={isLoading}
                style={{
                  minHeight: capabilities.hasTouch ? '44px' : 'auto',
                }}
              >
                <Plus className="w-5 h-5" />
                {isConnected 
                  ? (capabilities.screenSize === 'small' ? 'Deposit' : 'Deposit & Auto-Split')
                  : 'Connect Wallet'
                }
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {isError && (
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                Failed to load bucket balances from contract. Please try refreshing.
                <Button 
                  variant="link" 
                  className="text-red-400 p-0 ml-2 h-auto"
                  onClick={handleRefresh}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Alert */}
          {!isConnected && (
            <Alert className="border-amber-500/20 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-300">
                Connect your wallet to view real-time bucket balances and perform transactions.
                <Button 
                  variant="link" 
                  className="text-amber-400 p-0 ml-2 h-auto"
                  onClick={handleConnect}
                >
                  Connect now
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* RWA Dashboard - only show on larger screens or when specifically requested */}
          {isConnected && capabilities.screenSize !== 'small' && <RWADashboard />}

          <div className={gridClasses}>
            {displayBuckets.map((bucket, index) => (
              <div
                key={bucket.id}
                ref={observeElement}
                style={{
                  // Stagger animations on mobile for better performance
                  animationDelay: capabilities.performanceLevel === 'low' ? '0ms' : `${index * 100}ms`,
                }}
              >
                <BucketCard
                  id={bucket.id}
                  name={bucket.name}
                  balance={bucket.balance}
                  percentage={bucket.percentage}
                  color={bucket.color}
                  icon={bucketIcons[bucket.id]}
                  isYielding={bucket.isYielding}
                  description={bucket.description}
                  apy={bucket.apy}
                  isLoading={isLoading}
                  error={isError ? 'Failed to load' : undefined}
                  lastUpdated={bucket.lastUpdated}
                  onRefresh={handleRefresh}
                  usdyBalance={bucket.usdyBalance}
                  musdBalance={bucket.musdBalance}
                  totalYieldEarned={bucket.totalYieldEarned}
                  currentRWAValue={bucket.currentRWAValue}
                />
              </div>
            ))}
          </div>
        </div>
      </main>

      <DepositModal open={isDepositOpen} onOpenChange={setIsDepositOpen} bucketId="auto-split" />
      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} />

      <BottomNav />
    </div>
  </NetworkGuard>
</AuthGuard>
  )
}
