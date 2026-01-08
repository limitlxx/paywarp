"use client"

import { useParams, useRouter } from "next/navigation"
import { SimpleHeader } from "@/components/simple-header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LiquidFill } from "@/components/liquid-fill"
import { YieldBubbles } from "@/components/animated-bubbles"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Droplet,
  PiggyBank,
  TrendingUp,
  Zap,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Target,
  Clock,
  ShieldCheck,
  ExternalLink,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react"
import { useState } from "react"
import { ExpenseManager } from "@/components/expense-manager"
import { PayrollManager } from "@/components/payroll-manager"
import { SavingsGoalsManager } from "@/components/savings-goals-manager"
import { SavingsGoalOverview } from "@/components/savings-goal-overview"
import { DepositModal } from "@/components/modals/deposit-modal"
import { WithdrawModal } from "@/components/modals/withdraw-modal"
import { NetworkGuard } from "@/components/network-guard"
import type { BucketType } from "@/types/bucket"

const bucketData = {
  billings: { name: "Billings", color: "#A100FF", icon: Droplet, balance: "$12,450.00", percentage: 45 },
  savings: {
    name: "Savings",
    color: "#6366F1",
    icon: PiggyBank,
    balance: "$45,230.00",
    percentage: 82,
    isYielding: true,
  },
  growth: {
    name: "Growth",
    color: "#3B82F6",
    icon: TrendingUp,
    balance: "$28,120.00",
    percentage: 35,
    isYielding: true,
  },
  instant: { name: "Instant", color: "#F59E0B", icon: Zap, balance: "$15,800.00", percentage: 60 },
  spendable: { name: "Spendable", color: "#10B981", icon: Wallet, balance: "$22,989.90", percentage: 100 },
}

const buckets = Object.values(bucketData)

const updateBucketBalance = (id: string, amount: number) => {
  // Simulate updating bucket balance
  console.log(`Updating bucket ${id} with amount $${amount.toFixed(2)}`)
}

export default function BucketDetails() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const bucket = bucketData[id as keyof typeof bucketData] || bucketData.billings
  const [goalAmount, setGoalAmount] = useState([5000])
  const [depositAmount, setDepositAmount] = useState(0)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)

  const rwaInfo = {
    billings: { provider: "Ondo", type: "Receivables", yield: "2.4%" },
    savings: { provider: "Ondo", type: "Tokenized T-Bills", yield: "4.5%" },
    growth: { provider: "Ondo", type: "Equity Vaults", yield: "12.8%" },
    instant: { provider: "Mantle", type: "Payroll Yields", yield: "3.2%" },
    spendable: { provider: "Mantle", type: "Native Yield", yield: "1.8%" },
  }[id as keyof typeof bucketData] || { provider: "PayWarp", type: "Native", yield: "0%" }

  const handlePaystackDeposit = (amount: number) => {
    console.log("[v0] Initiating Paystack deposit for amount:", amount)
    // In a real app, this would call the Paystack API and then a server action to process the split
    // For this demonstration, we'll simulate the auto-split logic
    const splitDetails = buckets.map((b) => ({
      id: b.id,
      name: b.name,
      splitAmount: (amount * b.percentage) / 100,
    }))

    splitDetails.forEach((detail) => {
      updateBucketBalance(detail.id, detail.splitAmount)
      console.log(`[v0] Auto-split: $${detail.splitAmount.toFixed(2)} routed to ${detail.name}`)
    })
  }

  if (!bucket) return null

  return (
    <NetworkGuard>
      <div className="min-h-screen gradient-bg pb-24">
      <SimpleHeader />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="glass border-purple-500/20 bg-transparent"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-opacity-10" style={{ backgroundColor: `${bucket.color}20` }}>
                  <bucket.icon className="w-8 h-8" style={{ color: bucket.color }} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{bucket.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="glass border-green-500/20 text-green-400 gap-1 px-2">
                      <ShieldCheck className="w-3 h-3" />
                      {rwaInfo.provider} {rwaInfo.type}
                    </Badge>
                    <p className="text-xs text-muted-foreground">Active RWA connection</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Current Balance</p>
                <p className="text-3xl font-bold text-foreground">{bucket.balance}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setIsDepositOpen(true)}
                  className="gradient-primary text-white h-9 px-4 font-bold text-xs gap-1"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Deposit
                </Button>
                <Button
                  onClick={() => setIsWithdrawOpen(true)}
                  variant="outline"
                  className="glass border-indigo-500/30 text-indigo-300 h-9 px-4 font-bold text-xs gap-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Withdraw
                </Button>
              </div>
              {bucket.isYielding && (
                <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                  +8% APY
                </div>
              )}
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="glass border-purple-500/20 p-1 h-12">
              <TabsTrigger value="overview" className="px-6 data-[state=active]:gradient-primary">
                Overview
              </TabsTrigger>
              <TabsTrigger value="actions" className="px-6 data-[state=active]:gradient-primary">
                Actions
              </TabsTrigger>
              <TabsTrigger value="history" className="px-6 data-[state=active]:gradient-primary">
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Large Liquid Meter */}
                <Card className="lg:col-span-2 glass-card border-purple-500/20 overflow-hidden relative min-h-[400px]">
                  <YieldBubbles
                    active={bucket.isYielding || id === "billings" || id === "instant"}
                    type={id === "billings" ? "expense" : id === "growth" ? "compounding" : "default"}
                  />
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">Volume Analysis</CardTitle>
                        <CardDescription>Visual representation of bucket capacity and yield flow</CardDescription>
                      </div>
                      {(id === "growth" || id === "savings") && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                            Live Yield
                          </p>
                          <p className="text-xl font-mono font-bold text-green-400">+$0.00042 / sec</p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="h-[300px] relative">
                    <LiquidFill
                      percentage={bucket.percentage}
                      color={bucket.color}
                      variant={
                        id === "growth"
                          ? "swirling"
                          : id === "instant"
                            ? "fast-flow"
                            : id === "billings"
                              ? "rising"
                              : "normal"
                      }
                      className="rounded-2xl border border-purple-500/10"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center bg-black/40 backdrop-blur-md p-6 rounded-full border border-white/10">
                        <p className="text-sm text-purple-300 uppercase tracking-widest font-bold">Capacity</p>
                        <p className="text-5xl font-bold text-white">{bucket.percentage}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Goals/Stats Sidebar */}
                <div className="space-y-6">
                  {id === "savings" && (
                    <SavingsGoalOverview />
                  )}

                  <Card className="glass-card border-purple-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        RWA Strategy
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Provider</span>
                        <span className="text-foreground font-medium flex items-center gap-1">
                          {rwaInfo.provider} <ExternalLink className="w-3 h-3 opacity-50" />
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Asset Type</span>
                        <span className="text-foreground font-medium">{rwaInfo.type}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Target Yield</span>
                        <span className="text-green-400 font-bold">{rwaInfo.yield} APY</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass-card border-purple-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-400" />
                        Next Payroll
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center p-4 glass rounded-xl border-indigo-500/20">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-tighter">Countdown</p>
                        <p className="text-2xl font-mono font-bold text-foreground">12:04:33:15</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Recent Transactions Table */}
              <Card className="glass-card border-purple-500/20">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-purple-500/10 hover:bg-transparent">
                        <TableHead className="text-purple-300">Transaction</TableHead>
                        <TableHead className="text-purple-300">Type</TableHead>
                        <TableHead className="text-purple-300">Date</TableHead>
                        <TableHead className="text-purple-300 text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        {
                          title: "Auto-split from Wallet",
                          type: "Deposit",
                          date: "2025-05-12",
                          amount: "+$1,200.00",
                          color: "text-green-400",
                        },
                        {
                          title: "Salary Payout - Team A",
                          type: "Payroll",
                          date: "2025-05-10",
                          amount: "-$5,400.00",
                          color: "text-red-400",
                        },
                        {
                          title: "DeFi Yield Accrual",
                          type: "Yield",
                          date: "2025-05-09",
                          amount: "+$12.45",
                          color: "text-green-400",
                        },
                        {
                          title: "Internal Transfer to Savings",
                          type: "Transfer",
                          date: "2025-05-08",
                          amount: "-$500.00",
                          color: "text-red-400",
                        },
                      ].map((tx, i) => (
                        <TableRow key={i} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-medium text-foreground">{tx.title}</TableCell>
                          <TableCell className="text-muted-foreground">{tx.type}</TableCell>
                          <TableCell className="text-muted-foreground font-mono">{tx.date}</TableCell>
                          <TableCell className={`text-right font-bold ${tx.color}`}>{tx.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-6">
              {id === "billings" && <ExpenseManager />}
              {id === "instant" && <PayrollManager />}
              {id === "savings" && <SavingsGoalsManager />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowDownLeft className="w-5 h-5 text-green-400" />
                      Add Liquidity
                    </CardTitle>
                    <CardDescription>
                      {id === "spendable"
                        ? "Deposit to your spendable bucket via Paystack or Faucet."
                        : "Add funds to this bucket using Paystack or your linked Wallet."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      className="w-full gradient-primary text-white h-12 text-lg font-bold gap-2"
                      onClick={() => setIsDepositOpen(true)}
                    >
                      Open Deposit Portal
                    </Button>
                    {id === "spendable" && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                        <Droplet className="w-3.5 h-3.5" />
                        Faucet available for Spendable bucket
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card border-indigo-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpRight className="w-5 h-5 text-indigo-400" />
                      Withdrawal Center
                    </CardTitle>
                    <CardDescription>Move funds out of this bucket securely</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="w-full glass border-indigo-500/30 hover:bg-indigo-500/10 text-foreground h-12 text-lg font-bold gap-2 bg-transparent"
                      onClick={() => setIsWithdrawOpen(true)}
                    >
                      Initiate Withdrawal
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                    Internal Warp Transfer
                  </CardTitle>
                  <CardDescription>Move funds between your buckets instantly with zero slippage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="space-y-2">
                      <Label>Source Bucket</Label>
                      <Select defaultValue={id}>
                        <SelectTrigger className="glass border-white/10 h-12 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass border-purple-500/20">
                          {buckets.map((b) => (
                            <SelectItem key={b.name.toLowerCase()} value={b.name.toLowerCase()}>
                              <div className="flex items-center gap-2">
                                <b.icon className="w-4 h-4" style={{ color: b.color }} />
                                {b.name} ({b.balance})
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-center pt-6">
                      <div className="p-3 rounded-full glass border-purple-500/20">
                        <ArrowRight className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Target Bucket</Label>
                      <Select defaultValue="savings">
                        <SelectTrigger className="glass border-white/10 h-12 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass border-purple-500/20">
                          {buckets.map((b) => (
                            <SelectItem key={b.name.toLowerCase()} value={b.name.toLowerCase()}>
                              <div className="flex items-center gap-2">
                                <b.icon className="w-4 h-4" style={{ color: b.color }} />
                                {b.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount to Warp</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="glass border-white/10 h-14 text-2xl font-bold pl-8 bg-transparent"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-purple-500/20 text-purple-400 font-bold"
                      >
                        MAX
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full gradient-primary text-white h-14 text-xl font-bold gap-2">
                    <Zap className="w-5 h-5" />
                    Initiate Zero-Slippage Warp
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              {/* Expanded History tab with more transaction types */}
              <Card className="glass-card border-purple-500/20">
                <CardHeader>
                  <CardTitle>Bucket Transaction History</CardTitle>
                  <CardDescription>Comprehensive log of all flows for the {bucket.name} bucket</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-purple-500/10 hover:bg-transparent">
                        <TableHead className="text-purple-300">Activity</TableHead>
                        <TableHead className="text-purple-300">Route</TableHead>
                        <TableHead className="text-purple-300">Method</TableHead>
                        <TableHead className="text-purple-300">Timestamp</TableHead>
                        <TableHead className="text-purple-300 text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        {
                          activity: "External Deposit",
                          route: "Paystack → Billings",
                          method: "Card",
                          time: "2 mins ago",
                          value: "+$2,500.00",
                          color: "text-green-400",
                        },
                        {
                          activity: "Internal Warp",
                          route: "Billings → Savings",
                          method: "Zero-Slippage",
                          time: "1 hour ago",
                          value: "-$1,000.00",
                          color: "text-red-400",
                        },
                        {
                          activity: "Yield Distribution",
                          route: "Ondo RWA → Billings",
                          method: "Auto-Split",
                          time: "3 hours ago",
                          value: "+$4.52",
                          color: "text-green-400",
                        },
                        {
                          activity: "Bucket Withdrawal",
                          route: "Billings → External Wallet",
                          method: "Mantle L2",
                          time: "Yesterday",
                          value: "-$500.00",
                          color: "text-red-400",
                        },
                        {
                          activity: "Cross-Bucket Transfer",
                          route: "Spendable → Billings",
                          method: "Internal Warp",
                          time: "May 12, 2025",
                          value: "+$800.00",
                          color: "text-green-400",
                        },
                      ].map((tx, i) => (
                        <TableRow key={i} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-bold text-foreground">{tx.activity}</TableCell>
                          <TableCell className="text-purple-300/70 text-xs">{tx.route}</TableCell>
                          <TableCell className="text-muted-foreground">
                            <Badge variant="outline" className="border-purple-500/20 text-[10px] uppercase font-mono">
                              {tx.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{tx.time}</TableCell>
                          <TableCell className={`text-right font-mono font-bold ${tx.color}`}>{tx.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <BottomNav />
      <DepositModal
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        bucketId={id as BucketType}
        bucketName={bucket.name}
      />
      <WithdrawModal
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        bucketId={id as BucketType}
        bucketName={bucket.name}
      />
    </div>
  </NetworkGuard>
  )
}
