"use client"

import { CircularLiquidFill } from "@/components/liquid-fill"
import { YieldBubbles } from "@/components/animated-bubbles"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, ArrowDownLeft, LucideIcon, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
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
}: BucketCardProps) {
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  
  // Mobile and performance optimizations
  const capabilities = useMobileCapabilities()
  const { isTransactionLoading } = useTransactionLoading()
  const { currentPercentage, shouldUseGPU } = useOptimizedLiquidFill(percentage, color)
  const { bubbleCount, animationSpeed } = useOptimizedBubbles(
    isYielding || id === "instant" || id === "spendable" || id === "billings",
    getBubbleType()
  )

  // Optimize touch interactions on mobile
  useOptimizedTouch(cardRef)

  // Performance-aware animation configuration
  const animationConfig = {
    duration: capabilities.performanceLevel === 'low' ? 150 : 300,
    reducedMotion: capabilities.performanceLevel === 'low',
  }

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
        style={{
          transform: shouldUseGPU ? 'translateZ(0)' : 'none', // Force GPU acceleration when beneficial
          transition: `all ${animationConfig.duration}ms ease-out`,
        }}
      >
        <Link href={`/buckets/${id}`}>
          <YieldBubbles
            active={bubbleCount > 0}
            type={getBubbleType()}
            color={color}
            count={bubbleCount}
            speed={animationSpeed}
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
                useGPU={shouldUseGPU}
                reducedMotion={animationConfig.reducedMotion}
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
                {(isYielding || apy) && (
                  <span className="ml-2 text-sm font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                    +{apy || 8}% APY
                  </span>
                )}
              </div>

              {/* RWA Balance Display */}
              {(usdyBalance > 0 || musdBalance > 0 || totalYieldEarned > 0) && (
                <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">RWA Holdings</span>
                    <span className="text-xs text-green-400">
                      +<CurrencyDisplay amount={totalYieldEarned} fromCurrency="USD" className="text-xs" />
                    </span>
                  </div>
                  
                  {usdyBalance > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">USDY:</span>
                      <span className="font-mono">{usdyBalance.toFixed(4)}</span>
                    </div>
                  )}
                  
                  {musdBalance > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">mUSD:</span>
                      <span className="font-mono">{musdBalance.toFixed(4)}</span>
                    </div>
                  )}
                  
                  {currentRWAValue > 0 && (
                    <div className="flex justify-between text-xs border-t border-border/30 pt-2">
                      <span className="text-muted-foreground">Total RWA Value:</span>
                      <CurrencyDisplay amount={currentRWAValue} fromCurrency="USD" className="text-xs font-medium" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size={capabilities.screenSize === 'small' ? 'sm' : 'default'}
                  className="flex-1 glass border-purple-500/20 hover:bg-purple-500/20 text-foreground gap-1"
                  onClick={handleDepositClick}
                  disabled={isLoading || isTransactionLoading()}
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
                  disabled={isLoading || isTransactionLoading()}
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
        </Link>

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
