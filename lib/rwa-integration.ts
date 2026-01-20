/**
 * RWA Integration Service for Mock RWA tokens (USDY, mUSD, USDe, mETH)
 * Handles token conversion, yield tracking, and balance management
 */

import type { BucketType, Currency } from './types'
import { rwaErrorHandler, withRWAFallback, getUserFriendlyError } from './rwa-error-handler'
import { createPublicClient, http, formatUnits, parseUnits } from 'viem'
import { mantleSepolia } from './networks'

export interface RWATokenData {
  address: string
  symbol: 'USDY' | 'mUSD' | 'USDe' | 'mETH'
  decimals: number
  currentAPY: number
  redemptionValue: number // Current redemption value (increases over time for yield)
  lastUpdated: Date
  bucketType: BucketType
}

export interface YieldData {
  currentAPY: number
  totalYieldEarned: number
  yieldToday: number
  projectedYearlyYield: number
  lastAccrualTime: Date
}

export interface YieldHistory {
  period: 'day' | 'week' | 'month' | 'year'
  data: Array<{
    timestamp: Date
    apy: number
    yieldEarned: number
    balance: number
  }>
}

export interface RWABalance {
  usdcAmount: number
  tokenAmount: number
  currentValue: number
  yieldEarned: number
}

export interface ConversionResult {
  success: boolean
  transactionHash?: string
  tokenAmount?: number
  error?: string
  gasUsed?: number
}

export class RWAIntegration {
  private network: 'mainnet' | 'sepolia'
  private tokenContracts: Map<string, RWATokenData>
  private yieldCache: Map<string, YieldData>
  private isTestnet: boolean
  private publicClient: any
  
  // Rate limiting and caching
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessingQueue = false
  private lastRequestTime = 0
  private readonly MIN_REQUEST_INTERVAL = 200 // 200ms between requests
  private balanceCache = new Map<string, { data: RWABalance; timestamp: number }>()
  private readonly CACHE_DURATION = 30000 // 30 seconds cache

  // RWA Contract ABI for reading data
  private readonly RWA_ABI = [
    {
      inputs: [],
      name: 'getAPY',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'user', type: 'address' }],
      name: 'getCurrentValue',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'user', type: 'address' }],
      name: 'getPendingYield',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'user', type: 'address' }],
      name: 'getYieldEarned',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    }
  ] as const

  constructor(network: 'mainnet' | 'sepolia' = 'sepolia') {
    this.network = network
    this.isTestnet = network === 'sepolia'
    this.tokenContracts = new Map()
    this.yieldCache = new Map()
    
    // Initialize public client for reading contract data
    this.publicClient = createPublicClient({
      chain: mantleSepolia,
      transport: http()
    })
    
    this.initializeTokenContracts()
  }

  /**
   * Rate limiting for RPC requests
   */
  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.requestQueue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest))
      }

      const request = this.requestQueue.shift()
      if (request) {
        this.lastRequestTime = Date.now()
        await request()
      }
    }

    this.isProcessingQueue = false
  }

  /**
   * Get cached balance or fetch new one
   */
  private getCachedBalance(cacheKey: string): RWABalance | null {
    const cached = this.balanceCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    return null
  }

  /**
   * Set balance cache
   */
  private setCachedBalance(cacheKey: string, data: RWABalance) {
    this.balanceCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    })
  }

  private initializeTokenContracts() {
    if (this.isTestnet) {
      // Real deployed mock contracts for testnet
      this.tokenContracts.set('USDY', {
        address: process.env.NEXT_PUBLIC_MOCK_USDY_SEPOLIA || '0xD83794CFD929612509Ac42e0E9Ab00CB764966c3',
        symbol: 'USDY',
        decimals: 18,
        currentAPY: 4.5,
        redemptionValue: 1.045,
        lastUpdated: new Date(),
        bucketType: 'billings'
      })

      this.tokenContracts.set('mUSD', {
        address: process.env.NEXT_PUBLIC_MOCK_MUSD_SEPOLIA || '0xE396D5a59AbaFE26a7a256f453735872593f1c03',
        symbol: 'mUSD',
        decimals: 18,
        currentAPY: 3.2,
        redemptionValue: 1.032,
        lastUpdated: new Date(),
        bucketType: 'savings'
      })

      this.tokenContracts.set('USDe', {
        address: process.env.NEXT_PUBLIC_MOCK_USDE_SEPOLIA || '0xDCf439790840C5bf66916997dB54cD15083773f0',
        symbol: 'USDe',
        decimals: 18,
        currentAPY: 8.0,
        redemptionValue: 1.08,
        lastUpdated: new Date(),
        bucketType: 'growth'
      })

      this.tokenContracts.set('mETH', {
        address: process.env.NEXT_PUBLIC_MOCK_METH_SEPOLIA || '0xcB1E04273dce35C8e58239B5BF46fB8d1fEDa5F8',
        symbol: 'mETH',
        decimals: 18,
        currentAPY: 10.0,
        redemptionValue: 1.10,
        lastUpdated: new Date(),
        bucketType: 'instant'
      })
    } else {
      // Real contracts for mainnet (when available)
      this.tokenContracts.set('USDY', {
        address: process.env.NEXT_PUBLIC_USDY_TOKEN_MAINNET || '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
        symbol: 'USDY',
        decimals: 18,
        currentAPY: 4.5,
        redemptionValue: 1.0,
        lastUpdated: new Date(),
        bucketType: 'billings'
      })

      this.tokenContracts.set('mUSD', {
        address: process.env.NEXT_PUBLIC_MUSD_TOKEN_MAINNET || '0x5bEaBAEBB3146685Dd74176f68a0721F91297D37',
        symbol: 'mUSD',
        decimals: 18,
        currentAPY: 3.2,
        redemptionValue: 1.0,
        lastUpdated: new Date(),
        bucketType: 'savings'
      })
    }
  }

  /**
   * Get USDY balance for a bucket
   */
  async getUSDYBalance(bucket: BucketType): Promise<RWABalance> {
    const cacheKey = `USDY-${bucket}`
    const cached = this.getCachedBalance(cacheKey)
    if (cached) {
      return cached
    }

    const usdyToken = this.tokenContracts.get('USDY')
    if (!usdyToken || usdyToken.bucketType !== bucket) {
      const zeroBalance = {
        usdcAmount: 0,
        tokenAmount: 0,
        currentValue: 0,
        yieldEarned: 0
      }
      this.setCachedBalance(cacheKey, zeroBalance)
      return zeroBalance
    }

    if (this.isTestnet) {
      try {
        const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA as `0x${string}`
        
        const [tokenBalance, currentValue, yieldEarned] = await Promise.all([
          this.queueRequest(() => this.publicClient.readContract({
            address: usdyToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'balanceOf',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: usdyToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getCurrentValue',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: usdyToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getYieldEarned',
            args: [bucketVaultAddress]
          }))
        ])

        const tokenAmount = Number(formatUnits(tokenBalance as bigint, 18))
        const currentValueUSD = Number(formatUnits(currentValue as bigint, 6))
        const yieldEarnedUSD = Number(formatUnits(yieldEarned as bigint, 6))
        const originalUSDC = currentValueUSD - yieldEarnedUSD

        const result = {
          usdcAmount: originalUSDC,
          tokenAmount,
          currentValue: currentValueUSD,
          yieldEarned: yieldEarnedUSD
        }

        this.setCachedBalance(cacheKey, result)
        return result
      } catch (error) {
        console.error('Error fetching USDY balance from contract:', error)
        const fallbackBalance = {
          usdcAmount: 0,
          tokenAmount: 0,
          currentValue: 0,
          yieldEarned: 0
        }
        this.setCachedBalance(cacheKey, fallbackBalance)
        return fallbackBalance
      }
    }

    throw new Error('Mainnet balance fetching not implemented yet')
  }

  /**
   * Get mUSD balance for a bucket
   */
  async getMUSDBalance(bucket: BucketType): Promise<RWABalance> {
    const cacheKey = `mUSD-${bucket}`
    const cached = this.getCachedBalance(cacheKey)
    if (cached) {
      return cached
    }

    const musdToken = this.tokenContracts.get('mUSD')
    if (!musdToken || musdToken.bucketType !== bucket) {
      const zeroBalance = {
        usdcAmount: 0,
        tokenAmount: 0,
        currentValue: 0,
        yieldEarned: 0
      }
      this.setCachedBalance(cacheKey, zeroBalance)
      return zeroBalance
    }

    if (this.isTestnet) {
      try {
        const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA as `0x${string}`
        
        const [tokenBalance, currentValue, yieldEarned] = await Promise.all([
          this.queueRequest(() => this.publicClient.readContract({
            address: musdToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'balanceOf',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: musdToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getCurrentValue',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: musdToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getYieldEarned',
            args: [bucketVaultAddress]
          }))
        ])

        const tokenAmount = Number(formatUnits(tokenBalance as bigint, 18))
        const currentValueUSD = Number(formatUnits(currentValue as bigint, 6))
        const yieldEarnedUSD = Number(formatUnits(yieldEarned as bigint, 6))
        const originalUSDC = currentValueUSD - yieldEarnedUSD

        const result = {
          usdcAmount: originalUSDC,
          tokenAmount,
          currentValue: currentValueUSD,
          yieldEarned: yieldEarnedUSD
        }

        this.setCachedBalance(cacheKey, result)
        return result
      } catch (error) {
        console.error('Error fetching mUSD balance from contract:', error)
        const fallbackBalance = {
          usdcAmount: 0,
          tokenAmount: 0,
          currentValue: 0,
          yieldEarned: 0
        }
        this.setCachedBalance(cacheKey, fallbackBalance)
        return fallbackBalance
      }
    }

    throw new Error('Mainnet balance fetching not implemented yet')
  }

  /**
   * Get USDe balance for a bucket
   */
  async getUSDEBalance(bucket: BucketType): Promise<RWABalance> {
    const cacheKey = `USDe-${bucket}`
    const cached = this.getCachedBalance(cacheKey)
    if (cached) {
      return cached
    }

    const usdeToken = this.tokenContracts.get('USDe')
    if (!usdeToken || usdeToken.bucketType !== bucket) {
      const zeroBalance = {
        usdcAmount: 0,
        tokenAmount: 0,
        currentValue: 0,
        yieldEarned: 0
      }
      this.setCachedBalance(cacheKey, zeroBalance)
      return zeroBalance
    }

    if (this.isTestnet) {
      try {
        const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA as `0x${string}`
        
        const [tokenBalance, currentValue, yieldEarned] = await Promise.all([
          this.queueRequest(() => this.publicClient.readContract({
            address: usdeToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'balanceOf',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: usdeToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getCurrentValue',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: usdeToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getYieldEarned',
            args: [bucketVaultAddress]
          }))
        ])

        const tokenAmount = Number(formatUnits(tokenBalance as bigint, 18))
        const currentValueUSD = Number(formatUnits(currentValue as bigint, 6))
        const yieldEarnedUSD = Number(formatUnits(yieldEarned as bigint, 6))
        const originalUSDC = currentValueUSD - yieldEarnedUSD

        const result = {
          usdcAmount: originalUSDC,
          tokenAmount,
          currentValue: currentValueUSD,
          yieldEarned: yieldEarnedUSD
        }

        this.setCachedBalance(cacheKey, result)
        return result
      } catch (error) {
        console.error('Error fetching USDe balance from contract:', error)
        const fallbackBalance = {
          usdcAmount: 0,
          tokenAmount: 0,
          currentValue: 0,
          yieldEarned: 0
        }
        this.setCachedBalance(cacheKey, fallbackBalance)
        return fallbackBalance
      }
    }

    throw new Error('Mainnet balance fetching not implemented yet')
  }

  /**
   * Get mETH balance for a bucket
   */
  async getMETHBalance(bucket: BucketType): Promise<RWABalance> {
    const cacheKey = `mETH-${bucket}`
    const cached = this.getCachedBalance(cacheKey)
    if (cached) {
      return cached
    }

    const methToken = this.tokenContracts.get('mETH')
    if (!methToken || methToken.bucketType !== bucket) {
      const zeroBalance = {
        usdcAmount: 0,
        tokenAmount: 0,
        currentValue: 0,
        yieldEarned: 0
      }
      this.setCachedBalance(cacheKey, zeroBalance)
      return zeroBalance
    }

    if (this.isTestnet) {
      try {
        const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA as `0x${string}`
        
        const [tokenBalance, currentValue, yieldEarned] = await Promise.all([
          this.queueRequest(() => this.publicClient.readContract({
            address: methToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'balanceOf',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: methToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getCurrentValue',
            args: [bucketVaultAddress]
          })),
          this.queueRequest(() => this.publicClient.readContract({
            address: methToken.address as `0x${string}`,
            abi: this.RWA_ABI,
            functionName: 'getYieldEarned',
            args: [bucketVaultAddress]
          }))
        ])

        const tokenAmount = Number(formatUnits(tokenBalance as bigint, 18))
        const currentValueUSD = Number(formatUnits(currentValue as bigint, 6))
        const yieldEarnedUSD = Number(formatUnits(yieldEarned as bigint, 6))
        const originalUSDC = currentValueUSD - yieldEarnedUSD

        const result = {
          usdcAmount: originalUSDC,
          tokenAmount,
          currentValue: currentValueUSD,
          yieldEarned: yieldEarnedUSD
        }

        this.setCachedBalance(cacheKey, result)
        return result
      } catch (error) {
        console.error('Error fetching mETH balance from contract:', error)
        const fallbackBalance = {
          usdcAmount: 0,
          tokenAmount: 0,
          currentValue: 0,
          yieldEarned: 0
        }
        this.setCachedBalance(cacheKey, fallbackBalance)
        return fallbackBalance
      }
    }

    throw new Error('Mainnet balance fetching not implemented yet')
  }

  /**
   * Get total value locked (TVL) across all RWA tokens
   */
  async getTotalValueLocked(): Promise<number> {
    try {
      if (this.isTestnet) {
        return Math.random() * 10000000 + 5000000 // $5M - $15M mock TVL
      }
      return 0
    } catch (error) {
      console.error('Failed to get TVL:', error)
      return 0
    }
  }

  /**
   * Get network-specific RWA configuration
   */
  getNetworkConfig() {
    return {
      network: this.network,
      isTestnet: this.isTestnet,
      supportedTokens: Array.from(this.tokenContracts.keys()),
      rwaSupported: this.tokenContracts.size > 0
    }
  }
}

// Export singleton instance
export const rwaIntegration = new RWAIntegration(
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as 'mainnet' | 'sepolia') || 'sepolia'
)