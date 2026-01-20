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
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useState, useMemo } from "react"
import { ExpenseManager } from "@/components/expense-manager"
import { PayrollManager } from "@/components/payroll-manager"
import { SavingsGoalsManager } from "@/components/savings-goals-manager"
import { RecurringExpensesManager } from "@/components/recurring-expenses-manager"
import { SavingsGoalOverview } from "@/components/savings-goal-overview"
import { DepositModal } from "@/components/modals/deposit-modal"
import { WithdrawModal } from "@/components/modals/withdraw-modal"
import { TransferModal } from "@/components/modals/transfer-modal"
import { AuthGuard } from "@/components/auth-guard"
import { useBucketBalances } from "@/hooks/use-bucket-balances"
import { useTransactionHistory } from "@/hooks/use-transaction-history"
import { useWallet } from "@/hooks/use-wallet"
import { useUserRegistration } from "@/lib/user-registration"
import { useToast } from "@/hooks/use-toast"
import { useContract, useContractWrite } from "@/lib/contracts"
import { useNetwork } from "@/hooks/use-network"
import { parseUnits } from "viem"
import { usePublicClient } from "wagmi"
import { DashboardHeader } from "@/components/dashboard-header"
import { useEffect } from "react"

type BucketType = 'billings' | 'savings' | 'growth' | 'instant' | 'spendable'

// Static bucket configuration for UI display
const bucketConfig = {
  billings: { 
    id: 'billings',
    name: "Billings", 
    color: "#A100FF", 
    icon: Droplet, 
    isYielding: false,
    description: "Automated expenses & bills",
    rwaProvider: "Ondo",
    rwaType: "Receivables",
    targetYield: "2.4%"
  },
  savings: {
    id: 'savings',
    name: "Savings",
    color: "#6366F1",
    icon: PiggyBank,
    isYielding: true,
    description: "Long-term goal oriented funds",
    rwaProvider: "Ondo",
    rwaType: "Tokenized T-Bills",
    targetYield: "4.5%"
  },
  growth: {
    id: 'growth',
    name: "Growth",
    color: "#3B82F6",
    icon: TrendingUp,
    isYielding: true,
    description: "DeFi yield optimization",
    rwaProvider: "Ondo",
    rwaType: "Equity Vaults",
    targetYield: "12.8%"
  },
  instant: { 
    id: 'instant',
    name: "Instant", 
    color: "#F59E0B", 
    icon: Zap, 
    isYielding: false,
    description: "Team payroll & salaries",
    rwaProvider: "Mantle",
    rwaType: "Payroll Yields",
    targetYield: "3.2%"
  },
  spendable: { 
    id: 'spendable',
    name: "Spendable", 
    color: "#10B981", 
    icon: Wallet, 
    isYielding: false,
    description: "Available for immediate use",
    rwaProvider: "Mantle",
    rwaType: "Native Yield",
    targetYield: "1.8%"
  },
}

export default function BucketDetails() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const bucket = bucketConfig[id as keyof typeof bucketConfig] || bucketConfig.billings
  
  // Authentication hooks
  const { isConnected, connect, address } = useWallet()
  const { isRegistered } = useUserRegistration()
  
  // Hooks for real contract data
  const { buckets, isLoading: bucketsLoading, refetch } = useBucketBalances()
  const { transactions, isLoading: transactionsLoading } = useTransactionHistory()
  const { toast } = useToast()
  const { currentNetwork } = useNetwork()
  const bucketVaultWriteContract = useContractWrite('bucketVault', currentNetwork)
  const publicClient = usePublicClient()
  
  // Local state
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [transferFromId, setTransferFromId] = useState<BucketType>(id as BucketType)
  const [transferToId, setTransferToId] = useState<BucketType>("savings")
  const [transferAmount, setTransferAmount] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)

  // Auth protection - redirect if not connected after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isConnected) {
        toast({
          title: "Authentication Required",
          description: "Please connect your wallet to access bucket details.",
          variant: "destructive",
        })
        router.push('/dashboard')
      }
    }, 2000) // Give 2 seconds for wallet to connect

    return () => clearTimeout(timer)
  }, [isConnected, router, toast])

  // Get real bucket data from contract
  const realBucketData = useMemo(() => {
    const contractBucket = buckets.find(b => b.name === id)
    if (!contractBucket) {
      return {
        balance: 0,
        formattedBalance: "0.00",
        percentage: 0,
        isYielding: bucket.isYielding
      }
    }

    // Calculate percentage based on total balance
    const totalBalance = buckets.reduce((sum, b) => sum + Number(b.formattedBalance), 0)
    const percentage = totalBalance > 0 ? (Number(contractBucket.formattedBalance) / totalBalance) * 100 : 0

    return {
      balance: Number(contractBucket.formattedBalance),
      formattedBalance: contractBucket.formattedBalance,
      percentage: Math.min(percentage, 100),
      isYielding: contractBucket.isYielding
    }
  }, [buckets, id, bucket.isYielding])

  // Filter transactions for this bucket
  const bucketTransactions = useMemo(() => {
    return transactions
      .filter(tx => 
        tx.bucket === id || 
        tx.fromBucket === id || 
        tx.toBucket === id ||
        (tx.type === 'deposit' && tx.description?.includes('split'))
      )
      .slice(0, 10) // Show last 10 transactions
  }, [transactions, id])

  // Handle internal transfer
  const handleInternalTransfer = async () => {
    if (!isConnected) {
      try {
        await connect()
      } catch (err) {
        toast({
          title: "Connection Failed",
          description: "Please connect your wallet to continue.",
          variant: "destructive",
        })
        return
      }
    }

    if (!bucketVaultWriteContract) {
      toast({
        title: "Contract Not Available",
        description: "Please switch to Sepolia testnet.",
        variant: "destructive",
      })
      return
    }

    if (!transferAmount || Number(transferAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid transfer amount.",
        variant: "destructive",
      })
      return
    }

    if (transferFromId === transferToId) {
      toast({
        title: "Invalid Transfer",
        description: "Please select different buckets for transfer.",
        variant: "destructive",
      })
      return
    }

    const fromBucket = buckets.find(b => b.name === transferFromId)
    if (!fromBucket || Number(transferAmount) > Number(fromBucket.formattedBalance)) {
      toast({
        title: "Insufficient Balance",
        description: "Transfer amount exceeds available balance.",
        variant: "destructive",
      })
      return
    }

    setIsTransferring(true)
    
    try {
      const numAmount = Number(transferAmount)
      
      console.log('🔄 Initiating internal transfer:', { 
        from: transferFromId, 
        to: transferToId, 
        amount: numAmount,
      })
      
      // Contract expects 6 decimals for USDC
      const amountIn6Decimals = parseUnits(transferAmount, 6)
      
      const hash = await bucketVaultWriteContract.write.transferBetweenBuckets([
        transferFromId,
        transferToId,
        amountIn6Decimals
      ])
      
      console.log('📝 Transfer transaction hash:', hash)
      
      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        if (receipt.status === 'success') {
          console.log('✅ Transfer successful')
          
          // Refresh balances
          await refetch()
          
          // Clear form
          setTransferAmount("")
          
          toast({
            title: "Transfer Complete",
            description: `Successfully moved $${numAmount.toFixed(2)} from ${bucket.name} to ${bucketConfig[transferToId].name}`,
          })
        } else {
          throw new Error('Transaction failed')
        }
      }
    } catch (err) {
      console.error('❌ Transfer error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed'
      toast({
        title: "Transfer Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsTransferring(false)
    }
  }

  if (!bucket) return null

  // Show connection prompt if not connected
  if (!isConnected) {
    return (
      <AuthGuard>
        <div className="min-h-screen gradient-bg pb-24">
          <DashboardHeader />
          <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-2xl mx-auto">
              <Card className="glass-card border-purple-500/20 text-center">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                    <Wallet className="w-8 h-8 text-purple-400" />
                  </div>
                  <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
                  <CardDescription>
                    You need to connect your wallet to access bucket details and perform transactions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={connect}
                    className="gradient-primary text-white h-12 px-8 font-bold"
                  >
                    Connect Wallet
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                    className="glass border-purple-500/20 bg-transparent"
                  >
                    Back to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
          <BottomNav />
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen gradient-bg pb-24">
      {/* <SimpleHeader /> */}
      <DashboardHeader />

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
                      {bucket.rwaProvider} {bucket.rwaType}
                    </Badge>
                    <p className="text-xs text-muted-foreground">Active RWA connection</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Current Balance</p>
                <p className="text-3xl font-bold text-foreground">${realBucketData.formattedBalance}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    if (!isConnected) {
                      toast({
                        title: "Connect Wallet",
                        description: "Please connect your wallet to deposit funds.",
                        variant: "destructive",
                      })
                      return
                    }
                    setIsDepositOpen(true)
                  }}
                  className="gradient-primary text-white h-9 px-4 font-bold text-xs gap-1"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Deposit
                </Button>
                <Button
                  onClick={() => {
                    if (!isConnected) {
                      toast({
                        title: "Connect Wallet", 
                        description: "Please connect your wallet to withdraw funds.",
                        variant: "destructive",
                      })
                      return
                    }
                    setIsWithdrawOpen(true)
                  }}
                  variant="outline"
                  className="glass border-indigo-500/30 text-indigo-300 h-9 px-4 font-bold text-xs gap-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Withdraw
                </Button>
              </div>
              {realBucketData.isYielding && (
                <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                  +{bucket.targetYield} APY
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
                      percentage={realBucketData.percentage}
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
                        <p className="text-5xl font-bold text-white">{realBucketData.percentage.toFixed(1)}%</p>
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
                          {bucket.rwaProvider} <ExternalLink className="w-3 h-3 opacity-50" />
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Asset Type</span>
                        <span className="text-foreground font-medium">{bucket.rwaType}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Target Yield</span>
                        <span className="text-green-400 font-bold">{bucket.targetYield} APY</span>
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
                      {transactionsLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                            <p className="text-muted-foreground">Loading transactions...</p>
                          </TableCell>
                        </TableRow>
                      ) : bucketTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <p className="text-muted-foreground">No transactions found for this bucket</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        bucketTransactions.map((tx, i) => (
                          <TableRow key={tx.id || i} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                            <TableCell className="font-medium text-foreground">
                              {tx.description || `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} Transaction`}
                            </TableCell>
                            <TableCell className="text-muted-foreground capitalize">{tx.type}</TableCell>
                            <TableCell className="text-muted-foreground font-mono">
                              {tx.timestamp.toLocaleDateString()}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${
                              tx.type === 'deposit' || tx.type === 'yield' || (tx.toBucket === id) 
                                ? 'text-green-400' 
                                : 'text-red-400'
                            }`}>
                              {tx.type === 'deposit' || tx.type === 'yield' || (tx.toBucket === id) ? '+' : '-'}
                              ${(Number(tx.amount) / Math.pow(10, tx.decimals || 18)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-6">
              {id === "billings" && (
                <>
                  <ExpenseManager />
                  <RecurringExpensesManager />
                </>
              )}
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
                      onClick={() => {
                        if (!isConnected) {
                          toast({
                            title: "Connect Wallet",
                            description: "Please connect your wallet to deposit funds.",
                            variant: "destructive",
                          })
                          return
                        }
                        setIsDepositOpen(true)
                      }}
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
                      onClick={() => {
                        if (!isConnected) {
                          toast({
                            title: "Connect Wallet",
                            description: "Please connect your wallet to withdraw funds.",
                            variant: "destructive",
                          })
                          return
                        }
                        setIsWithdrawOpen(true)
                      }}
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
                      <Select value={transferFromId} onValueChange={(val) => setTransferFromId(val as BucketType)}>
                        <SelectTrigger className="glass border-white/10 h-12 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass border-purple-500/20">
                          {buckets.map((b) => (
                            <SelectItem key={b.name} value={b.name}>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: bucketConfig[b.name as keyof typeof bucketConfig]?.color }} />
                                {bucketConfig[b.name as keyof typeof bucketConfig]?.name} (${b.formattedBalance})
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
                      <Select value={transferToId} onValueChange={(val) => setTransferToId(val as BucketType)}>
                        <SelectTrigger className="glass border-white/10 h-12 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass border-purple-500/20">
                          {buckets.map((b) => (
                            <SelectItem key={b.name} value={b.name}>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: bucketConfig[b.name as keyof typeof bucketConfig]?.color }} />
                                {bucketConfig[b.name as keyof typeof bucketConfig]?.name}
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
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="glass border-white/10 h-14 text-2xl font-bold pl-8 bg-transparent"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const fromBucket = buckets.find(b => b.name === transferFromId)
                          if (fromBucket) setTransferAmount(fromBucket.formattedBalance)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-purple-500/20 text-purple-400 font-bold"
                      >
                        MAX
                      </Button>
                    </div>
                  </div>

                  <Button 
                    onClick={handleInternalTransfer}
                    disabled={isTransferring || !transferAmount || Number(transferAmount) <= 0 || transferFromId === transferToId}
                    className="w-full gradient-primary text-white h-14 text-xl font-bold gap-2"
                  >
                    {isTransferring ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                    {isTransferring ? "Processing Transfer..." : "Initiate Zero-Slippage Warp"}
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
      <TransferModal
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        initialFromId={id as BucketType}
      />
    </div>
  </AuthGuard>
  )
}
