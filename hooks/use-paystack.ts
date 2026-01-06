/**
 * React hook for Paystack integration
 * Manages payment sessions, deposit history, and auto-split triggering
 */

import { useState, useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { getPaystackService, type PaymentSession, type DepositRecord } from '@/lib/paystack-service'
import { useBlockchainBuckets } from './use-blockchain-buckets'
import { toast } from './use-toast'

interface UsePaystackReturn {
  // Payment session management
  currentSession: PaymentSession | null
  isInitializing: boolean
  initializePayment: (amount: number, currency: 'NGN' | 'USD', email: string) => Promise<PaymentSession | null>
  verifyPayment: (reference: string) => Promise<boolean>
  
  // Deposit history
  depositHistory: DepositRecord[]
  isLoadingHistory: boolean
  refreshHistory: () => Promise<void>
  
  // Auto-split integration
  triggerAutoSplit: (depositRecord: DepositRecord) => Promise<boolean>
  
  // Error handling
  error: string | null
  clearError: () => void
}

export function usePaystack(): UsePaystackReturn {
  const { address } = useAccount()
  const { depositAndSplit } = useBlockchainBuckets()
  
  const [currentSession, setCurrentSession] = useState<PaymentSession | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [depositHistory, setDepositHistory] = useState<DepositRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initialize a new Paystack payment
   */
  const initializePayment = useCallback(async (
    amount: number,
    currency: 'NGN' | 'USD',
    email: string
  ): Promise<PaymentSession | null> => {
    if (!address) {
      setError('Wallet not connected')
      return null
    }

    setIsInitializing(true)
    setError(null)

    try {
      const session = await getPaystackService().initializePayment(amount, currency, address, email)
      setCurrentSession(session)
      
      toast({
        title: 'Payment Initialized',
        description: `Paystack payment session created for ${currency} ${amount.toLocaleString()}`,
      })
      
      return session
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment'
      setError(errorMessage)
      
      toast({
        title: 'Payment Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      
      return null
    } finally {
      setIsInitializing(false)
    }
  }, [address])

  /**
   * Verify a Paystack payment and trigger wallet funding
   */
  const verifyPayment = useCallback(async (reference: string): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected')
      return false
    }

    setError(null)

    try {
      const verification = await getPaystackService().verifyPayment(reference)
      
      if (!verification.success) {
        throw new Error(verification.error || 'Payment verification failed')
      }

      // Update current session status
      if (currentSession?.reference === reference) {
        setCurrentSession(prev => prev ? { ...prev, status: 'success' } : null)
      }

      toast({
        title: 'Payment Verified',
        description: 'Your deposit has been processed successfully',
      })

      // Refresh deposit history
      await refreshHistory()
      
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment verification failed'
      setError(errorMessage)
      
      // Update current session status
      if (currentSession?.reference === reference) {
        setCurrentSession(prev => prev ? { ...prev, status: 'failed' } : null)
      }
      
      toast({
        title: 'Payment Verification Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      
      return false
    }
  }, [address, currentSession])

  /**
   * Trigger auto-split after successful deposit
   */
  const triggerAutoSplit = useCallback(async (depositRecord: DepositRecord): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected')
      return false
    }

    try {
      // Convert crypto amount to wei (assuming USDC has 6 decimals)
      const amountInWei = BigInt(Math.floor(depositRecord.cryptoAmount * 1e6))
      
      const result = await depositAndSplit(amountInWei)
      
      if (result.success) {
        toast({
          title: 'Auto-Split Completed',
          description: `${depositRecord.cryptoAmount} USDC has been split across your buckets`,
        })
        
        // Update deposit record to mark auto-split as triggered
        // In production, this would update the database
        console.log(`Auto-split triggered for deposit ${depositRecord.id}`)
        
        return true
      } else {
        throw new Error(result.error || 'Auto-split failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Auto-split failed'
      setError(errorMessage)
      
      toast({
        title: 'Auto-Split Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      
      return false
    }
  }, [address, depositAndSplit])

  /**
   * Refresh deposit history
   */
  const refreshHistory = useCallback(async () => {
    if (!address) return

    setIsLoadingHistory(true)
    setError(null)

    try {
      const history = await getPaystackService().getDepositHistory(address)
      setDepositHistory(history)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load deposit history'
      setError(errorMessage)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [address])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Load deposit history on mount and address change
   */
  useEffect(() => {
    if (address) {
      refreshHistory()
    } else {
      setDepositHistory([])
      setCurrentSession(null)
    }
  }, [address, refreshHistory])

  /**
   * Handle payment session expiration
   */
  useEffect(() => {
    if (!currentSession || currentSession.status !== 'pending') return

    const timeUntilExpiry = currentSession.expiresAt.getTime() - Date.now()
    
    if (timeUntilExpiry <= 0) {
      setCurrentSession(prev => prev ? { ...prev, status: 'failed' } : null)
      return
    }

    const timeout = setTimeout(() => {
      setCurrentSession(prev => prev ? { ...prev, status: 'failed' } : null)
      toast({
        title: 'Payment Expired',
        description: 'The payment session has expired. Please try again.',
        variant: 'destructive'
      })
    }, timeUntilExpiry)

    return () => clearTimeout(timeout)
  }, [currentSession])

  return {
    currentSession,
    isInitializing,
    initializePayment,
    verifyPayment,
    depositHistory,
    isLoadingHistory,
    refreshHistory,
    triggerAutoSplit,
    error,
    clearError
  }
}