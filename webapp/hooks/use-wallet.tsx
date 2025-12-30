"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"

// Simple mock wallet context to replace wagmi/rainbowkit
interface WalletContextType {
  isConnected: boolean
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)

  // Load from local storage for persistence (v0 allows this for internal mock state)
  useEffect(() => {
    const saved = localStorage.getItem("paywarp_wallet_connected")
    if (saved === "true") {
      setIsConnected(true)
      setAddress("0x71C...392b")
    }
  }, [])

  const connect = async () => {
    // Simulate a slight delay for connection
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsConnected(true)
    setAddress("0x71C...392b")
    localStorage.setItem("paywarp_wallet_connected", "true")
  }

  const disconnect = () => {
    setIsConnected(false)
    setAddress(null)
    localStorage.removeItem("paywarp_wallet_connected")
  }

  return (
    <WalletContext.Provider value={{ isConnected, address, connect, disconnect }}>{children}</WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
