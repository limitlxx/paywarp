import { createPublicClient, createWalletClient, http, fallback, webSocket } from 'viem'
import { mantleMainnet, mantleSepolia } from './networks'
import { errorHandler } from './error-handler'
import type { NetworkType } from './types'

// RPC endpoint configurations with fallbacks
const RPC_ENDPOINTS = {
  mainnet: {
    primary: process.env.NEXT_PUBLIC_MANTLE_MAINNET_RPC || 'https://rpc.mantle.xyz',
    fallbacks: [
      'https://mantle-mainnet.g.alchemy.com/v2/eXgTwJ3xY1x26GMzs1zi-',
      // 'https://mantle-mainnet.public.blastapi.io',
      // 'https://mantle.publicnode.com',
      // 'https://rpc.ankr.com/mantle'
    ],
    websocket: process.env.NEXT_PUBLIC_MANTLE_MAINNET_WS || 'wss://ws.mantle.xyz'
  },
  sepolia: {
    primary: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || 'https://rpc.sepolia.mantle.xyz',
    fallbacks: [      
      'https://mantle-sepolia.g.alchemy.com/v2/eXgTwJ3xY1x26GMzs1zi-',
      // 'https://mantle-sepolia.public.blastapi.io',
      // 'https://mantle-sepolia.publicnode.com'
    ],
    websocket: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_WS || 'wss://ws.sepolia.mantle.xyz'
  }
} as const

// Connection health monitoring
interface ConnectionHealth {
  endpoint: string
  latency: number
  successRate: number
  lastCheck: Date
  isHealthy: boolean
}

export class RPCProvider {
  private static instances: Map<NetworkType, RPCProvider> = new Map()
  private network: NetworkType
  private publicClient: any
  private walletClient: any
  private healthStats: Map<string, ConnectionHealth> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null

  private constructor(network: NetworkType) {
    this.network = network
    this.initializeClients()
    this.startHealthMonitoring()
  }

  static getInstance(network: NetworkType): RPCProvider {
    if (!RPCProvider.instances.has(network)) {
      RPCProvider.instances.set(network, new RPCProvider(network))
    }
    return RPCProvider.instances.get(network)!
  }

  /**
   * Get public client with fallback support
   */
  getPublicClient() {
    return this.publicClient
  }

  /**
   * Get wallet client with fallback support
   */
  getWalletClient() {
    return this.walletClient
  }

  /**
   * Execute a read operation with automatic fallback
   */
  async executeRead<T>(operation: (client: any) => Promise<T>): Promise<T> {
    return errorHandler.handleRPCFailure(
      () => operation(this.publicClient),
      this.createFallbackOperations(operation),
      { 
        component: 'RPCProvider',
        action: 'read_operation',
        network: this.network
      }
    )
  }

  /**
   * Execute a write operation with retry logic
   */
  async executeWrite<T>(operation: (client: any) => Promise<T>): Promise<T> {
    const errorId = errorHandler.handleError(
      new Error('Write operation initiated'),
      {
        component: 'RPCProvider',
        action: 'write_operation',
        network: this.network
      }
    )

    return errorHandler.retryOperation(
      () => operation(this.walletClient),
      errorId,
      2 // Fewer retries for write operations
    )
  }

  /**
   * Check connection health
   */
  async checkHealth(): Promise<{
    network: NetworkType
    primaryHealthy: boolean
    fallbacksAvailable: number
    bestLatency: number
    overallHealth: 'good' | 'degraded' | 'poor'
  }> {
    const endpoints = RPC_ENDPOINTS[this.network]
    const allEndpoints = [endpoints.primary, ...endpoints.fallbacks]
    
    const healthChecks = await Promise.allSettled(
      allEndpoints.map(endpoint => this.checkEndpointHealth(endpoint))
    )

    const healthyCount = healthChecks.filter(
      result => result.status === 'fulfilled' && result.value.isHealthy
    ).length

    const latencies = healthChecks
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<ConnectionHealth>).value.latency)
      .filter(latency => latency > 0)

    const bestLatency = latencies.length > 0 ? Math.min(...latencies) : Infinity
    const primaryHealthy = healthChecks[0]?.status === 'fulfilled' && 
                          (healthChecks[0] as PromiseFulfilledResult<ConnectionHealth>).value.isHealthy

    let overallHealth: 'good' | 'degraded' | 'poor'
    if (primaryHealthy && healthyCount >= 2) {
      overallHealth = 'good'
    } else if (healthyCount >= 1) {
      overallHealth = 'degraded'
    } else {
      overallHealth = 'poor'
    }

    return {
      network: this.network,
      primaryHealthy,
      fallbacksAvailable: healthyCount - (primaryHealthy ? 1 : 0),
      bestLatency,
      overallHealth
    }
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    const stats = Array.from(this.healthStats.values())
    return {
      network: this.network,
      endpoints: stats.length,
      healthy: stats.filter(s => s.isHealthy).length,
      averageLatency: stats.reduce((sum, s) => sum + s.latency, 0) / stats.length || 0,
      lastUpdated: new Date()
    }
  }

  /**
   * Force reconnection with fresh clients
   */
  async reconnect(): Promise<void> {
    try {
      // Clear health stats
      this.healthStats.clear()
      
      // Reinitialize clients
      this.initializeClients()
      
      // Test connection
      await this.publicClient.getBlockNumber()
      
      console.log(`Successfully reconnected to ${this.network}`)
    } catch (error) {
      errorHandler.handleError(error as Error, {
        component: 'RPCProvider',
        action: 'reconnect',
        network: this.network
      })
      throw error
    }
  }

  /**
   * Switch to a different network
   */
  static async switchNetwork(newNetwork: NetworkType): Promise<RPCProvider> {
    const provider = RPCProvider.getInstance(newNetwork)
    await provider.reconnect()
    return provider
  }

  private initializeClients(): void {
    const endpoints = RPC_ENDPOINTS[this.network]
    const chain = this.network === 'mainnet' ? mantleMainnet : mantleSepolia

    // Create transport with fallback support
    const transports = [
      http(endpoints.primary, {
        timeout: 10000,
        retryCount: 2,
        retryDelay: 1000
      }),
      ...endpoints.fallbacks.map(url => 
        http(url, {
          timeout: 15000,
          retryCount: 1,
          retryDelay: 2000
        })
      )
    ]

    const transport = fallback(transports, {
      rank: {
        interval: 60000, // Re-rank every minute
        sampleCount: 5,
        timeout: 5000,
        weights: {
          latency: 0.7,
          stability: 0.3
        }
      }
    })

    // Create clients
    this.publicClient = createPublicClient({
      chain,
      transport,
      batch: {
        multicall: true
      },
      cacheTime: 4000 // 4 second cache
    })

    // Wallet client will be created when needed
    this.walletClient = createWalletClient({
      chain,
      transport
    })
  }

  private createFallbackOperations<T>(
    operation: (client: any) => Promise<T>
  ): (() => Promise<T>)[] {
    const endpoints = RPC_ENDPOINTS[this.network]
    const chain = this.network === 'mainnet' ? mantleMainnet : mantleSepolia

    return endpoints.fallbacks.map(endpoint => {
      return async () => {
        const fallbackClient = createPublicClient({
          chain,
          transport: http(endpoint, { timeout: 10000 })
        })
        return operation(fallbackClient)
      }
    })
  }

  private async checkEndpointHealth(endpoint: string): Promise<ConnectionHealth> {
    const startTime = Date.now()
    
    try {
      const chain = this.network === 'mainnet' ? mantleMainnet : mantleSepolia
      const testClient = createPublicClient({
        chain,
        transport: http(endpoint, { timeout: 5000 })
      })

      // Simple health check - get latest block
      await testClient.getBlockNumber()
      
      const latency = Date.now() - startTime
      const health: ConnectionHealth = {
        endpoint,
        latency,
        successRate: 1.0, // Will be calculated over time
        lastCheck: new Date(),
        isHealthy: latency < 5000 // Consider healthy if < 5s response
      }

      this.healthStats.set(endpoint, health)
      return health
    } catch (error) {
      const health: ConnectionHealth = {
        endpoint,
        latency: -1,
        successRate: 0,
        lastCheck: new Date(),
        isHealthy: false
      }

      this.healthStats.set(endpoint, health)
      return health
    }
  }

  private startHealthMonitoring(): void {
    // Check health every 2 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth()
      } catch (error) {
        console.warn('Health check failed:', error)
      }
    }, 2 * 60 * 1000)
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    this.healthStats.clear()
  }
}

// Utility functions for common RPC operations
export async function withRPCFallback<T>(
  network: NetworkType,
  operation: (client: any) => Promise<T>
): Promise<T> {
  const provider = RPCProvider.getInstance(network)
  return provider.executeRead(operation)
}

export async function executeTransaction<T>(
  network: NetworkType,
  operation: (client: any) => Promise<T>
): Promise<T> {
  const provider = RPCProvider.getInstance(network)
  return provider.executeWrite(operation)
}

// Export singleton instances
export const mainnetProvider = RPCProvider.getInstance('mainnet')
export const sepoliaProvider = RPCProvider.getInstance('sepolia')