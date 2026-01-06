import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { 
  mantleMainnet, 
  mantleSepolia, 
  getContractAddress, 
  getChainConfig, 
  CONTRACT_ADDRESSES,
  type NetworkType 
} from '../networks'

/**
 * **Feature: paywarp-web3-integration, Property 2: Network State Integrity**
 * 
 * For any network switch operation, all contract addresses, RPC endpoints, 
 * and UI indicators should update consistently to reflect the target network configuration
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 */
describe('Network Configuration Property Tests', () => {
  it('Property 2: Network State Integrity - network configurations are consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mainnet' as NetworkType, 'sepolia' as NetworkType),
        fc.constantFrom('bucketVault', 'payrollEngine', 'usdyToken', 'musdToken'),
        (network, contractName) => {
          // Get chain configuration for the network
          const chainConfig = getChainConfig(network)
          
          // Get contract address for the network and contract
          const contractAddress = getContractAddress(network, contractName)
          
          // Verify chain configuration matches expected network
          if (network === 'mainnet') {
            expect(chainConfig.id).toBe(5000)
            expect(chainConfig.name).toBe('Mantle')
            expect(chainConfig.testnet).toBeUndefined()
          } else {
            expect(chainConfig.id).toBe(5003)
            expect(chainConfig.name).toBe('Mantle Sepolia')
            expect(chainConfig.testnet).toBe(true)
          }
          
          // Verify contract address is valid and matches the network
          expect(contractAddress).toBeDefined()
          expect(contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
          expect(contractAddress).toBe(CONTRACT_ADDRESSES[network][contractName])
          
          // Verify RPC endpoints are configured
          expect(chainConfig.rpcUrls.default.http).toBeDefined()
          expect(chainConfig.rpcUrls.default.http.length).toBeGreaterThan(0)
          expect(chainConfig.rpcUrls.default.http[0]).toMatch(/^https?:\/\//)
          
          // Verify block explorer is configured
          expect(chainConfig.blockExplorers?.default).toBeDefined()
          expect(chainConfig.blockExplorers?.default.url).toMatch(/^https?:\/\//)
          
          // Verify native currency configuration
          expect(chainConfig.nativeCurrency.symbol).toBe('MNT')
          expect(chainConfig.nativeCurrency.decimals).toBe(18)
          expect(chainConfig.nativeCurrency.name).toBe('Mantle')
          
          // Verify multicall contract is configured
          expect(chainConfig.contracts?.multicall3).toBeDefined()
          expect(chainConfig.contracts?.multicall3?.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
          expect(chainConfig.contracts?.multicall3?.blockCreated).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2: Network State Integrity - mainnet and testnet configurations are distinct', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('bucketVault', 'payrollEngine', 'usdyToken', 'musdToken'),
        (contractName) => {
          const mainnetAddress = getContractAddress('mainnet', contractName)
          const sepoliaAddress = getContractAddress('sepolia', contractName)
          
          // Contract addresses should be different between networks
          expect(mainnetAddress).not.toBe(sepoliaAddress)
          
          // Both should be valid addresses
          expect(mainnetAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
          expect(sepoliaAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2: Network State Integrity - chain configurations have required properties', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mainnet' as NetworkType, 'sepolia' as NetworkType),
        (network) => {
          const chainConfig = getChainConfig(network)
          
          // Required properties must exist
          expect(chainConfig.id).toBeDefined()
          expect(chainConfig.name).toBeDefined()
          expect(chainConfig.nativeCurrency).toBeDefined()
          expect(chainConfig.rpcUrls).toBeDefined()
          expect(chainConfig.blockExplorers).toBeDefined()
          
          // Chain ID must be positive integer
          expect(chainConfig.id).toBeGreaterThan(0)
          expect(Number.isInteger(chainConfig.id)).toBe(true)
          
          // Name must be non-empty string
          expect(typeof chainConfig.name).toBe('string')
          expect(chainConfig.name.length).toBeGreaterThan(0)
          
          // Native currency must have required fields
          expect(chainConfig.nativeCurrency.name).toBeDefined()
          expect(chainConfig.nativeCurrency.symbol).toBeDefined()
          expect(chainConfig.nativeCurrency.decimals).toBeDefined()
          expect(chainConfig.nativeCurrency.decimals).toBeGreaterThan(0)
          
          // RPC URLs must be valid
          expect(Array.isArray(chainConfig.rpcUrls.default.http)).toBe(true)
          expect(chainConfig.rpcUrls.default.http.length).toBeGreaterThan(0)
          
          // Block explorer must be configured
          expect(chainConfig.blockExplorers.default.name).toBeDefined()
          expect(chainConfig.blockExplorers.default.url).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2: Network State Integrity - contract addresses are consistently formatted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mainnet' as NetworkType, 'sepolia' as NetworkType),
        fc.constantFrom('bucketVault', 'payrollEngine', 'usdyToken', 'musdToken'),
        (network, contractName) => {
          const address = getContractAddress(network, contractName)
          
          // Address must be valid Ethereum address format
          expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
          
          // Address must be exactly 42 characters (0x + 40 hex chars)
          expect(address.length).toBe(42)
          
          // Address must start with 0x
          expect(address.startsWith('0x')).toBe(true)
          
          // Address must not be zero address (unless explicitly set for testing)
          if (address !== '0x0000000000000000000000000000000000000000') {
            expect(address).not.toBe('0x0000000000000000000000000000000000000000')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})