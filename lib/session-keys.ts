/**
 * Session Key Management System
 * 
 * Provides limited-permission signing capabilities for automated transactions
 * with configurable limits, expiration, and revocation handling.
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, http, type Address, type Hash, type WalletClient } from 'viem'
import { mantleMainnet, mantleSepolia } from './networks'

export interface SessionKeyConfig {
  // Transaction limits
  maxTransactionAmount: bigint
  maxDailyAmount: bigint
  maxTransactionCount: number
  
  // Time boundaries
  expirationTime: Date
  createdAt: Date
  
  // Allowed operations
  allowedContracts: Address[]
  allowedMethods: string[]
  
  // Security settings
  requireUserConfirmation: boolean
  emergencyRevocation: boolean
}

export interface SessionKeyUsage {
  transactionHash: Hash
  amount: bigint
  timestamp: Date
  contractAddress: Address
  methodName: string
  gasUsed: bigint
}

export interface SessionKeyState {
  privateKey: `0x${string}`
  address: Address
  config: SessionKeyConfig
  usage: SessionKeyUsage[]
  isActive: boolean
  isRevoked: boolean
  revokedAt?: Date
  revokedReason?: string
}

export interface SessionKeyLimits {
  dailyAmountUsed: bigint
  transactionCountUsed: number
  remainingDailyAmount: bigint
  remainingTransactionCount: number
  canExecuteTransaction: boolean
  limitReachedReason?: string
}

export class SessionKeyManager {
  private sessionKeys: Map<string, SessionKeyState> = new Map()
  private walletClient: WalletClient | null = null
  
  constructor(private chainId: number) {
    this.initializeWalletClient()
  }
  
  private initializeWalletClient() {
    const chain = this.chainId === 5000 ? mantleMainnet : mantleSepolia
    this.walletClient = createWalletClient({
      chain,
      transport: http()
    })
  }
  
  /**
   * Create a new session key with specified configuration
   */
  createSessionKey(config: Omit<SessionKeyConfig, 'createdAt'>): string {
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const sessionId = this.generateSessionId()
    
    const sessionKeyState: SessionKeyState = {
      privateKey,
      address: account.address,
      config: {
        ...config,
        createdAt: new Date()
      },
      usage: [],
      isActive: true,
      isRevoked: false
    }
    
    this.sessionKeys.set(sessionId, sessionKeyState)
    return sessionId
  }
  
  /**
   * Get session key state by ID
   */
  getSessionKey(sessionId: string): SessionKeyState | null {
    return this.sessionKeys.get(sessionId) || null
  }
  
  /**
   * Check if session key can execute a transaction
   */
  checkSessionLimits(sessionId: string, amount: bigint, contractAddress: Address, methodName: string): SessionKeyLimits {
    const sessionKey = this.sessionKeys.get(sessionId)
    
    if (!sessionKey) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Session key not found'
      }
    }
    
    if (!sessionKey.isActive || sessionKey.isRevoked) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: sessionKey.isRevoked ? 'Session key revoked' : 'Session key inactive'
      }
    }
    
    // Check expiration
    if (new Date() > sessionKey.config.expirationTime) {
      this.expireSessionKey(sessionId)
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Session key expired'
      }
    }
    
    // Check contract and method allowlist
    if (!sessionKey.config.allowedContracts.includes(contractAddress)) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Contract not allowed'
      }
    }
    
    if (!sessionKey.config.allowedMethods.includes(methodName)) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Method not allowed'
      }
    }
    
    // Calculate daily usage
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayUsage = sessionKey.usage.filter(usage => {
      const usageDate = new Date(usage.timestamp)
      usageDate.setHours(0, 0, 0, 0)
      return usageDate.getTime() === today.getTime()
    })
    
    const dailyAmountUsed = todayUsage.reduce((sum, usage) => sum + usage.amount, 0n)
    const transactionCountUsed = todayUsage.length
    
    // Check transaction amount limit
    if (amount > sessionKey.config.maxTransactionAmount) {
      return {
        dailyAmountUsed,
        transactionCountUsed,
        remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
        remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
        canExecuteTransaction: false,
        limitReachedReason: 'Transaction amount exceeds limit'
      }
    }
    
    // Check daily amount limit
    if (dailyAmountUsed + amount > sessionKey.config.maxDailyAmount) {
      return {
        dailyAmountUsed,
        transactionCountUsed,
        remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
        remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
        canExecuteTransaction: false,
        limitReachedReason: 'Daily amount limit exceeded'
      }
    }
    
    // Check transaction count limit
    if (transactionCountUsed >= sessionKey.config.maxTransactionCount) {
      return {
        dailyAmountUsed,
        transactionCountUsed,
        remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
        remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
        canExecuteTransaction: false,
        limitReachedReason: 'Daily transaction count limit exceeded'
      }
    }
    
    return {
      dailyAmountUsed,
      transactionCountUsed,
      remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
      remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
      canExecuteTransaction: true
    }
  }
  
  /**
   * Execute a transaction using session key
   */
  async executeTransaction(
    sessionId: string,
    contractAddress: Address,
    methodName: string,
    amount: bigint,
    data: `0x${string}`,
    gasLimit?: bigint
  ): Promise<{ success: boolean; transactionHash?: Hash; error?: string }> {
    const sessionKey = this.sessionKeys.get(sessionId)
    
    if (!sessionKey) {
      return { success: false, error: 'Session key not found' }
    }
    
    // Check limits
    const limits = this.checkSessionLimits(sessionId, amount, contractAddress, methodName)
    if (!limits.canExecuteTransaction) {
      return { success: false, error: limits.limitReachedReason }
    }
    
    try {
      if (!this.walletClient) {
        throw new Error('Wallet client not initialized')
      }
      
      const account = privateKeyToAccount(sessionKey.privateKey)
      
      const hash = await this.walletClient.sendTransaction({
        account,
        to: contractAddress,
        data,
        value: amount,
        gas: gasLimit
      })
      
      // Record usage
      const usage: SessionKeyUsage = {
        transactionHash: hash,
        amount,
        timestamp: new Date(),
        contractAddress,
        methodName,
        gasUsed: gasLimit || 0n
      }
      
      sessionKey.usage.push(usage)
      
      return { success: true, transactionHash: hash }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      }
    }
  }
  
  /**
   * Test helper: Record transaction usage without executing
   * This is used for testing daily limit accumulation
   */
  recordUsageForTesting(
    sessionId: string,
    amount: bigint,
    contractAddress: Address,
    methodName: string
  ): boolean {
    const sessionKey = this.sessionKeys.get(sessionId)
    
    if (!sessionKey) {
      return false
    }
    
    // Record usage
    const usage: SessionKeyUsage = {
      transactionHash: `0x${'test'.padEnd(64, '0')}` as Hash,
      amount,
      timestamp: new Date(),
      contractAddress,
      methodName,
      gasUsed: 0n
    }
    
    sessionKey.usage.push(usage)
    return true
  }

  /**
   * Revoke a session key immediately
   */
  revokeSessionKey(sessionId: string, reason: string = 'User revoked'): boolean {
    const sessionKey = this.sessionKeys.get(sessionId)
    
    if (!sessionKey) {
      return false
    }
    
    sessionKey.isRevoked = true
    sessionKey.isActive = false
    sessionKey.revokedAt = new Date()
    sessionKey.revokedReason = reason
    
    return true
  }
  
  /**
   * Expire a session key
   */
  private expireSessionKey(sessionId: string): void {
    const sessionKey = this.sessionKeys.get(sessionId)
    
    if (sessionKey) {
      sessionKey.isActive = false
    }
  }
  
  /**
   * Get all active session keys
   */
  getActiveSessionKeys(): Array<{ sessionId: string; state: SessionKeyState }> {
    const activeKeys: Array<{ sessionId: string; state: SessionKeyState }> = []
    
    for (const [sessionId, state] of this.sessionKeys.entries()) {
      if (state.isActive && !state.isRevoked && new Date() < state.config.expirationTime) {
        activeKeys.push({ sessionId, state })
      }
    }
    
    return activeKeys
  }
  
  /**
   * Clean up expired session keys
   */
  cleanupExpiredKeys(): number {
    let cleanedCount = 0
    const now = new Date()
    
    for (const [sessionId, state] of this.sessionKeys.entries()) {
      if (now > state.config.expirationTime) {
        this.expireSessionKey(sessionId)
        cleanedCount++
      }
    }
    
    return cleanedCount
  }
  
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Get session key usage statistics
   */
  getUsageStatistics(sessionId: string): {
    totalTransactions: number
    totalAmountSpent: bigint
    averageTransactionAmount: bigint
    lastUsed?: Date
    dailyUsage: Array<{ date: string; transactions: number; amount: bigint }>
  } | null {
    const sessionKey = this.sessionKeys.get(sessionId)
    
    if (!sessionKey) {
      return null
    }
    
    const usage = sessionKey.usage
    const totalTransactions = usage.length
    const totalAmountSpent = usage.reduce((sum, u) => sum + u.amount, 0n)
    const averageTransactionAmount = totalTransactions > 0 ? totalAmountSpent / BigInt(totalTransactions) : 0n
    const lastUsed = usage.length > 0 ? usage[usage.length - 1].timestamp : undefined
    
    // Group by day
    const dailyUsageMap = new Map<string, { transactions: number; amount: bigint }>()
    
    for (const u of usage) {
      const dateKey = u.timestamp.toISOString().split('T')[0]
      const existing = dailyUsageMap.get(dateKey) || { transactions: 0, amount: 0n }
      dailyUsageMap.set(dateKey, {
        transactions: existing.transactions + 1,
        amount: existing.amount + u.amount
      })
    }
    
    const dailyUsage = Array.from(dailyUsageMap.entries()).map(([date, stats]) => ({
      date,
      ...stats
    }))
    
    return {
      totalTransactions,
      totalAmountSpent,
      averageTransactionAmount,
      lastUsed,
      dailyUsage
    }
  }
}

// Default session key configurations
export const DEFAULT_SESSION_CONFIGS = {
  // Micro transactions (small automated actions)
  micro: {
    maxTransactionAmount: BigInt('1000000000000000000'), // 1 token
    maxDailyAmount: BigInt('10000000000000000000'), // 10 tokens
    maxTransactionCount: 50,
    allowedMethods: ['transfer', 'approve'],
    requireUserConfirmation: false,
    emergencyRevocation: true
  },
  
  // Standard automation (regular bucket operations)
  standard: {
    maxTransactionAmount: BigInt('100000000000000000000'), // 100 tokens
    maxDailyAmount: BigInt('1000000000000000000000'), // 1000 tokens
    maxTransactionCount: 20,
    allowedMethods: ['depositAndSplit', 'transferBetweenBuckets', 'withdraw'],
    requireUserConfirmation: false,
    emergencyRevocation: true
  },
  
  // High value (payroll and large operations)
  highValue: {
    maxTransactionAmount: BigInt('10000000000000000000000'), // 10,000 tokens
    maxDailyAmount: BigInt('100000000000000000000000'), // 100,000 tokens
    maxTransactionCount: 5,
    allowedMethods: ['processPayroll', 'batchTransfer'],
    requireUserConfirmation: true,
    emergencyRevocation: true
  }
} as const

export type SessionConfigType = keyof typeof DEFAULT_SESSION_CONFIGS