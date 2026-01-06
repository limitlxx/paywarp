/**
 * Transaction Batching Service
 * Optimizes gas usage by batching multiple transactions together
 * Requirements: 3.5, 4.5, 6.4
 */

import { parseUnits } from 'viem'
import type { Hash } from 'viem'

export interface BatchedTransaction {
  id: string
  type: 'deposit' | 'transfer' | 'withdraw' | 'config'
  params: any[]
  priority: number
  timestamp: Date
  resolve: (hash: Hash) => void
  reject: (error: Error) => void
}

export interface BatchExecutionResult {
  successful: BatchedTransaction[]
  failed: Array<{ transaction: BatchedTransaction; error: Error }>
  totalGasUsed: bigint
  executionTime: number
}

export class TransactionBatcher {
  private queue: BatchedTransaction[] = []
  private processing = false
  private batchSize = 10
  private batchTimeout = 2000 // 2 seconds
  private timeoutId: NodeJS.Timeout | null = null

  constructor(
    private contractWrite: any,
    private publicClient: any
  ) {}

  /**
   * Add a transaction to the batch queue
   */
  async addTransaction(
    type: BatchedTransaction['type'],
    params: any[],
    priority: number = 1
  ): Promise<Hash> {
    return new Promise((resolve, reject) => {
      const transaction: BatchedTransaction = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        params,
        priority,
        timestamp: new Date(),
        resolve,
        reject,
      }

      // Insert transaction in priority order
      const insertIndex = this.queue.findIndex(tx => tx.priority < priority)
      if (insertIndex === -1) {
        this.queue.push(transaction)
      } else {
        this.queue.splice(insertIndex, 0, transaction)
      }

      // Start processing if not already running
      if (!this.processing) {
        this.scheduleProcessing()
      }
    })
  }

  /**
   * Schedule batch processing with timeout
   */
  private scheduleProcessing() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    // Process immediately if queue is full or has high priority transactions
    const hasHighPriority = this.queue.some(tx => tx.priority >= 5)
    const shouldProcessImmediately = this.queue.length >= this.batchSize || hasHighPriority

    if (shouldProcessImmediately) {
      this.processBatch()
    } else {
      // Wait for more transactions or timeout
      this.timeoutId = setTimeout(() => {
        if (this.queue.length > 0) {
          this.processBatch()
        }
      }, this.batchTimeout)
    }
  }

  /**
   * Process the current batch of transactions
   */
  private async processBatch(): Promise<BatchExecutionResult> {
    if (this.processing || this.queue.length === 0) {
      return {
        successful: [],
        failed: [],
        totalGasUsed: BigInt(0),
        executionTime: 0,
      }
    }

    this.processing = true
    const startTime = performance.now()

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    // Take batch from queue
    const batch = this.queue.splice(0, this.batchSize)
    const successful: BatchedTransaction[] = []
    const failed: Array<{ transaction: BatchedTransaction; error: Error }> = []
    let totalGasUsed = BigInt(0)

    try {
      // Group transactions by type for potential optimization
      const groupedTransactions = this.groupTransactionsByType(batch)

      // Process each group
      for (const [type, transactions] of Object.entries(groupedTransactions)) {
        try {
          const results = await this.executeTransactionGroup(type as BatchedTransaction['type'], transactions)
          
          for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i]
            const result = results[i]
            
            if (result.success) {
              transaction.resolve(result.hash)
              successful.push(transaction)
              totalGasUsed += result.gasUsed || BigInt(0)
            } else {
              transaction.reject(result.error)
              failed.push({ transaction, error: result.error })
            }
          }
        } catch (error) {
          // If group execution fails, reject all transactions in the group
          for (const transaction of transactions) {
            const err = error instanceof Error ? error : new Error('Batch execution failed')
            transaction.reject(err)
            failed.push({ transaction, error: err })
          }
        }
      }
    } catch (error) {
      // If entire batch fails, reject all transactions
      for (const transaction of batch) {
        const err = error instanceof Error ? error : new Error('Batch processing failed')
        transaction.reject(err)
        failed.push({ transaction, error: err })
      }
    }

    this.processing = false
    const executionTime = performance.now() - startTime

    // Schedule next batch if queue has more transactions
    if (this.queue.length > 0) {
      this.scheduleProcessing()
    }

    return {
      successful,
      failed,
      totalGasUsed,
      executionTime,
    }
  }

  /**
   * Group transactions by type for potential batching optimizations
   */
  private groupTransactionsByType(transactions: BatchedTransaction[]): Record<string, BatchedTransaction[]> {
    return transactions.reduce((groups, transaction) => {
      if (!groups[transaction.type]) {
        groups[transaction.type] = []
      }
      groups[transaction.type].push(transaction)
      return groups
    }, {} as Record<string, BatchedTransaction[]>)
  }

  /**
   * Execute a group of transactions of the same type
   */
  private async executeTransactionGroup(
    type: BatchedTransaction['type'],
    transactions: BatchedTransaction[]
  ): Promise<Array<{ success: boolean; hash?: Hash; gasUsed?: bigint; error?: Error }>> {
    const results: Array<{ success: boolean; hash?: Hash; gasUsed?: bigint; error?: Error }> = []

    // For now, execute transactions sequentially within the group
    // Future optimization: implement actual batching for compatible transaction types
    for (const transaction of transactions) {
      try {
        const result = await this.executeSingleTransaction(transaction)
        results.push({ success: true, ...result })
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error : new Error('Transaction failed') 
        })
      }
    }

    return results
  }

  /**
   * Execute a single transaction
   */
  private async executeSingleTransaction(transaction: BatchedTransaction): Promise<{ hash: Hash; gasUsed?: bigint }> {
    const { type, params } = transaction

    let hash: Hash

    switch (type) {
      case 'deposit':
        hash = await this.contractWrite.write.depositAndSplit(params)
        break
      case 'transfer':
        hash = await this.contractWrite.write.transferBetweenBuckets(params)
        break
      case 'withdraw':
        hash = await this.contractWrite.write.withdrawFromBucket(params)
        break
      case 'config':
        hash = await this.contractWrite.write.setSplitConfig(params)
        break
      default:
        throw new Error(`Unknown transaction type: ${type}`)
    }

    // Wait for transaction receipt to get gas usage
    let gasUsed: bigint | undefined
    if (this.publicClient) {
      try {
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
        gasUsed = receipt.gasUsed
      } catch (error) {
        // Don't fail the transaction if we can't get the receipt
        console.warn('Failed to get transaction receipt:', error)
      }
    }

    return { hash, gasUsed }
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      nextBatchSize: Math.min(this.queue.length, this.batchSize),
      estimatedProcessingTime: this.queue.length > 0 ? this.batchTimeout : 0,
    }
  }

  /**
   * Clear the queue (useful for cleanup)
   */
  clearQueue() {
    // Reject all pending transactions
    for (const transaction of this.queue) {
      transaction.reject(new Error('Queue cleared'))
    }
    
    this.queue = []
    this.processing = false
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  /**
   * Update batch configuration
   */
  updateConfig(config: { batchSize?: number; batchTimeout?: number }) {
    if (config.batchSize !== undefined) {
      this.batchSize = Math.max(1, Math.min(50, config.batchSize)) // Limit between 1-50
    }
    if (config.batchTimeout !== undefined) {
      this.batchTimeout = Math.max(100, Math.min(10000, config.batchTimeout)) // Limit between 100ms-10s
    }
  }
}

/**
 * Hook for using transaction batcher
 */
export function useTransactionBatcher(contractWrite: any, publicClient: any) {
  const batcher = new TransactionBatcher(contractWrite, publicClient)

  return {
    batchTransaction: (type: BatchedTransaction['type'], params: any[], priority?: number) =>
      batcher.addTransaction(type, params, priority),
    getQueueStatus: () => batcher.getQueueStatus(),
    clearQueue: () => batcher.clearQueue(),
    updateConfig: (config: { batchSize?: number; batchTimeout?: number }) =>
      batcher.updateConfig(config),
  }
}