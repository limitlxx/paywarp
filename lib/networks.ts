import { defineChain } from 'viem'

// Mantle Mainnet configuration
export const mantleMainnet = defineChain({
  id: 5000,
  name: 'Mantle',
  nativeCurrency: {
    decimals: 18,
    name: 'Mantle',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MANTLE_MAINNET_RPC || 'https://rpc.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Explorer',
      url: 'https://explorer.mantle.xyz',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 304717,
    },
  },
})

// Mantle Sepolia Testnet configuration
export const mantleSepolia = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Mantle',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || 'https://rpc.sepolia.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Sepolia Explorer',
      url: 'https://explorer.sepolia.mantle.xyz',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 4584012,
    },
  },
  testnet: true,
})

// Network type definition
export type NetworkType = 'mainnet' | 'sepolia'

// Contract addresses by network
export const CONTRACT_ADDRESSES = {
  mainnet: {
    bucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_MAINNET as `0x${string}`,
    payrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET as `0x${string}`,
    usdyToken: process.env.NEXT_PUBLIC_USDY_TOKEN_MAINNET as `0x${string}`,
    musdToken: process.env.NEXT_PUBLIC_MUSD_TOKEN_MAINNET as `0x${string}`,
  },
  sepolia: {
    bucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA as `0x${string}`,
    payrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA as `0x${string}`,
    usdyToken: process.env.NEXT_PUBLIC_USDY_TOKEN_SEPOLIA as `0x${string}`,
    musdToken: process.env.NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA as `0x${string}`,
  },
} as const

// Get contract address by network and contract name
export function getContractAddress(
  network: NetworkType,
  contract: keyof typeof CONTRACT_ADDRESSES.mainnet
): `0x${string}` {
  return CONTRACT_ADDRESSES[network][contract]
}

// Get chain configuration by network type
export function getChainConfig(network: NetworkType) {
  return network === 'mainnet' ? mantleMainnet : mantleSepolia
}

// Default network from environment
export const DEFAULT_NETWORK: NetworkType = 
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as NetworkType) || 'sepolia'