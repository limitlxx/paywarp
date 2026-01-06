/**
 * React Hook for Session Key Management
 * 
 * Provides session key creation, management, and automated transaction capabilities
 * with proper state management and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { type Address, type Hash } from 'viem'
import {
  SessionKeyManager,
  type SessionKeyConfig,
  type SessionKeyState,
  type SessionKeyLimits,
  type SessionConfigType,
  DEFAULT_SESSION_CONFIGS
} from '@/lib/session-keys'

export interface UseSessionKeysReturn {
  // Session key management
  createSessionKey: (config: Omit<SessionKeyConfig, 'createdAt'>) => Promise<string>
  createStandardSessionKey: (type: SessionConfigType, expirationHours: number, allowedContracts: Address[]) => Promise<string>
  revokeSessionKey: (sessionId: string, reason?: string) => boolean
  getSessionKey: (sessionId: string) => SessionKeyState | null
  
  // Transaction execution
  executeAutomatedTransaction: (
    sessionId: string,
    contractAddress: Address,
    methodName: string,
    amount: bigint,
    data: `0x${string}`,
    gasLimit?: bigint
  ) => Promise<{ success: boolean; transactionHash?: Hash; error?: string }>
  
  // Limit checking
  checkTransactionLimits: (sessionId: string, amount: bigint, contractAddress: Address, methodName: string) => SessionKeyLimits
  
  // State management
  activeSessionKeys: Array<{ sessionId: string; state: SessionKeyState }>
  refreshSessionKeys: () => void
  
  // Automation control
  isAutomationEnabled: boolean
  enableAutomation: () => void
  disableAutomation: () => void
  
  // Error handling
  error: string | null
  clearError: () => void
  
  // Loading states
  isCreatingSession: boolean
  isExecutingTransaction: boolean
  
  // Statistics
  getSessionStatistics: (sessionId: string) => ReturnType<SessionKeyManager['getUsageStatistics']>
  
  // Cleanup
  cleanupExpiredSessions: () => number
}

export function useSessionKeys(): UseSessionKeysReturn {
  const { address } = useAccount()
  const chainId = useChainId()
  
  // State management
  const [activeSessionKeys, setActiveSessionKeys] = useState<Array<{ sessionId: string; state: SessionKeyState }>>([])
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isExecutingTransaction, setIsExecutingTransaction] = useState(false)
  
  // Session key manager instance
  const sessionManagerRef = useRef<SessionKeyManager | null>(null)
  
  // Initialize session manager when chain changes
  useEffect(() => {
    if (chainId) {
      sessionManagerRef.current = new SessionKeyManager(chainId)
      refreshSessionKeys()
    }
  }, [chainId])
  
  // Auto-cleanup expired sessions every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionManagerRef.current) {
        sessionManagerRef.current.cleanupExpiredKeys()
        refreshSessionKeys()
      }
    }, 5 * 60 * 1000) // 5 minutes
    
    return () => clearInterval(interval)
  }, [])
  
  // Disable automation when wallet disconnects
  useEffect(() => {
    if (!address) {
      setIsAutomationEnabled(false)
      setActiveSessionKeys([])
    }
  }, [address])
  
  const clearError = useCallback(() => {
    setError(null)
  }, [])
  
  const refreshSessionKeys = useCallback(() => {
    if (!sessionManagerRef.current) return
    
    try {
      const keys = sessionManagerRef.current.getActiveSessionKeys()
      setActiveSessionKeys(keys)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh session keys')
    }
  }, [])
  
  const createSessionKey = useCallback(async (config: Omit<SessionKeyConfig, 'createdAt'>): Promise<string> => {
    if (!sessionManagerRef.current) {
      throw new Error('Session manager not initialized')
    }
    
    if (!address) {
      throw new Error('Wallet not connected')
    }
    
    setIsCreatingSession(true)
    setError(null)
    
    try {
      const sessionId = sessionManagerRef.current.createSessionKey(config)
      refreshSessionKeys()
      return sessionId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session key'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsCreatingSession(false)
    }
  }, [address, refreshSessionKeys])
  
  const createStandardSessionKey = useCallback(async (
    type: SessionConfigType,
    expirationHours: number,
    allowedContracts: Address[]
  ): Promise<string> => {
    const baseConfig = DEFAULT_SESSION_CONFIGS[type]
    const expirationTime = new Date()
    expirationTime.setHours(expirationTime.getHours() + expirationHours)
    
    const config: Omit<SessionKeyConfig, 'createdAt'> = {
      ...baseConfig,
      expirationTime,
      allowedContracts
    }
    
    return createSessionKey(config)
  }, [createSessionKey])
  
  const revokeSessionKey = useCallback((sessionId: string, reason: string = 'User revoked'): boolean => {
    if (!sessionManagerRef.current) {
      setError('Session manager not initialized')
      return false
    }
    
    try {
      const success = sessionManagerRef.current.revokeSessionKey(sessionId, reason)
      if (success) {
        refreshSessionKeys()
      }
      return success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session key')
      return false
    }
  }, [refreshSessionKeys])
  
  const getSessionKey = useCallback((sessionId: string): SessionKeyState | null => {
    if (!sessionManagerRef.current) {
      return null
    }
    
    return sessionManagerRef.current.getSessionKey(sessionId)
  }, [])
  
  const checkTransactionLimits = useCallback((
    sessionId: string,
    amount: bigint,
    contractAddress: Address,
    methodName: string
  ): SessionKeyLimits => {
    if (!sessionManagerRef.current) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Session manager not initialized'
      }
    }
    
    return sessionManagerRef.current.checkSessionLimits(sessionId, amount, contractAddress, methodName)
  }, [])
  
  const executeAutomatedTransaction = useCallback(async (
    sessionId: string,
    contractAddress: Address,
    methodName: string,
    amount: bigint,
    data: `0x${string}`,
    gasLimit?: bigint
  ): Promise<{ success: boolean; transactionHash?: Hash; error?: string }> => {
    if (!sessionManagerRef.current) {
      return { success: false, error: 'Session manager not initialized' }
    }
    
    if (!isAutomationEnabled) {
      return { success: false, error: 'Automation is disabled' }
    }
    
    setIsExecutingTransaction(true)
    setError(null)
    
    try {
      const result = await sessionManagerRef.current.executeTransaction(
        sessionId,
        contractAddress,
        methodName,
        amount,
        data,
        gasLimit
      )
      
      if (result.success) {
        refreshSessionKeys() // Refresh to update usage statistics
      } else {
        setError(result.error || 'Transaction failed')
      }
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction execution failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsExecutingTransaction(false)
    }
  }, [isAutomationEnabled, refreshSessionKeys])
  
  const enableAutomation = useCallback(() => {
    if (!address) {
      setError('Wallet must be connected to enable automation')
      return
    }
    
    setIsAutomationEnabled(true)
    setError(null)
  }, [address])
  
  const disableAutomation = useCallback(() => {
    setIsAutomationEnabled(false)
  }, [])
  
  const getSessionStatistics = useCallback((sessionId: string) => {
    if (!sessionManagerRef.current) {
      return null
    }
    
    return sessionManagerRef.current.getUsageStatistics(sessionId)
  }, [])
  
  const cleanupExpiredSessions = useCallback((): number => {
    if (!sessionManagerRef.current) {
      return 0
    }
    
    const cleanedCount = sessionManagerRef.current.cleanupExpiredKeys()
    if (cleanedCount > 0) {
      refreshSessionKeys()
    }
    return cleanedCount
  }, [refreshSessionKeys])
  
  return {
    // Session key management
    createSessionKey,
    createStandardSessionKey,
    revokeSessionKey,
    getSessionKey,
    
    // Transaction execution
    executeAutomatedTransaction,
    
    // Limit checking
    checkTransactionLimits,
    
    // State management
    activeSessionKeys,
    refreshSessionKeys,
    
    // Automation control
    isAutomationEnabled,
    enableAutomation,
    disableAutomation,
    
    // Error handling
    error,
    clearError,
    
    // Loading states
    isCreatingSession,
    isExecutingTransaction,
    
    // Statistics
    getSessionStatistics,
    
    // Cleanup
    cleanupExpiredSessions
  }
}