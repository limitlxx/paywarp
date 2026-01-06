import { toast } from '@/hooks/use-toast'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  network?: string
  contractAddress?: string
  transactionHash?: string
  metadata?: Record<string, any>
}

export interface ErrorReport {
  id: string
  message: string
  severity: ErrorSeverity
  timestamp: Date
  context: ErrorContext
  stack?: string
  resolved: boolean
  retryCount: number
}

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorReports: Map<string, ErrorReport> = new Map()
  private maxRetries = 3
  private retryDelays = [1000, 2000, 4000] // Exponential backoff

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * Handle different types of errors with appropriate user feedback
   */
  handleError(error: Error, context: ErrorContext = {}): string {
    const errorId = this.generateErrorId()
    const severity = this.determineSeverity(error, context)
    
    const errorReport: ErrorReport = {
      id: errorId,
      message: error.message,
      severity,
      timestamp: new Date(),
      context,
      stack: error.stack,
      resolved: false,
      retryCount: 0
    }

    this.errorReports.set(errorId, errorReport)

    // Show user-friendly message based on error type
    const userMessage = this.getUserFriendlyMessage(error, context)
    this.showUserNotification(userMessage, severity)

    // Log for debugging
    console.error(`[${severity.toUpperCase()}] ${error.message}`, {
      errorId,
      context,
      stack: error.stack
    })

    return errorId
  }

  /**
   * Retry a failed operation with exponential backoff
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    errorId: string,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    const errorReport = this.errorReports.get(errorId)
    if (!errorReport) {
      throw new Error('Error report not found')
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation()
        
        // Mark as resolved
        errorReport.resolved = true
        errorReport.retryCount = attempt + 1
        
        if (attempt > 0) {
          toast({
            title: "Success",
            description: "Operation completed successfully after retry",
          })
        }
        
        return result
      } catch (error) {
        errorReport.retryCount = attempt + 1
        
        if (attempt === maxRetries - 1) {
          // Final attempt failed
          throw error
        }
        
        // Wait before retry
        await this.delay(this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)])
      }
    }

    throw new Error('Max retries exceeded')
  }

  /**
   * Handle RPC endpoint failures with fallback
   */
  async handleRPCFailure<T>(
    primaryRPC: () => Promise<T>,
    fallbackRPCs: (() => Promise<T>)[],
    context: ErrorContext = {}
  ): Promise<T> {
    const errorId = this.generateErrorId()
    
    try {
      return await primaryRPC()
    } catch (primaryError) {
      console.warn('Primary RPC failed, trying fallbacks:', primaryError.message)
      
      for (let i = 0; i < fallbackRPCs.length; i++) {
        try {
          const result = await fallbackRPCs[i]()
          
          toast({
            title: "Network Issue Resolved",
            description: `Connected using backup network (${i + 1}/${fallbackRPCs.length})`,
            variant: "default"
          })
          
          return result
        } catch (fallbackError) {
          console.warn(`Fallback RPC ${i + 1} failed:`, fallbackError.message)
          
          if (i === fallbackRPCs.length - 1) {
            // All fallbacks failed
            this.handleError(new Error('All RPC endpoints unavailable'), {
              ...context,
              action: 'rpc_fallback_exhausted'
            })
            throw new Error('Network unavailable. Please check your connection and try again.')
          }
        }
      }
    }

    throw new Error('Unexpected error in RPC fallback')
  }

  /**
   * Handle contract call failures
   */
  handleContractError(error: Error, context: ErrorContext = {}): never {
    let userMessage = 'Transaction failed. Please try again.'
    
    // Parse common contract errors
    if (error.message.includes('insufficient funds')) {
      userMessage = 'Insufficient funds for this transaction. Please check your balance.'
    } else if (error.message.includes('gas')) {
      userMessage = 'Transaction failed due to gas issues. Try increasing gas limit.'
    } else if (error.message.includes('revert')) {
      userMessage = 'Transaction was rejected by the smart contract. Please check the transaction details.'
    } else if (error.message.includes('nonce')) {
      userMessage = 'Transaction nonce error. Please refresh and try again.'
    } else if (error.message.includes('network')) {
      userMessage = 'Network congestion detected. Please wait a moment and try again.'
    }

    this.handleError(error, { ...context, action: 'contract_call' })
    throw new Error(userMessage)
  }

  /**
   * Handle price feed failures
   */
  async handlePriceFeedFailure<T>(
    primaryFeed: () => Promise<T>,
    fallbackData: T,
    context: ErrorContext = {}
  ): Promise<{ data: T; isStale: boolean }> {
    try {
      const data = await primaryFeed()
      return { data, isStale: false }
    } catch (error) {
      console.warn('Price feed unavailable, using fallback data:', error.message)
      
      toast({
        title: "Using Cached Data",
        description: "Live price data unavailable. Showing last known prices.",
        variant: "default"
      })

      this.handleError(error, { ...context, action: 'price_feed_failure' })
      return { data: fallbackData, isStale: true }
    }
  }

  /**
   * Enable read-only mode when critical services are down
   */
  enableReadOnlyMode(reason: string): void {
    toast({
      title: "Read-Only Mode",
      description: `Some features are temporarily unavailable: ${reason}`,
      variant: "destructive"
    })

    // Store read-only state
    if (typeof window !== 'undefined') {
      localStorage.setItem('paywarp_readonly_mode', JSON.stringify({
        enabled: true,
        reason,
        timestamp: new Date().toISOString()
      }))
    }
  }

  /**
   * Check if app is in read-only mode
   */
  isReadOnlyMode(): { enabled: boolean; reason?: string; timestamp?: string } {
    if (typeof window === 'undefined') {
      return { enabled: false }
    }

    try {
      const stored = localStorage.getItem('paywarp_readonly_mode')
      if (stored) {
        const parsed = JSON.parse(stored)
        
        // Auto-disable after 1 hour
        const timestamp = new Date(parsed.timestamp)
        const now = new Date()
        const hoursSince = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
        
        if (hoursSince > 1) {
          localStorage.removeItem('paywarp_readonly_mode')
          return { enabled: false }
        }
        
        return parsed
      }
    } catch (error) {
      console.warn('Failed to check read-only mode:', error)
    }

    return { enabled: false }
  }

  /**
   * Disable read-only mode
   */
  disableReadOnlyMode(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('paywarp_readonly_mode')
    }
    
    toast({
      title: "Services Restored",
      description: "All features are now available",
      variant: "default"
    })
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    total: number
    byType: Record<string, number>
    bySeverity: Record<ErrorSeverity, number>
    recent: ErrorReport[]
  } {
    const reports = Array.from(this.errorReports.values())
    const recent = reports
      .filter(r => Date.now() - r.timestamp.getTime() < 24 * 60 * 60 * 1000) // Last 24 hours
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)

    const byType: Record<string, number> = {}
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }

    reports.forEach(report => {
      const action = report.context.action || 'unknown'
      byType[action] = (byType[action] || 0) + 1
      bySeverity[report.severity]++
    })

    return {
      total: reports.length,
      byType,
      bySeverity,
      recent
    }
  }

  /**
   * Public method to generate error IDs for external use
   */
  generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    const message = error.message.toLowerCase()
    
    if (message.includes('critical') || message.includes('security')) {
      return 'critical'
    }
    
    if (message.includes('transaction') || message.includes('contract')) {
      return 'high'
    }
    
    if (message.includes('network') || message.includes('rpc')) {
      return 'medium'
    }
    
    return 'low'
  }

  private getUserFriendlyMessage(error: Error, context: ErrorContext): string {
    const message = error.message.toLowerCase()
    
    // Network-related errors
    if (message.includes('network') || message.includes('rpc')) {
      return 'Network connection issue. Trying backup servers...'
    }
    
    // Transaction errors
    if (message.includes('transaction')) {
      return 'Transaction failed. Your funds are safe. Please try again.'
    }
    
    // Contract errors
    if (message.includes('contract')) {
      return 'Smart contract interaction failed. Please check your transaction details.'
    }
    
    // Price feed errors
    if (message.includes('price') || message.includes('feed')) {
      return 'Price data temporarily unavailable. Using cached prices.'
    }
    
    // Generic fallback
    return 'An unexpected error occurred. Please try again or contact support if the issue persists.'
  }

  private showUserNotification(message: string, severity: ErrorSeverity): void {
    const variant = severity === 'critical' || severity === 'high' ? 'destructive' : 'default'
    
    toast({
      title: severity === 'critical' ? 'Critical Error' : 'Notice',
      description: message,
      variant
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance()

// Utility functions for common error scenarios
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: ErrorContext = {}
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      const errorId = errorHandler.handleError(error as Error, context)
      throw error
    }
  }
}

export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number = 3,
  context: ErrorContext = {}
) {
  return async (...args: T): Promise<R> => {
    const errorId = errorHandler.generateErrorId()
    
    return errorHandler.retryOperation(
      () => fn(...args),
      errorId,
      maxRetries
    )
  }
}