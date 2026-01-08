/**
 * Token Spending Service
 * 
 * Handles token approvals and spending on behalf of users for automated operations
 */

import { type Address, type Hash, parseUnits, formatUnits } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { useCallback, useState } from 'react'
import { useContracts } from '@/lib/contracts'
import { ERC20_ABI } from '@/lib/contracts'
import { sessionKeyStorage } from '@/lib/session-key-storage'

export interface TokenSpendingConfig {
  tokenAddress: Address
  spenderAddress: Address
  amount: bigint
  sessionKeyId?: string
  autoApprove?: boolean
}

export interface SpendingAllowance {
  token: Address
  spender: Address
  allowance: bigint
  used: bigint
  remaining: bigint
  isUnlimited: boolean
}

export interface TokenSpendingResult {
  success: boolean
  transactionHash?: Hash
  error?: string
  gasUsed?: bigint
}

export function useTokenSpending() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { bucketVaultAddress, payrollEngineAddress, usdyTokenAddress, musdTokenAddress } = useContracts()
  
  const [isApproving, setIsApproving] = useState(false)
  const [isSpending, setIsSpending] = useState(false)

  // Helper function to check if a token is native
  const isNativeToken = useCallback((tokenAddress: Address) => {
    return tokenAddress === '0x0000000000000000000000000000000000000000'
  }, [])

  // Get current allowance for a token/spender pair
  const getAllowance = useCallback(async (
    tokenAddress: Address,
    spenderAddress: Address,
    ownerAddress?: Address
  ): Promise<bigint> => {
    if (!publicClient) throw new Error('Public client not available')
    
    // Native tokens don't have allowances - they're spent directly
    if (isNativeToken(tokenAddress)) {
      return BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') // Return max for native tokens
    }
    
    const owner = ownerAddress || address
    if (!owner) throw new Error('Owner address required')

    try {
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spenderAddress]
      })
      
      return allowance as bigint
    } catch (error) {
      console.error('Failed to get allowance:', error)
      throw new Error('Failed to get token allowance')
    }
  }, [publicClient, address, isNativeToken])

  // Get token balance
  const getTokenBalance = useCallback(async (
    tokenAddress: Address,
    ownerAddress?: Address
  ): Promise<bigint> => {
    if (!publicClient) throw new Error('Public client not available')
    
    const owner = ownerAddress || address
    if (!owner) throw new Error('Owner address required')

    // For native tokens, get ETH balance
    if (isNativeToken(tokenAddress)) {
      try {
        const balance = await publicClient.getBalance({ address: owner })
        return balance
      } catch (error) {
        console.error('Failed to get native token balance:', error)
        throw new Error('Failed to get native token balance')
      }
    }

    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [owner]
      })
      
      return balance as bigint
    } catch (error) {
      console.error('Failed to get token balance:', error)
      throw new Error('Failed to get token balance')
    }
  }, [publicClient, address, isNativeToken])

  // Get token info (decimals, symbol, name)
  const getTokenInfo = useCallback(async (tokenAddress: Address) => {
    if (!publicClient) throw new Error('Public client not available')

    // For native tokens, return hardcoded info
    if (isNativeToken(tokenAddress)) {
      return {
        decimals: 18,
        symbol: 'MNT',
        name: 'Mantle Token'
      }
    }

    try {
      const [decimals, symbol, name] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name'
        })
      ])
      
      return {
        decimals: decimals as number,
        symbol: symbol as string,
        name: name as string
      }
    } catch (error) {
      console.error('Failed to get token info:', error)
      throw new Error('Failed to get token information')
    }
  }, [publicClient, isNativeToken])

  // Approve token spending
  const approveTokenSpending = useCallback(async (config: TokenSpendingConfig): Promise<TokenSpendingResult> => {
    if (!walletClient || !address) {
      throw new Error('Wallet not connected')
    }

    // Native tokens don't need approval
    if (isNativeToken(config.tokenAddress)) {
      return {
        success: true,
        error: 'Native tokens do not require approval - they can be spent directly'
      }
    }

    setIsApproving(true)

    try {
      // Check current allowance
      const currentAllowance = await getAllowance(config.tokenAddress, config.spenderAddress)
      
      // If allowance is already sufficient, no need to approve
      if (currentAllowance >= config.amount) {
        return {
          success: true,
          error: `Sufficient allowance already exists: ${formatUnits(currentAllowance, 18)}`
        }
      }

      // Execute approval transaction
      const hash = await walletClient.writeContract({
        address: config.tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [config.spenderAddress, config.amount]
      })

      // Wait for transaction confirmation
      const receipt = await publicClient?.waitForTransactionReceipt({ hash })
      
      if (!receipt || receipt.status !== 'success') {
        throw new Error('Approval transaction failed')
      }

      // Verify the allowance was actually set
      const newAllowance = await getAllowance(config.tokenAddress, config.spenderAddress)
      if (newAllowance < config.amount) {
        throw new Error('Allowance verification failed - transaction may not have been processed correctly')
      }

      return {
        success: true,
        transactionHash: hash,
        gasUsed: receipt.gasUsed
      }
    } catch (error) {
      console.error('Token approval failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Approval failed'
      }
    } finally {
      setIsApproving(false)
    }
  }, [walletClient, address, getAllowance, publicClient, isNativeToken])

  // Approve unlimited spending (max uint256)
  const approveUnlimitedSpending = useCallback(async (
    tokenAddress: Address,
    spenderAddress: Address
  ): Promise<TokenSpendingResult> => {
    const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    
    return approveTokenSpending({
      tokenAddress,
      spenderAddress,
      amount: maxAmount
    })
  }, [approveTokenSpending])

  // Revoke token spending approval
  const revokeTokenSpending = useCallback(async (
    tokenAddress: Address,
    spenderAddress: Address
  ): Promise<TokenSpendingResult> => {
    return approveTokenSpending({
      tokenAddress,
      spenderAddress,
      amount: 0n
    })
  }, [approveTokenSpending])

  // Execute automated deposit and split using session key
  const executeAutomatedDeposit = useCallback(async (
    tokenAddress: Address,
    amount: bigint,
    sessionKeyId: string
  ): Promise<TokenSpendingResult> => {
    if (!bucketVaultAddress) {
      throw new Error('BucketVault contract not available')
    }

    if (!publicClient || !walletClient) {
      throw new Error('Clients not available')
    }

    setIsSpending(true)

    try {
      // Check session key eligibility
      const eligibility = sessionKeyStorage.canExecuteTransaction(sessionKeyId, amount, bucketVaultAddress)
      if (!eligibility.canExecute) {
        throw new Error(eligibility.reason || 'Transaction not allowed')
      }

      // Check token allowance
      const allowance = await getAllowance(tokenAddress, bucketVaultAddress)
      if (allowance < amount) {
        throw new Error('Insufficient token allowance for BucketVault')
      }

      // Check token balance
      const balance = await getTokenBalance(tokenAddress)
      if (balance < amount) {
        throw new Error('Insufficient token balance')
      }

      // Execute deposit and split
      const hash = await walletClient.writeContract({
        address: bucketVaultAddress,
        abi: [
          {
            "type": "function",
            "name": "depositAndSplit",
            "inputs": [{"name": "amount", "type": "uint256"}],
            "outputs": [],
            "stateMutability": "nonpayable"
          }
        ],
        functionName: 'depositAndSplit',
        args: [amount]
      })

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      if (!receipt || receipt.status !== 'success') {
        throw new Error('Deposit transaction failed')
      }

      // Update session key usage
      sessionKeyStorage.updateSessionKeyUsage(sessionKeyId, amount, bucketVaultAddress)

      return {
        success: true,
        transactionHash: hash,
        gasUsed: receipt.gasUsed
      }
    } catch (error) {
      console.error('Automated deposit failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deposit failed'
      }
    } finally {
      setIsSpending(false)
    }
  }, [bucketVaultAddress, publicClient, walletClient, getAllowance, getTokenBalance])

  // Get all spending allowances for current user
  const getAllSpendingAllowances = useCallback(async (): Promise<SpendingAllowance[]> => {
    if (!address) return []

    const allowances: SpendingAllowance[] = []
    
    // Common tokens to check (exclude native tokens from allowance checking)
    const tokensToCheck = [
      process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as Address,
      usdyTokenAddress,
      musdTokenAddress
    ].filter(token => token && !isNativeToken(token)) as Address[]

    // Common spenders to check
    const spendersToCheck = [
      bucketVaultAddress,
      payrollEngineAddress
    ].filter(Boolean) as Address[]

    try {
      for (const token of tokensToCheck) {
        for (const spender of spendersToCheck) {
          const allowance = await getAllowance(token, spender)
          
          if (allowance > 0n) {
            allowances.push({
              token,
              spender,
              allowance,
              used: 0n, // Would need to track this separately
              remaining: allowance,
              isUnlimited: allowance >= BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') / 2n
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to get spending allowances:', error)
    }

    return allowances
  }, [address, usdyTokenAddress, musdTokenAddress, bucketVaultAddress, payrollEngineAddress, getAllowance, isNativeToken])

  // Setup standard allowances for bucket operations
  const setupBucketAllowances = useCallback(async (tokenAddress: Address): Promise<TokenSpendingResult[]> => {
    if (!bucketVaultAddress) {
      throw new Error('BucketVault contract not available')
    }

    const results: TokenSpendingResult[] = []

    try {
      // Approve unlimited spending for bucket vault
      const bucketResult = await approveUnlimitedSpending(tokenAddress, bucketVaultAddress)
      results.push(bucketResult)

      // Also approve for payroll engine if available
      if (payrollEngineAddress) {
        const payrollResult = await approveUnlimitedSpending(tokenAddress, payrollEngineAddress)
        results.push(payrollResult)
      }

      return results
    } catch (error) {
      console.error('Failed to setup bucket allowances:', error)
      throw error
    }
  }, [bucketVaultAddress, payrollEngineAddress, approveUnlimitedSpending])

  // Check if user has sufficient allowances for automated operations
  const checkAutomationReadiness = useCallback(async (tokenAddress: Address): Promise<{
    isReady: boolean
    missingAllowances: Address[]
    recommendations: string[]
  }> => {
    const missingAllowances: Address[] = []
    const recommendations: string[] = []

    try {
      // Check bucket vault allowance
      if (bucketVaultAddress) {
        const bucketAllowance = await getAllowance(tokenAddress, bucketVaultAddress)
        if (bucketAllowance === 0n) {
          missingAllowances.push(bucketVaultAddress)
          recommendations.push('Approve BucketVault for automated deposits and transfers')
        }
      }

      // Check payroll engine allowance
      if (payrollEngineAddress) {
        const payrollAllowance = await getAllowance(tokenAddress, payrollEngineAddress)
        if (payrollAllowance === 0n) {
          missingAllowances.push(payrollEngineAddress)
          recommendations.push('Approve PayrollEngine for automated payroll processing')
        }
      }

      return {
        isReady: missingAllowances.length === 0,
        missingAllowances,
        recommendations
      }
    } catch (error) {
      console.error('Failed to check automation readiness:', error)
      return {
        isReady: false,
        missingAllowances: [],
        recommendations: ['Failed to check allowances - please try again']
      }
    }
  }, [bucketVaultAddress, payrollEngineAddress, getAllowance])

  return {
    // Core functions
    getAllowance,
    getTokenBalance,
    getTokenInfo,
    approveTokenSpending,
    approveUnlimitedSpending,
    revokeTokenSpending,
    
    // Automated operations
    executeAutomatedDeposit,
    
    // Batch operations
    setupBucketAllowances,
    getAllSpendingAllowances,
    checkAutomationReadiness,
    
    // State
    isApproving,
    isSpending
  }
}

// Utility function to format token amounts
export function formatTokenAmount(amount: bigint, decimals: number, maxDecimals: number = 4): string {
  // Check if this is an unlimited allowance (max uint256 or close to it)
  const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  const isUnlimited = amount >= maxUint256 / 2n // Consider anything above half of max as unlimited
  
  if (isUnlimited) {
    return 'Unlimited'
  }
  
  const formatted = formatUnits(amount, decimals)
  const num = parseFloat(formatted)
  
  if (num === 0) return '0'
  if (num < 0.0001) return '< 0.0001'
  
  // Format large numbers with suffixes
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  })
}

// Utility function to parse token amounts
export function parseTokenAmount(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount, decimals)
  } catch (error) {
    throw new Error('Invalid token amount format')
  }
}

// Get network-specific token addresses
export function getNetworkTokens() {
  return {
    USDC: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as Address,
    USDY: process.env.NEXT_PUBLIC_USDY_TOKEN_SEPOLIA as Address,
    MUSD: process.env.NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA as Address,
    MNT: '0x0000000000000000000000000000000000000000' as Address // Native token
  }
}