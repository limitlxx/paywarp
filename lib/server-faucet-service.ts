import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantleSepolia } from '@/lib/networks'

// Faucet configuration
const FAUCET_AMOUNTS = {
  MNT: parseEther('10'), // 10 MNT
  USDC: parseEther('100'), // 100 USDC (using 18 decimals for mock)
} as const

const RATE_LIMIT_HOURS = 24
const FAUCET_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, number>()

export interface ServerFaucetRequest {
  tokenSymbol: 'MNT' | 'USDC'
  recipientAddress: `0x${string}`
}

export interface ServerFaucetResult {
  success: boolean
  transactionHash?: `0x${string}`
  error?: string
  amount?: string
  nextClaimTime?: number
}

export class ServerFaucetService {
  private publicClient
  private walletClient
  private faucetAccount

  constructor() {
    this.publicClient = createPublicClient({
      chain: mantleSepolia,
      transport: http()
    })

    if (FAUCET_PRIVATE_KEY) {
      this.faucetAccount = privateKeyToAccount(FAUCET_PRIVATE_KEY)
      this.walletClient = createWalletClient({
        account: this.faucetAccount,
        chain: mantleSepolia,
        transport: http()
      })
    }
  }

  /**
   * Check if an address can claim tokens (rate limiting)
   */
  canClaim(address: string): { canClaim: boolean; nextClaimTime?: number } {
    const lastClaimTime = rateLimitStore.get(address.toLowerCase())
    
    if (!lastClaimTime) {
      return { canClaim: true }
    }

    const now = Date.now()
    const timeSinceLastClaim = now - lastClaimTime
    const rateLimitMs = RATE_LIMIT_HOURS * 60 * 60 * 1000

    if (timeSinceLastClaim >= rateLimitMs) {
      return { canClaim: true }
    }

    const nextClaimTime = lastClaimTime + rateLimitMs
    return { canClaim: false, nextClaimTime }
  }

  /**
   * Get faucet balance for a token
   */
  async getFaucetBalance(tokenSymbol: 'MNT' | 'USDC'): Promise<string> {
    if (!this.faucetAccount) {
      throw new Error('Faucet not configured')
    }

    try {
      if (tokenSymbol === 'MNT') {
        const balance = await this.publicClient.getBalance({
          address: this.faucetAccount.address
        })
        return formatEther(balance)
      } else {
        // For USDC, we'd need to call the token contract
        // For now, return a mock balance
        return '1000000'
      }
    } catch (error) {
      console.error('Error getting faucet balance:', error)
      return '0'
    }
  }

  /**
   * Request tokens from faucet
   */
  async requestTokens({ tokenSymbol, recipientAddress }: ServerFaucetRequest): Promise<ServerFaucetResult> {
    try {
      // Check rate limiting
      const { canClaim, nextClaimTime } = this.canClaim(recipientAddress)
      if (!canClaim) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait before claiming again.',
          nextClaimTime
        }
      }

      if (!this.walletClient || !this.faucetAccount) {
        return {
          success: false,
          error: 'Faucet service not available'
        }
      }

      const amount = FAUCET_AMOUNTS[tokenSymbol]
      let transactionHash: `0x${string}`

      if (tokenSymbol === 'MNT') {
        // Send native MNT tokens
        transactionHash = await this.walletClient.sendTransaction({
          to: recipientAddress,
          value: amount,
        })
      } else {
        // For USDC, we would interact with the mock ERC20 contract
        // For now, simulate the transaction
        await new Promise(resolve => setTimeout(resolve, 2000))
        transactionHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('') as `0x${string}`
      }

      // Update rate limiting
      rateLimitStore.set(recipientAddress.toLowerCase(), Date.now())

      return {
        success: true,
        transactionHash,
        amount: formatEther(amount)
      }

    } catch (error) {
      console.error('Faucet request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}

// Singleton instance
export const serverFaucetService = new ServerFaucetService()