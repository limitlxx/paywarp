"use client"

import { Button } from "@/components/ui/button"
import { BottomNav } from "@/components/bottom-nav"
import { SimpleHeader } from "@/components/simple-header"
import { DashboardHeader } from "@/components/dashboard-header"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowUp,
  ArrowDown,
  Activity,
  TrendingUp,
  DollarSign,
  Wallet,
  Plus,
  Share2,
  RefreshCw,
  Droplet,
  Scan,
  Loader2,
  CheckCircle2Icon,
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { DepositModal } from "@/components/modals/deposit-modal"
import { useTransactionHistory } from "@/hooks/use-transaction-history"
import { useWrappedReports } from "@/hooks/use-wrapped-reports"
import { useBucketBalances } from "@/hooks/use-bucket-balances"
import { formatEther, formatUnits } from "viem"

// Preference storage utilities for wrapped redirect
const WRAPPED_VIEWED_KEY = 'paywarp-wrapped-viewed'

const getWrappedViewed = (address: string): boolean => {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(`${WRAPPED_VIEWED_KEY}-${address}`)
  return stored === 'true'
}

export default function Dashboard() {
  const router = useRouter()
  const { address } = useAccount()
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const { transactions, isLoading, refreshHistory, syncHistory, fromCache, error } = useTransactionHistory()
  const { buckets, totalBalance, formattedTotalBalance, splitConfig, nonce, hasData: hasBucketData, refetch: refetchBuckets } = useBucketBalances()
  const { hasActivity } = useWrappedReports()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Debug: Log bucket data
  useEffect(() => {
    if (address) {
      console.log('📊 BUCKET DATA DEBUG:')
      console.log('  Address:', address)
      console.log('  Has Bucket Data:', hasBucketData)
      console.log('  Total Balance:', formattedTotalBalance, 'USDC')
      console.log('  Nonce:', nonce.toString())
      console.log('  Buckets:', buckets.map(b => `${b.name}: ${b.formattedBalance}`))
      console.log('  Split Config:', splitConfig)
    }
  }, [address, hasBucketData, formattedTotalBalance, nonce, buckets, splitConfig])

  // Check if user should be redirected to wrapped page
  useEffect(() => {
    if (address && hasActivity && !isLoading) {
      const hasViewedWrapped = getWrappedViewed(address)
      
      if (!hasViewedWrapped) {
        console.log(`🎁 REDIRECTING NEW USER TO WRAPPED PAGE:`)
        console.log(`   User: ${address}`)
        console.log(`   Has activity: ${hasActivity}`)
        console.log(`   Has viewed wrapped: ${hasViewedWrapped}`)
        
        // Redirect to wrapped page for first-time users with activity
        router.push('/wrapped')
        return
      }
    }
  }, [address, hasActivity, isLoading, router])

  // Calculate real statistics from transactions AND bucket balances
  const stats = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    // Use contract transactions only (managed wallet transactions)
    const allTxs = transactions
    
    // Filter transactions from last 30 days
    const recentTransactions = allTxs.filter(tx => 
      tx.timestamp >= thirtyDaysAgo
    )

    // Use REAL bucket balance from contract (this is the actual on-chain balance)
    const totalBalance = Number(formattedTotalBalance)

    // Calculate monthly inflow (deposits + splits)
    const monthlyInflow = recentTransactions.reduce((sum, tx) => {
      if (tx.type === 'deposit' || tx.type === 'split' || tx.type === 'erc20_in') {
        return sum + Number(formatUnits(tx.amount, tx.decimals || 18))
      }
      return sum
    }, 0)

    // Calculate monthly outflow (withdrawals + transfers out)
    const monthlyOutflow = recentTransactions.reduce((sum, tx) => {
      if (tx.type === 'withdrawal' || tx.type === 'erc20_out') {
        return sum + Number(formatUnits(tx.amount, tx.decimals || 18))
      }
      return sum
    }, 0)

    // Calculate spendable balance from actual bucket data
    const spendableBucket = buckets.find(b => b.name === 'spendable')
    const spendableBalance = spendableBucket ? Number(spendableBucket.formattedBalance) : totalBalance * 0.05

    return {
      totalBalance,
      monthlyInflow,
      monthlyOutflow,
      spendableBalance,
      transactionCount: allTxs.length,
      recentCount: recentTransactions.length
    }
  }, [transactions, formattedTotalBalance, buckets])

  // Generate chart data from last 7 days
  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const now = new Date()
    const data = []
    
    // Use contract transactions only
    const allTxs = transactions

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dayName = days[date.getDay()]
      
      const dayTransactions = allTxs.filter(tx => {
        const txDate = new Date(tx.timestamp)
        return txDate.toDateString() === date.toDateString()
      })

      const inflow = dayTransactions.reduce((sum, tx) => {
        if (tx.type === 'deposit' || tx.type === 'split' || tx.type === 'erc20_in') {
          return sum + Number(formatUnits(tx.amount, tx.decimals || 18))
        }
        return sum
      }, 0)

      const outflow = dayTransactions.reduce((sum, tx) => {
        if (tx.type === 'withdrawal' || tx.type === 'erc20_out') {
          return sum + Number(formatUnits(tx.amount, tx.decimals || 18))
        }
        return sum
      }, 0)

      data.push({ name: dayName, inflow, outflow })
    }

    return data
  }, [transactions])

  // Handle refresh - use API refresh
  const handleRefresh = async () => {
    await refreshHistory()
  }
  
  return (
    <AuthGuard>
      <div className="min-h-screen gradient-bg pb-24">
        <DashboardHeader />
        {/* <SimpleHeader /> */}

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Summary Row */}
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-glow-neon">Dashboard</h1>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading your data...
                    </span>
                  ) : stats.transactionCount > 0 ? (
                    <span className="flex flex-wrap items-center gap-1">
                      <span>{stats.transactionCount} transactions</span>
                      {fromCache && <span className="text-purple-400">• Cached data</span>}
                    </span>
                  ) : (
                    'Track your DeFi budgets and earnings'
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-card border-green-500/30 text-green-400 hover:bg-green-500/10 gap-2 bg-transparent text-xs sm:text-sm h-8 sm:h-9"
                  asChild
                >
                  <Link href="/faucet">
                    <Droplet className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Faucet</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-card border-blue-500/30 text-blue-400 hover:bg-blue-500/10 gap-2 bg-transparent text-xs sm:text-sm h-8 sm:h-9"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                {/* <Button
                  variant="outline"
                  size="sm"
                  className="glass-card border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 bg-transparent text-xs sm:text-sm h-8 sm:h-9 hidden sm:flex"
                >
                  <Scan className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Scan QR</span>
                </Button> */}
                <Link href="/wrapped" className="hidden sm:block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-card border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 bg-transparent text-xs sm:text-sm h-8 sm:h-9"
                  >
                    <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>View Wrapped</span>
                  </Button>
                </Link>
                {/* <Button
                  variant="outline"
                  size="sm"
                  className="glass-card border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 bg-transparent text-xs sm:text-sm h-8 sm:h-9 hidden lg:flex"
                >
                  <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Share</span>
                </Button> */}
              </div>
            </div>

            {/* Empty State */}
            {!isLoading && stats.transactionCount === 0 && !hasBucketData && !error && (
              <Card className="glass-card border-purple-500/20">
                <CardContent className="p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-purple-500/10">
                      <Wallet className="w-12 h-12 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Welcome to PayWarp!</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Get started by making your first deposit. Your funds will be automatically split across your buckets.
                      </p>
                    </div>
                    <Button
                      className="gradient-primary text-white border-0 px-8 py-6 h-auto text-lg font-bold gap-2 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform mt-4"
                      onClick={() => setIsDepositOpen(true)}
                    >
                      <Plus className="w-5 h-5" />
                      Make Your First Deposit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error State */}
            {error && (
              <Card className="glass-card border-red-500/20">
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 rounded-full bg-red-500/10">
                      <Activity className="w-12 h-12 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">No Transaction History</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        {error.includes('register') 
                          ? 'Please register your wallet to access transaction history.'
                          : 'Unable to load transaction history. Click sync to try again.'
                        }
                      </p>
                    </div>
                    <Button
                      className="gradient-primary text-white border-0 px-6 py-3 h-auto font-bold gap-2"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? 'Syncing...' : 'Sync Transaction History'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Stats - Show when there are transactions OR bucket data, and no errors */}
          {(isLoading || (stats.transactionCount > 0 && !error) || (hasBucketData && !error)) && (
            <>
              {/* Summary Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Balance</p>
                  <p className="text-xl font-bold text-foreground">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      `$${stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-green-500/20 text-green-400">
                  <ArrowDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Inflow</p>
                  <p className="text-xl font-bold text-foreground">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      `+$${stats.monthlyInflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-red-500/20 text-red-400">
                  <ArrowUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Outflow</p>
                  <p className="text-xl font-bold text-foreground">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      `-$${stats.monthlyOutflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="glass-card border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-purple-400" />
                    Spendable Balance
                  </h3>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    {isLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      `$${stats.spendableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Available for withdrawal</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="gradient-primary text-white border-0 flex-1 h-14 text-xl font-bold gap-2 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform"
                   onClick={() => setIsDepositOpen(true)}
                >
                  <Plus className="w-6 h-6" />
                  Deposit & Auto-Split
                </Button>
                <div className="flex flex-col justify-center px-2">
                  <p className="text-xs text-purple-400 font-bold uppercase tracking-widest">Smart Routing</p>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Directly to your 4 active buckets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Chart */}
          <Card className="glass-card border-purple-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold text-foreground">
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading Cash Flow...
                  </span>
                ) : (
                  'Net Cash Flow (Last 7 Days)'
                )}
              </CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-muted-foreground">In</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <span className="text-muted-foreground">Out</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(163, 0, 255, 0.1)" />
                    <XAxis
                      dataKey="name"
                      stroke="rgba(163, 0, 255, 0.4)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgba(163, 0, 255, 0.4)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0, 0, 0, 0.95)",
                        border: "1px solid rgba(163, 0, 255, 0.2)",
                        borderRadius: "12px",
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                    />
                    <Line
                      type="monotone"
                      dataKey="inflow"
                      stroke="#A100FF"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                    <Line type="monotone" dataKey="outflow" stroke="#6366F1" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-muted-foreground">Total Yield</p>
                </div>
                <p className="text-2xl font-bold text-foreground">$2,145.30</p>
                <p className="text-xs text-green-400 mt-1">+12.5% this month</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-muted-foreground">Avg APY</p>
                </div>
                <p className="text-2xl font-bold text-foreground">8.4%</p>
                <p className="text-xs text-muted-foreground mt-1">Across all buckets</p>
              </CardContent>
            </Card>
          </div>

          {/* View All Buckets CTA */}
          <Link href="/buckets">
            <Card className="glass-card border-purple-500/30 hover:border-purple-500/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <p className="text-lg font-semibold text-foreground mb-1">View All Buckets</p>
                <p className="text-sm text-muted-foreground">Manage your budget allocations</p>
              </CardContent>
            </Card>
          </Link>
            </>
          )}
        </div>
      </main>

      <DepositModal open={isDepositOpen} onOpenChange={setIsDepositOpen} bucketId="auto-split" />
      
      <BottomNav />
    </div>
  </AuthGuard>
  )
}
