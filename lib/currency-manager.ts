import { createPublicClient, http, parseAbi } from 'viem'
import { mantleMainnet, mantleSepolia, getChainConfig } from './networks'
import { errorHandler, withErrorHandling, withRetry } from './error-handler'
import { RPCProvider } from './rpc-provider'
import type { Currency, CurrencyRates, PriceFeedData, NetworkType } from './types'

// Chainlink Price Feed ABI (minimal interface)
const PRICE_FEED_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
  'function description() external view returns (string)'
])

// Chainlink price feed addresses on Mantle
const PRICE_FEED_ADDRESSES = {
  mainnet: {
    MNT_USD: '0xD97F20bEbeD74e8144134C4b148fE93417dd0F96', // Real Chainlink MNT/USD feed
    USD_NGN: '0x0000000000000000000000000000000000000000', // No feed available – use CMC
  },
  sepolia: {
    MNT_USD: '0x0000000000000000000000000000000000000000', // No feed on testnet – use CMC
    USD_NGN: '0x0000000000000000000000000000000000000000', // No feed – use CMC
  }
} as const

// Fallback rates (updated periodically)
const FALLBACK_RATES: CurrencyRates = {
  MNT_USD: 1.06, // Current MNT price in USD (source: CoinMarketCap/CoinGecko live data)
  USD_NGN: 1438, // Mid-market USD to NGN rate (highly volatile; black/parallel market often ~1490–1500+)
  lastUpdated: new Date(),
  source: 'fallback'
}

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const CACHE_KEY = 'paywarp_currency_rates'

export class CurrencyManager {
  private rpcProvider: RPCProvider
  private network: NetworkType
  private cachedRates: CurrencyRates | null = null
  private lastFetchTime: number = 0
  private CMC_API_KEY = process.env.CMC_API_KEY || process.env.NEXT_PUBLIC_CMC_API_KEY || ''

  constructor(network: NetworkType = 'sepolia') {
    this.network = network
    this.rpcProvider = RPCProvider.getInstance(network)
    this.loadCachedRates()
  }

  /**
   * Get current MNT price in USD from Chainlink (mainnet) or CMC (testnet) with error handling
   */
  async getMNTPrice(): Promise<number> {
    const context = {
      component: 'CurrencyManager',
      action: 'get_mnt_price',
      network: this.network
    }

    return errorHandler.handlePriceFeedFailure(
      async () => {
        // Try Chainlink on mainnet first
        if (this.network === 'mainnet') {
          const feedAddress = PRICE_FEED_ADDRESSES.mainnet.MNT_USD
          
          try {
            return await this.rpcProvider.executeRead(async (client) => {
              const [roundId, answer, , updatedAt] = await client.readContract({
                address: feedAddress,
                abi: PRICE_FEED_ABI,
                functionName: 'latestRoundData'
              })

              const decimals = await client.readContract({
                address: feedAddress,
                abi: PRICE_FEED_ABI,
                functionName: 'decimals'
              })

              // Convert answer to proper decimal format
              const price = Number(answer) / Math.pow(10, decimals)
              
              // Validate price is reasonable (between $0.01 and $100)
              if (price < 0.01 || price > 100) {
                throw new Error('Price feed returned unreasonable value')
              }

              return price
            })
          } catch (chainlinkError) {
            console.warn('Chainlink feed failed, falling back to CMC:', chainlinkError)
            // Fall through to CMC
          }
        }

        // Fallback to CMC for testnet or if Chainlink fails
        return this.getMNTPriceFromCMC()
      },
      FALLBACK_RATES.MNT_USD,
      context
    ).then(result => result.data)
  }

  /**
   * Get MNT price from CoinMarketCap API
   */
  async getMNTPriceFromCMC(): Promise<number> {
    if (!this.CMC_API_KEY) {
      throw new Error('CMC API key not configured')
    }

    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=MNT&convert=USD`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': this.CMC_API_KEY,
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`CMC API error: ${response.status}`)
    }

    const data = await response.json()
    const price = data.data.MNT[0].quote.USD.price

    if (price < 0.01 || price > 100) {
      throw new Error('Unreasonable MNT price from CMC')
    }

    return price
  }

  /**
   * Get current USD to NGN exchange rate from CoinMarketCap API with error handling
   */
  async getNGNRateFromCMC(): Promise<number> {
    const context = { component: 'CurrencyManager', action: 'get_ngn_rate_cmc' };

    return errorHandler.handlePriceFeedFailure(async () => {
      if (!this.CMC_API_KEY) {
        throw new Error('CMC API key not configured');
      }

      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/tools/price-conversion?amount=1&symbol=USD&convert=NGN`,
        { 
          headers: { 
            'X-CMC_PRO_API_KEY': this.CMC_API_KEY,
            'Accept': 'application/json'
          } 
        }
      );

      if (!response.ok) {
        throw new Error(`CMC API error: ${response.status}`);
      }

      const data = await response.json();
      const rate = data.data.quote.NGN.price;

      if (rate < 100 || rate > 10000) {
        throw new Error('Unreasonable NGN rate from CMC');
      }

      return rate;
    }, FALLBACK_RATES.USD_NGN, context).then(result => result.data);
  }

  /**
   * Get current USD to NGN exchange rate from Chainlink price feed with error handling
   */
  async getNGNRate(): Promise<number> {
    const context = {
      component: 'CurrencyManager',
      action: 'get_ngn_rate',
      network: this.network
    }

    return errorHandler.handlePriceFeedFailure(
      async () => {
        const feedAddress = PRICE_FEED_ADDRESSES[this.network].USD_NGN
        
        // If no feed address configured, use fallback
        if (feedAddress === '0x0000000000000000000000000000000000000000') {
          throw new Error('Price feed not configured')
        }

        return this.rpcProvider.executeRead(async (client) => {
          const [roundId, answer, , updatedAt] = await client.readContract({
            address: feedAddress,
            abi: PRICE_FEED_ABI,
            functionName: 'latestRoundData'
          })

          const decimals = await client.readContract({
            address: feedAddress,
            abi: PRICE_FEED_ABI,
            functionName: 'decimals'
          })

          // Convert answer to proper decimal format
          const rate = Number(answer) / Math.pow(10, decimals)
          
          // Validate rate is reasonable (between 100 and 10000 NGN per USD)
          if (rate < 100 || rate > 10000) {
            throw new Error('Price feed returned unreasonable value')
          }

          return rate
        })
      },
      FALLBACK_RATES.USD_NGN,
      context
    ).then(result => result.data)
  }

  /**
   * Get current currency rates with caching and comprehensive error handling
   */
  async getCurrentRates(): Promise<CurrencyRates> {
    const now = Date.now()
    
    // Return cached rates if still valid
    if (this.cachedRates && (now - this.lastFetchTime) < CACHE_DURATION) {
      return this.cachedRates
    }

    const context = {
      component: 'CurrencyManager',
      action: 'get_current_rates',
      network: this.network
    }

    try {
      // Check if we're in read-only mode
      const readOnlyState = errorHandler.isReadOnlyMode()
      if (readOnlyState.enabled) {
        if (this.cachedRates) {
          return { ...this.cachedRates, source: 'cached' }
        }
        return FALLBACK_RATES
      }

      // Fetch fresh rates from mixed sources with retry logicFail with error 'Invalid signature'
      const fetchRates = withRetry(async () => {
        const [mntPrice, ngnRate] = await Promise.all([
          this.getMNTPrice(),                    // Chainlink on mainnet, CMC on testnet
          this.getNGNRateFromCMC()               // CMC for fiat rates
        ])

        return {
          MNT_USD: mntPrice,
          USD_NGN: ngnRate,
          lastUpdated: new Date(),
          source: this.network === 'mainnet' ? 'mixed' as const : 'cmc' as const
        }
      }, 2, context)

      const rates = await fetchRates()

      // Cache the rates
      this.cachedRates = rates
      this.lastFetchTime = now
      this.saveCachedRates(rates)

      // Disable read-only mode if we successfully got rates
      errorHandler.disableReadOnlyMode()

      return rates
    } catch (error) {
      errorHandler.handleError(error as Error, context)
      
      // Return cached rates if available, otherwise fallback
      if (this.cachedRates) {
        return { ...this.cachedRates, source: 'cached' }
      }
      
      // Don't enable read-only mode for price feed failures - just use fallback rates
      console.warn('Price feeds unavailable, using fallback rates')
      return FALLBACK_RATES
    }
  }

  /**
   * Convert amount between currencies
   */
  convertAmount(amount: number, from: Currency, to: Currency, rates?: CurrencyRates): number {
    if (from === to) return amount
    
    const currentRates = rates || this.cachedRates || FALLBACK_RATES
    
    // Convert to USD first if needed
    let usdAmount = amount
    if (from === 'MNT') {
      usdAmount = amount * currentRates.MNT_USD
    } else if (from === 'NGN') {
      usdAmount = amount / currentRates.USD_NGN
    }
    
    // Convert from USD to target currency
    if (to === 'USD') {
      return usdAmount
    } else if (to === 'MNT') {
      return usdAmount / currentRates.MNT_USD
    } else if (to === 'NGN') {
      return usdAmount * currentRates.USD_NGN
    }
    
    return amount
  }

  /**
   * Format currency amount with proper symbol and precision
   */
  formatCurrency(amount: number, currency: Currency, precision: number = 2): string {
    const symbols = {
      USD: '$',
      NGN: '₦',
      MNT: 'MNT'
    }
    
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    })
    
    if (currency === 'MNT') {
      return `${formatted} ${symbols[currency]}`
    }
    
    return `${symbols[currency]}${formatted}`
  }

  /**
   * Get cached rates from localStorage
   */
  private loadCachedRates(): void {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          this.cachedRates = {
            ...parsed,
            lastUpdated: new Date(parsed.lastUpdated)
          }
          this.lastFetchTime = this.cachedRates?.lastUpdated.getTime() || 0
        }
      }
    } catch (error) {
      console.warn('Failed to load cached currency rates:', error)
    }
  }

  /**
   * Save rates to localStorage
   */
  private saveCachedRates(rates: CurrencyRates): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify(rates))
      }
    } catch (error) {
      console.warn('Failed to save currency rates to cache:', error)
    }
  }

  /**
   * Update network and reinitialize client with error handling
   */
  updateNetwork(network: NetworkType): void {
    try {
      this.network = network
      this.rpcProvider = RPCProvider.getInstance(network)
      
      // Clear cache when switching networks
      this.cachedRates = null
      this.lastFetchTime = 0
    } catch (error) {
      errorHandler.handleError(error as Error, {
        component: 'CurrencyManager',
        action: 'update_network',
        network
      })
      throw error
    }
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): NetworkType {
    return this.network
  }

  /**
   * Get price feed data for debugging/monitoring with error handling
   */
  async getPriceFeedData(feedType: 'MNT_USD' | 'USD_NGN'): Promise<PriceFeedData | null> {
    const context = {
      component: 'CurrencyManager',
      action: 'get_price_feed_data',
      network: this.network,
      metadata: { feedType }
    }

    try {
      const feedAddress = PRICE_FEED_ADDRESSES[this.network][feedType]
      
      if (feedAddress === '0x0000000000000000000000000000000000000000') {
        return null
      }

      return await this.rpcProvider.executeRead(async (client) => {
        const [roundId, answer, , updatedAt] = await client.readContract({
          address: feedAddress,
          abi: PRICE_FEED_ABI,
          functionName: 'latestRoundData'
        })

        const [decimals, description] = await Promise.all([
          client.readContract({
            address: feedAddress,
            abi: PRICE_FEED_ABI,
            functionName: 'decimals'
          }),
          client.readContract({
            address: feedAddress,
            abi: PRICE_FEED_ABI,
            functionName: 'description'
          })
        ])

        return {
          price: Number(answer) / Math.pow(10, decimals),
          timestamp: new Date(Number(updatedAt) * 1000),
          roundId: roundId.toString(),
          source: description
        }
      })
    } catch (error) {
      errorHandler.handleError(error as Error, context)
      return null
    }
  }

  /**
   * Check if rates are stale (older than cache duration)
   */
  areRatesStale(): boolean {
    if (!this.cachedRates) return true
    return (Date.now() - this.lastFetchTime) > CACHE_DURATION
  }

  /**
   * Force refresh rates (bypass cache)
   */
  async refreshRates(): Promise<CurrencyRates> {
    this.cachedRates = null
    this.lastFetchTime = 0
    return this.getCurrentRates()
  }
}

// Singleton instance
let currencyManagerInstance: CurrencyManager | null = null

/**
 * Get or create CurrencyManager singleton
 */
export function getCurrencyManager(network?: NetworkType): CurrencyManager {
  if (!currencyManagerInstance || (network && currencyManagerInstance.getCurrentNetwork() !== network)) {
    currencyManagerInstance = new CurrencyManager(network)
  }
  return currencyManagerInstance
}

/**
 * Utility function to convert and format currency
 */
export async function convertAndFormat(
  amount: number,
  from: Currency,
  to: Currency,
  precision: number = 2,
  network?: NetworkType
): Promise<string> {
  const manager = getCurrencyManager(network)
  const rates = await manager.getCurrentRates()
  const converted = manager.convertAmount(amount, from, to, rates)
  return manager.formatCurrency(converted, to, precision)
}