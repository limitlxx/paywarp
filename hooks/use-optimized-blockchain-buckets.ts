"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, usePublicClient, useWatchContractEvent } from "wagmi"
import { parseUnits, formatUnits } from "viem"
import { useContract, useContractWrite } from "@/lib/contracts"
import { useNetwork } from "./use-network"
import { useToast } from "./use-toast"
import { useTransactionBatcher } from "@/lib/transaction-batcher"
import { useTransactionLoading } from "@/lib/loading-state-manager"
import { useMobileCapabilities } from "@/lib/mobile-optimization"
import type { Bucket, BucketType, SavingsGoal, Transaction } from "@/lib/types"
import type { SplitConfig, BucketBalance } from "@/types/contracts/BucketVault"

// Enhanced bucket interface with blockchain data
interface BlockchainBucket extends Bucket {
  contractBalance: bigint
  yieldBalance: bigint
  isYielding: boolean
  lastUpdated: Date
}

// Transaction status for monitoring
interface TransactionStatus {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  type: 'deposit' | 'transfer' | 'withdraw'
  timestamp: Date
}

export function useOptimizedBlockchainBuckets() {
  const { address, isConnected } = useAccount()
  const { currentNetwork } = useNetwork()
  const { toast } = useToast()
  const publicClient = usePublicClient()
  const capabilities = useMobileCapabilities()
  
  // Contract instances
  const bucketVaultContract = useContract('bucketVault', currentNetwork)
  const bucketVaultWriteContract = useContractWrite('bucketVault', currentNetwork)
  
  // Performance optimizations
  const { batchTransaction, getQueueStatus } = useTransactionBatcher(bucketVaultWriteContract, publicClient)
  const { executeWithLoading, isTransactionLoading } = useTransactionLoading()
  
  // State management
  const [buckets, setBuckets] = useState<BlockchainBucket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingTransactions, setPendingTransactions] = useState<TransactionStatus[]>([])
  const [splitConfig, setSplitConfig] = useState<SplitConfig | null>(null)

  // Default bucket configuration
  const defaultBuckets: Omit<BlockchainBucket, 'balance' | 'contractBalance' | 'yieldBalance' | 'lastUpdated'>[] = [
    {
      id: "billings",
      name: "Billings",
      percentage: 45,
      color: "#EF4444",
      description: "Automated expenses & bills",
      rwaConnection: {
        provider: "Ondo",
        type: "receivables",
        enabled: true,
      },
      features: {
        autoFill: true,
        overflowTarget: "growth",
        expenseTracking: true,
        directPayout: true,
      },
      isYielding: false,
    },
    {
      id: "savings",
      name: "Savings",
      percentage: 20,
      color: "#3B82F6",
      description: "Long-term goal oriented funds",
      isYielding: true,
      apy: 4.5,
      rwaConnection: {
        provider: "Ondo",
        type: "t-bills",
        enabled: true,
      },
      features: {
        goalTracking: true,
        directPayout: false,
      },
    },
    {
      id: "growth",
      name: "Growth",
      percentage: 20,
      color: "#EAB308",
      description: "DeFi yield optimization",
      isYielding: true,
      apy: 12.8,
      rwaConnection: {
        provider: "Ondo",
        type: "equity-vaults",
        enabled: true,
      },
      features: {
        minSplitPercent: 20,
        autoCompound: true,
        directPayout: false,
      },
    },
    {
      id: "instant",
      name: "Instant",
      percentage: 10,
      color: "#22C55E",
      description: "Team payroll & salaries",
      isYielding: false,
      apy: 2.5,
      rwaConnection: {
        provider: "Mantle",
        type: "payroll-yields",
        enabled: true,
      },
      features: {
        payrollManagement: true,
        directPayout: true,
      },
    },
    {
      id: "spendable",
      name: "Spendable",
      percentage: 5,
      color: "#94A3B8",
      description: "Available for immediate use",
      isYielding: false,
      rwaConnection: {
        provider: "Mantle",
        type: "native",
        enabled: true,
      },
      features: {
        directPayout: true,
      },
    },
  ]

  // Rate limiting state
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [fetchTimeoutId, setFetchTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const MIN_FETCH_INTERVAL = 5000 // 5 seconds minimum between fetches

  // Optimized fetch bucket balances with mobile considerations and rate limiting
  const fetchBucketBalances = useCallback(async () => {
    if (!address || !isConnected) {
      return
    }

    if (!bucketVaultContract) {
      setError('Contracts not deployed on current network. Please switch to Sepolia testnet.')
      return
    }

    // Rate limiting check
    const now = Date.now()
    if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
      console.log('Rate limiting: skipping fetch, too soon since last fetch')
      return
    }

    // Don't fetch if we're already loading
    if (isLoading) {
      console.log('Skipping bucket balance fetch: already loading')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Adjust batch size based on device capabilities
      const batchSize = capabilities.performanceLevel === 'low' ? 2 : 
                       capabilities.performanceLevel === 'medium' ? 3 : 5

      // Process buckets in batches for better performance on mobile
      const bucketBatches = []
      for (let i = 0; i < defaultBuckets.length; i += batchSize) {
        bucketBatches.push(defaultBuckets.slice(i, i + batchSize))
      }

      const allBuckets: BlockchainBucket[] = []

      for (const batch of bucketBatches) {
        const bucketPromises = batch.map(async (bucketConfig) => {
          try {
            const bucketBalance = await bucketVaultContract.read.getBucketBalance([
              address,
              bucketConfig.id
            ]) as BucketBalance

            const balance = Number(formatUnits(bucketBalance.balance, 18))
            const yieldBalance = Number(formatUnits(bucketBalance.yieldBalance, 18))

            return {
              ...bucketConfig,
              balance: balance + yieldBalance,
              contractBalance: bucketBalance.balance,
              yieldBalance: bucketBalance.yieldBalance,
              isYielding: bucketBalance.isYielding,
              lastUpdated: new Date(),
            }
          } catch (err) {
            console.error(`Error fetching balance for bucket ${bucketConfig.id}:`, err)
            return {
              ...bucketConfig,
              balance: 0,
              contractBalance: BigInt(0),
              yieldBalance: BigInt(0),
              isYielding: false,
              lastUpdated: new Date(),
            }
          }
        })

        const batchResults = await Promise.all(bucketPromises)
        allBuckets.push(...batchResults)

        // Add small delay between batches on slow connections
        if (capabilities.connectionType === 'slow' && bucketBatches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      setBuckets(allBuckets)

      // Also fetch split configuration
      try {
        const config = await bucketVaultContract.read.getSplitConfig([address]) as SplitConfig
        setSplitConfig(config)
      } catch (err) {
        console.error('Error fetching split config:', err)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bucket data'
      setError(errorMessage)
      console.error('Error fetching bucket balances:', err)
    } finally {
      setIsLoading(false)
      setLastFetchTime(Date.now()) // Update last fetch time
    }
  }, [bucketVaultContract, address, isConnected, capabilities])

  // Debounced fetch function to prevent rapid successive calls
  const debouncedFetchBucketBalances = useCallback(() => {
    // Clear any existing timeout
    if (fetchTimeoutId) {
      clearTimeout(fetchTimeoutId)
    }

    // Set a new timeout
    const timeoutId = setTimeout(() => {
      fetchBucketBalances()
    }, 500) // 500ms debounce

    setFetchTimeoutId(timeoutId)
  }, [fetchBucketBalances, fetchTimeoutId])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutId) {
        clearTimeout(fetchTimeoutId)
      }
    }
  }, [fetchTimeoutId])
  const depositAndSplit = useCallback(async (amount: number) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    if (!bucketVaultWriteContract) {
      throw new Error('Contracts not deployed on current network. Please switch to Sepolia testnet.')
    }

    return executeWithLoading(async () => {
      const amountWei = parseUnits(amount.toString(), 18)
      
      // Use transaction batching for better gas optimization
      const hash = await batchTransaction('deposit', [amountWei], 5) // High priority
      
      // Track pending transaction
      const pendingTx: TransactionStatus = {
        hash,
        status: 'pending',
        type: 'deposit',
        timestamp: new Date(),
      }
      setPendingTransactions(prev => [...prev, pendingTx])

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        // Update transaction status
        setPendingTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: receipt.status === 'success' ? 'confirmed' : 'failed' }
              : tx
          )
        )

        if (receipt.status === 'success') {
          toast({
            title: "Deposit Successful",
            description: `Successfully deposited ${amount.toLocaleString()} and split across buckets.`,
          })
          
          // Refresh balances
          await fetchBucketBalances()
        } else {
          throw new Error('Transaction failed')
        }
      }

      return hash
    }, `Depositing ${amount.toLocaleString()} USDC`, true)
  }, [bucketVaultWriteContract, address, batchTransaction, executeWithLoading, publicClient, toast, fetchBucketBalances])

  // Optimized transfer between buckets
  const transferBetweenBuckets = useCallback(async (fromId: BucketType, toId: BucketType, amount: number) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    if (!bucketVaultWriteContract) {
      throw new Error('Contracts not deployed on current network. Please switch to Sepolia testnet.')
    }

    return executeWithLoading(async () => {
      const amountWei = parseUnits(amount.toString(), 18)
      
      // Use transaction batching with medium priority
      const hash = await batchTransaction('transfer', [fromId, toId, amountWei], 3)
      
      // Track pending transaction
      const pendingTx: TransactionStatus = {
        hash,
        status: 'pending',
        type: 'transfer',
        timestamp: new Date(),
      }
      setPendingTransactions(prev => [...prev, pendingTx])

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        // Update transaction status
        setPendingTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: receipt.status === 'success' ? 'confirmed' : 'failed' }
              : tx
          )
        )

        if (receipt.status === 'success') {
          const fromBucket = buckets.find(b => b.id === fromId)
          const toBucket = buckets.find(b => b.id === toId)
          
          toast({
            title: "Transfer Complete",
            description: `Successfully moved ${amount.toLocaleString()} from ${fromBucket?.name} to ${toBucket?.name}.`,
          })
          
          // Refresh balances
          await fetchBucketBalances()
        } else {
          throw new Error('Transaction failed')
        }
      }

      return hash
    }, `Transferring ${amount.toLocaleString()} USDC`, true)
  }, [bucketVaultWriteContract, address, batchTransaction, executeWithLoading, publicClient, toast, fetchBucketBalances, buckets])

  // Optimized withdraw from bucket
  const withdrawFromBucket = useCallback(async (bucketId: BucketType, amount: number) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    if (!bucketVaultWriteContract) {
      throw new Error('Contracts not deployed on current network. Please switch to Sepolia testnet.')
    }

    return executeWithLoading(async () => {
      const amountWei = parseUnits(amount.toString(), 18)
      
      // Use transaction batching with medium priority
      const hash = await batchTransaction('withdraw', [bucketId, amountWei], 3)
      
      // Track pending transaction
      const pendingTx: TransactionStatus = {
        hash,
        status: 'pending',
        type: 'withdraw',
        timestamp: new Date(),
      }
      setPendingTransactions(prev => [...prev, pendingTx])

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        // Update transaction status
        setPendingTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: receipt.status === 'success' ? 'confirmed' : 'failed' }
              : tx
          )
        )

        if (receipt.status === 'success') {
          const bucket = buckets.find(b => b.id === bucketId)
          
          toast({
            title: "Withdrawal Complete",
            description: `Successfully withdrawn ${amount.toLocaleString()} from ${bucket?.name}.`,
          })
          
          // Refresh balances
          await fetchBucketBalances()
        } else {
          throw new Error('Transaction failed')
        }
      }

      return hash
    }, `Withdrawing ${amount.toLocaleString()} USDC`, true)
  }, [bucketVaultWriteContract, address, batchTransaction, executeWithLoading, publicClient, toast, fetchBucketBalances, buckets])

  // Get bucket by ID
  const getBucket = useCallback((id: BucketType) => {
    return buckets.find(b => b.id === id)
  }, [buckets])

  // Update split configuration with batching
  const updateSplitConfig = useCallback(async (config: SplitConfig) => {
    if (!bucketVaultWriteContract || !address) {
      throw new Error('Contract not available or wallet not connected')
    }

    return executeWithLoading(async () => {
      const hash = await batchTransaction('config', [config], 4) // High-medium priority
      
      // Track pending transaction
      const pendingTx: TransactionStatus = {
        hash,
        status: 'pending',
        type: 'deposit', // Using deposit type for config updates
        timestamp: new Date(),
      }
      setPendingTransactions(prev => [...prev, pendingTx])

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        // Update transaction status
        setPendingTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: receipt.status === 'success' ? 'confirmed' : 'failed' }
              : tx
          )
        )

        if (receipt.status === 'success') {
          toast({
            title: "Configuration Updated",
            description: "Split configuration has been updated successfully.",
          })
          
          // Refresh balances and config
          await fetchBucketBalances()
        } else {
          throw new Error('Transaction failed')
        }
      }

      return hash
    }, "Updating split configuration", true)
  }, [bucketVaultWriteContract, address, batchTransaction, executeWithLoading, publicClient, toast, fetchBucketBalances])

  // Watch for contract events to update UI in real-time
  useWatchContractEvent({
    address: bucketVaultContract?.address,
    abi: bucketVaultContract?.abi,
    eventName: 'FundsSplit',
    onLogs: (logs) => {
      console.log('FundsSplit event detected:', logs)
      // Refresh balances when funds are split
      fetchBucketBalances()
    },
  })

  useWatchContractEvent({
    address: bucketVaultContract?.address,
    abi: bucketVaultContract?.abi,
    eventName: 'BucketTransfer',
    onLogs: (logs) => {
      console.log('BucketTransfer event detected:', logs)
      // Refresh balances when transfers occur
      fetchBucketBalances()
    },
  })

  // Initial data fetch and refresh on connection changes
  useEffect(() => {
    if (isConnected && address && bucketVaultContract) {
      debouncedFetchBucketBalances()
    } else {
      // Clear data when disconnected
      setBuckets([])
      setSplitConfig(null)
      setError(null)
    }
  }, [isConnected, address, bucketVaultContract]) // Removed fetchBucketBalances from dependencies

  // Clean up old pending transactions
  useEffect(() => {
    const cleanup = setInterval(() => {
      setPendingTransactions(prev => 
        prev.filter(tx => 
          tx.status === 'pending' && 
          Date.now() - tx.timestamp.getTime() < 5 * 60 * 1000 // Keep for 5 minutes
        )
      )
    }, 60000) // Check every minute

    return () => clearInterval(cleanup)
  }, [])

  return {
    // Data
    buckets,
    splitConfig,
    pendingTransactions,
    
    // State
    isLoading: isLoading || isTransactionLoading(),
    error,
    isConnected,
    
    // Actions
    getBucket,
    depositAndSplit,
    transferBetweenBuckets,
    withdrawFromBucket,
    updateSplitConfig,
    refreshBalances: fetchBucketBalances,
    
    // Performance metrics
    queueStatus: getQueueStatus(),
    
    // Utilities
    clearError: () => setError(null),
  }
}