/**
 * React Hook for RWA Error Handling
 * Provides error state management and recovery mechanisms for RWA operations
 */

import { useState, useEffect, useCallback } from 'react'
import { rwaErrorHandler, type ErrorState } from '@/lib/rwa-error-handler'

export interface UseRWAErrorHandlingReturn {
  errorStates: Map<string, ErrorState>
  isInErrorState: (operationKey: string) => boolean
  getErrorMessage: (operationKey: string) => string | null
  clearError: (operationKey: string) => void
  clearAllErrors: () => void
  retryOperation: (operationKey: string, operation: () => Promise<any>) => Promise<boolean>
  cacheStats: any
}

export function useRWAErrorHandling(): UseRWAErrorHandlingReturn {
  const [errorStates, setErrorStates] = useState<Map<string, ErrorState>>(new Map())
  const [cacheStats, setCacheStats] = useState(rwaErrorHandler.getCacheStats())

  // Subscribe to error state changes
  useEffect(() => {
    const unsubscribe = rwaErrorHandler.onError((errorState) => {
      setErrorStates(prev => {
        const newMap = new Map(prev)
        // Find the operation key for this error state
        // This is a simplified approach - in practice you might want to track operation keys differently
        const operationKey = `error-${Date.now()}`
        newMap.set(operationKey, errorState)
        return newMap
      })
    })

    // Update cache stats periodically
    const statsInterval = setInterval(() => {
      setCacheStats(rwaErrorHandler.getCacheStats())
    }, 5000)

    return () => {
      unsubscribe()
      clearInterval(statsInterval)
    }
  }, [])

  const isInErrorState = useCallback((operationKey: string): boolean => {
    return rwaErrorHandler.isInErrorState(operationKey)
  }, [])

  const getErrorMessage = useCallback((operationKey: string): string | null => {
    const errorState = rwaErrorHandler.getErrorState(operationKey)
    return errorState?.errorMessage || null
  }, [])

  const clearError = useCallback((operationKey: string): void => {
    rwaErrorHandler.clearAllErrorStates() // Simplified - would need more granular control
    setErrorStates(prev => {
      const newMap = new Map(prev)
      newMap.delete(operationKey)
      return newMap
    })
  }, [])

  const clearAllErrors = useCallback((): void => {
    rwaErrorHandler.clearAllErrorStates()
    setErrorStates(new Map())
  }, [])

  const retryOperation = useCallback(async (
    operationKey: string, 
    operation: () => Promise<any>
  ): Promise<boolean> => {
    try {
      const success = await rwaErrorHandler.recoverFromErrorState(operationKey, operation)
      if (success) {
        clearError(operationKey)
      }
      return success
    } catch (error) {
      console.error(`[useRWAErrorHandling] Retry failed for ${operationKey}:`, error)
      return false
    }
  }, [clearError])

  return {
    errorStates,
    isInErrorState,
    getErrorMessage,
    clearError,
    clearAllErrors,
    retryOperation,
    cacheStats
  }
}

// Hook for specific RWA operations
export function useRWAOperation<T>(
  operationKey: string,
  operation: () => Promise<T>,
  fallbackOperation?: () => Promise<T>
) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { isInErrorState, getErrorMessage, retryOperation } = useRWAErrorHandling()

  const execute = useCallback(async (): Promise<T | null> => {
    setIsLoading(true)
    setError(null)

    try {
      let result: T

      if (fallbackOperation) {
        // Use error handler with fallback
        result = await rwaErrorHandler.handleRWAContractFailure(
          operation,
          fallbackOperation,
          operationKey
        )
      } else {
        // Execute operation directly
        result = await operation()
      }

      setResult(result)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [operation, fallbackOperation, operationKey])

  const retry = useCallback(async (): Promise<boolean> => {
    return retryOperation(operationKey, operation)
  }, [operationKey, operation, retryOperation])

  // Check if this operation is in error state
  const hasError = isInErrorState(operationKey)
  const errorMessage = getErrorMessage(operationKey) || error

  return {
    execute,
    retry,
    isLoading,
    result,
    error: errorMessage,
    hasError
  }
}

// Hook for yield data with caching
export function useRWAYieldData(userAddress?: string) {
  const [yields, setYields] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)

  const fetchYields = useCallback(async () => {
    if (!userAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // This would integrate with the yield polling service
      const yieldData = await rwaErrorHandler.handleYieldPollingFailure(
        async () => {
          // Mock yield fetching - replace with actual implementation
          throw new Error('Yield service unavailable')
        },
        userAddress
      )

      setYields(yieldData)
      setIsStale(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch yield data'
      setError(errorMessage)
      setIsStale(true)
    } finally {
      setIsLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchYields()
  }, [fetchYields])

  return {
    yields,
    isLoading,
    error,
    isStale,
    refetch: fetchYields
  }
}