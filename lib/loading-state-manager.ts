/**
 * Loading State Manager
 * Manages loading states and progress indicators for blockchain operations
 * Requirements: 3.5, 4.5, 6.4
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface LoadingOperation {
  id: string
  type: 'transaction' | 'balance' | 'network' | 'contract' | 'general'
  description: string
  progress: number // 0-100
  status: 'pending' | 'processing' | 'success' | 'error'
  startTime: Date
  endTime?: Date
  error?: string
  metadata?: Record<string, any>
}

export interface LoadingState {
  operations: Record<string, LoadingOperation>
  globalLoading: boolean
  criticalLoading: boolean // For operations that should block UI
}

interface LoadingStore extends LoadingState {
  // Actions
  startOperation: (operation: Omit<LoadingOperation, 'id' | 'startTime' | 'status' | 'progress'>) => string
  updateOperation: (id: string, updates: Partial<LoadingOperation>) => void
  completeOperation: (id: string, success: boolean, error?: string) => void
  removeOperation: (id: string) => void
  clearOperations: (type?: LoadingOperation['type']) => void
  
  // Getters
  getOperation: (id: string) => LoadingOperation | undefined
  getOperationsByType: (type: LoadingOperation['type']) => LoadingOperation[]
  isLoading: (type?: LoadingOperation['type']) => boolean
  getProgress: (type?: LoadingOperation['type']) => number
}

export const useLoadingStore = create<LoadingStore>()(
  subscribeWithSelector((set, get) => ({
    operations: {},
    globalLoading: false,
    criticalLoading: false,

    startOperation: (operation) => {
      const id = `${operation.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newOperation: LoadingOperation = {
        ...operation,
        id,
        startTime: new Date(),
        status: 'pending',
        progress: 0,
      }

      set((state) => {
        const newOperations = { ...state.operations, [id]: newOperation }
        return {
          operations: newOperations,
          globalLoading: Object.keys(newOperations).length > 0,
          criticalLoading: Object.values(newOperations).some(op => 
            op.metadata?.critical && op.status === 'processing'
          ),
        }
      })

      return id
    },

    updateOperation: (id, updates) => {
      set((state) => {
        const operation = state.operations[id]
        if (!operation) return state

        const updatedOperation = { ...operation, ...updates }
        const newOperations = { ...state.operations, [id]: updatedOperation }

        return {
          operations: newOperations,
          criticalLoading: Object.values(newOperations).some(op => 
            op.metadata?.critical && op.status === 'processing'
          ),
        }
      })
    },

    completeOperation: (id, success, error) => {
      set((state) => {
        const operation = state.operations[id]
        if (!operation) return state

        const updatedOperation: LoadingOperation = {
          ...operation,
          status: success ? 'success' : 'error',
          progress: 100,
          endTime: new Date(),
          error: error || undefined,
        }

        const newOperations = { ...state.operations, [id]: updatedOperation }

        return {
          operations: newOperations,
          globalLoading: Object.values(newOperations).some(op => 
            op.status === 'pending' || op.status === 'processing'
          ),
          criticalLoading: Object.values(newOperations).some(op => 
            op.metadata?.critical && op.status === 'processing'
          ),
        }
      })

      // Auto-remove successful operations after a delay
      if (success) {
        setTimeout(() => {
          get().removeOperation(id)
        }, 3000)
      }
    },

    removeOperation: (id) => {
      set((state) => {
        const { [id]: removed, ...remainingOperations } = state.operations
        return {
          operations: remainingOperations,
          globalLoading: Object.keys(remainingOperations).length > 0,
          criticalLoading: Object.values(remainingOperations).some(op => 
            op.metadata?.critical && op.status === 'processing'
          ),
        }
      })
    },

    clearOperations: (type) => {
      set((state) => {
        let newOperations = { ...state.operations }
        
        if (type) {
          // Remove operations of specific type
          Object.keys(newOperations).forEach(id => {
            if (newOperations[id].type === type) {
              delete newOperations[id]
            }
          })
        } else {
          // Clear all operations
          newOperations = {}
        }

        return {
          operations: newOperations,
          globalLoading: Object.keys(newOperations).length > 0,
          criticalLoading: Object.values(newOperations).some(op => 
            op.metadata?.critical && op.status === 'processing'
          ),
        }
      })
    },

    getOperation: (id) => {
      return get().operations[id]
    },

    getOperationsByType: (type) => {
      return Object.values(get().operations).filter(op => op.type === type)
    },

    isLoading: (type) => {
      const operations = Object.values(get().operations)
      if (type) {
        return operations.some(op => 
          op.type === type && (op.status === 'pending' || op.status === 'processing')
        )
      }
      return operations.some(op => op.status === 'pending' || op.status === 'processing')
    },

    getProgress: (type) => {
      const operations = Object.values(get().operations)
      const relevantOps = type ? operations.filter(op => op.type === type) : operations
      
      if (relevantOps.length === 0) return 0
      
      const totalProgress = relevantOps.reduce((sum, op) => sum + op.progress, 0)
      return Math.round(totalProgress / relevantOps.length)
    },
  }))
)

/**
 * Hook for managing loading states with automatic cleanup
 */
export function useLoadingManager() {
  const store = useLoadingStore()

  const withLoading = async <T>(
    operation: () => Promise<T>,
    config: {
      type: LoadingOperation['type']
      description: string
      critical?: boolean
      onProgress?: (progress: number) => void
    }
  ): Promise<T> => {
    const operationId = store.startOperation({
      type: config.type,
      description: config.description,
      metadata: { critical: config.critical },
    })

    try {
      // Start processing
      store.updateOperation(operationId, { status: 'processing', progress: 10 })

      // Set up progress tracking if provided
      if (config.onProgress) {
        const progressInterval = setInterval(() => {
          const currentOp = store.getOperation(operationId)
          if (currentOp && currentOp.status === 'processing' && currentOp.progress < 90) {
            const newProgress = Math.min(90, currentOp.progress + 10)
            store.updateOperation(operationId, { progress: newProgress })
            config.onProgress!(newProgress)
          }
        }, 500)

        // Clear interval when operation completes
        setTimeout(() => clearInterval(progressInterval), 30000) // Max 30 seconds
      }

      const result = await operation()
      
      store.completeOperation(operationId, true)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed'
      store.completeOperation(operationId, false, errorMessage)
      throw error
    }
  }

  return {
    ...store,
    withLoading,
  }
}

/**
 * Hook for transaction-specific loading management
 */
export function useTransactionLoading() {
  const loadingManager = useLoadingManager()

  const executeWithLoading = async <T>(
    transaction: () => Promise<T>,
    description: string,
    critical: boolean = false
  ): Promise<T> => {
    return loadingManager.withLoading(transaction, {
      type: 'transaction',
      description,
      critical,
      onProgress: (progress) => {
        // Could emit events for UI components to listen to
        window.dispatchEvent(new CustomEvent('transactionProgress', { 
          detail: { progress, description } 
        }))
      },
    })
  }

  return {
    executeWithLoading,
    isTransactionLoading: () => loadingManager.isLoading('transaction'),
    getTransactionProgress: () => loadingManager.getProgress('transaction'),
    getTransactionOperations: () => loadingManager.getOperationsByType('transaction'),
  }
}

/**
 * Performance monitoring for loading operations
 */
export class LoadingPerformanceMonitor {
  private metrics: Map<string, {
    operationType: string
    startTime: number
    endTime?: number
    duration?: number
    success: boolean
  }> = new Map()

  startTracking(operationId: string, operationType: string) {
    this.metrics.set(operationId, {
      operationType,
      startTime: performance.now(),
      success: false,
    })
  }

  endTracking(operationId: string, success: boolean) {
    const metric = this.metrics.get(operationId)
    if (metric) {
      const endTime = performance.now()
      metric.endTime = endTime
      metric.duration = endTime - metric.startTime
      metric.success = success
    }
  }

  getMetrics(operationType?: string) {
    const allMetrics = Array.from(this.metrics.values())
    return operationType 
      ? allMetrics.filter(m => m.operationType === operationType)
      : allMetrics
  }

  getAverageLoadTime(operationType?: string) {
    const metrics = this.getMetrics(operationType).filter(m => m.duration !== undefined)
    if (metrics.length === 0) return 0
    
    const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0)
    return totalDuration / metrics.length
  }

  getSuccessRate(operationType?: string) {
    const metrics = this.getMetrics(operationType)
    if (metrics.length === 0) return 0
    
    const successCount = metrics.filter(m => m.success).length
    return (successCount / metrics.length) * 100
  }

  clear() {
    this.metrics.clear()
  }
}

export const loadingPerformanceMonitor = new LoadingPerformanceMonitor()

// Subscribe to loading operations for performance tracking
useLoadingStore.subscribe(
  (state) => state.operations,
  (operations, previousOperations) => {
    // Track new operations
    Object.values(operations).forEach(operation => {
      if (!previousOperations[operation.id]) {
        loadingPerformanceMonitor.startTracking(operation.id, operation.type)
      }
      
      // Track completed operations
      if (operation.status === 'success' || operation.status === 'error') {
        const previousOp = previousOperations[operation.id]
        if (previousOp && (previousOp.status === 'pending' || previousOp.status === 'processing')) {
          loadingPerformanceMonitor.endTracking(operation.id, operation.status === 'success')
        }
      }
    })
  }
)