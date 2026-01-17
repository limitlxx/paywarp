"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText, 
  Filter, 
  Download, 
  Search, 
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Trash2,
  RefreshCw,
  AlertCircle
} from "lucide-react"
import { format } from "date-fns"
import { useTransactionHistory } from "@/hooks/use-transaction-history"
import { useExpenseAudit } from "@/hooks/use-expense-audit"
import { useWallet } from "@/hooks/use-wallet"

export interface AuditTransaction {
  id: string
  hash: string
  timestamp: Date
  type: 'deposit' | 'withdrawal' | 'transfer' | 'yield' | 'payroll' | 'expense' | 'recurring_expense'
  amount: string
  tokenSymbol: string
  description: string
  status: 'pending' | 'confirmed' | 'failed'
  fromBucket?: string
  toBucket?: string
  bucket?: string
  gasUsed?: string
  gasFee?: string
  blockNumber?: string
}

interface AuditFilters {
  type: string
  status: string
  bucket: string
  dateRange: string
  searchTerm: string
}

export function AuditTray() {
  const { transactions, isLoading, refreshHistory } = useTransactionHistory()
  const { expenseAudit, isLoading: expenseLoading, refreshExpenseAudit } = useExpenseAudit()
  const { address } = useWallet()
  
  // Local state for filters and search
  const [filters, setFilters] = useState<AuditFilters>({
    type: 'all',
    status: 'all',
    bucket: 'all',
    dateRange: 'all',
    searchTerm: ''
  })
  
  // Convert blockchain transactions to audit format
  const auditTransactions = useMemo<AuditTransaction[]>(() => {
    const blockchainTxs = transactions.map(tx => ({
      id: tx.id,
      hash: tx.hash,
      timestamp: tx.timestamp,
      type: tx.type as AuditTransaction['type'],
      amount: (Number(tx.amount) / Math.pow(10, tx.decimals || 18)).toFixed(6),
      tokenSymbol: tx.tokenSymbol || 'USDC',
      description: tx.description || `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} transaction`,
      status: tx.status as AuditTransaction['status'],
      fromBucket: tx.fromBucket,
      toBucket: tx.toBucket,
      bucket: tx.bucket,
      blockNumber: tx.blockNumber?.toString(),
    }))

    // Convert expense audit transactions
    const expenseTxs = expenseAudit.map(exp => ({
      id: exp.id,
      hash: exp.hash || '',
      timestamp: exp.timestamp,
      type: exp.type as AuditTransaction['type'],
      amount: exp.amount,
      tokenSymbol: exp.tokenSymbol,
      description: exp.description,
      status: exp.status as AuditTransaction['status'],
      bucket: exp.bucket,
      blockNumber: '',
    }))

    // Combine and sort by timestamp
    return [...blockchainTxs, ...expenseTxs].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    )
  }, [transactions, expenseAudit])

  // Filter transactions based on current filters
  const filteredTransactions = useMemo(() => {
    return auditTransactions.filter(tx => {
      // Type filter
      if (filters.type !== 'all' && tx.type !== filters.type) return false
      
      // Status filter
      if (filters.status !== 'all' && tx.status !== filters.status) return false
      
      // Bucket filter
      if (filters.bucket !== 'all') {
        const bucketMatch = tx.bucket === filters.bucket || 
                           tx.fromBucket === filters.bucket || 
                           tx.toBucket === filters.bucket
        if (!bucketMatch) return false
      }
      
      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date()
        const txDate = tx.timestamp
        
        switch (filters.dateRange) {
          case '24h':
            if (now.getTime() - txDate.getTime() > 24 * 60 * 60 * 1000) return false
            break
          case '7d':
            if (now.getTime() - txDate.getTime() > 7 * 24 * 60 * 60 * 1000) return false
            break
          case '30d':
            if (now.getTime() - txDate.getTime() > 30 * 24 * 60 * 60 * 1000) return false
            break
        }
      }
      
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase()
        const searchableText = [
          tx.description,
          tx.hash,
          tx.amount,
          tx.tokenSymbol,
          tx.fromBucket,
          tx.toBucket,
          tx.bucket
        ].join(' ').toLowerCase()
        
        if (!searchableText.includes(searchLower)) return false
      }
      
      return true
    })
  }, [auditTransactions, filters])

  // Export transactions to CSV
  const exportToCSV = () => {
    const headers = [
      'Timestamp',
      'Type',
      'Amount',
      'Token',
      'Description',
      'Status',
      'From Bucket',
      'To Bucket',
      'Hash',
      'Block Number'
    ]
    
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(tx => [
        tx.timestamp.toISOString(),
        tx.type,
        tx.amount,
        tx.tokenSymbol,
        `"${tx.description}"`,
        tx.status,
        tx.fromBucket || '',
        tx.toBucket || '',
        tx.hash,
        tx.blockNumber || ''
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paywarp-audit-${address}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      type: 'all',
      status: 'all',
      bucket: 'all',
      dateRange: 'all',
      searchTerm: ''
    })
  }

  // Get unique buckets for filter dropdown
  const uniqueBuckets = useMemo(() => {
    const buckets = new Set<string>()
    auditTransactions.forEach(tx => {
      if (tx.bucket) buckets.add(tx.bucket)
      if (tx.fromBucket) buckets.add(tx.fromBucket)
      if (tx.toBucket) buckets.add(tx.toBucket)
    })
    return Array.from(buckets).sort()
  }, [auditTransactions])

  // Transaction type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-green-400" />
      case 'withdrawal': return <ArrowUpRight className="w-4 h-4 text-red-400" />
      case 'transfer': return <ArrowRightLeft className="w-4 h-4 text-blue-400" />
      default: return <FileText className="w-4 h-4 text-gray-400" />
    }
  }

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'border-green-500/20 text-green-400'
      case 'pending': return 'border-yellow-500/20 text-yellow-400'
      case 'failed': return 'border-red-500/20 text-red-400'
      default: return 'border-gray-500/20 text-gray-400'
    }
  }

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Transaction Audit Tray
            </CardTitle>
            <CardDescription>
              Local storage and filtering for all PayWarp transactions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                await refreshHistory()
                await refreshExpenseAudit()
              }}
              size="sm"
              variant="outline"
              className="glass border-blue-500/20 text-blue-400 gap-1"
              disabled={isLoading || expenseLoading}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading || expenseLoading ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <Button
              onClick={exportToCSV}
              size="sm"
              variant="outline"
              className="glass border-green-500/20 text-green-400 gap-1"
              disabled={filteredTransactions.length === 0}
            >
              <Download className="w-3 h-3" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hash, description..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="glass border-white/10 pl-10 bg-transparent"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Type</label>
            <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
              <SelectTrigger className="glass border-white/10 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-purple-500/20">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdrawal">Withdrawals</SelectItem>
                <SelectItem value="transfer">Transfers</SelectItem>
                <SelectItem value="yield">Yield</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="recurring_expense">Recurring Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Status</label>
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="glass border-white/10 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-purple-500/20">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Bucket</label>
            <Select value={filters.bucket} onValueChange={(value) => setFilters(prev => ({ ...prev, bucket: value }))}>
              <SelectTrigger className="glass border-white/10 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-purple-500/20">
                <SelectItem value="all">All Buckets</SelectItem>
                {uniqueBuckets.map(bucket => (
                  <SelectItem key={bucket} value={bucket}>
                    {bucket.charAt(0).toUpperCase() + bucket.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Date Range</label>
            <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
              <SelectTrigger className="glass border-white/10 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass border-purple-500/20">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {filteredTransactions.length} of {auditTransactions.length} transactions
            </span>
            {(filters.type !== 'all' || filters.status !== 'all' || filters.bucket !== 'all' || 
              filters.dateRange !== 'all' || filters.searchTerm) && (
              <Button
                onClick={clearFilters}
                size="sm"
                variant="ghost"
                className="text-purple-400 hover:bg-purple-500/20 gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-purple-500/10 hover:bg-transparent">
                <TableHead className="text-purple-300">Type</TableHead>
                <TableHead className="text-purple-300">Description</TableHead>
                <TableHead className="text-purple-300">Amount</TableHead>
                <TableHead className="text-purple-300">Buckets</TableHead>
                <TableHead className="text-purple-300">Status</TableHead>
                <TableHead className="text-purple-300">Date</TableHead>
                <TableHead className="text-purple-300">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || expenseLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-muted-foreground">Loading transactions...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-muted-foreground" />
                      <span className="text-muted-foreground">No transactions match your filters</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(tx.type)}
                        <span className="capitalize text-sm">{tx.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate text-sm" title={tx.description}>
                        {tx.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">
                        {tx.amount} {tx.tokenSymbol}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        {tx.fromBucket && (
                          <div className="text-red-400">From: {tx.fromBucket}</div>
                        )}
                        {tx.toBucket && (
                          <div className="text-green-400">To: {tx.toBucket}</div>
                        )}
                        {tx.bucket && !tx.fromBucket && !tx.toBucket && (
                          <div className="text-blue-400">{tx.bucket}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getStatusColor(tx.status)} text-xs`}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(tx.timestamp, 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-muted-foreground max-w-[100px] truncate" title={tx.hash}>
                        {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}