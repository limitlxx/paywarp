import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { 
  TransactionSyncService, 
  BlockchainTransaction, 
  TransactionSyncOptions,
  WrappedReport 
} from '@/lib/transaction-sync'

export interface UseTransactionHistoryReturn {
  // Transaction data
  transactions: BlockchainTransaction[]
  isLoading: boolean
  error: string | null
  
  // Sync operations
  syncHistory: (options?: TransactionSyncOptions) => Promise<void>
  refreshHistory: () => Promise<void>
  
  // Wrapped reports
  wrappedReports: WrappedReport[]
  generateWrapped: (year: number) => Promise<WrappedReport>
  
  // Real-time updates
  isWatching: boolean
  startWatching: () => void
  stopWatching: () => void
  
  // Categorization
  categorizedTransactions: Record<string, BlockchainTransaction[]>
  getTransactionsByYear: (year: number) => BlockchainTransaction[]
  getTransactionsByType: (type: string) => BlockchainTransaction[]
}

export function useTransactionHistory(): UseTransactionHistoryReturn {
  const { address } = useAccount()
  const chainId = useChainId()
  
  // State management
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([])
  const [wrappedReports, setWrappedReports] = useState<WrappedReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  
  // Service and cleanup refs
  const syncServiceRef = useRef<TransactionSyncService | null>(null)
  const watchCleanupRef = useRef<(() => void) | null>(null)

  // Initialize sync service when chain or address changes
  useEffect(() => {
    if (chainId) {
      syncServiceRef.current = new TransactionSyncService(chainId)
    }
    
    // Cleanup previous watchers when chain changes
    if (watchCleanupRef.current) {
      watchCleanupRef.current()
      watchCleanupRef.current = null
      setIsWatching(false)
    }
  }, [chainId])

  // Sync transaction history
  const syncHistory = useCallback(async (options: TransactionSyncOptions = {}) => {
    if (!address || !syncServiceRef.current) {
      setError('Wallet not connected or sync service not initialized')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const historicalTransactions = await syncServiceRef.current.syncHistoricalTransactions(
        address, 
        {
          includePayroll: true,
          maxBlocks: 15000, // Further reduced to match chunking size
          ...options
        }
      )

      setTransactions(historicalTransactions)
      
      // Generate wrapped reports for years with activity
      const yearsWithActivity = new Set(
        historicalTransactions.map(tx => tx.timestamp.getFullYear())
      )
      
      const reports: WrappedReport[] = []
      for (const year of yearsWithActivity) {
        const report = TransactionSyncService.generateWrappedData(
          historicalTransactions, 
          year, 
          address
        )
        reports.push(report)
      }
      
      setWrappedReports(reports.sort((a, b) => b.year - a.year))
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync transaction history'
      setError(errorMessage)
      console.error('Transaction sync error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address])

  // Refresh history (re-sync from current point)
  const refreshHistory = useCallback(async () => {
    await syncHistory()
  }, [syncHistory])

  // Generate wrapped report for specific year
  const generateWrapped = useCallback(async (year: number): Promise<WrappedReport> => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    const yearTransactions = transactions.filter(tx => 
      tx.timestamp.getFullYear() === year
    )

    const report = TransactionSyncService.generateWrappedData(
      yearTransactions, 
      year, 
      address
    )

    // Update wrapped reports state
    setWrappedReports(prev => {
      const filtered = prev.filter(r => r.year !== year)
      return [...filtered, report].sort((a, b) => b.year - a.year)
    })

    return report
  }, [address, transactions])

  // Start real-time transaction watching
  const startWatching = useCallback(() => {
    if (!address || !syncServiceRef.current || isWatching) {
      return
    }

    const handleNewTransaction = (transaction: BlockchainTransaction) => {
      setTransactions(prev => {
        // Check if transaction already exists
        const exists = prev.some(tx => tx.id === transaction.id)
        if (exists) return prev
        
        // Add new transaction and sort by timestamp
        return [...prev, transaction].sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        )
      })
    }

    syncServiceRef.current.watchTransactions(address, handleNewTransaction)
      .then(cleanup => {
        watchCleanupRef.current = cleanup
        setIsWatching(true)
      })
      .catch(err => {
        console.error('Error starting transaction watcher:', err)
        setError('Failed to start real-time transaction monitoring')
      })
  }, [address, isWatching])

  // Stop real-time transaction watching
  const stopWatching = useCallback(() => {
    if (watchCleanupRef.current) {
      watchCleanupRef.current()
      watchCleanupRef.current = null
      setIsWatching(false)
    }
  }, [])

  // Auto-sync when wallet connects
  useEffect(() => {
    if (address && syncServiceRef.current) {
      syncHistory()
    }
  }, [address, syncHistory])

  // Auto-start watching when wallet connects
  useEffect(() => {
    if (address && syncServiceRef.current && !isWatching) {
      startWatching()
    }
    
    // Cleanup on unmount or address change
    return () => {
      if (watchCleanupRef.current) {
        watchCleanupRef.current()
        watchCleanupRef.current = null
      }
    }
  }, [address, startWatching, isWatching])

  // Categorize transactions
  const categorizedTransactions = transactions.reduce((acc, tx) => {
    const category = TransactionSyncService.categorizeTransaction(tx)
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(tx)
    return acc
  }, {} as Record<string, BlockchainTransaction[]>)

  // Get transactions by year
  const getTransactionsByYear = useCallback((year: number) => {
    return transactions.filter(tx => tx.timestamp.getFullYear() === year)
  }, [transactions])

  // Get transactions by type
  const getTransactionsByType = useCallback((type: string) => {
    return transactions.filter(tx => tx.type === type)
  }, [transactions])

  return {
    // Transaction data
    transactions,
    isLoading,
    error,
    
    // Sync operations
    syncHistory,
    refreshHistory,
    
    // Wrapped reports
    wrappedReports,
    generateWrapped,
    
    // Real-time updates
    isWatching,
    startWatching,
    stopWatching,
    
    // Categorization
    categorizedTransactions,
    getTransactionsByYear,
    getTransactionsByType
  }
}