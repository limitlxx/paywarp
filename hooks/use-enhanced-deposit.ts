/**
 * Enhanced Deposit Hook
 * Handles deposits from wallet, Paystack, and faucet with automatic splitting
 */

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { ethers } from 'ethers'
import { getDepositService, type DepositOptions, type DepositResult } from '@/lib/deposit-service'
import { type PaymentSession } from '@/lib/paystack-service'
import { PaystackStorage, type PaystackSessionData } from '@/lib/paystack-storage'
import { useToast } from './use-toast'
import { useBlockchainBuckets } from './use-blockchain-buckets-improved'

interface UseEnhancedDepositReturn {
  // Deposit methods
  depositFromWallet: (amount: number, bucketId?: string) => Promise<DepositResult>
  depositFromPaystack: (amount: number, currency: 'NGN' | 'USD', email: string) => Promise<DepositResult>
  depositFromFaucet: (amount?: number) => Promise<DepositResult>
  completeManualDeposit: (amount: number) => Promise<DepositResult>
  
  // Paystack session management
  currentPaystackSession: PaymentSession | null
  verifyPaystackPayment: (reference: string) => Promise<boolean>
  
  // State
  isLoading: boolean
  error: string | null
  
  // User info
  usdcBalance: number
  needsSplitConfig: boolean
  
  // Utilities
  refreshUserInfo: () => Promise<void>
  clearError: () => void
}

export function useEnhancedDeposit(): UseEnhancedDepositReturn {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { toast } = useToast()
  const { refreshBalances } = useBlockchainBuckets()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usdcBalance, setUsdcBalance] = useState(0)
  const [needsSplitConfig, setNeedsSplitConfig] = useState(false)
  const [currentPaystackSession, setCurrentPaystackSession] = useState<PaymentSession | null>(null)
  const [isPaystackInitializing, setIsPaystackInitializing] = useState(false)

  /**
   * Complete manual deposit and split (when auto-split failed)
   */
  const completeManualDeposit = useCallback(async (amount: number): Promise<DepositResult> => {
    if (!address || !walletClient) {
      const error = 'Wallet not connected'
      setError(error)
      return { success: false, error }
    }

    setIsLoading(true)
    setError(null)

    try {
      // Convert wagmi wallet client to ethers wallet
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      const depositService = getDepositService()
      const result = await depositService.depositFromWallet(signer as any, amount)
      
      if (result.success) {
        toast({
          title: 'Deposit Complete',
          description: `Successfully deposited and split ${amount} USDC into your buckets`,
        })
        
        // Refresh balances and user info
        await Promise.all([
          refreshBalances(),
          refreshUserInfo()
        ])
      } else {
        setError(result.error || 'Manual deposit failed')
        toast({
          title: 'Deposit Failed',
          description: result.error || 'Manual deposit failed',
          variant: 'destructive'
        })
      }
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Manual deposit failed'
      setError(errorMessage)
      toast({
        title: 'Deposit Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, toast, refreshBalances])

  /**
   * Deposit from user's wallet
   */
  const depositFromWallet = useCallback(async (
    amount: number,
    bucketId?: string
  ): Promise<DepositResult> => {
    if (!address || !walletClient) {
      const error = 'Wallet not connected'
      setError(error)
      return { success: false, error }
    }

    setIsLoading(true)
    setError(null)

    try {
      // Convert wagmi wallet client to ethers wallet
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      const depositService = getDepositService()
      const result = await depositService.depositFromWallet(signer as any, amount, bucketId)
      
      if (result.success) {
        toast({
          title: 'Deposit Successful',
          description: `Successfully deposited ${amount} USDC from your wallet`,
        })
        
        // Refresh balances and user info
        await Promise.all([
          refreshBalances(),
          refreshUserInfo()
        ])
      } else {
        setError(result.error || 'Wallet deposit failed')
        toast({
          title: 'Deposit Failed',
          description: result.error || 'Wallet deposit failed',
          variant: 'destructive'
        })
      }
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Wallet deposit failed'
      setError(errorMessage)
      toast({
        title: 'Deposit Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [address, walletClient, toast, refreshBalances])

  /**
   * Initialize Paystack deposit
   */
  const depositFromPaystack = useCallback(async (
    amount: number,
    currency: 'NGN' | 'USD',
    email: string
  ): Promise<DepositResult> => {
    if (!address) {
      const error = 'Wallet not connected'
      setError(error)
      return { success: false, error }
    }

    setIsLoading(true)
    setIsPaystackInitializing(true)
    setError(null)

    try {
      console.log('🔄 Initializing Paystack payment...', { amount, currency, email, address })
      
      // Call the API route instead of the service directly
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          userAddress: address,
          email
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize payment')
      }

      const session = result.session
      console.log('✅ Paystack session created:', session)
      console.log('🔗 Paystack URL:', session.paystackUrl)
      
      if (session) {
        // Store session in localStorage
        const sessionData = PaystackStorage.storeSession({
          reference: session.reference,
          amount: session.amount,
          currency: session.currency,
          userAddress: session.userAddress,
          email,
          paystackUrl: session.paystackUrl,
          status: 'pending'
        })
        
        console.log('💾 Session stored in localStorage:', sessionData)
        
        // Ensure proper date conversion when setting session from API response
        setCurrentPaystackSession({
          ...session,
          expiresAt: new Date(session.expiresAt),
          createdAt: new Date(session.createdAt)
        })
        console.log('🎯 Current session state updated')
        
        toast({
          title: 'Payment Initialized',
          description: `Paystack payment session created for ${currency} ${amount.toLocaleString()}`,
        })
        
        return {
          success: true,
          paystackReference: session.reference
        }
      } else {
        console.error('❌ No session returned from API')
        throw new Error('Failed to initialize Paystack payment')
      }
    } catch (err) {
      console.error('❌ Paystack initialization error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Paystack deposit failed'
      setError(errorMessage)
      toast({
        title: 'Payment Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
      setIsPaystackInitializing(false)
    }
  }, [address, toast])

  /**
   * Verify Paystack payment and complete deposit
   */
  const verifyPaystackPayment = useCallback(async (reference: string): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Verifying Paystack payment...', reference)
      
      const depositService = getDepositService()
      
      // Step 1: Verify payment and get USDC sent to wallet
      const result = await depositService.completePaystackDeposit(reference, address)
      
      if (result.success) {
        console.log('✅ Payment verified, USDC sent to wallet')
        
        // Step 2: Clear the payment session immediately after USDC transfer
        console.log('🧹 Clearing payment session...')
        PaystackStorage.clearSession()
        setCurrentPaystackSession(null)
        
        toast({
          title: 'Payment Received',
          description: 'USDC has been sent to your wallet. Waiting for balance confirmation...',
        })
        
        // Step 3: Wait for wallet balance confirmation with polling
        console.log('⏳ Waiting for wallet balance confirmation...')
        const cryptoAmount = result.depositRecord?.cryptoAmount || 0
        const balanceConfirmed = await waitForBalanceConfirmation(cryptoAmount)
        
        if (balanceConfirmed) {
          console.log('✅ Balance confirmed, triggering depositAndSplit...')
          
          // Step 4: Call depositAndSplit after balance confirmation
          const splitResult = await triggerDepositAndSplit(cryptoAmount)
          
          if (splitResult) {
            toast({
              title: 'Deposit Complete',
              description: `Successfully deposited and split ${cryptoAmount} USDC into your buckets`,
            })
          } else {
            toast({
              title: 'Manual Action Required',
              description: 'USDC received but auto-split failed. Please complete the deposit manually.',
              variant: 'destructive'
            })
          }
        } else {
          toast({
            title: 'Balance Confirmation Timeout',
            description: 'USDC transfer may still be pending. Please check your wallet and complete deposit manually if needed.',
            variant: 'destructive'
          })
        }
        
        // Refresh balances and user info
        await Promise.all([
          refreshBalances(),
          refreshUserInfo()
        ])
        
        return true
      } else {
        setError(result.error || 'Payment verification failed')
        
        // Clear the session on failure
        PaystackStorage.clearSession()
        setCurrentPaystackSession(null)
        
        toast({
          title: 'Payment Verification Failed',
          description: result.error || 'Payment verification failed',
          variant: 'destructive'
        })
        
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment verification failed'
      setError(errorMessage)
      
      // Clear the session on error
      PaystackStorage.clearSession()
      setCurrentPaystackSession(null)
      
      toast({
        title: 'Payment Verification Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      
      return false
    } finally {
      setIsLoading(false)
    }
  }, [address, toast, refreshBalances])

  /**
   * Wait for wallet balance confirmation with polling
   */
  const waitForBalanceConfirmation = useCallback(async (expectedAmount: number): Promise<boolean> => {
    if (!address) return false

    const depositService = getDepositService()
    const maxAttempts = 30 // 30 attempts = 1 minute with 2-second intervals
    let attempts = 0
    
    const initialBalance = await depositService.getUserUSDCBalance(address)
    console.log(`💰 Initial balance: ${initialBalance} USDC, expecting increase of ${expectedAmount} USDC`)
    
    return new Promise((resolve) => {
      const checkBalance = async () => {
        attempts++
        
        try {
          const currentBalance = await depositService.getUserUSDCBalance(address)
          console.log(`💰 Balance check ${attempts}/${maxAttempts}: ${currentBalance} USDC`)
          
          // Check if balance increased by at least the expected amount (with small tolerance for rounding)
          const balanceIncrease = currentBalance - initialBalance
          const tolerance = 0.01 // 1 cent tolerance
          
          if (balanceIncrease >= (expectedAmount - tolerance)) {
            console.log(`✅ Balance confirmed! Increase: ${balanceIncrease} USDC`)
            resolve(true)
            return
          }
          
          if (attempts >= maxAttempts) {
            console.log(`⏰ Balance confirmation timeout after ${attempts} attempts`)
            resolve(false)
            return
          }
          
          // Continue polling
          setTimeout(checkBalance, 2000) // Check every 2 seconds
        } catch (error) {
          console.error('Error checking balance:', error)
          if (attempts >= maxAttempts) {
            resolve(false)
          } else {
            setTimeout(checkBalance, 2000)
          }
        }
      }
      
      // Start checking after a short delay to allow for transaction propagation
      setTimeout(checkBalance, 1000)
    })
  }, [address])

  /**
   * Trigger depositAndSplit after balance confirmation
   */
  const triggerDepositAndSplit = useCallback(async (amount: number): Promise<boolean> => {
    if (!address || !walletClient) {
      console.error('Wallet not connected for depositAndSplit')
      return false
    }

    try {
      console.log(`🔄 Triggering depositAndSplit for ${amount} USDC...`)
      
      // Convert wagmi wallet client to ethers wallet for deposit service
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      const depositService = getDepositService()
      const result = await depositService.depositFromWallet(signer as any, amount)
      
      if (result.success) {
        console.log('✅ DepositAndSplit completed successfully:', result.transactionHash)
        return true
      } else {
        console.error('❌ DepositAndSplit failed:', result.error)
        return false
      }
    } catch (error) {
      console.error('❌ Error in triggerDepositAndSplit:', error)
      return false
    }
  }, [address, walletClient])

  /**
   * Deposit from faucet (mint USDC for testing)
   */
  const depositFromFaucet = useCallback(async (amount: number = 100): Promise<DepositResult> => {
    if (!address) {
      const error = 'Wallet not connected'
      setError(error)
      return { success: false, error }
    }

    setIsLoading(true)
    setError(null)

    try {
      // Call the faucet API route instead of using the service directly
      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenSymbol: 'USDC',
          recipientAddress: address,
          amount
        })
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        const result: DepositResult = {
          success: true,
          transactionHash: data.transactionHash
        }
        
        toast({
          title: 'Faucet Successful',
          description: `Successfully received ${amount} USDC from faucet`,
        })
        
        // Refresh balances and user info
        await Promise.all([
          refreshBalances(),
          refreshUserInfo()
        ])
        
        return result
      } else {
        const error = data.error || 'Faucet request failed'
        setError(error)
        toast({
          title: 'Faucet Failed',
          description: error,
          variant: 'destructive'
        })
        return { success: false, error }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Faucet request failed'
      setError(errorMessage)
      toast({
        title: 'Faucet Failed',
        description: errorMessage,
        variant: 'destructive'
      })
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [address, toast, refreshBalances])

  /**
   * Refresh user information (balance, config status)
   */
  const refreshUserInfo = useCallback(async () => {
    if (!address) {
      setUsdcBalance(0)
      setNeedsSplitConfig(false)
      return
    }

    try {
      const depositService = getDepositService()
      
      const [balance, needsConfig] = await Promise.all([
        depositService.getUserUSDCBalance(address),
        depositService.checkSplitConfiguration(address)
      ])
      
      setUsdcBalance(balance)
      setNeedsSplitConfig(needsConfig)
    } catch (err) {
      console.error('Error refreshing user info:', err)
    }
  }, [address])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Load user info on mount and address change
   */
  useEffect(() => {
    if (address) {
      refreshUserInfo()
      
      // Check for existing Paystack session
      const existingSession = PaystackStorage.getSession()
      if (existingSession && existingSession.userAddress === address) {
        setCurrentPaystackSession({
          reference: existingSession.reference,
          amount: existingSession.amount,
          currency: existingSession.currency,
          userAddress: existingSession.userAddress,
          status: existingSession.status,
          paystackUrl: existingSession.paystackUrl,
          expiresAt: new Date(existingSession.expiresAt),
          createdAt: new Date(existingSession.createdAt)
        })
      }
    } else {
      setUsdcBalance(0)
      setNeedsSplitConfig(false)
      setCurrentPaystackSession(null)
      PaystackStorage.clearSession()
    }
  }, [address, refreshUserInfo])

  /**
   * Listen for Paystack callbacks from popup window
   */
  useEffect(() => {
    const checkForCallback = () => {
      // Check for callback without consuming it first
      const callback = PaystackStorage.getCallback()
      if (callback && currentPaystackSession?.reference === callback.reference) {
        if (callback.status === 'success') {
          // Automatically verify the payment
          // Only consume callback after successful verification
          verifyPaystackPayment(callback.reference).then(success => {
            if (success) {
              // Clear callback only after successful verification
              PaystackStorage.clearCallback()
            }
          })
        } else {
          // For failed payments, we can consume immediately
          PaystackStorage.consumeCallback()
          setCurrentPaystackSession(prev => prev ? { ...prev, status: 'failed' } : null)
          toast({
            title: 'Payment Failed',
            description: 'Payment was not completed successfully.',
            variant: 'destructive'
          })
        }
      }
    }

    // Check immediately
    checkForCallback()

    // Set up interval to check for callbacks
    const interval = setInterval(checkForCallback, 2000)

    // Listen for storage changes (cross-tab communication)
    const cleanup = PaystackStorage.onStorageChange((event) => {
      if (event.key === 'paystack_callback') {
        checkForCallback()
      }
    })

    return () => {
      clearInterval(interval)
      cleanup()
    }
  }, [currentPaystackSession, verifyPaystackPayment, toast])

  /**
   * Handle Paystack session expiration
   */
  useEffect(() => {
    if (!currentPaystackSession || currentPaystackSession.status !== 'pending') return

    // Ensure expiresAt is a Date object
    const expiresAt = currentPaystackSession.expiresAt instanceof Date 
      ? currentPaystackSession.expiresAt 
      : new Date(currentPaystackSession.expiresAt)
    
    const timeUntilExpiry = expiresAt.getTime() - Date.now()
    
    if (timeUntilExpiry <= 0) {
      setCurrentPaystackSession(prev => prev ? { ...prev, status: 'failed' } : null)
      return
    }

    const timeout = setTimeout(() => {
      setCurrentPaystackSession(prev => prev ? { ...prev, status: 'failed' } : null)
      toast({
        title: 'Payment Expired',
        description: 'The payment session has expired. Please try again.',
        variant: 'destructive'
      })
    }, timeUntilExpiry)

    return () => clearTimeout(timeout)
  }, [currentPaystackSession, toast])

  return {
    depositFromWallet,
    depositFromPaystack,
    depositFromFaucet,
    completeManualDeposit,
    currentPaystackSession,
    verifyPaystackPayment,
    isLoading,
    error,
    usdcBalance,
    needsSplitConfig,
    refreshUserInfo,
    clearError
  }
}