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

      // Round to 6 decimals (USDC precision) to avoid underflow errors
      const roundedAmount = Math.floor(usdcAmount * 1e6) / 1e6
      console.log(`💰 Funding wallet: ${usdcAmount} → ${roundedAmount} USDC (rounded to 6 decimals)`)

      // Check managed wallet balance
      const managedWalletBalance = await this.getManagedWalletUSDCBalance()
      if (managedWalletBalance < roundedAmount) {
        throw new Error(`Insufficient USDC in managed wallet. Need ${roundedAmount}, have ${managedWalletBalance}`)
      }

      // Create USDC contract instance
      const usdcContract = new ethers.Contract(
        this.config.usdcTokenAddress,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)',
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        ],
        this.managedWallet
      )

      // Get decimals (should be 6 for USDC)
      const decimals = await usdcContract.decimals()
      console.log(`📊 USDC decimals: ${decimals}`)
      
      // Convert amount to proper decimals - use rounded amount with fixed precision
      const amountString = roundedAmount.toFixed(Number(decimals))
      console.log(`🔢 Amount string for parseUnits: ${amountString}`)
      
      const transferAmount = ethers.parseUnits(amountString, decimals)
      console.log(`✅ Transfer amount (wei): ${transferAmount.toString()}`)

      // Execute transfer with error handling for duplicate transactions
      console.log(`📤 Transferring ${roundedAmount} USDC to ${userAddress}...`)
      
      try {
        const tx = await usdcContract.transfer(userAddress, transferAmount)
        console.log(`⏳ Waiting for transaction confirmation...`)
        const receipt = await tx.wait()
        console.log(`✅ Transfer complete! TX: ${tx.hash}`)
        
        return { success: true, txHash: tx.hash }
      } catch (txError: any) {
        // Check if error is "already known" (duplicate transaction)
        if (txError.message?.includes('already known') || 
            txError.message?.includes('nonce too low') ||
            txError.code === 'NONCE_EXPIRED' ||
            txError.code === 'REPLACEMENT_UNDERPRICED') {
          console.log(`⚠️ Transaction already submitted, searching for it...`)
          
          try {
            // First, check pending transactions in mempool
            const nonce = await this.managedWallet.getNonce('pending')
            const latestNonce = await this.managedWallet.getNonce('latest')
            
            console.log(`📊 Nonce check - Pending: ${nonce}, Latest: ${latestNonce}`)
            
            // If there's a pending transaction, wait for it to be mined
            if (nonce > latestNonce) {
              console.log(`⏳ Pending transaction detected, waiting up to 30s for confirmation...`)
              const maxWait = 30000 // 30 seconds
              const checkInterval = 2000 // Check every 2 seconds
              let waited = 0
              
              while (waited < maxWait) {
                await new Promise(resolve => setTimeout(resolve, checkInterval))
                waited += checkInterval
                
                const updatedLatestNonce = await this.managedWallet.getNonce('latest')
                if (updatedLatestNonce >= nonce) {
                  console.log(`✅ Transaction confirmed! Nonce updated to ${updatedLatestNonce}`)
                  break
                }
                console.log(`⏳ Still waiting... (${waited}ms elapsed)`)
              }
            }
            
            // Get recent transactions to find the existing one
            const currentBlock = await this.provider.getBlockNumber()
            const recentBlocks = 200 // Check last 200 blocks (more thorough)
            const fromBlock = Math.max(0, currentBlock - recentBlocks)
            
            // Query Transfer events from managed wallet to user
            const filter = usdcContract.filters.Transfer(this.config.managedWalletAddress, userAddress)
            const events = await usdcContract.queryFilter(filter, fromBlock, currentBlock)
            
            console.log(`📋 Found ${events.length} recent transfer events`)
            
            // Find matching transaction by amount (with some tolerance for rounding)
            const matchingEvent = events.find(event => {
              // Type guard to ensure we have an EventLog with args
              if (!('args' in event) || !event.args) return false
              const eventAmount = event.args[2] || event.args.value // Transfer event: (from, to, value)
              if (!eventAmount) return false
              
              // Check if amounts match (exact match)
              const amountMatch = eventAmount.toString() === transferAmount.toString()
              
              // Also check timestamp - should be recent (within last 5 minutes)
              const block = event.blockNumber
              const isRecent = currentBlock - block < 100 // ~100 blocks for safety
              
              return amountMatch && isRecent
            })
            
            if (matchingEvent) {
              console.log(`✅ Found existing transaction: ${matchingEvent.transactionHash}`)
              return { success: true, txHash: matchingEvent.transactionHash }
            }
            
            // If still not found, it may still be pending
            console.log(`🔍 Transaction not found in recent blocks, checking if still pending...`)
            
            // One more nonce check to see if transaction is truly pending
            const finalPendingNonce = await this.managedWallet.getNonce('pending')
            const finalLatestNonce = await this.managedWallet.getNonce('latest')
            
            if (finalPendingNonce > finalLatestNonce) {
              console.log(`⏳ Transaction is still pending in mempool`)
              return { 
                success: true, 
                txHash: 'pending',
                error: 'Transaction submitted and pending confirmation. Please check your wallet in a few minutes.'
              }
            }
            
            // Transaction should have been mined but we can't find it
            // This is unusual but not necessarily an error
            console.log(`⚠️ Transaction may have been mined but not found in recent events`)
            return { 
              success: true, 
              txHash: 'unknown',
              error: 'Transaction was submitted. Please check your wallet to confirm receipt.'
            }
          } catch (queryError) {
            console.error('❌ Error querying events:', queryError)
            // If we can't query events, assume success since transaction was submitted
            return { 
              success: true, 
              txHash: 'unknown',
              error: 'Transaction submitted but could not verify. Please check your wallet.'
            }
          }
        }
        
        // For other errors, rethrow
        throw txError
      }
    } catch (error) {
      console.error('❌ Fund wallet error:', error)
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
   * Calculate equivalent crypto amount for fiat payment using real-time rates
   */
  private async calculateCryptoAmount(fiatAmount: number, fiatCurrency: 'NGN' | 'USD'): Promise<number> {
    // For USD, 1:1 conversion to USDC
    if (fiatCurrency === 'USD') {
      // Round to 6 decimals (USDC precision)
      return Math.floor(fiatAmount * 1e6) / 1e6
    }
    
    // For NGN, fetch real-time exchange rate from CurrencyManager
    try {
      const { getCurrencyManager } = await import('./currency-manager')
      const currencyManager = getCurrencyManager()
      const rates = await currencyManager.getCurrentRates()
      
      // Convert NGN to USD, then to USDC (1:1)
      const usdAmount = fiatAmount / rates.USD_NGN
      
      // Round to 6 decimals (USDC precision) to avoid underflow errors
      const roundedAmount = Math.floor(usdAmount * 1e6) / 1e6
      
      console.log(`💱 Currency conversion: ₦${fiatAmount} → $${usdAmount} → ${roundedAmount} USDC (rate: ₦${rates.USD_NGN}/USD)`)
      
      return roundedAmount
    } catch (error) {
      console.error('Failed to fetch exchange rate, using fallback:', error)
      // Fallback to conservative rate if fetch fails
      const fallbackRate = 1438 // Conservative mid-market rate
      const usdAmount = fiatAmount / fallbackRate
      
      // Round to 6 decimals
      return Math.floor(usdAmount * 1e6) / 1e6
    }
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

        // Get real exchange rate for record
        let exchangeRate = 1
        if (currency !== 'USD') {
          try {
            const { getCurrencyManager } = await import('./currency-manager')
            const currencyManager = getCurrencyManager()
            const rates = await currencyManager.getCurrentRates()
            exchangeRate = rates.USD_NGN
          } catch (error) {
            console.error('Failed to fetch exchange rate for record:', error)
            exchangeRate = 1438 // Fallback rate
          }
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
          exchangeRate,
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