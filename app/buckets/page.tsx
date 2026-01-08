"use client"

import { BottomNav } from "@/components/bottom-nav"
import { SimpleHeader } from "@/components/simple-header"
import { AuthGuard } from "@/components/auth-guard"
import { BucketCard } from "@/components/bucket-card"
import { RWADashboard } from "@/components/rwa-dashboard"
import { Droplet, Zap, PiggyBank, TrendingUp, Wallet, Plus, ArrowRightLeft, RefreshCw, AlertCircle } from "lucide-react"
import { DepositModal } from "@/components/modals/deposit-modal"
import { TransferModal } from "@/components/modals/transfer-modal"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useOptimizedBlockchainBuckets } from "@/hooks/use-optimized-blockchain-buckets"
import { useWallet } from "@/hooks/use-wallet.tsx"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMobileCapabilities, useMobileRenderOptimization, useMobilePerformanceMonitoring } from "@/lib/mobile-optimization"
import { useLoadingManager } from "@/lib/loading-state-manager"
import { useAnimationPerformanceMonitoring } from "@/lib/animation-optimizer"
import { NetworkGuard } from "@/components/network-guard"

export default function BucketsPage() {
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  
  // Performance optimizations
  const capabilities = useMobileCapabilities()
  const { observeElement } = useMobileRenderOptimization()
  const { recordRenderTime } = useMobilePerformanceMonitoring()
  const { metrics: animationMetrics } = useAnimationPerformanceMonitoring()
  const loadingManager = useLoadingManager()
  
  const { 
    buckets, 
    isLoading, 
    error, 
    isConnected, 
    refreshBalances, 
    clearError,
    queueStatus
  } = useOptimizedBlockchainBuckets()
  
  const { connect } = useWallet()

  // Memoized bucket icons for performance
  const bucketIcons = useMemo(() => ({
    billings: Droplet,
    savings: PiggyBank,
    growth: TrendingUp,
    instant: Zap,
    spendable: Wallet,
  }), [])

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
    clearError()
    await loadingManager.withLoading(
      () => refreshBalances(),
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
        () => connect(),
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
    },
    {
      id: "instant" as const,
      name: "Instant",
      balance: isConnected ? 0 : 15800,
      percentage: 60,
      color: "#22C55E",
      icon: Zap,
      description: "Team payroll & salaries",
    },
    {
      id: "spendable" as const,
      name: "Spendable",
      balance: isConnected ? 0 : 22989.9,
      percentage: 100,
      color: "#94A3B8",
      icon: Wallet,
      description: "Available for immediate use",
    },
  ], [isConnected])

  // Determine which buckets to display
  const displayBuckets = buckets.length > 0 ? buckets : fallbackBuckets

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
        <SimpleHeader />

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
                  <div>Animation FPS: {animationMetrics.fps} | Queue: {queueStatus.queueLength} pending</div>
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
          {error && (
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {error}
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
                  error={error}
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
