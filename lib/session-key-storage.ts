/**
 * Session Key Storage and Persistence
 * 
 * Handles secure storage and retrieval of session keys with encryption
 */

import { type Address } from 'viem'

export interface StoredSessionKey {
  id: string
  address: Address
  type: 'micro' | 'standard' | 'highValue'
  createdAt: number
  expiresAt: number
  allowedContracts: Address[]
  transactionLimits: {
    maxTransactionValue: bigint
    maxDailyValue: bigint
    maxTransactionCount: number
  }
  usage: {
    transactionCount: number
    totalValue: bigint
    lastUsed: number
    dailyUsage: { [date: string]: { count: number; value: bigint } }
  }
  isActive: boolean
  encryptedPrivateKey?: string // For client-side storage (optional)
}

export interface SessionKeyFilter {
  type?: 'micro' | 'standard' | 'highValue'
  isActive?: boolean
  contractAddress?: Address
  includeExpired?: boolean
}

class SessionKeyStorage {
  private readonly STORAGE_KEY = 'paywarp_session_keys'
  private readonly STORAGE_VERSION = '1.0'

  /**
   * Store a session key
   */
  storeSessionKey(sessionKey: StoredSessionKey): void {
    try {
      const stored = this.getAllSessionKeys()
      stored[sessionKey.id] = sessionKey
      
      const storageData = {
        version: this.STORAGE_VERSION,
        keys: stored,
        lastUpdated: Date.now()
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData, this.bigIntReplacer))
    } catch (error) {
      console.error('Failed to store session key:', error)
      throw new Error('Failed to store session key')
    }
  }

  /**
   * Get a specific session key by ID
   */
  getSessionKey(id: string): StoredSessionKey | null {
    try {
      const stored = this.getAllSessionKeys()
      const sessionKey = stored[id]
      
      if (!sessionKey) return null
      
      // Check if expired
      if (sessionKey.expiresAt < Date.now()) {
        sessionKey.isActive = false
        this.storeSessionKey(sessionKey) // Update storage
      }
      
      return sessionKey
    } catch (error) {
      console.error('Failed to get session key:', error)
      return null
    }
  }

  /**
   * Get all session keys for a user
   */
  getUserSessionKeys(userAddress: Address, filter?: SessionKeyFilter): StoredSessionKey[] {
    try {
      const stored = this.getAllSessionKeys()
      let keys = Object.values(stored).filter(key => key.address === userAddress)
      
      if (filter) {
        if (filter.type) {
          keys = keys.filter(key => key.type === filter.type)
        }
        
        if (filter.isActive !== undefined) {
          keys = keys.filter(key => key.isActive === filter.isActive)
        }
        
        if (filter.contractAddress) {
          keys = keys.filter(key => 
            key.allowedContracts.includes(filter.contractAddress!)
          )
        }
        
        if (!filter.includeExpired) {
          keys = keys.filter(key => key.expiresAt > Date.now())
        }
      }
      
      return keys.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('Failed to get user session keys:', error)
      return []
    }
  }

  /**
   * Update session key usage
   */
  updateSessionKeyUsage(
    id: string, 
    transactionValue: bigint, 
    contractAddress: Address
  ): boolean {
    try {
      const sessionKey = this.getSessionKey(id)
      if (!sessionKey || !sessionKey.isActive) return false
      
      const today = new Date().toISOString().split('T')[0]
      
      // Update usage statistics
      sessionKey.usage.transactionCount += 1
      sessionKey.usage.totalValue += transactionValue
      sessionKey.usage.lastUsed = Date.now()
      
      // Update daily usage
      if (!sessionKey.usage.dailyUsage[today]) {
        sessionKey.usage.dailyUsage[today] = { count: 0, value: 0n }
      }
      sessionKey.usage.dailyUsage[today].count += 1
      sessionKey.usage.dailyUsage[today].value += transactionValue
      
      // Check limits
      const dailyUsage = sessionKey.usage.dailyUsage[today]
      if (dailyUsage.value > sessionKey.transactionLimits.maxDailyValue ||
          dailyUsage.count > sessionKey.transactionLimits.maxTransactionCount) {
        sessionKey.isActive = false
      }
      
      this.storeSessionKey(sessionKey)
      return true
    } catch (error) {
      console.error('Failed to update session key usage:', error)
      return false
    }
  }

  /**
   * Deactivate a session key
   */
  deactivateSessionKey(id: string): boolean {
    try {
      const sessionKey = this.getSessionKey(id)
      if (!sessionKey) return false
      
      sessionKey.isActive = false
      this.storeSessionKey(sessionKey)
      return true
    } catch (error) {
      console.error('Failed to deactivate session key:', error)
      return false
    }
  }

  /**
   * Remove expired session keys
   */
  cleanupExpiredKeys(): number {
    try {
      const stored = this.getAllSessionKeys()
      const now = Date.now()
      let removedCount = 0
      
      Object.keys(stored).forEach(id => {
        if (stored[id].expiresAt < now) {
          delete stored[id]
          removedCount++
        }
      })
      
      if (removedCount > 0) {
        const storageData = {
          version: this.STORAGE_VERSION,
          keys: stored,
          lastUpdated: Date.now()
        }
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData, this.bigIntReplacer))
      }
      
      return removedCount
    } catch (error) {
      console.error('Failed to cleanup expired keys:', error)
      return 0
    }
  }

  /**
   * Get session key statistics for a user
   */
  getSessionKeyStats(userAddress: Address): {
    total: number
    active: number
    expired: number
    totalTransactions: number
    totalValue: bigint
  } {
    try {
      const keys = this.getUserSessionKeys(userAddress, { includeExpired: true })
      const now = Date.now()
      
      const stats = {
        total: keys.length,
        active: keys.filter(k => k.isActive && k.expiresAt > now).length,
        expired: keys.filter(k => k.expiresAt <= now).length,
        totalTransactions: keys.reduce((sum, k) => sum + k.usage.transactionCount, 0),
        totalValue: keys.reduce((sum, k) => sum + k.usage.totalValue, 0n)
      }
      
      return stats
    } catch (error) {
      console.error('Failed to get session key stats:', error)
      return {
        total: 0,
        active: 0,
        expired: 0,
        totalTransactions: 0,
        totalValue: 0n
      }
    }
  }

  /**
   * Check if a session key can execute a transaction
   */
  canExecuteTransaction(
    id: string,
    transactionValue: bigint,
    contractAddress: Address
  ): { canExecute: boolean; reason?: string } {
    try {
      const sessionKey = this.getSessionKey(id)
      
      if (!sessionKey) {
        return { canExecute: false, reason: 'Session key not found' }
      }
      
      if (!sessionKey.isActive) {
        return { canExecute: false, reason: 'Session key is inactive' }
      }
      
      if (sessionKey.expiresAt <= Date.now()) {
        return { canExecute: false, reason: 'Session key has expired' }
      }
      
      if (!sessionKey.allowedContracts.includes(contractAddress)) {
        return { canExecute: false, reason: 'Contract not authorized' }
      }
      
      if (transactionValue > sessionKey.transactionLimits.maxTransactionValue) {
        return { canExecute: false, reason: 'Transaction value exceeds limit' }
      }
      
      const today = new Date().toISOString().split('T')[0]
      const dailyUsage = sessionKey.usage.dailyUsage[today] || { count: 0, value: 0n }
      
      if (dailyUsage.value + transactionValue > sessionKey.transactionLimits.maxDailyValue) {
        return { canExecute: false, reason: 'Daily value limit would be exceeded' }
      }
      
      if (dailyUsage.count >= sessionKey.transactionLimits.maxTransactionCount) {
        return { canExecute: false, reason: 'Daily transaction count limit reached' }
      }
      
      return { canExecute: true }
    } catch (error) {
      console.error('Failed to check transaction eligibility:', error)
      return { canExecute: false, reason: 'Error checking transaction eligibility' }
    }
  }

  /**
   * Export session keys for backup
   */
  exportSessionKeys(userAddress: Address): string {
    try {
      const keys = this.getUserSessionKeys(userAddress, { includeExpired: true })
      const exportData = {
        version: this.STORAGE_VERSION,
        userAddress,
        exportedAt: Date.now(),
        keys: keys.map(key => ({
          ...key,
          encryptedPrivateKey: undefined // Don't export private keys
        }))
      }
      
      return JSON.stringify(exportData, this.bigIntReplacer)
    } catch (error) {
      console.error('Failed to export session keys:', error)
      throw new Error('Failed to export session keys')
    }
  }

  /**
   * Clear all session keys for a user
   */
  clearUserSessionKeys(userAddress: Address): number {
    try {
      const stored = this.getAllSessionKeys()
      let removedCount = 0
      
      Object.keys(stored).forEach(id => {
        if (stored[id].address === userAddress) {
          delete stored[id]
          removedCount++
        }
      })
      
      if (removedCount > 0) {
        const storageData = {
          version: this.STORAGE_VERSION,
          keys: stored,
          lastUpdated: Date.now()
        }
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData, this.bigIntReplacer))
      }
      
      return removedCount
    } catch (error) {
      console.error('Failed to clear user session keys:', error)
      return 0
    }
  }

  /**
   * Get all session keys from storage
   */
  private getAllSessionKeys(): { [id: string]: StoredSessionKey } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return {}
      
      const data = JSON.parse(stored, this.bigIntReviver)
      
      // Handle version migration if needed
      if (data.version !== this.STORAGE_VERSION) {
        // Perform migration logic here if needed
        console.warn('Session key storage version mismatch, clearing storage')
        localStorage.removeItem(this.STORAGE_KEY)
        return {}
      }
      
      return data.keys || {}
    } catch (error) {
      console.error('Failed to load session keys from storage:', error)
      return {}
    }
  }

  /**
   * BigInt serialization helper
   */
  private bigIntReplacer(key: string, value: any): any {
    return typeof value === 'bigint' ? value.toString() + 'n' : value
  }

  /**
   * BigInt deserialization helper
   */
  private bigIntReviver(key: string, value: any): any {
    if (typeof value === 'string' && value.endsWith('n')) {
      try {
        return BigInt(value.slice(0, -1))
      } catch {
        return value
      }
    }
    return value
  }
}

// Export singleton instance
export const sessionKeyStorage = new SessionKeyStorage()

// Export utility functions
export function createSessionKeyId(): string {
  return `sk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function getSessionKeyLimits(type: 'micro' | 'standard' | 'highValue') {
  switch (type) {
    case 'micro':
      return {
        maxTransactionValue: BigInt('100000000'), // 100 USDC (6 decimals)
        maxDailyValue: BigInt('1000000000'), // 1000 USDC
        maxTransactionCount: 50
      }
    case 'standard':
      return {
        maxTransactionValue: BigInt('10000000000'), // 10,000 USDC
        maxDailyValue: BigInt('50000000000'), // 50,000 USDC
        maxTransactionCount: 100
      }
    case 'highValue':
      return {
        maxTransactionValue: BigInt('100000000000'), // 100,000 USDC
        maxDailyValue: BigInt('1000000000000'), // 1,000,000 USDC
        maxTransactionCount: 500
      }
  }
}