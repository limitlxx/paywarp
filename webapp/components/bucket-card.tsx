"use client"

import { CircularLiquidFill } from "@/components/liquid-fill"
import { YieldBubbles } from "@/components/animated-bubbles"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, ArrowDownLeft, Type as type, LucideIcon } from "lucide-react"
import Link from "next/link"

interface BucketCardProps {
  name: string
  balance: string
  percentage: number
  color: string
  icon: LucideIcon
  isYielding?: boolean
  description: string
  id: string
  apy?: number
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
}: BucketCardProps) {
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

  return (
    <Card className="glass-card border-purple-500/20 relative overflow-hidden group hover:border-purple-500/40 transition-all cursor-pointer">
      <Link href={`/buckets/${id}`}>
        <YieldBubbles
          active={isYielding || id === "instant" || id === "spendable" || id === "billings"}
          type={getBubbleType()}
          color={color}
        />
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${color}20` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="text-xl font-bold text-foreground">{name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            <CircularLiquidFill percentage={percentage} color={color} size={80} variant={getLiquidVariant()} />
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-3xl font-bold text-foreground">{balance}</span>
              {(isYielding || apy) && (
                <span className="ml-2 text-sm font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                  +{apy || 8}% APY
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 glass border-purple-500/20 hover:bg-purple-500/20 text-foreground gap-1"
              >
                <ArrowDownLeft className="w-4 h-4 text-purple-400" />
                Deposit
              </Button>
              <Button
                size="sm"
                className="flex-1 glass border-purple-500/20 hover:bg-purple-500/20 text-foreground gap-1"
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
  )
}
