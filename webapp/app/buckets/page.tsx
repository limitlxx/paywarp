"use client"

import { BottomNav } from "@/components/bottom-nav"
import { SimpleHeader } from "@/components/simple-header"
import { BucketCard } from "@/components/bucket-card"
import { Droplet, Zap, PiggyBank, TrendingUp, Wallet, Plus, ArrowRightLeft } from "lucide-react"
import { DepositModal } from "@/components/modals/deposit-modal"
import { TransferModal } from "@/components/modals/transfer-modal"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function BucketsPage() {
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <SimpleHeader />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Buckets</h1>
              <p className="text-muted-foreground">Manage your budget allocations and track yields</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsTransferOpen(true)}
                variant="outline"
                className="glass border-purple-500/30 text-white h-12 px-6 font-bold gap-2 hover:bg-white/5 transition-all"
              >
                <ArrowRightLeft className="w-5 h-5" />
                Transfer
              </Button>
              <Button
                onClick={() => setIsDepositOpen(true)}
                className="gradient-primary text-white border-0 h-12 px-6 font-bold gap-2 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform"
              >
                <Plus className="w-5 h-5" />
                Deposit & Auto-Split
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Updated Billings color to red #EF4444 */}
            <BucketCard
              id="billings"
              name="Billings"
              balance="$12,450.00"
              percentage={45}
              color="#EF4444"
              icon={Droplet}
              description="Automated expenses & bills"
            />
            {/* Updated Savings color to blue #3B82F6 */}
            <BucketCard
              id="savings"
              name="Savings"
              balance="$45,230.00"
              percentage={82}
              color="#3B82F6"
              icon={PiggyBank}
              isYielding
              description="Long-term goal oriented funds"
            />
            {/* Updated Growth color to golden #F59E0B */}
            <BucketCard
              id="growth"
              name="Growth"
              balance="$28,120.00"
              percentage={35}
              color="#F59E0B"
              icon={TrendingUp}
              isYielding
              description="DeFi yield optimization"
            />
            {/* Updated Instant color to green #10B981 */}
            <BucketCard
              id="instant"
              name="Instant"
              balance="$15,800.00"
              percentage={60}
              color="#10B981"
              icon={Zap}
              description="Team payroll & salaries"
            />
            {/* Updated Spendable color to neutral gray #9CA3AF */}
            <BucketCard
              id="spendable"
              name="Spendable"
              balance="$22,989.90"
              percentage={100}
              color="#9CA3AF"
              icon={Wallet}
              description="Available for immediate use"
            />
          </div>
        </div>
      </main>

      <DepositModal open={isDepositOpen} onOpenChange={setIsDepositOpen} bucketId="auto-split" />
      <TransferModal open={isTransferOpen} onOpenChange={setIsTransferOpen} />

      <BottomNav />
    </div>
  )
}
