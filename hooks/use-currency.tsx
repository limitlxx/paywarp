"use client"

import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from 'react'
import { getCurrencyManager } from '@/lib/currency-manager'
import { useNetwork } from './use-network'
import type { Currency, CurrencyRates } from '@/lib/types'

interface CurrencyContextType {
  // Current state
  currentCurrency: Currency
  rates: CurrencyRates | null
  isLoading: boolean
  isStale: boolean
  lastError: string | null

  // Actions
  setCurrency: (currency: Currency) => void
  refreshRates: () => Promise<void>
  convertAmount: (amount: number, from: Currency, to?: Currency) => number
  formatAmount: (amount: number, currency?: Currency, precision?: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | null>(null)

interface CurrencyProviderProps {
  children: ReactNode
  defaultCurrency?: Currency
}

export function CurrencyProvider({ children, defaultCurrency = 'USD' }: CurrencyProviderProps) {
  const [currentCurrency, setCurrentCurrency] = useState<Currency>(defaultCurrency)
  const [rates, setRates] = useState<CurrencyRates | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastError, setLastError] = useState<string | null>(null)
  const { currentNetwork } = useNetwork()

  // Initialize currency manager
  const currencyManager = getCurrencyManager(currentNetwork)

  // Load rates on mount and network change
  useEffect(() => {
    loadRates()
  }, [currentNetwork])

  // Set up periodic rate updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (currencyManager.areRatesStale()) {
        loadRates()
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [currentNetwork])

  const loadRates = useCallback(async () => {
    try {
      setIsLoading(true)
      setLastError(null)
      
      // Update network in currency manager
      currencyManager.updateNetwork(currentNetwork)
      
      const newRates = await currencyManager.getCurrentRates()
      setRates(newRates)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load currency rates'
      setLastError(errorMessage)
      console.error('Failed to load currency rates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentNetwork, currencyManager])

  const refreshRates = useCallback(async () => {
    try {
      setIsLoading(true)
      setLastError(null)
      const newRates = await currencyManager.refreshRates()
      setRates(newRates)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh currency rates'
      setLastError(errorMessage)
      console.error('Failed to refresh currency rates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currencyManager])

  const setCurrency = useCallback((currency: Currency) => {
    setCurrentCurrency(currency)
    // Save to localStorage
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('paywarp_selected_currency', currency)
      }
    } catch (error) {
      console.warn('Failed to save currency preference:', error)
    }
  }, [])

  const convertAmount = useCallback((amount: number, from: Currency, to?: Currency): number => {
    const targetCurrency = to || currentCurrency
    if (!rates) return amount
    return currencyManager.convertAmount(amount, from, targetCurrency, rates)
  }, [currentCurrency, rates, currencyManager])

  const formatAmount = useCallback((amount: number, currency?: Currency, precision: number = 2): string => {
    const targetCurrency = currency || currentCurrency
    return currencyManager.formatCurrency(amount, targetCurrency, precision)
  }, [currentCurrency, currencyManager])

  // Load saved currency preference on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('paywarp_selected_currency') as Currency
        if (saved && ['USD', 'NGN', 'MNT'].includes(saved)) {
          setCurrentCurrency(saved)
        }
      }
    } catch (error) {
      console.warn('Failed to load currency preference:', error)
    }
  }, [])

  const isStale = rates ? currencyManager.areRatesStale() : false

  const contextValue: CurrencyContextType = {
    currentCurrency,
    rates,
    isLoading,
    isStale,
    lastError,
    setCurrency,
    refreshRates,
    convertAmount,
    formatAmount
  }

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}

// Utility hook for simple currency conversion without context
export function useCurrencyConverter(network?: string) {
  const [rates, setRates] = useState<CurrencyRates | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadRates = useCallback(async () => {
    setIsLoading(true)
    try {
      const manager = getCurrencyManager(network as any)
      const newRates = await manager.getCurrentRates()
      setRates(newRates)
    } catch (error) {
      console.error('Failed to load rates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [network])

  useEffect(() => {
    loadRates()
  }, [loadRates])

  const convert = useCallback((amount: number, from: Currency, to: Currency): number => {
    if (!rates) return amount
    const manager = getCurrencyManager(network as any)
    return manager.convertAmount(amount, from, to, rates)
  }, [rates, network])

  const format = useCallback((amount: number, currency: Currency, precision: number = 2): string => {
    const manager = getCurrencyManager(network as any)
    return manager.formatCurrency(amount, currency, precision)
  }, [network])

  return { rates, isLoading, convert, format, refresh: loadRates }
}