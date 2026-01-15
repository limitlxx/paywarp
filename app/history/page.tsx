"use client"

import { SimpleHeader } from "@/components/simple-header"
import { BottomNav } from "@/components/bottom-nav"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { History, ArrowDownLeft, TrendingUp, Droplet, Zap, ExternalLink, Filter, Search, Loader2, ArrowUpRight, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Suspense, useState, useMemo } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { useTransactionHistory } from "@/hooks/use-transaction-history"
import { formatUnits } from "viem"
import type { BlockchainTransaction } from "@/lib/transaction-sync"

function getTransactionIcon(type: BlockchainTransaction['type']) {
  switch (type) {
    case 'deposit':
    case 'erc20_in':
      return ArrowDownLeft
    case 'withdrawal':
    case 'erc20_out':
      return ArrowUpRight
    case 'split':
      return Droplet
    case 'transfer':
    case 'erc20_transfer':
      return TrendingUp
    default:
      return Zap
  }
}

function getTransactionColor(type: BlockchainTransaction['type']) {
  switch (type) {
    case 'deposit':
    case 'erc20_in':
      return 'text-green-400'
    case 'withdrawal':
    case 'erc20_out':
      return 'text-red-400'
    case 'split':
      return 'text-purple-400'
    case 'transfer':
    case 'erc20_transfer':
      return 'text-blue-400'
    default:
      return 'text-amber-400'
  }
}

function getTransactionLabel(type: BlockchainTransaction['type']) {
  switch (type) {
    case 'deposit':
      return 'Deposit'
    case 'withdrawal':
      return 'Withdrawal'
    case 'split':
      return 'Split'
    case 'transfer':
      return 'Transfer'
    case 'erc20_in':
      return 'Received'
    case 'erc20_out':
      return 'Sent'
    case 'erc20_transfer':
      return 'ERC20 Transfer'
    case 'erc20_approve':
      return 'Approval'
    default:
      return 'Transaction'
  }
}

function HistoryContent() {
  const [searchQuery, setSearchQuery] = useState('')
  const { transactions, isLoading, refreshHistory } = useTransactionHistory()
  
  // Filter transactions by search query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions
    const query = searchQuery.toLowerCase()
    return transactions.filter(tx => 
      tx.hash.toLowerCase().includes(query) ||
      tx.description.toLowerCase().includes(query) ||
      tx.type.toLowerCase().includes(query) ||
      (tx.tokenSymbol && tx.tokenSymbol.toLowerCase().includes(query))
    )
  }, [transactions, searchQuery])
  
  const explorerUrl = (hash: string) => {
    return `https://explorer.sepolia.mantle.xyz/tx/${hash}`
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <History className="w-8 h-8 text-purple-400" />
            Transaction History
          </h1>
          <p className="text-muted-foreground">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading transactions...
              </span>
            ) : (
              `${filteredTransactions.length} transactions found`
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tx hash..."
              className="pl-10 glass border-purple-500/20 bg-transparent w-[240px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="glass border-purple-500/20 bg-transparent"
            onClick={refreshHistory}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {filteredTransactions.length === 0 && !isLoading ? (
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-purple-500/10">
                <History className="w-12 h-12 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">No Transactions Found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery 
                    ? 'No transactions match your search query.'
                    : 'Start syncing to view your transaction history.'}
                </p>
              </div>
              {!searchQuery && (
                <Button
                  className="gradient-primary text-white border-0 px-6 py-3 h-auto font-bold gap-2"
                  onClick={refreshHistory}
                  disabled={isLoading}
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh History
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-4">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-indigo-500/20 to-transparent" />

          {filteredTransactions.map((item, index) => {
            const Icon = getTransactionIcon(item.type)
            const color = getTransactionColor(item.type)
            const label = getTransactionLabel(item.type)
            const amount = Number(formatUnits(item.amount, item.decimals || 18))
            const isIncoming = item.type === 'deposit' || item.type === 'erc20_in'
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 1) }}
                className="relative pl-14"
              >
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full gradient-primary ring-4 ring-black/40 z-10" />

                <Card className="glass-card border-purple-500/20 hover:border-purple-500/40 transition-all group overflow-hidden">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-xl bg-opacity-10`}
                        style={{
                          backgroundColor: color.includes('green') 
                            ? 'rgba(34, 197, 94, 0.1)' 
                            : color.includes('red')
                            ? 'rgba(239, 68, 68, 0.1)'
                            : color.includes('purple')
                            ? 'rgba(161, 0, 255, 0.1)'
                            : 'rgba(59, 130, 246, 0.1)',
                        }}
                      >
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground">{label}</h3>
                          {item.tokenSymbol && (
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase bg-purple-500/10 border-purple-500/20 text-purple-300"
                            >
                              {item.tokenSymbol}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${
                              item.status === 'completed' 
                                ? 'bg-green-500/10 border-green-500/20 text-green-300'
                                : item.status === 'failed'
                                ? 'bg-red-500/10 border-red-500/20 text-red-300'
                                : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
                            }`}
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="space-y-1">
                        <p className={`text-xl font-bold ${color}`}>
                          {isIncoming ? '+' : '-'}{amount.toFixed(4)} {item.tokenSymbol || 'MNT'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10"
                        onClick={() => window.open(explorerUrl(item.hash), '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Explorer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function WarpHistory() {
  return (
    <AuthGuard>
      <div className="min-h-screen gradient-bg pb-24">
        {/* <SimpleHeader /> */}
        <DashboardHeader />

        <main className="p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<div>Loading...</div>}>
            <HistoryContent />
          </Suspense>
        </main>
        <BottomNav />
      </div>
    </AuthGuard>
  )
}
