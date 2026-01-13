import { createPublicClient, http } from 'viem'
import { mantleSepolia } from '@/lib/networks'

export interface FaucetRequest {
  tokenSymbol: 'MNT' | 'USDC'
  recipientAddress: `0x${string}`
}

export interface FaucetResult {
  success: boolean
  transactionHash?: `0x${string}`
  error?: string
  amount?: string
  nextClaimTime?: number
}

export class FaucetService {
  private publicClient

  constructor() {
    this.publicClient = createPublicClient({
      chain: mantleSepolia,
      transport: http()
    })
  }

  /**
   * Check if an address can claim tokens (rate limiting)
   */
  async canClaim(address: string): Promise<{ canClaim: boolean; nextClaimTime?: number }> {
    try {
      const response = await fetch(`/api/faucet?address=${address}`)
      if (response.ok) {
        return await response.json()
      }
      return { canClaim: false }
    } catch (error) {
      console.error('Error checking claim eligibility:', error)
      return { canClaim: false }
    }
  }

  /**
   * Get faucet balance for a token
   */
  async getFaucetBalance(tokenSymbol: 'MNT' | 'USDC'): Promise<string> {
    try {
      const response = await fetch(`/api/faucet?token=${tokenSymbol}`)
      if (response.ok) {
        const data = await response.json()
        return data.balance || '0'
      }
      return '0'
    } catch (error) {
      console.error('Error getting faucet balance:', error)
      return '0'
    }
  }

  /**
   * Request tokens from faucet
   */
  async requestTokens({ tokenSymbol, recipientAddress }: FaucetRequest): Promise<FaucetResult> {
    try {
      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenSymbol,
          recipientAddress
        })
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          transactionHash: data.transactionHash,
          amount: data.amount
        }
      } else {
        return {
          success: false,
          error: data.error,
          nextClaimTime: data.nextClaimTime
        }
      }
    } catch (error) {
      console.error('Faucet request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred'
      }
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(hash: `0x${string}`): Promise<{
    status: 'pending' | 'success' | 'failed'
    blockNumber?: bigint
  }> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash })
      return {
        status: receipt.status === 'success' ? 'success' : 'failed',
        blockNumber: receipt.blockNumber
      }
    } catch (error) {
      // Transaction might still be pending
      return { status: 'pending' }
    }
  }
}

// Singleton instance
export const faucetService = new FaucetService()