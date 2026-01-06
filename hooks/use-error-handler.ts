'use client'

import { useState, useEffect, useCallback } from 'react'
import { errorHandler, type ErrorContext, type ErrorReport } from '@/lib/error-handler'
import { RPCProvider } from '@/lib/rpc-provider'
import type { NetworkType } from '@/lib/types'

export interface UseErrorHandlerReturn {
  // Error state
  hasError: boolean
  lastError: ErrorReport | null
  errorStats: ReturnType<typeof errorHandler.getErrorStats>
  
  // Read-only mode
  isReadOnlyMode: boolean
  readOnlyReason?: string
  
  // Network health
  networkHealth: {
    network: NetworkType
    primaryHealthy: boolean
    fallbacksAvailable: number
    bestLatency: number
    overallHealth: 'good' | 'degraded' | 'poor'
  } | null
  
  // Actions
  handleError: (error: Error, context?: ErrorContext) => string
  retryLastOperation: () => Promise<void>
  clearErrors: () => void
  exitReadOnlyMode: () => void
  checkNetworkHealth: (network: NetworkType) => Promise<void>
  
  // Utilities
  withErrorHandling: <T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: ErrorContext
  ) => (...args: T) => Promise<R>
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [hasError, setHasError] = useState(false)
  const [lastError, setLastError] = useState<ErrorReport | null>(null)
  const [errorStats, setErrorStats] = useState(errorHandler.getErrorStats())
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false)
  const [readOnlyReason, setReadOnlyReason] = useState<string>()
  const [networkHealth, setNetworkHealth] = useState<UseErrorHandlerReturn['networkHealth']>(null)
  const [lastOperation, setLastOperation] = useState<{
    fn: () => Promise<any>
    errorId: string
  } | null>(null)

  // Check read-only mode on mount and periodically
  useEffect(() => {
    const checkReadOnlyMode = () => {
      const state = errorHandler.isReadOnlyMode()
      setIsReadOnlyMode(state.enabled)
      setReadOnlyReason(state.reason)
    }

    checkReadOnlyMode()
    const interval = setInterval(checkReadOnlyMode, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Update error stats periodically
  useEffect(() => {
    const updateStats = () => {
      setErrorStats(errorHandler.getErrorStats())
    }

    updateStats()
    const interval = setInterval(updateStats, 60000) // Every minute

    return () => clearInterval(interval)
  }, [])

  const handleErrorCallback = useCallback((error: Error, context?: ErrorContext): string => {
    const errorId = errorHandler.handleError(error, context)
    
    // Update local state
    setHasError(true)
    const reports = Array.from((errorHandler as any).errorReports.values()) as ErrorReport[]
    const latestError = reports.find((r: ErrorReport) => r.id === errorId)
    if (latestError) {
      setLastError(latestError)
    }
    
    return errorId
  }, [])

  const retryLastOperation = useCallback(async () => {
    if (!lastOperation) {
      throw new Error('No operation to retry')
    }

    try {
      await errorHandler.retryOperation(
        lastOperation.fn,
        lastOperation.errorId,
        3
      )
      
      // Clear error state on successful retry
      setHasError(false)
      setLastError(null)
      setLastOperation(null)
    } catch (error) {
      // Retry failed, update error state
      handleErrorCallback(error as Error, {
        component: 'useErrorHandler',
        action: 'retry_failed'
      })
      throw error
    }
  }, [lastOperation, handleErrorCallback])

  const clearErrors = useCallback(() => {
    setHasError(false)
    setLastError(null)
    setLastOperation(null)
  }, [])

  const exitReadOnlyMode = useCallback(() => {
    try {
      errorHandler.disableReadOnlyMode()
      setIsReadOnlyMode(false)
      setReadOnlyReason(undefined)
    } catch (error) {
      handleErrorCallback(error as Error, {
        component: 'useErrorHandler',
        action: 'exit_readonly_mode'
      })
    }
  }, [handleErrorCallback])

  const checkNetworkHealth = useCallback(async (network: NetworkType) => {
    try {
      const provider = RPCProvider.getInstance(network)
      const health = await provider.checkHealth()
      setNetworkHealth(health)
    } catch (error) {
      handleErrorCallback(error as Error, {
        component: 'useErrorHandler',
        action: 'check_network_health',
        network
      })
    }
  }, [handleErrorCallback])

  const withErrorHandling = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: ErrorContext
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        const result = await fn(...args)
        
        // Clear error state on success
        if (hasError) {
          clearErrors()
        }
        
        return result
      } catch (error) {
        const errorId = handleErrorCallback(error as Error, context)
        
        // Store operation for potential retry
        setLastOperation({
          fn: () => fn(...args),
          errorId
        })
        
        throw error
      }
    }
  }, [hasError, clearErrors, handleErrorCallback])

  return {
    // State
    hasError,
    lastError,
    errorStats,
    isReadOnlyMode,
    readOnlyReason,
    networkHealth,
    
    // Actions
    handleError: handleErrorCallback,
    retryLastOperation,
    clearErrors,
    exitReadOnlyMode,
    checkNetworkHealth,
    
    // Utilities
    withErrorHandling
  }
}

// Specialized hooks for different error scenarios

export function useRPCErrorHandler(network: NetworkType) {
  const errorHandler = useErrorHandler()
  
  const executeWithFallback = useCallback(async <T>(
    operation: (client: any) => Promise<T>
  ): Promise<T> => {
    const provider = RPCProvider.getInstance(network)
    
    return errorHandler.withErrorHandling(
      () => provider.executeRead(operation),
      {
        component: 'RPCErrorHandler',
        action: 'execute_with_fallback',
        network
      }
    )()
  }, [network, errorHandler])

  return {
    ...errorHandler,
    executeWithFallback
  }
}

export function useTransactionErrorHandler() {
  const errorHandler = useErrorHandler()
  
  const executeTransaction = useCallback(async <T>(
    network: NetworkType,
    operation: (client: any) => Promise<T>
  ): Promise<T> => {
    const provider = RPCProvider.getInstance(network)
    
    return errorHandler.withErrorHandling(
      () => provider.executeWrite(operation),
      {
        component: 'TransactionErrorHandler',
        action: 'execute_transaction',
        network
      }
    )()
  }, [errorHandler])

  return {
    ...errorHandler,
    executeTransaction
  }
}

export function usePriceFeedErrorHandler() {
  const errorHandler = useErrorHandler()
  
  const fetchWithFallback = useCallback(async <T>(
    primaryFetch: () => Promise<T>,
    fallbackData: T,
    context?: ErrorContext
  ): Promise<{ data: T; isStale: boolean }> => {
    try {
      const data = await errorHandler.withErrorHandling(
        primaryFetch,
        {
          component: 'PriceFeedErrorHandler',
          action: 'fetch_with_fallback',
          ...context
        }
      )()
      
      return { data, isStale: false }
    } catch (error) {
      console.warn('Price feed unavailable, using fallback data:', error)
      return { data: fallbackData, isStale: true }
    }
  }, [errorHandler])

  return {
    ...errorHandler,
    fetchWithFallback
  }
}