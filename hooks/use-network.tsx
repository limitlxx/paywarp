'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { mantleMainnet, mantleSepolia, type NetworkType, DEFAULT_NETWORK } from '@/lib/networks'

interface NetworkContextType {
  currentNetwork: NetworkType
  isMainnet: boolean
  isTestnet: boolean
  switchToMainnet: () => Promise<void>
  switchToTestnet: () => Promise<void>
  switchNetwork: (network: NetworkType) => Promise<void>
  isNetworkSupported: boolean
  networkError: string | null
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

interface NetworkProviderProps {
  children: ReactNode
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const chainId = useChainId()
  const { switchChain, isPending, error } = useSwitchChain()
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>(DEFAULT_NETWORK)
  const [networkError, setNetworkError] = useState<string | null>(null)

  // Determine current network based on chain ID
  useEffect(() => {
    if (chainId === mantleMainnet.id) {
      setCurrentNetwork('mainnet')
    } else if (chainId === mantleSepolia.id) {
      setCurrentNetwork('sepolia')
    } else {
      // If connected to unsupported network, default to testnet
      setCurrentNetwork('sepolia')
    }
  }, [chainId])

  // Handle switch chain errors
  useEffect(() => {
    if (error) {
      setNetworkError(error.message)
    } else {
      setNetworkError(null)
    }
  }, [error])

  const isNetworkSupported = chainId === mantleMainnet.id || chainId === mantleSepolia.id
  const isMainnet = currentNetwork === 'mainnet'
  const isTestnet = currentNetwork === 'sepolia'

  const switchToMainnet = async () => {
    try {
      setNetworkError(null)
      await switchChain({ chainId: mantleMainnet.id })
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'Failed to switch to mainnet')
    }
  }

  const switchToTestnet = async () => {
    try {
      setNetworkError(null)
      await switchChain({ chainId: mantleSepolia.id })
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'Failed to switch to testnet')
    }
  }

  const switchNetwork = async (network: NetworkType) => {
    if (network === 'mainnet') {
      await switchToMainnet()
    } else {
      await switchToTestnet()
    }
  }

  const value: NetworkContextType = {
    currentNetwork,
    isMainnet,
    isTestnet,
    switchToMainnet,
    switchToTestnet,
    switchNetwork,
    isNetworkSupported,
    networkError,
  }

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}