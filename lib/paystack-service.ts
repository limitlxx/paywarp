/**
 * Paystack Integration Service
 * Handles fiat-to-crypto conversion with automatic wallet funding
 */

import { ethers } from 'ethers'
import type { Currency } from './types'

export interface PaymentSession {
  reference: string
  amount: number
  currency: 'NGN' | 'USD'
  userAddress: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  paystackUrl: string
  expiresAt: Date
  createdAt: Date
}

export interface DepositRecord {
  id: string
  paystackReference: string
  blockchainTxHash?: string
  fiatAmount: number
  fiatCurrency: 'NGN' | 'USD'
  cryptoAmount: number
  cryptoToken: 'USDC'
  exchangeRate: number
  status: 'success' | 'pending' | 'failed' | 'refunded'
  timestamp: Date
  userAddress: string
  autoSplitTriggered?: boolean
  errorMessage?: string
}

export interface PaystackConfig {
  publicKey: string
  secretKey: string
  managedWalletPrivateKey: string
  managedWalletAddress: string
  usdcTokenAddress: string
  rpcUrl: string
  webhookSecret: string
}

export interface PaystackWebhookEvent {
  event: 'charge.success' | 'charge.failed' | 'transfer.success' | 'transfer.failed'
  data: {
    reference: string
    amount: number
    currency: string
    status: string
    customer: {
      email: string
    }
    metadata?: {
      userAddress: string
      cryptoAmount: number
    }
  }
}

export interface ManagedWalletInfo {
  address: string
  balance: number
  lastUpdated: Date
  transactionCount: number
}

export class PaystackService {
  private config: PaystackConfig
  private managedWallet: ethers.Wallet
  private provider: ethers.JsonRpcProvider

  constructor(config: PaystackConfig) {
    this.config = config
    
    // Validate configuration
    if (!config.managedWalletPrivateKey) {
      throw new Error('PaystackService: managedWalletPrivateKey is required')
    }
    
    if (!config.managedWalletPrivateKey.startsWith('0x') || config.managedWalletPrivateKey.length !== 66) {
      throw new Error('PaystackService: managedWalletPrivateKey must be a valid 32-byte hex string starting with 0x')
    }
    
    if (!config.rpcUrl) {
      throw new Error('PaystackService: rpcUrl is required')
    }

    try {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
      this.managedWallet = new ethers.Wallet(config.managedWalletPrivateKey, this.provider)
    } catch (error) {
      throw new Error(`PaystackService: Failed to initialize wallet - ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Initialize a Paystack payment session
   */
  async initializePayment(
    amount: number,
    currency: 'NGN' | 'USD',
    userAddress: string,
    email: string
  ): Promise<PaymentSession> {
    const reference = this.generateReference()
    const cryptoAmount = await this.calculateCryptoAmount(amount, currency)
    
    const paymentData = {
      email,
      amount: amount * 100, // Paystack expects amount in kobo/cents
      currency,
      reference,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/deposit/callback`,
      metadata: {
        userAddress,
        cryptoAmount,
        email, // Include email in metadata
        custom_fields: [
          {
            display_name: "Wallet Address",
            variable_name: "wallet_address",
            value: userAddress
          },
          {
            display_name: "Email Address",
            variable_name: "email_address", 
            value: email
          }
        ]
      }
    }

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      })

      const result = await response.json()
      
      if (!result.status) {
        throw new Error(`Paystack initialization failed: ${result.message}`)
      }

      return {
        reference,
        amount,
        currency,
        userAddress,
        status: 'pending',
        paystackUrl: result.data.authorization_url,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        createdAt: new Date()
      }
    } catch (error) {
      throw new Error(`Failed to initialize Paystack payment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify a Paystack payment
   */
  async verifyPayment(reference: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`
        }
      })

      const result = await response.json()
      
      if (!result.status) {
        return { success: false, error: result.message }
      }

      return { success: true, data: result.data }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Fund user wallet with USDC after successful Paystack payment
   */
  async fundUserWallet(
    userAddress: string,
    usdcAmount: number,
    paystackReference: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Validate user address
      if (!ethers.isAddress(userAddress)) {
        throw new Error('Invalid user address')
      }

      // Check managed wallet balance
      const managedWalletBalance = await this.getManagedWalletUSDCBalance()
      if (managedWalletBalance < usdcAmount) {
        throw new Error('Insufficient USDC in managed wallet')
      }

      // Create USDC contract instance
      const usdcContract = new ethers.Contract(
        this.config.usdcTokenAddress,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        this.managedWallet
      )

      // Convert amount to proper decimals (USDC has 6 decimals)
      const decimals = await usdcContract.decimals()
      const transferAmount = ethers.parseUnits(usdcAmount.toString(), decimals)

      // Execute transfer
      const tx = await usdcContract.transfer(userAddress, transferAmount)
      await tx.wait()

      return { success: true, txHash: tx.hash }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get managed wallet USDC balance
   */
  async getManagedWalletUSDCBalance(): Promise<number> {
    try {
      const usdcContract = new ethers.Contract(
        this.config.usdcTokenAddress,
        [
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        this.provider
      )

      const balance = await usdcContract.balanceOf(this.config.managedWalletAddress)
      const decimals = await usdcContract.decimals()
      
      return parseFloat(ethers.formatUnits(balance, decimals))
    } catch (error) {
      console.error('Error getting managed wallet balance:', error)
      return 0
    }
  }

  /**
   * Get managed wallet info
   */
  async getManagedWalletInfo(): Promise<ManagedWalletInfo> {
    const balance = await this.getManagedWalletUSDCBalance()
    const transactionCount = await this.provider.getTransactionCount(this.config.managedWalletAddress)

    return {
      address: this.config.managedWalletAddress,
      balance,
      lastUpdated: new Date(),
      transactionCount
    }
  }

  /**
   * Calculate equivalent crypto amount for fiat payment
   */
  private async calculateCryptoAmount(fiatAmount: number, fiatCurrency: 'NGN' | 'USD'): Promise<number> {
    // For simplicity, assuming 1:1 USD to USDC conversion
    // In production, you'd fetch real-time exchange rates
    if (fiatCurrency === 'USD') {
      return fiatAmount
    }
    
    // For NGN, use a mock exchange rate (in production, fetch from reliable source)
    const usdNgnRate = 1500 // Mock rate: 1 USD = 1500 NGN
    return fiatAmount / usdNgnRate
  }

  /**
   * Generate unique payment reference
   */
  private generateReference(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `paywarp_${timestamp}_${random}`
  }

  /**
   * Process webhook event from Paystack
   */
  async processWebhookEvent(event: PaystackWebhookEvent): Promise<DepositRecord | null> {
    try {
      if (event.event === 'charge.success') {
        const { reference, amount, currency } = event.data
        const userAddress = event.data.metadata?.userAddress
        const cryptoAmount = event.data.metadata?.cryptoAmount

        if (!userAddress || !cryptoAmount) {
          throw new Error('Missing user address or crypto amount in webhook metadata')
        }

        // Fund user wallet
        const fundingResult = await this.fundUserWallet(userAddress, cryptoAmount, reference)
        
        if (!fundingResult.success) {
          throw new Error(`Failed to fund user wallet: ${fundingResult.error}`)
        }

        // Create deposit record
        const depositRecord: DepositRecord = {
          id: `deposit_${reference}`,
          paystackReference: reference,
          blockchainTxHash: fundingResult.txHash,
          fiatAmount: amount / 100, // Convert from kobo/cents
          fiatCurrency: currency as 'NGN' | 'USD',
          cryptoAmount,
          cryptoToken: 'USDC',
          exchangeRate: currency === 'USD' ? 1 : 1500, // Mock rate
          status: 'success',
          timestamp: new Date(),
          userAddress,
          autoSplitTriggered: false // Will be set to true when auto-split is triggered
        }

        return depositRecord
      }

      return null
    } catch (error) {
      console.error('Error processing webhook event:', error)
      return null
    }
  }

  /**
   * Get deposit history for a user
   */
  async getDepositHistory(userAddress: string): Promise<DepositRecord[]> {
    // In production, this would query a database
    // For now, return empty array as this is a mock implementation
    return []
  }

  /**
   * Correlate Paystack transaction with blockchain transaction
   */
  async correlateTransactions(paystackRef: string, blockchainTx: string): Promise<void> {
    // In production, this would update the database record
    console.log(`Correlating Paystack ref ${paystackRef} with blockchain tx ${blockchainTx}`)
  }

  /**
   * Handle refund for failed deposits
   */
  async processRefund(reference: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transaction: reference,
          amount: undefined, // Full refund
          currency: undefined,
          customer_note: reason,
          merchant_note: `PayWarp refund: ${reason}`
        })
      })

      const result = await response.json()
      
      if (!result.status) {
        return { success: false, error: result.message }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

// Export singleton instance (in production, this would be properly configured)
let _paystackService: PaystackService | null = null

export function getPaystackService(): PaystackService {
  if (!_paystackService) {
    const config = {
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
      secretKey: process.env.PAYSTACK_SECRET_KEY || '',
      managedWalletPrivateKey: process.env.MANAGED_WALLET_PRIVATE_KEY || '',
      managedWalletAddress: process.env.MANAGED_WALLET_ADDRESS || '',
      usdcTokenAddress: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '',
      rpcUrl: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || '',
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || ''
    }

    // Validate required configuration
    if (!config.managedWalletPrivateKey) {
      throw new Error('MANAGED_WALLET_PRIVATE_KEY environment variable is required')
    }
    
    if (!config.managedWalletPrivateKey.startsWith('0x')) {
      throw new Error('MANAGED_WALLET_PRIVATE_KEY must start with 0x')
    }
    
    if (config.managedWalletPrivateKey.length !== 66) {
      throw new Error('MANAGED_WALLET_PRIVATE_KEY must be 66 characters long (including 0x prefix)')
    }

    _paystackService = new PaystackService(config)
  }
  return _paystackService
}

// For backward compatibility - lazy initialization only when needed
export const paystackService = null // Don't initialize at module load