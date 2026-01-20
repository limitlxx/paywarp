"use client"

import { CircularLiquidFill } from "@/components/liquid-fill"
import { YieldBubbles } from "@/components/animated-bubbles"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, ArrowDownLeft, LucideIcon, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useYieldPolling } from "@/lib/yield-polling-service"
import { useAccount } from "wagmi"
import { DepositModal } from "@/components/modals/deposit-modal"
import { TransferModal } from "@/components/modals/transfer-modal"
import { CurrencyDisplay } from "@/components/currency-display"
import { useOptimizedTouch, useMobileCapabilities } from "@/lib/mobile-optimization"
import { useOptimizedLiquidFill, useOptimizedBubbles } from "@/lib/animation-optimizer"
import { useTransactionLoading } from "@/lib/loading-state-manager"
import type { BucketType } from "@/lib/types"

interface BucketCardProps {
  name: string
  balance: number // Changed from string to number
  percentage: number
  color: string
  icon: LucideIcon
  isYielding?: boolean
  description: string
  id: BucketType
  apy?: number
  isLoading?: boolean
  error?: string | null
  lastUpdated?: Date
  onRefresh?: () => void
  // RWA-specific props
  usdyBalance?: number
  musdBalance?: number
  totalYieldEarned?: number
  currentRWAValue?: number
  // Real-time yield updates
  enableRealTimeYields?: boolean
}

export function BucketCard({
  name,
  balance,
  percentage,
  color,
  icon: Icon,
  isYielding,
  description,
  id,
  apy,
  isLoading = false,
  error = null,
  lastUpdated,
  onRefresh,
  usdyBalance = 0,
  musdBalance = 0,
  totalYieldEarned = 0,
  currentRWAValue = 0,
  enableRealTimeYields = true,
}: BucketCardProps) {
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { address } = useAccount()
  
  // Real-time yield polling integration
  const { yields, isLoading: yieldLoading } = useYieldPolling(
    enableRealTimeYields && address ? address : undefined
  )
  
  // Get real-time yield data for this bucket
  const bucketYieldData = yields[id as keyof typeof yields]
  
  // Use real-time data if available, otherwise fall back to props
  const effectiveAPY = bucketYieldData?.apy || apy || 0
  const effectiveIsYielding = bucketYieldData?.isYielding || isYielding || false
  const effectivePendingYield = bucketYieldData?.pending || 0
  const effectiveTokenBalance = bucketYieldData?.tokenBalance || (usdyBalance + musdBalance)
  const effectiveTotalYieldEarned = bucketYieldData?.totalYieldEarned || totalYieldEarned
  const effectiveCurrentRWAValue = currentRWAValue || (effectiveTokenBalance * 1.0) // Approximate value
  
  // Enhanced yield bubble activation
  const shouldShowYieldBubbles = effectiveIsYielding && (effectivePendingYield > 0.01 || effectiveTokenBalance > 0)
  
  // Mobile and performance optimizations
  const capabilities = useMobileCapabilities()
  const { isTransactionLoading } = useTransactionLoading()

  // <CHANGE> Updated bubble type mapping to include expense type for billings
  const getBubbleType = () => {
    switch (id) {
      case "billings":
        return "expense"
      case "instant":
        return "lightning"
      case "growth":
        return "compounding"
      case "savings":
        return "milestone"
      case "spendable":
        return "neutral"
      default:
        return "default"
    }
  }

  // <CHANGE> Updated liquid variant mapping to include rising for billings
  const getLiquidVariant = () => {
    switch (id) {
      case "billings":
        return "rising"
      case "growth":
        return "swirling"
      case "instant":
        return "fast-flow"
      case "spendable":
        return "clear"
      default:
        return "normal"
    }
  }

  const { currentPercentage, shouldUseGPU } = useOptimizedLiquidFill(percentage, color)
  const { bubbleCount, animationSpeed } = useOptimizedBubbles(
    shouldShowYieldBubbles,
    getBubbleType()
  )

  // Optimize touch interactions on mobile - cast to HTMLElement ref
  useOptimizedTouch(cardRef as React.RefObject<HTMLElement>)

  // Performance-aware animation configuration
  const animationConfig = {
    duration: capabilities.performanceLevel === 'low' ? 150 : 300,
    reducedMotion: capabilities.performanceLevel === 'low',
  }

  const handleDepositClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDepositModal(true)
  }

  const handleTransferClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowTransferModal(true)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    
    setIsNavigating(true)
    router.push(`/buckets/${id}`)
  }

  // Handle optimized tap events on mobile
  useEffect(() => {
    const handleOptimizedTap = (e: CustomEvent) => {
      // Provide haptic feedback on supported devices
      if ('vibrate' in navigator && capabilities.isMobile) {
        navigator.vibrate(10)
      }
    }

    const cardElement = cardRef.current
    if (cardElement) {
      cardElement.addEventListener('optimizedTap', handleOptimizedTap as EventListener)
      return () => cardElement.removeEventListener('optimizedTap', handleOptimizedTap as EventListener)
    }
  }, [capabilities.isMobile])

  return (
    <>
      <Card 
        ref={cardRef}
        className="glass-card border-purple-500/20 relative overflow-hidden group hover:border-purple-500/40 transition-all cursor-pointer"
        onClick={handleCardClick}
        style={{
          transform: shouldUseGPU ? 'translateZ(0)' : 'none', // Force GPU acceleration when beneficial
          transition: `all ${animationConfig.duration}ms ease-out`,
        }}
      >
        {/* Loading overlay when navigating */}
        {isNavigating && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-sm text-purple-300 font-medium">Loading bucket details...</p>
            </div>
          </div>
        )}
        
        <YieldBubbles
          active={bubbleCount > 0}
          type={getBubbleType()}
          color={color}
        />
        <CardContent className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${color}20` }}>
                      {isLoading || isTransactionLoading() ? (
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
                      ) : (
                        <Icon className="w-5 h-5" style={{ color }} />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{name}</h3>
                    {error && (
                      <AlertCircle 
                        className="w-4 h-4 text-red-400 cursor-pointer" 
                        onClick={onRefresh}
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                  {lastUpdated && (
                    <p className="text-xs text-muted-foreground/60">
                      Updated: {lastUpdated.toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <CircularLiquidFill 
                  percentage={currentPercentage} 
                  color={color} 
                  size={capabilities.screenSize === 'small' ? 70 : 80}
                  variant={getLiquidVariant()}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <CurrencyDisplay 
                    amount={balance} 
                    fromCurrency="USD" 
                    className="text-3xl font-bold text-foreground"
                    loading={isLoading}
                  />
                  {(effectiveIsYielding || effectiveAPY > 0) && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                        +{effectiveAPY.toFixed(1)}% APY
                      </span>
                      {effectivePendingYield > 0.01 && (
                        <span className="text-xs text-green-300 bg-green-500/10 px-2 py-0.5 rounded-full animate-pulse">
                          +${effectivePendingYield.toFixed(2)} pending
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Enhanced RWA Balance Display */}
                {(effectiveTokenBalance > 0 || effectiveTotalYieldEarned > 0 || effectiveCurrentRWAValue > 0) && (
                  <div className="space-y-3 p-3 rounded-lg bg-background/50 border border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">RWA Holdings</span>
                      <div className="flex items-center gap-2">
                        {effectiveTotalYieldEarned > 0 && (
                          <span className="text-xs text-green-400 font-medium">
                            +<CurrencyDisplay amount={effectiveTotalYieldEarned} fromCurrency="USD" className="text-xs" />
                          </span>
                        )}
                        {yieldLoading && (
                          <div className="w-3 h-3 border border-green-400/30 border-t-green-400 rounded-full animate-spin"></div>
                        )}
                      </div>
                    </div>
                    
                    {/* Token Balances */}
                    {usdyBalance > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">USDY:</span>
                        <span className="font-mono text-foreground">{usdyBalance.toFixed(4)}</span>
                      </div>
                    )}
                    
                    {musdBalance > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">mUSD:</span>
                        <span className="font-mono text-foreground">{musdBalance.toFixed(4)}</span>
                      </div>
                    )}

                    {/* Additional RWA tokens based on bucket type */}
                    {id === 'growth' && effectiveTokenBalance > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">USDe:</span>
                        <span className="font-mono text-foreground">{(effectiveTokenBalance * 0.6).toFixed(4)}</span>
                      </div>
                    )}

                    {id === 'instant' && effectiveTokenBalance > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">mETH:</span>
                        <span className="font-mono text-foreground">{(effectiveTokenBalance * 0.4).toFixed(4)}</span>
                      </div>
                    )}
                    
                    {/* Total RWA Value */}
                    {effectiveCurrentRWAValue > 0 && (
                      <div className="flex justify-between text-xs border-t border-border/30 pt-2">
                        <span className="text-muted-foreground font-medium">Total RWA Value:</span>
                        <CurrencyDisplay 
                          amount={effectiveCurrentRWAValue} 
                          fromCurrency="USD" 
                          className="text-xs font-medium text-foreground" 
                        />
                      </div>
                    )}

                    {/* Yield Performance Indicator */}
                    {effectiveAPY > 0 && (
                      <div className="flex justify-between text-xs border-t border-border/30 pt-2">
                        <span className="text-muted-foreground">24h Yield:</span>
                        <span className="text-green-400 font-medium">
                          +${((balance * effectiveAPY / 100) / 365).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Last Update Timestamp */}
                    {bucketYieldData?.lastUpdated && (
                      <div className="text-xs text-muted-foreground/60 text-center">
                        Updated: {bucketYieldData.lastUpdated.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                )}
              </div>

            <div className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Button
                  size={capabilities.screenSize === 'small' ? 'sm' : 'default'}
                  className="flex-1 glass border-purple-500/20 hover:bg-purple-500/20 text-foreground gap-1"
                  onClick={handleDepositClick}
                  disabled={isLoading || isTransactionLoading() || isNavigating}
                  style={{
                    minHeight: capabilities.hasTouch ? '44px' : 'auto', // Touch-friendly minimum height
                  }}
                >
                  <ArrowDownLeft className="w-4 h-4 text-purple-400" />
                  Deposit
                </Button>
                <Button
                  size={capabilities.screenSize === 'small' ? 'sm' : 'default'}
                  className="flex-1 glass border-purple-500/20 hover:bg-purple-500/20 text-foreground gap-1"
                  onClick={handleTransferClick}
                  disabled={isLoading || isTransactionLoading() || isNavigating}
                  style={{
                    minHeight: capabilities.hasTouch ? '44px' : 'auto', // Touch-friendly minimum height
                  }}
                >
                  <ArrowUpRight className="w-4 h-4 text-indigo-400" />
                  Transfer
                </Button>
              </div>
            </div>
          </CardContent>

        <div
          className="absolute bottom-0 left-0 w-full h-1 opacity-20 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: color }}
        />
      </Card>

      {/* Modals */}
      <DepositModal
        open={showDepositModal}
        onOpenChange={setShowDepositModal}
        bucketId={id}
        bucketName={name}
      />
      <TransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        initialFromId={id}
      />
    </>
  )
}