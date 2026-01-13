import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { 
  TransactionSyncService, 
  BlockchainTransaction, 
  TransactionSyncOptions,
  WrappedReport 
} from '@/lib/transaction-sync'
import { useUserRegistration } from '@/lib/user-registration'

export interface UseTransactionHistoryReturn {
  // Transaction data
  transactions: BlockchainTransaction[]
  isLoading: boolean
  error: string | null
  fromCache: boolean // New: indicates if data came from cache
  
  // Sync operations
  syncHistory: (options?: TransactionSyncOptions) => Promise<void>
  refreshHistory: () => Promise<void> // Now does incremental sync
  
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
  
  // Cache management
  clearCache: () => Promise<void>
  getCacheInfo: () => Promise<any>
}

export function useTransactionHistory(): UseTransactionHistoryReturn {
  const { address } = useAccount()
  const chainId = useChainId()
  const { isRegistered } = useUserRegistration()
  
  // State management
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([])
  const [wrappedReports, setWrappedReports] = useState<WrappedReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  
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

  // Sync transaction history (works for all users)
  const syncHistory = useCallback(async (options: TransactionSyncOptions = {}) => {
    if (!address || !syncServiceRef.current) {
      setError('Wallet not connected or sync service not initialized')
      return
    }

    // Note: Removed registration requirement - deposits should be detected for all users
    console.log('Syncing transaction history for user:', address)

    setIsLoading(true)
    setError(null)

    try {
      let result;
      
      // If this is a forced sync (like onboarding), use recent sync
      if (options.forceSync && options.maxBlocks) {
        console.log(`Performing initial sync with ${options.maxBlocks} blocks`)
        const transactions = await syncServiceRef.current.syncRecentTransactions(
          address, 
          options.maxBlocks
        )
        result = { transactions, fromCache: false }
      } else {
        // Use cached transactions with smart syncing for regular use
        result = await syncServiceRef.current.getCachedTransactions(
          address, 
          {
            includePayroll: true,
            maxBlocks: 200, // More blocks for regular sync
            useCache: true,
            ...options
          }
        )
      }

      setTransactions(result.transactions)
      setFromCache(result.fromCache)
      
      if (result.fromCache) {
        console.log(`📱 LOADED TRANSACTIONS FROM CACHE:`)
        console.log(`   Count: ${result.transactions.length}`)
        console.log(`   User: ${address}`)
        console.log(`   Chain: ${chainId}`)
      } else {
        console.log(`🔄 LOADED FRESH TRANSACTIONS FROM BLOCKCHAIN:`)
        console.log(`   Count: ${result.transactions.length}`)
        console.log(`   User: ${address}`)
        console.log(`   Chain: ${chainId}`)
        console.log(`   Blocks synced: ${options.maxBlocks || 'default'}`)
      }
      
      // Generate wrapped reports for years with activity
      const yearsWithActivity = new Set(
        result.transactions.map(tx => tx.timestamp.getFullYear())
      )
      
      const reports: WrappedReport[] = []
      for (const year of yearsWithActivity) {
        const report = TransactionSyncService.generateWrappedData(
          result.transactions, 
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
  }, [address, isRegistered])

  // Incremental refresh (fetch new transactions for all users)
  const refreshHistory = useCallback(async () => {
    if (!address || !syncServiceRef.current) {
      return
    }

    console.log('Refreshing transaction history for user:', address)

    setIsLoading(true)
    setError(null)

    try {
      const newTransactions = await syncServiceRef.current.syncIncrementalTransactions(address)
      
      if (newTransactions.length > 0) {
        // Merge new transactions with existing ones
        setTransactions(prev => {
          const combined = [...prev, ...newTransactions]
          // Remove duplicates and sort by timestamp
          const unique = combined.filter((tx, index, arr) => 
            arr.findIndex(t => t.id === tx.id) === index
          )
          return unique.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        })
        
        console.log(`Added ${newTransactions.length} new transactions`)
      } else {
        console.log('No new transactions found')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh transaction history'
      setError(errorMessage)
      console.error('Transaction refresh error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address, isRegistered])

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

  // Auto-load cached data when wallet connects (regardless of registration)
  useEffect(() => {
    if (address && syncServiceRef.current) {
      // Load from cache first without syncing
      console.log('Loading cached transactions for user (registration not required)')
      
      const loadCachedData = async () => {
        try {
          setIsLoading(true)
          setError(null)
          
          // Try to load from cache only
          const result = await syncServiceRef.current!.getCachedTransactions(
            address, 
            {
              useCache: true,
              forceSync: false, // Don't force sync
              maxBlocks: 0 // Don't sync new blocks
            }
          )
          
          console.log(`📱 LOADED CACHED TRANSACTIONS FOR USER:`)
          console.log(`   Count: ${result.transactions.length}`)
          console.log(`   User: ${address}`)
          console.log(`   From cache: ${result.fromCache}`)
          console.log(`   Chain: ${chainId}`)
          
          setTransactions(result.transactions)
          setFromCache(result.fromCache)
          
          console.log(`Loaded ${result.transactions.length} cached transactions`)
          
          // Generate wrapped reports if we have data
          if (result.transactions.length > 0) {
            const yearsWithActivity = new Set(
              result.transactions.map(tx => tx.timestamp.getFullYear())
            )
            
            const reports: WrappedReport[] = []
            for (const year of yearsWithActivity) {
              const report = TransactionSyncService.generateWrappedData(
                result.transactions, 
                year, 
                address
              )
              reports.push(report)
            }
            
            setWrappedReports(reports.sort((a, b) => b.year - a.year))
          }
          
        } catch (err) {
          console.log('No cached data available or cache error:', err)
          // Don't set error for cache miss - just leave empty
          setTransactions([])
          setWrappedReports([])
        } finally {
          setIsLoading(false)
        }
      }
      
      loadCachedData()
    }
  }, [address]) // Removed isRegistered dependency

  // Auto-start watching when wallet connects (regardless of registration)
  useEffect(() => {
    if (address && syncServiceRef.current && !isWatching && transactions.length > 0) {
      startWatching()
    }
    
    // Cleanup on unmount or address change
    return () => {
      if (watchCleanupRef.current) {
        watchCleanupRef.current()
        watchCleanupRef.current = null
      }
    }
  }, [address, startWatching, isWatching, transactions.length]) // Removed isRegistered dependency

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
    fromCache, // New: indicates if data came from cache
    
    // Sync operations
    syncHistory,
    refreshHistory, // Now does incremental sync
    
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
    getTransactionsByType,
    
    // Cache management
    clearCache: useCallback(async () => {
      if (address && syncServiceRef.current) {
        await syncServiceRef.current.clearCache(address)
        setTransactions([])
        setWrappedReports([])
      }
    }, [address]),
    
    getCacheInfo: useCallback(async () => {
      if (address && syncServiceRef.current) {
        return syncServiceRef.current.getCacheInfo(address)
      }
      return null
    }, [address])
  }
}