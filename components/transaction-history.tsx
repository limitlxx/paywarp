"use client"

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, ExternalLink, Calendar, Filter } from 'lucide-react'
import { useWallet } from '@/hooks/use-wallet.tsx'
import { useTransactionHistory } from '@/hooks/use-transaction-history'
import { TransactionSyncService, type BlockchainTransaction } from '@/lib/transaction-sync'
import { formatDistanceToNow } from 'date-fns'

interface TransactionHistoryProps {
  className?: string
}

export function TransactionHistory({ className }: TransactionHistoryProps) {
  const { address, isConnected } = useWallet()
  const { 
    transactions, 
    isLoading, 
    error, 
    refreshHistory,
    categorizedTransactions,
    getTransactionsByYear 
  } = useTransactionHistory()
  
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(tx => tx.timestamp.getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [transactions])

  // Filter transactions based on selected year and category
  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    if (selectedYear !== 'all') {
      filtered = getTransactionsByYear(selectedYear)
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(tx => 
        TransactionSyncService.categorizeTransaction(tx) === selectedCategory
      )
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [transactions, selectedYear, selectedCategory, getTransactionsByYear])

  // Get available categories
  const availableCategories = useMemo(() => {
    return Object.keys(categorizedTransactions)
  }, [categorizedTransactions])

  const formatAmount = (amount: bigint) => {
    const value = Number(amount) / 1e18 // Assuming 18 decimals
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 6 
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'split':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'transfer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'withdrawal':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'payroll_processed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
      case 'goal_completed':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const openInExplorer = (hash: string) => {
    const explorerUrl = 'https://explorer.mantle.xyz/tx/' + hash
    window.open(explorerUrl, '_blank')
  }

  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Connect your wallet to view transaction history
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              {transactions.length} transactions found for {address?.slice(0, 6)}...{address?.slice(-4)}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshHistory}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="all">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="all">All Categories</option>
              {availableCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Transaction List</TabsTrigger>
            <TabsTrigger value="categories">By Category</TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="space-y-4">
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading transactions...</span>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getTypeColor(tx.type)}>
                            {tx.type.replace('_', ' ')}
                          </Badge>
                          <Badge className={getStatusColor(tx.status)}>
                            {tx.status}
                          </Badge>
                        </div>
                        
                        <p className="text-sm font-medium truncate">
                          {tx.description}
                        </p>
                        
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(tx.timestamp, { addSuffix: true })}</span>
                          {tx.fromBucket && tx.toBucket && (
                            <span>{tx.fromBucket} → {tx.toBucket}</span>
                          )}
                          {tx.recipient && (
                            <span>To: {tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {formatAmount(tx.amount)} USDC
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Block #{tx.blockNumber.toString()}
                          </p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openInExplorer(tx.hash)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="categories" className="space-y-4">
            <ScrollArea className="h-[400px]">
              {Object.entries(categorizedTransactions).map(([category, categoryTxs]) => (
                <div key={category} className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{category}</h3>
                    <Badge variant="secondary">{categoryTxs.length}</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {categoryTxs.slice(0, 5).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-2 border rounded text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                        <div className="ml-2 text-right">
                          <p className="font-medium">{formatAmount(tx.amount)} USDC</p>
                        </div>
                      </div>
                    ))}
                    
                    {categoryTxs.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{categoryTxs.length - 5} more transactions
                      </p>
                    )}
                  </div>
                  
                  <Separator className="mt-4" />
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}