/**
 * Transaction Cache Service
 * 
 * Provides persistent storage for blockchain transactions using IndexedDB
 * Supports incremental syncing and offline functionality
 */

export interface CachedTransaction {
  id: string
  hash: string
  type: string
  amount: string // Store as string to avoid BigInt serialization issues
  fromBucket?: string
  toBucket?: string
  recipient?: string
  timestamp: number // Store as timestamp
  blockNumber: string // Store as string to avoid BigInt serialization issues
  status: string
  gasUsed: string
  gasCost: string
  description: string
  metadata: any
  contractAddress: string
  eventName: string
  userAddress: string // Index by user address
  chainId: number // Index by chain
}

export interface SyncMetadata {
  userAddress: string
  chainId: number
  lastSyncedBlock: string
  lastSyncedTimestamp: number
  totalTransactions: number
  lastUpdated: number
}

export class TransactionCacheService {
  private dbName = 'PayWarpTransactionCache'
  private dbVersion = 1
  private db: IDBDatabase | null = null

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' })
          transactionStore.createIndex('userAddress', 'userAddress', { unique: false })
          transactionStore.createIndex('chainId', 'chainId', { unique: false })
          transactionStore.createIndex('blockNumber', 'blockNumber', { unique: false })
          transactionStore.createIndex('timestamp', 'timestamp', { unique: false })
          transactionStore.createIndex('userChain', ['userAddress', 'chainId'], { unique: false })
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains('syncMetadata')) {
          const metadataStore = db.createObjectStore('syncMetadata', { keyPath: ['userAddress', 'chainId'] })
          metadataStore.createIndex('userAddress', 'userAddress', { unique: false })
          metadataStore.createIndex('lastUpdated', 'lastUpdated', { unique: false })
        }
      }
    })
  }

  /**
   * Store transactions in cache
   */
  async storeTransactions(
    transactions: any[], 
    userAddress: string, 
    chainId: number
  ): Promise<void> {
    await this.initialize()
    if (!this.db) throw new Error('Database not initialized')

    console.log(`💾 SAVING TRANSACTION DATA TO DATABASE:`)
    console.log(`   User: ${userAddress}`)
    console.log(`   Chain: ${chainId}`)
    console.log(`   Transactions: ${transactions.length}`)
    console.log(`   Transaction Details:`, transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      timestamp: tx.timestamp,
      blockNumber: tx.blockNumber.toString()
    })))

    const transaction = this.db.transaction(['transactions'], 'readwrite')
    const store = transaction.objectStore('transactions')

    for (const tx of transactions) {
      const cachedTx: CachedTransaction = {
        id: tx.id,
        hash: tx.hash,
        type: tx.type,
        amount: tx.amount.toString(),
        fromBucket: tx.fromBucket,
        toBucket: tx.toBucket,
        recipient: tx.recipient,
        timestamp: tx.timestamp.getTime(),
        blockNumber: tx.blockNumber.toString(),
        status: tx.status,
        gasUsed: tx.gasUsed.toString(),
        gasCost: tx.gasCost.toString(),
        description: tx.description,
        metadata: tx.metadata,
        contractAddress: tx.contractAddress,
        eventName: tx.eventName,
        userAddress,
        chainId
      }

      store.put(cachedTx)
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`✅ Successfully saved ${transactions.length} transactions to database`)
        resolve()
      }
      transaction.onerror = () => {
        console.error(`❌ Failed to save transactions to database:`, transaction.error)
        reject(transaction.error)
      }
    })
  }

  /**
   * Get cached transactions for a user
   */
  async getTransactions(
    userAddress: string, 
    chainId: number,
    limit?: number
  ): Promise<CachedTransaction[]> {
    await this.initialize()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readonly')
      const store = transaction.objectStore('transactions')
      const index = store.index('userChain')
      const request = index.getAll([userAddress, chainId])

      request.onsuccess = () => {
        let results = request.result || []
        
        // Sort by timestamp descending (newest first)
        results.sort((a, b) => b.timestamp - a.timestamp)
        
        // Apply limit if specified
        if (limit) {
          results = results.slice(0, limit)
        }
        
        console.log(`📖 LOADING TRANSACTION DATA FROM DATABASE:`)
        console.log(`   User: ${userAddress}`)
        console.log(`   Chain: ${chainId}`)
        console.log(`   Found: ${results.length} transactions`)
        if (results.length > 0) {
          console.log(`   Latest transaction: ${new Date(results[0].timestamp).toISOString()}`)
          console.log(`   Oldest transaction: ${new Date(results[results.length - 1].timestamp).toISOString()}`)
        }
        
        resolve(results)
      }
      request.onerror = () => {
        console.error(`❌ Failed to load transactions from database:`, request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Get sync metadata for a user
   */
  async getSyncMetadata(userAddress: string, chainId: number): Promise<SyncMetadata | null> {
    await this.initialize()
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncMetadata'], 'readonly')
      const store = transaction.objectStore('syncMetadata')
      const request = store.get([userAddress, chainId])

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(metadata: SyncMetadata): Promise<void> {
    await this.initialize()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncMetadata'], 'readwrite')
      const store = transaction.objectStore('syncMetadata')
      const request = store.put(metadata)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Check if we have recent cached data (within last hour)
   */
  async hasRecentCache(userAddress: string, chainId: number): Promise<boolean> {
    const metadata = await this.getSyncMetadata(userAddress, chainId)
    if (!metadata) return false

    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    return metadata.lastUpdated > oneHourAgo
  }

  /**
   * Get the last synced block number
   */
  async getLastSyncedBlock(userAddress: string, chainId: number): Promise<bigint | null> {
    const metadata = await this.getSyncMetadata(userAddress, chainId)
    return metadata ? BigInt(metadata.lastSyncedBlock) : null
  }

  /**
   * Clear all cached data for a user
   */
  async clearUserCache(userAddress: string, chainId: number): Promise<void> {
    await this.initialize()
    if (!this.db) return

    const transaction = this.db.transaction(['transactions', 'syncMetadata'], 'readwrite')
    
    // Clear transactions
    const transactionStore = transaction.objectStore('transactions')
    const transactionIndex = transactionStore.index('userChain')
    const transactionRequest = transactionIndex.openCursor([userAddress, chainId])
    
    transactionRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }

    // Clear metadata
    const metadataStore = transaction.objectStore('syncMetadata')
    metadataStore.delete([userAddress, chainId])

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(userAddress: string, chainId: number): Promise<{
    totalTransactions: number
    oldestTransaction: number | null
    newestTransaction: number | null
    cacheSize: number
  }> {
    const transactions = await this.getTransactions(userAddress, chainId)
    
    if (transactions.length === 0) {
      return {
        totalTransactions: 0,
        oldestTransaction: null,
        newestTransaction: null,
        cacheSize: 0
      }
    }

    const timestamps = transactions.map(tx => tx.timestamp)
    
    return {
      totalTransactions: transactions.length,
      oldestTransaction: Math.min(...timestamps),
      newestTransaction: Math.max(...timestamps),
      cacheSize: JSON.stringify(transactions).length // Rough size estimate
    }
  }

  /**
   * Convert cached transaction back to BlockchainTransaction format
   */
  static fromCached(cached: CachedTransaction): any {
    return {
      id: cached.id,
      hash: cached.hash,
      type: cached.type,
      amount: BigInt(cached.amount),
      fromBucket: cached.fromBucket,
      toBucket: cached.toBucket,
      recipient: cached.recipient,
      timestamp: new Date(cached.timestamp),
      blockNumber: BigInt(cached.blockNumber),
      status: cached.status,
      gasUsed: BigInt(cached.gasUsed),
      gasCost: BigInt(cached.gasCost),
      description: cached.description,
      metadata: cached.metadata,
      contractAddress: cached.contractAddress,
      eventName: cached.eventName
    }
  }
}

// Export singleton instance
export const transactionCache = new TransactionCacheService()

/**
 * Utility functions for localStorage fallback (for small data)
 */
export class LocalStorageCache {
  private static prefix = 'paywarp_'

  static set(key: string, value: any, ttl?: number): void {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl: ttl || 0
      }
      localStorage.setItem(this.prefix + key, JSON.stringify(item))
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
    }
  }

  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key)
      if (!item) return null

      const parsed = JSON.parse(item)
      
      // Check TTL
      if (parsed.ttl > 0 && Date.now() - parsed.timestamp > parsed.ttl) {
        this.remove(key)
        return null
      }

      return parsed.value
    } catch (error) {
      console.warn('Failed to read from localStorage:', error)
      return null
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key)
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error)
    }
  }

  static clear(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix))
      keys.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  }
}