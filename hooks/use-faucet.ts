import { useState, useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNetwork } from './use-network'
import { faucetService, type FaucetRequest, type FaucetResult } from '@/lib/faucet-service'

interface FaucetState {
  isLoading: boolean
  error: string | null
  lastClaimTimes: Record<string, number>
  transactionHashes: Record<string, string>
  claimStatus: Record<string, 'idle' | 'pending' | 'success' | 'failed'>
}

export function useFaucet() {
  const { address } = useAccount()
  const { isTestnet } = useNetwork()
  
  const [state, setState] = useState<FaucetState>({
    isLoading: false,
    error: null,
    lastClaimTimes: {},
    transactionHashes: {},
    claimStatus: {}
  })

  // Check if faucet is available (testnet only)
  const isFaucetAvailable = isTestnet && !!address

  // Check if user can claim tokens
  const canClaim = useCallback((tokenSymbol: 'MNT' | 'USDC') => {
    if (!address || !isFaucetAvailable) return false
    
    // This will be checked asynchronously in the component
    return true // Allow the component to handle the actual check
  }, [address, isFaucetAvailable])

  // Get next claim time for a token
  const getNextClaimTime = useCallback((tokenSymbol: 'MNT' | 'USDC') => {
    if (!address) return null
    
    // This will be fetched asynchronously in the component
    return null
  }, [address])

  // Check claim eligibility (async version)
  const checkClaimEligibility = useCallback(async (tokenSymbol: 'MNT' | 'USDC') => {
    if (!address || !isFaucetAvailable) {
      return { canClaim: false, nextClaimTime: undefined }
    }
    
    return await faucetService.canClaim(address)
  }, [address, isFaucetAvailable])

  // Request tokens from faucet
  const requestTokens = useCallback(async (tokenSymbol: 'MNT' | 'USDC'): Promise<FaucetResult> => {
    if (!address || !isFaucetAvailable) {
      return {
        success: false,
        error: 'Wallet not connected or not on testnet'
      }
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      claimStatus: { ...prev.claimStatus, [tokenSymbol]: 'pending' }
    }))

    try {
      const result = await faucetService.requestTokens({
        tokenSymbol,
        recipientAddress: address as `0x${string}`
      })

      setState(prev => ({
        ...prev,
        isLoading: false,
        claimStatus: { 
          ...prev.claimStatus, 
          [tokenSymbol]: result.success ? 'success' : 'failed' 
        },
        transactionHashes: result.transactionHash ? {
          ...prev.transactionHashes,
          [tokenSymbol]: result.transactionHash
        } : prev.transactionHashes,
        lastClaimTimes: result.success ? {
          ...prev.lastClaimTimes,
          [tokenSymbol]: Date.now()
        } : prev.lastClaimTimes,
        error: result.error || null
      }))

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        claimStatus: { ...prev.claimStatus, [tokenSymbol]: 'failed' }
      }))

      return {
        success: false,
        error: errorMessage
      }
    }
  }, [address, isFaucetAvailable])

  // Monitor transaction status
  const monitorTransaction = useCallback(async (tokenSymbol: 'MNT' | 'USDC', hash: string) => {
    try {
      const status = await faucetService.getTransactionStatus(hash as `0x${string}`)
      
      setState(prev => ({
        ...prev,
        claimStatus: {
          ...prev.claimStatus,
          [tokenSymbol]: status.status === 'success' ? 'success' : 
                        status.status === 'failed' ? 'failed' : 'pending'
        }
      }))

      return status
    } catch (error) {
      console.error('Error monitoring transaction:', error)
      return { status: 'failed' as const }
    }
  }, [])

  // Reset claim status for a token
  const resetClaimStatus = useCallback((tokenSymbol: 'MNT' | 'USDC') => {
    setState(prev => ({
      ...prev,
      claimStatus: { ...prev.claimStatus, [tokenSymbol]: 'idle' },
      error: null
    }))
  }, [])

  // Clear all errors
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Get faucet balance
  const getFaucetBalance = useCallback(async (tokenSymbol: 'MNT' | 'USDC') => {
    try {
      return await faucetService.getFaucetBalance(tokenSymbol)
    } catch (error) {
      console.error('Error getting faucet balance:', error)
      return '0'
    }
  }, [])

  // Auto-clear success status after some time
  useEffect(() => {
    const successTokens = Object.entries(state.claimStatus)
      .filter(([_, status]) => status === 'success')
      .map(([token]) => token)

    if (successTokens.length > 0) {
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          claimStatus: Object.fromEntries(
            Object.entries(prev.claimStatus).map(([token, status]) => [
              token,
              successTokens.includes(token) ? 'idle' : status
            ])
          )
        }))
      }, 5000) // Clear success status after 5 seconds

      return () => clearTimeout(timer)
    }
  }, [state.claimStatus])

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    claimStatus: state.claimStatus,
    transactionHashes: state.transactionHashes,
    
    // Computed values
    isFaucetAvailable,
    canClaim,
    getNextClaimTime,
    checkClaimEligibility,
    
    // Actions
    requestTokens,
    monitorTransaction,
    resetClaimStatus,
    clearError,
    getFaucetBalance,
  }
}