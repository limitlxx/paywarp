"use client"

import type React from "react"
import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useNetwork } from "./use-network"
import { mantleMainnet, mantleSepolia, type NetworkType } from "@/lib/networks"
import { useTransactionHistory } from "./use-transaction-history"
import type { BlockchainTransaction, WrappedReport } from "@/lib/transaction-sync"

// Enhanced wallet context with RainbowKit integration
interface WalletContextType {
  // Connection state
  isConnected: boolean
  address: string | null
  chainId: number | null
  
  // Network management
  currentNetwork: NetworkType
  switchNetwork: (network: NetworkType) => Promise<void>
  
  // Connection methods
  connect: () => Promise<void>
  disconnect: () => void
  
  // Transaction history
  syncHistory: () => Promise<void>
  transactions: BlockchainTransaction[]
  isHistoryLoading: boolean
  historyError: string | null
  
  // Wrapped data
  wrappedReports: WrappedReport[]
  generateWrapped: (year: number) => Promise<WrappedReport>
  
  // Real-time transaction monitoring
  isWatchingTransactions: boolean
  startTransactionWatching: () => void
  stopTransactionWatching: () => void
  
  // Connection status
  isConnecting: boolean
  connectionError: string | null
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected: wagmiConnected, chainId } = useAccount()
  const { connect: wagmiConnect, connectors, isPending: isConnecting, error } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const { currentNetwork, switchNetwork: networkSwitchNetwork } = useNetwork()
  
  // Transaction history integration
  const {
    transactions,
    isLoading: isHistoryLoading,
    error: historyError,
    syncHistory: syncTransactionHistory,
    wrappedReports,
    generateWrapped,
    isWatching: isWatchingTransactions,
    startWatching: startTransactionWatching,
    stopWatching: stopTransactionWatching
  } = useTransactionHistory()
  
  // Local state for connection management
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Handle connection errors
  useEffect(() => {
    if (error) {
      setConnectionError(error.message)
    } else {
      setConnectionError(null)
    }
  }, [error])

  // Clear error when connection succeeds
  useEffect(() => {
    if (wagmiConnected) {
      setConnectionError(null)
    }
  }, [wagmiConnected])

  const connect = useCallback(async () => {
    try {
      setConnectionError(null)
      
      if (openConnectModal) {
        // Use RainbowKit modal for better UX
        openConnectModal()
      } else {
        // Fallback to direct connection with first available connector
        const connector = connectors[0]
        if (connector) {
          await wagmiConnect({ connector })
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setConnectionError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [openConnectModal, wagmiConnect, connectors])

  const disconnect = useCallback(() => {
    try {
      wagmiDisconnect()
      // Stop transaction watching on disconnect
      stopTransactionWatching()
      setConnectionError(null)
    } catch (err) {
      console.error('Error disconnecting wallet:', err)
    }
  }, [wagmiDisconnect, stopTransactionWatching])

  const switchNetwork = useCallback(async (network: NetworkType) => {
    try {
      setConnectionError(null)
      await networkSwitchNetwork(network)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch network'
      setConnectionError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [networkSwitchNetwork])

  // Sync history wrapper
  const syncHistory = useCallback(async () => {
    if (!address) return
    
    try {
      await syncTransactionHistory()
    } catch (err) {
      console.error('Error syncing transaction history:', err)
    }
  }, [address, syncTransactionHistory])

  const value: WalletContextType = {
    // Connection state
    isConnected: wagmiConnected,
    address: address || null,
    chainId: chainId || null,
    
    // Network management
    currentNetwork,
    switchNetwork,
    
    // Connection methods
    connect,
    disconnect,
    
    // Transaction history
    syncHistory,
    transactions,
    isHistoryLoading,
    historyError,
    
    // Wrapped data
    wrappedReports,
    generateWrapped,
    
    // Real-time transaction monitoring
    isWatchingTransactions,
    startTransactionWatching,
    stopTransactionWatching,
    
    // Connection status
    isConnecting,
    connectionError,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
