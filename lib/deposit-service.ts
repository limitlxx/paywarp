/**
 * Enhanced Deposit Service
 * Handles deposits from wallet, Paystack, and faucet with automatic contract splitting
 */

import { ethers } from 'ethers'
import { getPaystackService, type DepositRecord } from './paystack-service'
import BucketVaultABI from './abis/BucketVault.json'

export interface DepositOptions {
  amount: number
  method: 'wallet' | 'paystack' | 'faucet'
  userAddress: string
  email?: string // Required for Paystack
  currency?: 'NGN' | 'USD' // For Paystack
  bucketId?: string // For specific bucket deposits
}

export interface DepositResult {
  success: boolean
  transactionHash?: string
  paystackReference?: string
  error?: string
  depositRecord?: DepositRecord
}

export interface ContractAddresses {
  bucketVault: string
  usdc: string
  faucet?: string
}

export interface SplitConfig {
  billingsPercent: bigint
  savingsPercent: bigint
  growthPercent: bigint
  instantPercent: bigint
  spendablePercent: bigint
}

export class DepositService {
  private provider: ethers.JsonRpcProvider
  private contracts: ContractAddresses
  private managedWallet?: ethers.Wallet

  constructor(rpcUrl: string, contracts: ContractAddresses, managedWalletKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    this.contracts = contracts
    
    if (managedWalletKey) {
      this.managedWallet = new ethers.Wallet(managedWalletKey, this.provider)
    }
  }

  /**
   * Process deposit from wallet (user pays gas)
   */
  async depositFromWallet(
    userWallet: ethers.Wallet,
    amount: number,
    bucketId?: string
  ): Promise<DepositResult> {
    try {
      // Create contract instances
      const usdcContract = new ethers.Contract(
        this.contracts.usdc,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)',
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)',
          'function transfer(address to, uint256 amount) returns (bool)'
        ],
        userWallet
      )

      const bucketVaultContract = new ethers.Contract(
        this.contracts.bucketVault,
        BucketVaultABI,
        userWallet
      )

      // Check user USDC balance
      const decimals = await usdcContract.decimals()
      const amountWei = ethers.parseUnits(amount.toString(), decimals)
      const userBalance = await usdcContract.balanceOf(userWallet.address)

      if (userBalance < amountWei) {
        return {
          success: false,
          error: `Insufficient USDC balance. You have ${ethers.formatUnits(userBalance, decimals)} USDC, need ${amount} USDC`
        }
      }

      // Check if user has split configuration
      const splitConfig = await bucketVaultContract.getSplitConfig(userWallet.address)
      const configSum = splitConfig[0] + splitConfig[1] + splitConfig[2] + splitConfig[3] + splitConfig[4]
      
      if (configSum === 0n) {
        // Set default split configuration if none exists
        const defaultConfig = [
          2000n, // billingsPercent - 20%
          3000n, // savingsPercent - 30%
          2000n, // growthPercent - 20%
          1500n, // instantPercent - 15%
          1500n  // spendablePercent - 15%
        ]
        
        console.log('Setting default split configuration...')
        const configTx = await bucketVaultContract.setSplitConfig(defaultConfig)
        await configTx.wait()
      }

      // Check and approve USDC spending
      const currentAllowance = await usdcContract.allowance(userWallet.address, this.contracts.bucketVault)
      
      if (currentAllowance < amountWei) {
        console.log('Approving USDC spending...')
        const approveTx = await usdcContract.approve(this.contracts.bucketVault, amountWei)
        await approveTx.wait()
      }

      // Perform deposit and split
      console.log('Depositing and splitting funds...')
      const depositTx = await bucketVaultContract.depositAndSplit(amountWei)
      const receipt = await depositTx.wait()

      return {
        success: true,
        transactionHash: receipt.hash
      }
    } catch (error) {
      console.error('Wallet deposit error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Wallet deposit failed'
      }
    }
  }

  /**
   * Process deposit from Paystack (managed wallet pays gas)
   */
  async depositFromPaystack(
    amount: number,
    currency: 'NGN' | 'USD',
    userAddress: string,
    email: string
  ): Promise<DepositResult> {
    try {
      if (!this.managedWallet) {
        throw new Error('Managed wallet not configured for Paystack deposits')
      }

      // Initialize Paystack payment
      const paystackService = getPaystackService()
      const session = await paystackService.initializePayment(amount, currency, userAddress, email)
      
      if (!session) {
        throw new Error('Failed to initialize Paystack payment')
      }

      return {
        success: true,
        paystackReference: session.reference
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Paystack deposit initialization failed'
      }
    }
  }

  /**
   * Complete Paystack deposit after payment verification
   */
  async completePaystackDeposit(
    paystackReference: string,
    userAddress: string
  ): Promise<DepositResult> {
    try {
      if (!this.managedWallet) {
        throw new Error('Managed wallet not configured')
      }

      const paystackService = getPaystackService()
      
      // Verify payment with Paystack
      const verification = await paystackService.verifyPayment(paystackReference)
      if (!verification.success) {
        throw new Error(verification.error || 'Payment verification failed')
      }

      // Calculate crypto amount from payment data
      const paymentData = verification.data
      const cryptoAmount = paymentData.metadata?.cryptoAmount || 
        (paymentData.currency === 'USD' ? paymentData.amount / 100 : (paymentData.amount / 100) / 1500)

      // Fund user wallet with USDC
      const fundingResult = await paystackService.fundUserWallet(userAddress, cryptoAmount, paystackReference)
      
      if (!fundingResult.success) {
        throw new Error(fundingResult.error || 'Failed to fund user wallet')
      }

      // Now trigger the actual deposit and split on the contract
      const splitResult = await this.executeDepositAndSplit(userAddress, cryptoAmount)
      
      if (!splitResult.success) {
        // If auto-split fails, the user still has the USDC in their wallet
        // They can manually trigger the split later
        console.warn('Auto-split failed, but USDC was transferred to user:', splitResult.error)
      }

      // Create deposit record
      const depositRecord: DepositRecord = {
        id: `deposit_${paystackReference}`,
        paystackReference,
        blockchainTxHash: fundingResult.txHash,
        fiatAmount: paymentData.amount / 100,
        fiatCurrency: paymentData.currency as 'NGN' | 'USD',
        cryptoAmount,
        cryptoToken: 'USDC',
        exchangeRate: paymentData.currency === 'USD' ? 1 : 1500,
        status: 'success',
        timestamp: new Date(),
        userAddress,
        autoSplitTriggered: splitResult.success
      }

      return {
        success: true,
        transactionHash: splitResult.transactionHash || fundingResult.txHash,
        paystackReference,
        depositRecord
      }
    } catch (error) {
      console.error('Paystack deposit completion error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Paystack deposit completion failed'
      }
    }
  }

  /**
   * Execute deposit and split on the contract using managed wallet
   * This transfers USDC from user to contract and splits it into buckets
   */
  private async executeDepositAndSplit(
    userAddress: string,
    amount: number
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.managedWallet) {
        throw new Error('Managed wallet not configured')
      }

      // Create contract instances with managed wallet
      const usdcContract = new ethers.Contract(
        this.contracts.usdc,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)',
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)',
          'function transferFrom(address from, address to, uint256 amount) returns (bool)'
        ],
        this.managedWallet
      )

      const bucketVaultContract = new ethers.Contract(
        this.contracts.bucketVault,
        BucketVaultABI,
        this.managedWallet
      )

      const decimals = await usdcContract.decimals()
      const amountWei = ethers.parseUnits(amount.toString(), decimals)

      // Check if user has sufficient USDC balance
      const userBalance = await usdcContract.balanceOf(userAddress)
      if (userBalance < amountWei) {
        throw new Error('User has insufficient USDC balance for deposit')
      }

      // Check if user has split configuration, set default if not
      const splitConfig = await bucketVaultContract.getSplitConfig(userAddress)
      const configSum = splitConfig[0] + splitConfig[1] + splitConfig[2] + splitConfig[3] + splitConfig[4]
      
      if (configSum === 0n) {
        // Set default split configuration using managed wallet
        const defaultConfig = [
          2000n, // billingsPercent - 20%
          3000n, // savingsPercent - 30%
          2000n, // growthPercent - 20%
          1500n, // instantPercent - 15%
          1500n  // spendablePercent - 15%
        ]
        
        console.log('Setting default split configuration for user...')
        
        // Check if the contract allows setting config for another user
        try {
          const configTx = await bucketVaultContract.setSplitConfigForUser(userAddress, defaultConfig)
          await configTx.wait()
        } catch (configError) {
          // If setSplitConfigForUser doesn't exist, user needs to set it manually
          console.warn('Cannot set split config for user via managed wallet:', configError)
          return {
            success: false,
            error: 'User needs to set split configuration manually before deposit'
          }
        }
      }

      // Check if managed wallet has approval to spend user's USDC
      const currentAllowance = await usdcContract.allowance(userAddress, this.contracts.bucketVault)
      
      if (currentAllowance < amountWei) {
        // For gasless transactions, we need the user to have pre-approved the contract
        // or we need to implement meta-transactions
        return {
          success: false,
          error: 'User needs to approve USDC spending by the contract first'
        }
      }

      // Execute depositAndSplit on behalf of the user
      // Note: This requires the contract to support depositAndSplitForUser function
      try {
        const depositTx = await bucketVaultContract.depositAndSplitForUser(userAddress, amountWei)
        const receipt = await depositTx.wait()

        return {
          success: true,
          transactionHash: receipt.hash
        }
      } catch (depositError) {
        // If depositAndSplitForUser doesn't exist, try regular depositAndSplit
        // but this won't work since we're using managed wallet, not user wallet
        console.warn('depositAndSplitForUser not available, user needs to manually trigger deposit')
        return {
          success: false,
          error: 'User needs to manually trigger depositAndSplit() function'
        }
      }
    } catch (error) {
      console.error('Execute deposit and split error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deposit and split execution failed'
      }
    }
  }

  /**
   * Trigger auto-split for user using managed wallet (gasless for user)
   * @deprecated Use executeDepositAndSplit instead
   */
  private async triggerAutoSplitForUser(
    userAddress: string,
    amount: number
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.managedWallet) {
        throw new Error('Managed wallet not configured')
      }

      // Create USDC contract instance with managed wallet
      const usdcContract = new ethers.Contract(
        this.contracts.usdc,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)',
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)',
          'function transferFrom(address from, address to, uint256 amount) returns (bool)'
        ],
        this.managedWallet
      )

      const bucketVaultContract = new ethers.Contract(
        this.contracts.bucketVault,
        BucketVaultABI,
        this.managedWallet
      )

      const decimals = await usdcContract.decimals()
      const amountWei = ethers.parseUnits(amount.toString(), decimals)

      // Check if user has sufficient USDC balance
      const userBalance = await usdcContract.balanceOf(userAddress)
      if (userBalance < amountWei) {
        throw new Error('User has insufficient USDC balance for auto-split')
      }

      // Check if user has split configuration, set default if not
      const splitConfig = await bucketVaultContract.getSplitConfig(userAddress)
      const configSum = splitConfig[0] + splitConfig[1] + splitConfig[2] + splitConfig[3] + splitConfig[4]
      
      if (configSum === 0n) {
        // Set default split configuration using managed wallet (gasless for user)
        const defaultConfig = [
          2000n, // billingsPercent - 20%
          3000n, // savingsPercent - 30%
          2000n, // growthPercent - 20%
          1500n, // instantPercent - 15%
          1500n  // spendablePercent - 15%
        ]
        
        console.log('Setting default split configuration for user via managed wallet...')
        // Note: This would require a special function in the contract to set config for another user
        // For now, we'll skip auto-split and let user handle it manually
        return {
          success: false,
          error: 'User needs to set split configuration manually'
        }
      }

      // For gasless auto-split, we would need the user to pre-approve the managed wallet
      // or implement a meta-transaction system. For now, we'll transfer USDC and let user handle split
      console.log(`USDC transferred to user ${userAddress}, amount: ${amount}`)
      console.log('User needs to manually trigger depositAndSplit() function')
      
      return {
        success: true,
        transactionHash: 'manual_split_required' // User needs to manually trigger split
      }
    } catch (error) {
      console.error('Auto-split error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-split failed'
      }
    }
  }

  /**
   * Process faucet deposit (mint USDC for testing)
   */
  async depositFromFaucet(
    userAddress: string,
    amount: number = 100
  ): Promise<DepositResult> {
    try {
      if (!this.managedWallet) {
        throw new Error('Managed wallet not configured for faucet')
      }

      // For testnet, we can mint USDC directly to user
      // This assumes we have a mintable USDC contract for testing
      const usdcContract = new ethers.Contract(
        this.contracts.usdc,
        [
          'function mint(address to, uint256 amount) external',
          'function decimals() view returns (uint8)',
          'function balanceOf(address account) view returns (uint256)',
          'function transfer(address to, uint256 amount) returns (bool)',
          'function owner() view returns (address)'
        ],
        this.managedWallet
      )

      const decimals = await usdcContract.decimals()
      const amountWei = ethers.parseUnits(amount.toString(), decimals)

      try {
        // Try to mint USDC to user (if contract supports minting)
        const mintTx = await usdcContract.mint(userAddress, amountWei)
        const receipt = await mintTx.wait()

        return {
          success: true,
          transactionHash: receipt.hash
        }
      } catch (mintError) {
        console.log('Minting failed, trying transfer from managed wallet:', mintError)
        
        // If minting fails, try transferring from managed wallet
        const managedBalance = await usdcContract.balanceOf(this.managedWallet.address)
        if (managedBalance < amountWei) {
          throw new Error('Insufficient USDC in managed wallet for faucet')
        }

        // Transfer USDC to user
        const transferTx = await usdcContract.transfer(userAddress, amountWei)
        const receipt = await transferTx.wait()

        return {
          success: true,
          transactionHash: receipt.hash
        }
      }
    } catch (error) {
      console.error('Faucet error:', error)
      return {
        success: false,
        error: `Faucet failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get instructions for manual deposit and split
   * Returns the steps user needs to take to complete the deposit
   */
  async getManualDepositInstructions(userAddress: string, amount: number): Promise<{
    needsApproval: boolean
    needsConfig: boolean
    approvalAmount?: string
    contractAddress: string
    steps: string[]
  }> {
    try {
      const usdcContract = new ethers.Contract(
        this.contracts.usdc,
        [
          'function allowance(address owner, address spender) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        this.provider
      )

      const bucketVaultContract = new ethers.Contract(
        this.contracts.bucketVault,
        BucketVaultABI,
        this.provider
      )

      const decimals = await usdcContract.decimals()
      const amountWei = ethers.parseUnits(amount.toString(), decimals)

      // Check allowance
      const currentAllowance = await usdcContract.allowance(userAddress, this.contracts.bucketVault)
      const needsApproval = currentAllowance < amountWei

      // Check split config
      const splitConfig = await bucketVaultContract.getSplitConfig(userAddress)
      const configSum = splitConfig[0] + splitConfig[1] + splitConfig[2] + splitConfig[3] + splitConfig[4]
      const needsConfig = configSum === 0n

      const steps: string[] = []
      
      if (needsConfig) {
        steps.push('1. Set your split configuration in Settings')
      }
      
      if (needsApproval) {
        steps.push(`${steps.length + 1}. Approve USDC spending: ${amount} USDC`)
      }
      
      steps.push(`${steps.length + 1}. Call depositAndSplit(${amountWei.toString()}) on the contract`)

      return {
        needsApproval,
        needsConfig,
        approvalAmount: needsApproval ? amountWei.toString() : undefined,
        contractAddress: this.contracts.bucketVault,
        steps
      }
    } catch (error) {
      console.error('Error getting manual deposit instructions:', error)
      return {
        needsApproval: true,
        needsConfig: true,
        contractAddress: this.contracts.bucketVault,
        steps: [
          '1. Set your split configuration in Settings',
          '2. Approve USDC spending for the contract',
          '3. Call depositAndSplit() function'
        ]
      }
    }
  }
  async getUserUSDCBalance(userAddress: string): Promise<number> {
    try {
      const usdcContract = new ethers.Contract(
        this.contracts.usdc,
        [
          'function balanceOf(address account) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        this.provider
      )

      const balance = await usdcContract.balanceOf(userAddress)
      const decimals = await usdcContract.decimals()
      
      return parseFloat(ethers.formatUnits(balance, decimals))
    } catch (error) {
      console.error('Error getting USDC balance:', error)
      return 0
    }
  }

  /**
   * Check if user needs to set split configuration
   */
  async checkSplitConfiguration(userAddress: string): Promise<boolean> {
    try {
      const bucketVaultContract = new ethers.Contract(
        this.contracts.bucketVault,
        BucketVaultABI,
        this.provider
      )

      const config = await bucketVaultContract.getSplitConfig(userAddress)
      
      // Check if any percentage is set (sum should be 10000 for 100%)
      const sum = config[0] + config[1] + config[2] + config[3] + config[4]
      return sum === 0n // Returns true if configuration is needed
    } catch (error) {
      console.error('Error checking split configuration:', error)
      return true // Assume configuration is needed if check fails
    }
  }
}

// Export singleton instance
let _depositService: DepositService | null = null

export function getDepositService(): DepositService {
  if (!_depositService) {
    const rpcUrl = process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || ''
    const contracts: ContractAddresses = {
      bucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA || '',
      usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '',
    }
    const managedWalletKey = process.env.MANAGED_WALLET_PRIVATE_KEY

    if (!rpcUrl || !contracts.bucketVault || !contracts.usdc) {
      throw new Error('Missing required contract addresses or RPC URL')
    }

    _depositService = new DepositService(rpcUrl, contracts, managedWalletKey)
  }
  return _depositService
}