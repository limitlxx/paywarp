import { getPublicClient } from 'wagmi/actions'
import { wagmiConfig } from './wagmi'
import { mantleMainnet, mantleSepolia } from './networks'
import { getContract } from 'viem'
import BucketVaultABI from './abis/BucketVault.json'
import PayrollEngineABI from './abis/PayrollEngine.json'
import { getContractAddress } from './contracts'
import { RPCProvider, withRPCFallback } from './rpc-provider'
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
}

export class TransactionSyncService {
  private publicClient: any
  private rpcProvider: RPCProvider
  private chainId: number
  private networkType: NetworkType
  private bucketVaultAddress: string
  private payrollEngineAddress: string

  constructor(chainId: number) {
    this.chainId = chainId
    this.networkType = chainId === mantleMainnet.id ? 'mainnet' : 'sepolia'
    this.rpcProvider = RPCProvider.getInstance(this.networkType)
    this.publicClient = this.rpcProvider.getPublicClient()
    
    // Get contract addresses based on network
    this.bucketVaultAddress = getContractAddress(this.networkType, 'bucketVault')
    this.payrollEngineAddress = getContractAddress(this.networkType, 'payrollEngine')
  }

  /**
   * Sync all historical transactions for a user from wallet creation date
   * 
   * Note: Mantle Sepolia RPC has a maximum block range limit of 30,000 blocks per eth_getLogs request.
   * This method automatically chunks large ranges to stay within this limit.
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
      
      // Default to syncing from 7 days ago or genesis block (much more conservative)
      const defaultFromBlock = currentBlock - BigInt(7 * 24 * 60 * 2) // ~7 days of blocks (2 min block time)
      const fromBlock = options.fromBlock || (defaultFromBlock > 0n ? defaultFromBlock : 0n)
      const toBlock = options.toBlock || currentBlock
      
      // Ensure we don't exceed the maximum block range (25,000 blocks for Mantle to be safe)
      const maxBlockRange = BigInt(options.maxBlocks || 20000) // Use 20k to be extra safe
      const actualFromBlock = toBlock - maxBlockRange > fromBlock ? toBlock - maxBlockRange : fromBlock
      
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
   * Mantle Sepolia RPC has a maximum block range limit of 30,000 blocks per eth_getLogs request.
   * This function automatically splits large ranges into smaller chunks to avoid 413 errors.
   */
  private async getLogsInChunks(
    logParams: any,
    fromBlock: bigint,
    toBlock: bigint,
    maxChunkSize: bigint = 15000n // Reduced from 25k to 15k for better reliability
  ): Promise<any[]> {
    const allLogs: any[] = []
    let currentFromBlock = fromBlock
    
    while (currentFromBlock <= toBlock) {
      const currentToBlock = currentFromBlock + maxChunkSize - 1n > toBlock 
        ? toBlock 
        : currentFromBlock + maxChunkSize - 1n
      
      try {
        const logs = await this.rpcProvider.executeRead(async (client: any) => {
          return client.getLogs({
            ...logParams,
            fromBlock: currentFromBlock,
            toBlock: currentToBlock
          })
        })
        allLogs.push(...logs)
      } catch (error) {
        console.warn(`Failed to get logs for blocks ${currentFromBlock}-${currentToBlock}:`, error)
        // If even a smaller chunk fails, try with an even smaller chunk
        if (maxChunkSize > 1000n) {
          const smallerChunkLogs = await this.getLogsInChunks(
            logParams, 
            currentFromBlock, 
            currentToBlock, 
            1000n
          )
          allLogs.push(...smallerChunkLogs)
        }
      }
      
      currentFromBlock = currentToBlock + 1n
    }
    
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
        onLogs: async (logs) => {
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
        onLogs: async (logs) => {
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