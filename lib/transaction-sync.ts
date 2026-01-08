import { getPublicClient } from 'wagmi/actions'
import { wagmiConfig } from './wagmi'
import { mantleMainnet, mantleSepolia } from './networks'
import { getContract } from 'viem'
import BucketVaultABI from './abis/BucketVault.json'
import PayrollEngineABI from './abis/PayrollEngine.json'
import { getContractAddress } from './contracts'
import { RPCProvider, withRPCFallback } from './rpc-provider'
import { transactionCache, LocalStorageCache, TransactionCacheService, type SyncMetadata } from './transaction-cache'
import type { NetworkType } from './types'

// Enhanced transaction types for blockchain integration
export interface BlockchainTransaction {
  id: string
  hash: string
  type: TransactionType
  amount: bigint
  fromBucket?: string
  toBucket?: string
  recipient?: string
  timestamp: Date
  blockNumber: bigint
  status: TransactionStatus
  gasUsed: bigint
  gasCost: bigint
  description: string
  metadata: TransactionMetadata
  contractAddress: string
  eventName: string
}

export type TransactionType = 
  | 'deposit' 
  | 'withdrawal' 
  | 'transfer' 
  | 'split' 
  | 'payroll' 
  | 'goal_created' 
  | 'goal_completed'
  | 'employee_added'
  | 'payroll_scheduled'
  | 'payroll_processed'

export type TransactionStatus = 'pending' | 'completed' | 'failed'

export interface TransactionMetadata {
  splitConfig?: {
    billingsPercent: bigint
    savingsPercent: bigint
    growthPercent: bigint
    instantPercent: bigint
    spendablePercent: bigint
  }
  goalId?: bigint
  batchId?: bigint
  employeeCount?: bigint
  bonusAPY?: bigint
}

export interface TransactionSyncOptions {
  fromBlock?: bigint
  toBlock?: bigint
  maxBlocks?: number
  includePayroll?: boolean
  chunkSize?: number // New option to configure chunk size
  forceSync?: boolean // Force sync even if cache is recent
  useCache?: boolean // Whether to use cached data (default: true)
  useAlchemy?: boolean // Whether to use Alchemy Transfer API (default: true)
}

export class TransactionSyncService {
  private publicClient: any
  private rpcProvider: RPCProvider
  private chainId: number
  private networkType: NetworkType
  private bucketVaultAddress: string
  private payrollEngineAddress: string
  private optimalChunkSize: bigint = BigInt(5) // Start with ultra-conservative chunk size

  constructor(chainId: number) {
    this.chainId = chainId
    this.networkType = chainId === mantleSepolia.id ? 'mainnet' : 'sepolia'
    this.rpcProvider = RPCProvider.getInstance(this.networkType)
    this.publicClient = this.rpcProvider.getPublicClient()
    
    // Get contract addresses based on network
    this.bucketVaultAddress = getContractAddress(this.networkType, 'bucketVault')
    this.payrollEngineAddress = getContractAddress(this.networkType, 'payrollEngine')
    
    // Detect optimal chunk size based on network
    this.detectOptimalChunkSize()
  }

  /**
   * Detect the optimal chunk size for the current RPC provider
   */
  private async detectOptimalChunkSize(): Promise<void> {
    try {
      // Test with a small range first
      const currentBlock = await this.rpcProvider.executeRead(async (client: any) => {
        return client.getBlockNumber()
      })
      
      // Try progressively larger chunk sizes to find the limit (much more conservative)
      const testSizes = [BigInt(5), BigInt(10), BigInt(20), BigInt(50)]
      
      for (const size of testSizes) {
        try {
          await this.rpcProvider.executeRead(async (client: any) => {
            return client.getLogs({
              address: this.bucketVaultAddress,
              fromBlock: currentBlock - size,
              toBlock: currentBlock - BigInt(1)
            })
          })
          this.optimalChunkSize = size
          console.log(`Optimal chunk size detected: ${size} blocks`)
        } catch (error) {
          console.log(`Chunk size ${size} failed, using previous successful size: ${this.optimalChunkSize}`)
          break
        }
      }
    } catch (error) {
      console.warn('Could not detect optimal chunk size, using conservative default:', error)
      this.optimalChunkSize = BigInt(5)
    }
  }

  /**
   * Check if user is registered (must be implemented by caller)
   * This prevents RPC calls for unregistered users
   */
  private async checkUserRegistration(userAddress: string): Promise<boolean> {
    // This will be checked by the hook before calling sync methods
    // For now, we'll assume the caller has already verified registration
    return true
  }

  /**
   * Get cached transactions with optional fresh sync
   */
  async getCachedTransactions(
    userAddress: string,
    options: TransactionSyncOptions = {}
  ): Promise<{ transactions: BlockchainTransaction[]; fromCache: boolean }> {
    const useCache = options.useCache !== false
    const forceSync = options.forceSync === true
    const useAlchemy = options.useAlchemy !== false

    // Try to get from cache first
    if (useCache && !forceSync) {
      try {
        const cachedTxs = await transactionCache.getTransactions(userAddress, this.chainId)
        
        if (cachedTxs.length > 0) {
          // Check if cache is recent (within last hour)
          const hasRecentCache = await transactionCache.hasRecentCache(userAddress, this.chainId)
          
          if (hasRecentCache) {
            console.log(`Using cached transactions: ${cachedTxs.length} transactions`)
            const transactions = cachedTxs.map(cached => TransactionCacheService.fromCached(cached))
            return { transactions, fromCache: true }
          }
        }
        
        // If no cache or old cache, but maxBlocks is 0, return empty (don't sync)
        if (options.maxBlocks === 0) {
          console.log('No cache available and sync disabled (maxBlocks=0)')
          return { transactions: [], fromCache: false }
        }
      } catch (error) {
        console.warn('Failed to load cached transactions:', error)
        
        // If cache fails and sync is disabled, return empty
        if (options.maxBlocks === 0) {
          return { transactions: [], fromCache: false }
        }
      }
    }

    // If no cache or forced sync, fetch fresh data (only if maxBlocks > 0)
    if (options.maxBlocks === 0) {
      console.log('Sync disabled (maxBlocks=0), returning empty transactions')
      return { transactions: [], fromCache: false }
    }

    console.log('Fetching fresh transaction data...')
    
    // Try Alchemy first if enabled and API key is available
    let transactions: BlockchainTransaction[] = []
    if (useAlchemy && process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_API_KEY !== 'your_alchemy_api_key_here') {
      try {
        console.log('🚀 Using Alchemy Transfer API for optimized fetching...')
        transactions = await this.fetchUserTransactionsAlchemy(userAddress, options)
        console.log(`✅ Alchemy API returned ${transactions.length} transactions`)
      } catch (error) {
        console.warn('Alchemy API failed, falling back to standard RPC:', error)
        transactions = await this.syncHistoricalTransactions(userAddress, options)
      }
    } else {
      // Fallback to standard RPC method
      if (!process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY === 'your_alchemy_api_key_here') {
        console.log('⚠️ Alchemy API key not configured, using standard RPC (slower)')
      }
      transactions = await this.syncHistoricalTransactions(userAddress, options)
    }
    
    // Cache the results
    if (useCache) {
      try {
        console.log(`💾 CACHING FRESH TRANSACTION DATA:`)
        console.log(`   User: ${userAddress}`)
        console.log(`   Chain: ${this.chainId}`)
        console.log(`   Transactions to cache: ${transactions.length}`)
        
        await transactionCache.storeTransactions(transactions, userAddress, this.chainId)
        
        // Update sync metadata
        const currentBlock = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getBlockNumber()
        })
        
        const metadata: SyncMetadata = {
          userAddress,
          chainId: this.chainId,
          lastSyncedBlock: currentBlock.toString(),
          lastSyncedTimestamp: Date.now(),
          totalTransactions: transactions.length,
          lastUpdated: Date.now()
        }
        
        await transactionCache.updateSyncMetadata(metadata)
        console.log(`✅ Successfully cached ${transactions.length} transactions and updated sync metadata`)
      } catch (error) {
        console.warn('Failed to cache transactions:', error)
      }
    }

    return { transactions, fromCache: false }
  }

  /**
   * Fetch user transactions via Alchemy Transfer API (no block scanning)
   * Filters for your contracts; paginates for full history
   */
  async fetchUserTransactionsAlchemy(
    userAddress: string,
    options: TransactionSyncOptions = {}
  ): Promise<BlockchainTransaction[]> {
    try {
      const alchemyEndpoint = this.networkType === 'mainnet' 
        ? `https://mantle-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : `https://mantle-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`

      // Build request payload
      const payload = {
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: options.fromBlock ? `0x${options.fromBlock.toString(16)}` : '0x0',
          toBlock: options.toBlock ? `0x${options.toBlock.toString(16)}` : 'latest',
          fromAddress: userAddress,
          toAddress: userAddress,
          contractAddresses: [this.bucketVaultAddress, this.payrollEngineAddress],
          category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
          withMetadata: true,
          excludeZeroValue: false,
          maxCount: '0x3e8', // 1000 transactions per call
          order: 'asc'
        }]
      }

      console.log(`🔍 Fetching transactions via Alchemy Transfer API...`)
      console.log(`   Endpoint: ${alchemyEndpoint.replace(process.env.ALCHEMY_API_KEY!, '[API_KEY]')}`)
      console.log(`   User: ${userAddress}`)
      console.log(`   Contracts: [${this.bucketVaultAddress}, ${this.payrollEngineAddress}]`)

      const response = await fetch(alchemyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(`Alchemy API error: ${data.error.message}`)
      }

      if (!data.result || !data.result.transfers) {
        console.log('No transfers found via Alchemy API')
        return []
      }

      console.log(`📦 Alchemy returned ${data.result.transfers.length} transfers`)

      // Map Alchemy transfers to your BlockchainTransaction type
      const transactions: BlockchainTransaction[] = []
      
      for (const transfer of data.result.transfers) {
        try {
          // Skip transfers that don't involve our contracts
          const isRelevantContract = transfer.rawContract?.address && (
            transfer.rawContract.address.toLowerCase() === this.bucketVaultAddress.toLowerCase() ||
            transfer.rawContract.address.toLowerCase() === this.payrollEngineAddress.toLowerCase()
          )

          if (!isRelevantContract) {
            continue
          }

          // Get block timestamp for accurate transaction time
          let timestamp: Date
          try {
            const block = await this.rpcProvider.executeRead(async (client: any) => {
              return client.getBlock({ blockNumber: BigInt(transfer.blockNum) })
            })
            timestamp = new Date(Number(block.timestamp) * 1000)
          } catch (error) {
            // Fallback to current time if block fetch fails
            timestamp = new Date()
          }

          const transaction: BlockchainTransaction = {
            id: `${transfer.hash}-${transfer.uniqueId || '0'}`,
            hash: transfer.hash as `0x${string}`,
            type: this.inferTypeFromAlchemyTransfer(transfer),
            amount: BigInt(transfer.value || '0'),
            fromBucket: transfer.metadata?.fromBucket,
            toBucket: transfer.metadata?.toBucket,
            recipient: transfer.to || undefined,
            timestamp,
            blockNumber: BigInt(transfer.blockNum),
            status: 'completed', // Alchemy only returns confirmed transactions
            gasUsed: BigInt(0), // Will be filled if needed
            gasCost: BigInt(0),
            description: this.generateDescriptionFromAlchemyTransfer(transfer),
            metadata: this.extractMetadataFromAlchemyTransfer(transfer),
            contractAddress: transfer.rawContract?.address as `0x${string}` || this.bucketVaultAddress,
            eventName: transfer.rawContract?.eventName || 'Transfer'
          }

          transactions.push(transaction)
        } catch (error) {
          console.warn('Failed to process Alchemy transfer:', error, transfer)
          // Continue processing other transfers
        }
      }

      // Handle pagination if there are more results
      if (data.result.pageKey && transactions.length < 10000) { // Reasonable limit
        console.log('📄 Fetching additional pages...')
        const additionalTxs = await this.fetchAlchemyPaginatedResults(
          alchemyEndpoint, 
          payload, 
          data.result.pageKey,
          userAddress
        )
        transactions.push(...additionalTxs)
      }

      // Sort by block number and timestamp
      const sortedTransactions = transactions.sort((a, b) => {
        const blockDiff = Number(a.blockNumber - b.blockNumber)
        if (blockDiff !== 0) return blockDiff
        return a.timestamp.getTime() - b.timestamp.getTime()
      })

      console.log(`✅ Alchemy API processed ${sortedTransactions.length} relevant transactions`)
      return sortedTransactions

    } catch (error) {
      console.error('Alchemy Transfer API failed:', error)
      throw error
    }
  }

  /**
   * Fetch paginated results from Alchemy API
   */
  private async fetchAlchemyPaginatedResults(
    endpoint: string,
    basePayload: any,
    pageKey: string,
    userAddress: string,
    maxPages: number = 10
  ): Promise<BlockchainTransaction[]> {
    const allTransactions: BlockchainTransaction[] = []
    let currentPageKey = pageKey
    let pageCount = 0

    while (currentPageKey && pageCount < maxPages) {
      try {
        const paginatedPayload = {
          ...basePayload,
          params: [{
            ...basePayload.params[0],
            pageKey: currentPageKey
          }]
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(paginatedPayload)
        })

        const data = await response.json()
        
        if (data.error || !data.result?.transfers) {
          break
        }

        // Process transfers from this page
        for (const transfer of data.result.transfers) {
          try {
            const isRelevantContract = transfer.rawContract?.address && (
              transfer.rawContract.address.toLowerCase() === this.bucketVaultAddress.toLowerCase() ||
              transfer.rawContract.address.toLowerCase() === this.payrollEngineAddress.toLowerCase()
            )

            if (!isRelevantContract) continue

            let timestamp: Date
            try {
              const block = await this.rpcProvider.executeRead(async (client: any) => {
                return client.getBlock({ blockNumber: BigInt(transfer.blockNum) })
              })
              timestamp = new Date(Number(block.timestamp) * 1000)
            } catch (error) {
              timestamp = new Date()
            }

            const transaction: BlockchainTransaction = {
              id: `${transfer.hash}-${transfer.uniqueId || '0'}`,
              hash: transfer.hash as `0x${string}`,
              type: this.inferTypeFromAlchemyTransfer(transfer),
              amount: BigInt(transfer.value || '0'),
              fromBucket: transfer.metadata?.fromBucket,
              toBucket: transfer.metadata?.toBucket,
              recipient: transfer.to || undefined,
              timestamp,
              blockNumber: BigInt(transfer.blockNum),
              status: 'completed',
              gasUsed: BigInt(0),
              gasCost: BigInt(0),
              description: this.generateDescriptionFromAlchemyTransfer(transfer),
              metadata: this.extractMetadataFromAlchemyTransfer(transfer),
              contractAddress: transfer.rawContract?.address as `0x${string}` || this.bucketVaultAddress,
              eventName: transfer.rawContract?.eventName || 'Transfer'
            }

            allTransactions.push(transaction)
          } catch (error) {
            console.warn('Failed to process paginated transfer:', error)
          }
        }

        currentPageKey = data.result.pageKey
        pageCount++
        
        console.log(`📄 Processed page ${pageCount}, found ${data.result.transfers.length} transfers`)
        
        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error('Failed to fetch paginated results:', error)
        break
      }
    }

    return allTransactions
  }

  /**
   * Infer transaction type from Alchemy transfer data
   */
  private inferTypeFromAlchemyTransfer(transfer: any): TransactionType {
    const contractAddress = transfer.rawContract?.address?.toLowerCase()
    const eventName = transfer.rawContract?.eventName
    
    // Map based on contract and event
    if (contractAddress === this.bucketVaultAddress.toLowerCase()) {
      if (eventName === 'FundsSplit') return 'split'
      if (eventName === 'BucketTransfer') return 'transfer'
      if (eventName === 'GoalCompleted') return 'goal_completed'
      if (transfer.category === 'external' && transfer.value > 0) return 'deposit'
    }
    
    if (contractAddress === this.payrollEngineAddress.toLowerCase()) {
      if (eventName === 'PayrollProcessed') return 'payroll_processed'
      if (eventName === 'PayrollScheduled') return 'payroll_scheduled'
      if (eventName === 'EmployeeAdded') return 'employee_added'
    }
    
    // Default based on transfer direction and value
    if (transfer.to?.toLowerCase() === transfer.from?.toLowerCase()) return 'transfer'
    if (transfer.value > 0) return 'deposit'
    
    return 'transfer'
  }

  /**
   * Generate description from Alchemy transfer data
   */
  private generateDescriptionFromAlchemyTransfer(transfer: any): string {
    const type = this.inferTypeFromAlchemyTransfer(transfer)
    const value = transfer.value || '0'
    const asset = transfer.asset || 'tokens'
    
    switch (type) {
      case 'split':
        return `Auto-split deposit of ${value} ${asset}`
      case 'transfer':
        return `Transfer of ${value} ${asset}`
      case 'deposit':
        return `Deposit of ${value} ${asset}`
      case 'payroll_processed':
        return `Payroll processed: ${value} ${asset}`
      case 'goal_completed':
        return `Savings goal completed`
      default:
        return `Transaction: ${value} ${asset}`
    }
  }

  /**
   * Extract metadata from Alchemy transfer data
   */
  private extractMetadataFromAlchemyTransfer(transfer: any): TransactionMetadata {
    const metadata: TransactionMetadata = {}
    
    // Extract any available metadata from the transfer
    if (transfer.metadata) {
      if (transfer.metadata.splitConfig) {
        metadata.splitConfig = transfer.metadata.splitConfig
      }
      if (transfer.metadata.goalId) {
        metadata.goalId = BigInt(transfer.metadata.goalId)
      }
      if (transfer.metadata.batchId) {
        metadata.batchId = BigInt(transfer.metadata.batchId)
      }
    }
    
    return metadata
  }

  /**
   * Fetch user transactions via Alchemy Transfer API (no block scanning)
   * Filters for your contracts; paginates for full history
   */
  async fetchUserTransactionsAlchemy(
    userAddress: string,
    options: TransactionSyncOptions = {}
  ): Promise<BlockchainTransaction[]> {
    try {
      const alchemyUrl = this.networkType === 'sepolia' 
        ? `https://mantle-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : `https://mantle-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`

      console.log(`🔍 Fetching transactions via Alchemy for ${userAddress}`)
      
      const response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: options.fromBlock ? `0x${options.fromBlock.toString(16)}` : '0x0',
            toBlock: options.toBlock ? `0x${options.toBlock.toString(16)}` : 'latest',
            fromAddress: userAddress,
            toAddress: userAddress,
            category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
            contractAddresses: [this.bucketVaultAddress, this.payrollEngineAddress],
            maxCount: '0x64', // 100 per page
            withMetadata: true,
            excludeZeroValue: false
          }]
        })
      })

      if (!response.ok) {
        throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(`Alchemy API error: ${data.error.message}`)
      }

      if (!data.result || !data.result.transfers) {
        console.log('No transfers found via Alchemy API')
        return []
      }

      console.log(`📦 Alchemy returned ${data.result.transfers.length} transfers`)

      // Map Alchemy transfers to BlockchainTransaction format
      const transactions: BlockchainTransaction[] = []
      
      for (const transfer of data.result.transfers) {
        try {
          const transaction: BlockchainTransaction = {
            id: `${transfer.hash}-${transfer.logIndex || 0}`,
            hash: transfer.hash as `0x${string}`,
            type: this.inferTypeFromAlchemyTransfer(transfer),
            amount: BigInt(transfer.value ? Math.floor(parseFloat(transfer.value) * 1e18) : 0),
            fromBucket: transfer.metadata?.fromBucket,
            toBucket: transfer.metadata?.toBucket,
            recipient: transfer.to || undefined,
            timestamp: new Date(transfer.metadata?.blockTimestamp ? 
              Number(transfer.metadata.blockTimestamp) * 1000 : Date.now()),
            blockNumber: BigInt(parseInt(transfer.blockNum, 16)),
            status: 'completed',
            gasUsed: BigInt(0), // Alchemy doesn't provide gas info in transfers
            gasCost: BigInt(0),
            description: `${transfer.category} transfer of ${transfer.value || '0'} ${transfer.asset || 'tokens'}`,
            metadata: {
              // Parse any additional metadata from Alchemy
              ...transfer.metadata
            },
            contractAddress: transfer.rawContract?.address as `0x${string}` || this.bucketVaultAddress,
            eventName: transfer.category || 'Transfer'
          }
          
          transactions.push(transaction)
        } catch (error) {
          console.warn('Failed to parse Alchemy transfer:', error, transfer)
        }
      }

      // Handle pagination if there are more results
      let pageKey = data.result.pageKey
      while (pageKey && transactions.length < 1000) { // Limit to prevent infinite loops
        try {
          const nextResponse = await fetch(alchemyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: 1,
              jsonrpc: '2.0',
              method: 'alchemy_getAssetTransfers',
              params: [{
                fromBlock: options.fromBlock ? `0x${options.fromBlock.toString(16)}` : '0x0',
                toBlock: options.toBlock ? `0x${options.toBlock.toString(16)}` : 'latest',
                fromAddress: userAddress,
                toAddress: userAddress,
                category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
                contractAddresses: [this.bucketVaultAddress, this.payrollEngineAddress],
                maxCount: '0x64',
                withMetadata: true,
                excludeZeroValue: false,
                pageKey: pageKey
              }]
            })
          })

          const nextData = await nextResponse.json()
          if (nextData.result && nextData.result.transfers) {
            for (const transfer of nextData.result.transfers) {
              try {
                const transaction: BlockchainTransaction = {
                  id: `${transfer.hash}-${transfer.logIndex || 0}`,
                  hash: transfer.hash as `0x${string}`,
                  type: this.inferTypeFromAlchemyTransfer(transfer),
                  amount: BigInt(transfer.value ? Math.floor(parseFloat(transfer.value) * 1e18) : 0),
                  fromBucket: transfer.metadata?.fromBucket,
                  toBucket: transfer.metadata?.toBucket,
                  recipient: transfer.to || undefined,
                  timestamp: new Date(transfer.metadata?.blockTimestamp ? 
                    Number(transfer.metadata.blockTimestamp) * 1000 : Date.now()),
                  blockNumber: BigInt(parseInt(transfer.blockNum, 16)),
                  status: 'completed',
                  gasUsed: BigInt(0),
                  gasCost: BigInt(0),
                  description: `${transfer.category} transfer of ${transfer.value || '0'} ${transfer.asset || 'tokens'}`,
                  metadata: { ...transfer.metadata },
                  contractAddress: transfer.rawContract?.address as `0x${string}` || this.bucketVaultAddress,
                  eventName: transfer.category || 'Transfer'
                }
                
                transactions.push(transaction)
              } catch (error) {
                console.warn('Failed to parse paginated Alchemy transfer:', error)
              }
            }
          }
          
          pageKey = nextData.result?.pageKey
        } catch (error) {
          console.warn('Failed to fetch paginated results:', error)
          break
        }
      }

      console.log(`✅ Processed ${transactions.length} transactions from Alchemy API`)
      
      return transactions.sort((a, b) => Number(a.blockNumber - b.blockNumber))
      
    } catch (error) {
      console.error('Alchemy fetch failed:', error)
      // Fallback to existing getLogs method
      console.log('🔄 Falling back to standard RPC method...')
      return this.syncHistoricalTransactions(userAddress, options)
    }
  }

  /**
   * Helper: Infer transaction type from Alchemy transfer data
   */
  private inferTypeFromAlchemyTransfer(transfer: any): TransactionType {
    const contract = transfer.rawContract?.address?.toLowerCase()
    const eventName = transfer.metadata?.eventName || transfer.category
    
    if (contract === this.bucketVaultAddress.toLowerCase()) {
      if (eventName === 'FundsSplit') return 'split'
      if (eventName === 'BucketTransfer') return 'transfer'
      if (eventName === 'GoalCompleted') return 'goal_completed'
    }
    
    if (contract === this.payrollEngineAddress.toLowerCase()) {
      if (eventName === 'PayrollProcessed') return 'payroll_processed'
      if (eventName === 'EmployeeAdded') return 'employee_added'
      if (eventName === 'PayrollScheduled') return 'payroll_scheduled'
    }
    
    // Default categorization based on transfer type
    if (transfer.category === 'external') return 'deposit'
    if (transfer.category === 'internal') return 'transfer'
    
    return 'transfer' // Default fallback
  }

  /**
   * Incremental sync - only fetch new transactions since last sync
   */
  async syncIncrementalTransactions(userAddress: string): Promise<BlockchainTransaction[]> {
    try {
      // Get last synced block
      const lastSyncedBlock = await transactionCache.getLastSyncedBlock(userAddress, this.chainId)
      
      if (!lastSyncedBlock) {
        // No previous sync, do full sync with small range
        console.log('No previous sync found, doing initial sync')
        return this.syncRecentTransactions(userAddress)
      }

      // Get current block
      const currentBlock = await this.rpcProvider.executeRead(async (client: any) => {
        return client.getBlockNumber()
      })

      // If we're already up to date, return empty
      if (lastSyncedBlock >= currentBlock) {
        console.log('Already up to date')
        return []
      }

      // Sync from last block to current (with reasonable limits)
      const maxIncrementalBlocks = BigInt(100) // Conservative limit for incremental sync
      const fromBlock = lastSyncedBlock + BigInt(1)
      const toBlock = currentBlock - fromBlock > maxIncrementalBlocks 
        ? fromBlock + maxIncrementalBlocks 
        : currentBlock

      console.log(`Incremental sync from block ${fromBlock} to ${toBlock}`)

      const newTransactions = await this.syncHistoricalTransactions(userAddress, {
        fromBlock,
        toBlock,
        maxBlocks: Number(toBlock - fromBlock + BigInt(1)),
        includePayroll: true
      })

      // Cache new transactions
      if (newTransactions.length > 0) {
        console.log(`💾 CACHING INCREMENTAL TRANSACTION DATA:`)
        console.log(`   User: ${userAddress}`)
        console.log(`   Chain: ${this.chainId}`)
        console.log(`   New transactions: ${newTransactions.length}`)
        
        await transactionCache.storeTransactions(newTransactions, userAddress, this.chainId)
        
        // Update metadata
        const metadata: SyncMetadata = {
          userAddress,
          chainId: this.chainId,
          lastSyncedBlock: toBlock.toString(),
          lastSyncedTimestamp: Date.now(),
          totalTransactions: (await transactionCache.getTransactions(userAddress, this.chainId)).length,
          lastUpdated: Date.now()
        }
        
        await transactionCache.updateSyncMetadata(metadata)
        console.log(`✅ Incrementally synced and cached ${newTransactions.length} new transactions`)
      }

      return newTransactions
    } catch (error) {
      console.error('Incremental sync failed:', error)
      throw error
    }
  }

  /**
   * Get cache statistics for debugging
   */
  async getCacheInfo(userAddress: string): Promise<{
    hasCache: boolean
    stats: any
    metadata: SyncMetadata | null
  }> {
    const stats = await transactionCache.getCacheStats(userAddress, this.chainId)
    const metadata = await transactionCache.getSyncMetadata(userAddress, this.chainId)
    
    return {
      hasCache: stats.totalTransactions > 0,
      stats,
      metadata
    }
  }

  /**
   * Clear cache for user (useful for troubleshooting)
   */
  async clearCache(userAddress: string): Promise<void> {
    await transactionCache.clearUserCache(userAddress, this.chainId)
    console.log(`Cleared cache for ${userAddress} on chain ${this.chainId}`)
  }

  /**
   * Sync recent transactions (optimized for onboarding UX)
   */
  async syncRecentTransactions(userAddress: string, maxBlocks: number = 100): Promise<BlockchainTransaction[]> {
    try {
      const currentBlock = await this.rpcProvider.executeRead(async (client: any) => {
        return client.getBlockNumber()
      })
      
      // Sync only recent blocks for fast UX
      const fromBlock = currentBlock - BigInt(maxBlocks)
      
      console.log(`Syncing recent ${maxBlocks} blocks for onboarding UX`)
      
      return this.syncHistoricalTransactions(userAddress, {
        fromBlock: fromBlock > BigInt(0) ? fromBlock : BigInt(0),
        toBlock: currentBlock,
        maxBlocks,
        includePayroll: true
      })
    } catch (error) {
      console.error('Error syncing recent transactions:', error)
      throw new Error(`Failed to sync recent transactions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sync transactions in smaller batches for large date ranges
   * This is useful when you need to sync a lot of historical data without hitting RPC limits
   */
  async syncTransactionsBatched(
    userAddress: string,
    fromBlock: bigint,
    toBlock: bigint,
    batchSize: number = 50, // Very conservative batch size
    onProgress?: (progress: { current: bigint; total: bigint; percentage: number }) => void
  ): Promise<BlockchainTransaction[]> {
    const allTransactions: BlockchainTransaction[] = []
    const totalBlocks = toBlock - fromBlock + BigInt(1)
    let currentFromBlock = fromBlock
    
    console.log(`Starting batched sync for ${totalBlocks} blocks in batches of ${batchSize}`)
    
    while (currentFromBlock <= toBlock) {
      const currentToBlock = currentFromBlock + BigInt(batchSize) - BigInt(1) > toBlock 
        ? toBlock 
        : currentFromBlock + BigInt(batchSize) - BigInt(1)
      
      try {
        console.log(`Syncing batch: blocks ${currentFromBlock} to ${currentToBlock}`)
        
        const batchTransactions = await this.syncHistoricalTransactions(userAddress, {
          fromBlock: currentFromBlock,
          toBlock: currentToBlock,
          maxBlocks: batchSize
        })
        
        allTransactions.push(...batchTransactions)
        
        // Report progress
        if (onProgress) {
          const processed = currentToBlock - fromBlock + BigInt(1)
          const percentage = Number(processed * BigInt(100) / totalBlocks)
          onProgress({
            current: currentToBlock,
            total: toBlock,
            percentage
          })
        }
        
        // Add delay between batches to be respectful to RPC providers
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error) {
        console.error(`Failed to sync batch ${currentFromBlock}-${currentToBlock}:`, error)
        // Continue with next batch instead of failing completely
      }
      
      currentFromBlock = currentToBlock + BigInt(1)
    }
    
    // Sort all transactions
    return allTransactions.sort((a, b) => {
      const blockDiff = Number(a.blockNumber - b.blockNumber)
      if (blockDiff !== 0) return blockDiff
      return a.timestamp.getTime() - b.timestamp.getTime()
    })
  }

  /**
   * Sync all historical transactions for a user from wallet creation date
   * 
   * Note: Different RPC providers have various limits:
   * - Alchemy Free Tier: 10 blocks max per eth_getLogs request
   * - Mantle RPC: ~100 blocks max to avoid 413 Content Too Large errors
   * This method automatically adapts to these limits.
   */
  async syncHistoricalTransactions(
    userAddress: string, 
    options: TransactionSyncOptions = {}
  ): Promise<BlockchainTransaction[]> {
    try {
      const transactions: BlockchainTransaction[] = []
      
      // Get current block number
      const currentBlock = await this.rpcProvider.executeRead(async (client: any) => {
        return client.getBlockNumber()
      })
      
      // Default to syncing from 1 day ago (very conservative)
      const defaultFromBlock = currentBlock - BigInt(1 * 24 * 60 * 2) // ~1 day of blocks (2 min block time)
      const fromBlock = options.fromBlock || (defaultFromBlock > BigInt(0) ? defaultFromBlock : BigInt(0))
      const toBlock = options.toBlock || currentBlock
      
      // Ensure we don't exceed reasonable limits (ultra conservative: 100 blocks max)
      const maxBlockRange = BigInt(options.maxBlocks || 100)
      const actualFromBlock = toBlock - maxBlockRange > fromBlock ? toBlock - maxBlockRange : fromBlock
      
      console.log(`Syncing transactions from block ${actualFromBlock} to ${toBlock} (${toBlock - actualFromBlock + BigInt(1)} blocks)`)
      
      // Sync BucketVault transactions
      const bucketTransactions = await this.syncBucketVaultTransactions(
        userAddress, 
        actualFromBlock, 
        toBlock
      )
      transactions.push(...bucketTransactions)
      
      // Sync PayrollEngine transactions if requested
      if (options.includePayroll !== false) {
        const payrollTransactions = await this.syncPayrollEngineTransactions(
          userAddress, 
          actualFromBlock, 
          toBlock
        )
        transactions.push(...payrollTransactions)
      }
      
      // Sort by block number and timestamp
      return transactions.sort((a, b) => {
        const blockDiff = Number(a.blockNumber - b.blockNumber)
        if (blockDiff !== 0) return blockDiff
        return a.timestamp.getTime() - b.timestamp.getTime()
      })
      
    } catch (error) {
      console.error('Error syncing historical transactions:', error)
      throw new Error(`Failed to sync historical transactions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Helper function to chunk large block ranges into smaller requests
   * 
   * Handles different RPC provider limitations:
   * - Alchemy Free Tier: 10 blocks max per eth_getLogs request
   * - Mantle RPC: ~50 blocks max to avoid 413 Content Too Large errors
   * - Other RPCs: Various limits
   */
  private async getLogsInChunks(
    logParams: any,
    fromBlock: bigint,
    toBlock: bigint,
    maxChunkSize: bigint = BigInt(5) // Start ultra-conservative for Alchemy free tier
  ): Promise<any[]> {
    const allLogs: any[] = []
    let currentFromBlock = fromBlock
    let currentChunkSize = maxChunkSize
    let consecutiveFailures = 0
    
    // Calculate total blocks to process
    const totalBlocks = toBlock - fromBlock + BigInt(1)
    console.log(`Processing ${totalBlocks} blocks in chunks of ${maxChunkSize}`)
    
    while (currentFromBlock <= toBlock) {
      const currentToBlock = currentFromBlock + currentChunkSize - BigInt(1) > toBlock 
        ? toBlock 
        : currentFromBlock + currentChunkSize - BigInt(1)
      
      try {
        console.log(`Fetching logs for blocks ${currentFromBlock} to ${currentToBlock} (chunk size: ${currentChunkSize})`)
        
        const logs = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getLogs({
            ...logParams,
            fromBlock: currentFromBlock,
            toBlock: currentToBlock
          })
        })
        
        allLogs.push(...logs)
        console.log(`Found ${logs.length} logs in chunk`)
        
        // Success - reset failure counter and potentially increase chunk size
        consecutiveFailures = 0
        if (currentChunkSize < BigInt(10) && logs.length < 50) {
          // Gradually increase chunk size if we're getting small results, but cap at 10 for Alchemy
          currentChunkSize = BigInt(Math.min(Number(currentChunkSize) + 1, 10))
        }
        
        // Add a small delay between requests to avoid rate limiting
        if (currentFromBlock + currentChunkSize <= toBlock) {
          await new Promise(resolve => setTimeout(resolve, 300)) // 300ms delay
        }
        
      } catch (error: unknown) {
        const errorMessage = (error as Error).message || String(error)
        console.warn(`Failed to get logs for blocks ${currentFromBlock}-${currentToBlock}:`, errorMessage)
        
        consecutiveFailures++
        
        // Handle specific error types
        if (errorMessage.includes('Under the Free tier plan') || errorMessage.includes('10 block range')) {
          // Alchemy free tier limit - use exactly 5 blocks to be safe
          currentChunkSize = BigInt(5)
          console.log('Detected Alchemy free tier limit, using 5 block chunks')
        } else if (errorMessage.includes('413') || errorMessage.includes('Content Too Large')) {
          // Content too large - reduce chunk size significantly
          currentChunkSize = BigInt(Math.max(1, Number(currentChunkSize) / 3))
          console.log(`Content too large error, reducing chunk size to ${currentChunkSize}`)
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          // Network issues - reduce chunk size and add longer delay
          currentChunkSize = BigInt(Math.max(1, Number(currentChunkSize) / 2))
          console.log(`Network error, reducing chunk size to ${currentChunkSize}`)
          await new Promise(resolve => setTimeout(resolve, 2000)) // 2s delay for network issues
        } else {
          // Generic error - reduce chunk size
          currentChunkSize = BigInt(Math.max(1, Number(currentChunkSize) / 2))
        }
        
        // If we're already at minimum chunk size and still failing, skip this range
        if (currentChunkSize <= BigInt(1) && consecutiveFailures >= 3) {
          console.error(`Skipping blocks ${currentFromBlock}-${currentToBlock} after ${consecutiveFailures} failures`)
          currentFromBlock = currentToBlock + BigInt(1)
          consecutiveFailures = 0
          currentChunkSize = BigInt(5) // Reset chunk size for next range
          continue
        }
        
        // Don't advance the block range on failure - retry with smaller chunk
        continue
      }
      
      currentFromBlock = currentToBlock + BigInt(1)
    }
    
    console.log(`Total logs collected: ${allLogs.length}`)
    return allLogs
  }

  /**
   * Sync BucketVault contract events
   */
  private async syncBucketVaultTransactions(
    userAddress: string,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<BlockchainTransaction[]> {
    const transactions: BlockchainTransaction[] = []
    
    try {
      const bucketVault = getContract({
        address: this.bucketVaultAddress as `0x${string}`,
        abi: BucketVaultABI,
        client: this.publicClient
      })

      // Get FundsSplit events
      const fundsSplitEvents = await this.getLogsInChunks({
        address: this.bucketVaultAddress,
        event: {
          type: 'event',
          name: 'FundsSplit',
          inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { 
              name: 'config', 
              type: 'tuple',
              components: [
                { name: 'billingsPercent', type: 'uint256' },
                { name: 'savingsPercent', type: 'uint256' },
                { name: 'growthPercent', type: 'uint256' },
                { name: 'instantPercent', type: 'uint256' },
                { name: 'spendablePercent', type: 'uint256' }
              ],
              indexed: false 
            }
          ]
        },
        args: { user: userAddress as `0x${string}` }
      }, fromBlock, toBlock)

      for (const event of fundsSplitEvents) {
        const block = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getBlock({ blockNumber: event.blockNumber })
        })
        const transaction = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getTransaction({ hash: event.transactionHash })
        })
        
        transactions.push({
          id: `${event.transactionHash}-${event.logIndex}`,
          hash: event.transactionHash,
          type: 'split',
          amount: event.args.amount,
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: event.blockNumber,
          status: 'completed',
          gasUsed: BigInt(0), // Will be filled from transaction receipt if needed
          gasCost: BigInt(0),
          description: `Auto-split deposit of ${event.args.amount} tokens`,
          metadata: {
            splitConfig: event.args.config
          },
          contractAddress: this.bucketVaultAddress,
          eventName: 'FundsSplit'
        })
      }

      // Get BucketTransfer events
      const bucketTransferEvents = await this.getLogsInChunks({
        address: this.bucketVaultAddress,
        event: {
          type: 'event',
          name: 'BucketTransfer',
          inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'fromBucket', type: 'string', indexed: true },
            { name: 'toBucket', type: 'string', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false }
          ]
        },
        args: { user: userAddress as `0x${string}` }
      }, fromBlock, toBlock)

      for (const event of bucketTransferEvents) {
        const block = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getBlock({ blockNumber: event.blockNumber })
        })
        
        transactions.push({
          id: `${event.transactionHash}-${event.logIndex}`,
          hash: event.transactionHash,
          type: 'transfer',
          amount: event.args.amount,
          fromBucket: event.args.fromBucket,
          toBucket: event.args.toBucket,
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: event.blockNumber,
          status: 'completed',
          gasUsed: BigInt(0),
          gasCost: BigInt(0),
          description: `Transfer ${event.args.amount} from ${event.args.fromBucket} to ${event.args.toBucket}`,
          metadata: {},
          contractAddress: this.bucketVaultAddress,
          eventName: 'BucketTransfer'
        })
      }

      // Get GoalCompleted events
      const goalCompletedEvents = await this.getLogsInChunks({
        address: this.bucketVaultAddress,
        event: {
          type: 'event',
          name: 'GoalCompleted',
          inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'goalId', type: 'uint256', indexed: true },
            { name: 'bonusApy', type: 'uint256', indexed: false }
          ]
        },
        args: { user: userAddress as `0x${string}` }
      }, fromBlock, toBlock)

      for (const event of goalCompletedEvents) {
        const block = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getBlock({ blockNumber: event.blockNumber })
        })
        
        transactions.push({
          id: `${event.transactionHash}-${event.logIndex}`,
          hash: event.transactionHash,
          type: 'goal_completed',
          amount: BigInt(0),
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: event.blockNumber,
          status: 'completed',
          gasUsed: BigInt(0),
          gasCost: BigInt(0),
          description: `Savings goal ${event.args.goalId} completed with ${event.args.bonusApy}% bonus APY`,
          metadata: {
            goalId: event.args.goalId,
            bonusAPY: event.args.bonusApy
          },
          contractAddress: this.bucketVaultAddress,
          eventName: 'GoalCompleted'
        })
      }

    } catch (error) {
      console.error('Error syncing BucketVault transactions:', error)
    }

    return transactions
  }

  /**
   * Sync PayrollEngine contract events
   */
  private async syncPayrollEngineTransactions(
    userAddress: string,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<BlockchainTransaction[]> {
    const transactions: BlockchainTransaction[] = []
    
    try {
      // Get EmployeeAdded events where user is the employer
      const employeeAddedEvents = await this.getLogsInChunks({
        address: this.payrollEngineAddress,
        event: {
          type: 'event',
          name: 'EmployeeAdded',
          inputs: [
            { name: 'employer', type: 'address', indexed: true },
            { name: 'employee', type: 'address', indexed: true },
            { name: 'salary', type: 'uint256', indexed: false },
            { name: 'paymentDate', type: 'uint256', indexed: false }
          ]
        },
        args: { employer: userAddress as `0x${string}` }
      }, fromBlock, toBlock)

      for (const event of employeeAddedEvents) {
        const block = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getBlock({ blockNumber: event.blockNumber })
        })
        
        transactions.push({
          id: `${event.transactionHash}-${event.logIndex}`,
          hash: event.transactionHash,
          type: 'employee_added',
          amount: event.args.salary,
          recipient: event.args.employee,
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: event.blockNumber,
          status: 'completed',
          gasUsed: BigInt(0),
          gasCost: BigInt(0),
          description: `Added employee ${event.args.employee} with salary ${event.args.salary}`,
          metadata: {},
          contractAddress: this.payrollEngineAddress,
          eventName: 'EmployeeAdded'
        })
      }

      // Get PayrollScheduled events
      const payrollScheduledEvents = await this.getLogsInChunks({
        address: this.payrollEngineAddress,
        event: {
          type: 'event',
          name: 'PayrollScheduled',
          inputs: [
            { name: 'employer', type: 'address', indexed: true },
            { name: 'batchId', type: 'uint256', indexed: true },
            { name: 'scheduledDate', type: 'uint256', indexed: false },
            { name: 'totalAmount', type: 'uint256', indexed: false },
            { name: 'employeeCount', type: 'uint256', indexed: false }
          ]
        },
        args: { employer: userAddress as `0x${string}` }
      }, fromBlock, toBlock)

      for (const event of payrollScheduledEvents) {
        const block = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getBlock({ blockNumber: event.blockNumber })
        })
        
        transactions.push({
          id: `${event.transactionHash}-${event.logIndex}`,
          hash: event.transactionHash,
          type: 'payroll_scheduled',
          amount: event.args.totalAmount,
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: event.blockNumber,
          status: 'completed',
          gasUsed: BigInt(0),
          gasCost: BigInt(0),
          description: `Scheduled payroll batch ${event.args.batchId} for ${event.args.employeeCount} employees`,
          metadata: {
            batchId: event.args.batchId,
            employeeCount: event.args.employeeCount
          },
          contractAddress: this.payrollEngineAddress,
          eventName: 'PayrollScheduled'
        })
      }

      // Get PayrollProcessed events
      const payrollProcessedEvents = await this.getLogsInChunks({
        address: this.payrollEngineAddress,
        event: {
          type: 'event',
          name: 'PayrollProcessed',
          inputs: [
            { name: 'batchId', type: 'uint256', indexed: true },
            { name: 'employer', type: 'address', indexed: true },
            { name: 'totalAmount', type: 'uint256', indexed: false },
            { name: 'employeeCount', type: 'uint256', indexed: false },
            { name: 'successful', type: 'bool', indexed: false }
          ]
        },
        args: { employer: userAddress as `0x${string}` }
      }, fromBlock, toBlock)

      for (const event of payrollProcessedEvents) {
        const block = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getBlock({ blockNumber: event.blockNumber })
        })
        
        transactions.push({
          id: `${event.transactionHash}-${event.logIndex}`,
          hash: event.transactionHash,
          type: 'payroll_processed',
          amount: event.args.totalAmount,
          timestamp: new Date(Number(block.timestamp) * 1000),
          blockNumber: event.blockNumber,
          status: event.args.successful ? 'completed' : 'failed',
          gasUsed: BigInt(0),
          gasCost: BigInt(0),
          description: `Processed payroll batch ${event.args.batchId} for ${event.args.employeeCount} employees`,
          metadata: {
            batchId: event.args.batchId,
            employeeCount: event.args.employeeCount
          },
          contractAddress: this.payrollEngineAddress,
          eventName: 'PayrollProcessed'
        })
      }

    } catch (error) {
      console.error('Error syncing PayrollEngine transactions:', error)
    }

    return transactions
  }

  /**
   * Get real-time transaction updates by watching for new events
   */
  async watchTransactions(
    userAddress: string,
    onTransaction: (transaction: BlockchainTransaction) => void
  ): Promise<() => void> {
    const unsubscribeFunctions: (() => void)[] = []

    try {
      // Watch BucketVault events
      const unsubscribeBucketVault = this.publicClient.watchEvent({
        address: this.bucketVaultAddress,
        events: [
          {
            type: 'event',
            name: 'FundsSplit',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
              { 
                name: 'config', 
                type: 'tuple',
                components: [
                  { name: 'billingsPercent', type: 'uint256' },
                  { name: 'savingsPercent', type: 'uint256' },
                  { name: 'growthPercent', type: 'uint256' },
                  { name: 'instantPercent', type: 'uint256' },
                  { name: 'spendablePercent', type: 'uint256' }
                ],
                indexed: false 
              }
            ]
          },
          {
            type: 'event',
            name: 'BucketTransfer',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'fromBucket', type: 'string', indexed: true },
              { name: 'toBucket', type: 'string', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false }
            ]
          }
        ],
        args: { user: userAddress as `0x${string}` },
        onLogs: async (logs: any[]) => {
          for (const log of logs) {
            const block = await this.rpcProvider.executeRead(async (client: any) => {
              return client.getBlock({ blockNumber: log.blockNumber })
            })
            
            let transaction: BlockchainTransaction
            
            if (log.eventName === 'FundsSplit') {
              transaction = {
                id: `${log.transactionHash}-${log.logIndex}`,
                hash: log.transactionHash,
                type: 'split',
                amount: log.args.amount,
                timestamp: new Date(Number(block.timestamp) * 1000),
                blockNumber: log.blockNumber,
                status: 'completed',
                gasUsed: BigInt(0),
                gasCost: BigInt(0),
                description: `Auto-split deposit of ${log.args.amount} tokens`,
                metadata: {
                  splitConfig: log.args.config
                },
                contractAddress: this.bucketVaultAddress,
                eventName: 'FundsSplit'
              }
            } else if (log.eventName === 'BucketTransfer') {
              transaction = {
                id: `${log.transactionHash}-${log.logIndex}`,
                hash: log.transactionHash,
                type: 'transfer',
                amount: log.args.amount,
                fromBucket: log.args.fromBucket,
                toBucket: log.args.toBucket,
                timestamp: new Date(Number(block.timestamp) * 1000),
                blockNumber: log.blockNumber,
                status: 'completed',
                gasUsed: BigInt(0),
                gasCost: BigInt(0),
                description: `Transfer ${log.args.amount} from ${log.args.fromBucket} to ${log.args.toBucket}`,
                metadata: {},
                contractAddress: this.bucketVaultAddress,
                eventName: 'BucketTransfer'
              }
            } else {
              continue
            }
            
            onTransaction(transaction)
          }
        }
      })
      
      unsubscribeFunctions.push(unsubscribeBucketVault)

      // Watch PayrollEngine events
      const unsubscribePayrollEngine = this.publicClient.watchEvent({
        address: this.payrollEngineAddress,
        events: [
          {
            type: 'event',
            name: 'PayrollProcessed',
            inputs: [
              { name: 'batchId', type: 'uint256', indexed: true },
              { name: 'employer', type: 'address', indexed: true },
              { name: 'totalAmount', type: 'uint256', indexed: false },
              { name: 'employeeCount', type: 'uint256', indexed: false },
              { name: 'successful', type: 'bool', indexed: false }
            ]
          }
        ],
        args: { employer: userAddress as `0x${string}` },
        onLogs: async (logs: any[]) => {
          for (const log of logs) {
            const block = await this.rpcProvider.executeRead(async (client: any) => {
              return client.getBlock({ blockNumber: log.blockNumber })
            })
            
            const transaction: BlockchainTransaction = {
              id: `${log.transactionHash}-${log.logIndex}`,
              hash: log.transactionHash,
              type: 'payroll_processed',
              amount: log.args.totalAmount,
              timestamp: new Date(Number(block.timestamp) * 1000),
              blockNumber: log.blockNumber,
              status: log.args.successful ? 'completed' : 'failed',
              gasUsed: BigInt(0),
              gasCost: BigInt(0),
              description: `Processed payroll batch ${log.args.batchId} for ${log.args.employeeCount} employees`,
              metadata: {
                batchId: log.args.batchId,
                employeeCount: log.args.employeeCount
              },
              contractAddress: this.payrollEngineAddress,
              eventName: 'PayrollProcessed'
            }
            
            onTransaction(transaction)
          }
        }
      })
      
      unsubscribeFunctions.push(unsubscribePayrollEngine)

    } catch (error) {
      console.error('Error setting up transaction watchers:', error)
    }

    // Return cleanup function
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => {
        try {
          unsubscribe()
        } catch (error) {
          console.error('Error unsubscribing from transaction watcher:', error)
        }
      })
    }
  }

  /**
   * Categorize transactions for better organization
   */
  static categorizeTransaction(transaction: BlockchainTransaction): string {
    switch (transaction.type) {
      case 'split':
        return 'Deposits & Splits'
      case 'transfer':
        return 'Bucket Transfers'
      case 'withdrawal':
        return 'Withdrawals'
      case 'goal_created':
      case 'goal_completed':
        return 'Savings Goals'
      case 'employee_added':
      case 'payroll_scheduled':
      case 'payroll_processed':
        return 'Payroll Management'
      default:
        return 'Other'
    }
  }

  /**
   * Generate wrapped report data from transaction history
   */
  static generateWrappedData(
    transactions: BlockchainTransaction[], 
    year: number,
    walletAddress: string
  ): WrappedReport {
    const yearTransactions = transactions.filter(tx => 
      tx.timestamp.getFullYear() === year
    )

    const totalVolume = yearTransactions.reduce((sum, tx) => 
      sum + Number(tx.amount), 0
    )

    const transactionsByType = yearTransactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topTransactionType = Object.entries(transactionsByType)
      .sort(([,a], [,b]) => b - a)[0]

    return {
      year,
      walletAddress,
      totalVolume,
      totalTransactions: yearTransactions.length,
      topAsset: {
        type: topTransactionType?.[0] || 'none',
        count: topTransactionType?.[1] || 0,
        volume: totalVolume
      },
      activityPattern: this.analyzeActivityPattern(yearTransactions),
      userArchetype: this.determineUserArchetype(yearTransactions),
      monthlyBreakdown: this.generateMonthlyBreakdown(yearTransactions),
      achievements: this.generateAchievements(yearTransactions),
      generatedAt: new Date()
    }
  }

  private static analyzeActivityPattern(transactions: BlockchainTransaction[]): ActivityPattern {
    const monthlyActivity = new Array(12).fill(0)
    
    transactions.forEach(tx => {
      monthlyActivity[tx.timestamp.getMonth()]++
    })

    const maxActivity = Math.max(...monthlyActivity)
    const peakMonth = monthlyActivity.indexOf(maxActivity)
    
    return {
      peakMonth: peakMonth + 1, // 1-indexed
      averageMonthlyTransactions: transactions.length / 12,
      mostActiveDay: this.getMostActiveDay(transactions),
      consistency: this.calculateConsistency(monthlyActivity)
    }
  }

  private static getMostActiveDay(transactions: BlockchainTransaction[]): string {
    const dayCount = new Array(7).fill(0)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    
    transactions.forEach(tx => {
      dayCount[tx.timestamp.getDay()]++
    })

    const maxDay = dayCount.indexOf(Math.max(...dayCount))
    return dayNames[maxDay]
  }

  private static calculateConsistency(monthlyActivity: number[]): number {
    const mean = monthlyActivity.reduce((a, b) => a + b, 0) / monthlyActivity.length
    
    // Handle case where there are no transactions (mean = 0)
    if (mean === 0) {
      return 100 // Perfect consistency when no activity
    }
    
    const variance = monthlyActivity.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / monthlyActivity.length
    const stdDev = Math.sqrt(variance)
    
    // Return consistency score (lower standard deviation = higher consistency)
    return Math.max(0, 100 - (stdDev / mean) * 100)
  }

  private static determineUserArchetype(transactions: BlockchainTransaction[]): UserArchetype {
    const typeCount = transactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalTransactions = transactions.length
    const splitRatio = (typeCount.split || 0) / totalTransactions
    const payrollRatio = ((typeCount.payroll_scheduled || 0) + (typeCount.payroll_processed || 0)) / totalTransactions
    const goalRatio = ((typeCount.goal_created || 0) + (typeCount.goal_completed || 0)) / totalTransactions

    if (payrollRatio > 0.3) {
      return {
        type: 'Team Manager',
        description: 'Actively manages team payroll and employee payments',
        traits: ['Payroll Management', 'Team Leadership', 'Financial Planning']
      }
    } else if (goalRatio > 0.2) {
      return {
        type: 'Goal-Oriented Saver',
        description: 'Focuses on savings goals and long-term financial planning',
        traits: ['Goal Setting', 'Disciplined Saving', 'Long-term Planning']
      }
    } else if (splitRatio > 0.4) {
      return {
        type: 'Automated Budgeter',
        description: 'Relies heavily on automated fund splitting and budgeting',
        traits: ['Automation', 'Systematic Budgeting', 'Consistent Deposits']
      }
    } else {
      return {
        type: 'Balanced User',
        description: 'Uses a mix of PayWarp features for comprehensive financial management',
        traits: ['Versatile', 'Balanced Approach', 'Multi-feature Usage']
      }
    }
  }

  private static generateMonthlyBreakdown(transactions: BlockchainTransaction[]): MonthlyData[] {
    const monthlyData: MonthlyData[] = []
    
    for (let month = 0; month < 12; month++) {
      const monthTransactions = transactions.filter(tx => 
        tx.timestamp.getMonth() === month
      )
      
      const totalVolume = monthTransactions.reduce((sum, tx) => 
        sum + Number(tx.amount), 0
      )

      monthlyData.push({
        month: month + 1,
        transactionCount: monthTransactions.length,
        totalVolume,
        topTransactionType: this.getTopTransactionType(monthTransactions)
      })
    }
    
    return monthlyData
  }

  private static getTopTransactionType(transactions: BlockchainTransaction[]): string {
    const typeCount = transactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
  }

  private static generateAchievements(transactions: BlockchainTransaction[]): Achievement[] {
    const achievements: Achievement[] = []
    
    // First transaction achievement
    if (transactions.length > 0) {
      achievements.push({
        id: 'first-transaction',
        name: 'Getting Started',
        description: 'Made your first PayWarp transaction',
        unlockedAt: transactions[0].timestamp
      })
    }

    // High volume achievement
    const totalVolume = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0)
    if (totalVolume > 10000) {
      // Use the latest transaction date for deterministic results
      const latestTransaction = transactions.reduce((latest, tx) => 
        tx.timestamp > latest.timestamp ? tx : latest, transactions[0]
      )
      achievements.push({
        id: 'high-volume',
        name: 'High Roller',
        description: 'Processed over 10,000 tokens in transactions',
        unlockedAt: latestTransaction ? latestTransaction.timestamp : new Date()
      })
    }

    // Consistent user achievement
    const monthsWithActivity = new Set(transactions.map(tx => tx.timestamp.getMonth())).size
    if (monthsWithActivity >= 6) {
      // Use the latest transaction date for deterministic results
      const latestTransaction = transactions.reduce((latest, tx) => 
        tx.timestamp > latest.timestamp ? tx : latest, transactions[0]
      )
      achievements.push({
        id: 'consistent-user',
        name: 'Consistent User',
        description: 'Active for 6+ months of the year',
        unlockedAt: latestTransaction ? latestTransaction.timestamp : new Date()
      })
    }

    return achievements
  }
}

// Supporting interfaces for wrapped reports
export interface WrappedReport {
  year: number
  walletAddress: string
  totalVolume: number
  totalTransactions: number
  topAsset: AssetData
  activityPattern: ActivityPattern
  userArchetype: UserArchetype
  monthlyBreakdown: MonthlyData[]
  achievements: Achievement[]
  generatedAt: Date
}

export interface AssetData {
  type: string
  count: number
  volume: number
}

export interface ActivityPattern {
  peakMonth: number
  averageMonthlyTransactions: number
  mostActiveDay: string
  consistency: number
}

export interface UserArchetype {
  type: string
  description: string
  traits: string[]
}

export interface MonthlyData {
  month: number
  transactionCount: number
  totalVolume: number
  topTransactionType: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  unlockedAt: Date
}