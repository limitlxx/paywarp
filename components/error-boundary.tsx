"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />
      }

      // Default error UI
      return (
        <Card className="glass-card border-red-500/20 max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-500/20 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {this.state.error?.message || 'An unexpected error occurred'}
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={this.handleRetry}
                className="gradient-primary text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
              >
                Reload Page
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 p-4 bg-black/20 rounded text-xs overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { captureError, resetError }
}

// Specific error boundary for payroll components
export function PayrollErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <Card className="glass-card border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Payroll System Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-500/20 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {error.message.includes('429') 
                  ? 'Too many requests. Please wait a moment and try again.'
                  : error.message.includes('network')
                  ? 'Network connection issue. Please check your internet connection.'
                  : error.message.includes('wallet')
                  ? 'Wallet connection issue. Please reconnect your wallet.'
                  : error.message || 'Failed to load payroll data'
                }
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={retry}
                className="gradient-primary text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      onError={(error, errorInfo) => {
        console.error('Payroll component error:', error, errorInfo)
        
        // Log specific error types for debugging
        if (error.message.includes('429')) {
          console.warn('RPC rate limit hit - consider implementing request throttling')
        } else if (error.message.includes('Maximum update depth')) {
          console.error('Infinite re-render detected - check useEffect dependencies')
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

// Specific error boundary for Web3 components
export function Web3ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <Card className="glass-card border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Web3 Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-500/20 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {error.message.includes('wallet') || error.message.includes('MetaMask')
                  ? 'Wallet connection issue. Please reconnect your wallet.'
                  : error.message.includes('network') || error.message.includes('RPC')
                  ? 'Network connection issue. Please check your internet connection.'
                  : error.message.includes('chain') || error.message.includes('Chain')
                  ? 'Wrong network. Please switch to the correct network.'
                  : error.message || 'Web3 connection failed'
                }
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={retry}
                className="gradient-primary text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      onError={(error, errorInfo) => {
        console.error('Web3 component error:', error, errorInfo)
        
        // Log specific Web3 error types
        if (error.message.includes('wallet')) {
          console.warn('Wallet connection error - user may need to reconnect')
        } else if (error.message.includes('chain')) {
          console.warn('Chain mismatch - user may need to switch networks')
        } else if (error.message.includes('RPC')) {
          console.warn('RPC error - network connectivity issue')
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

// Specific error boundary for transaction components
export function TransactionErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <Card className="glass-card border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Transaction Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-500/20 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {error.message.includes('user rejected') || error.message.includes('User denied')
                  ? 'Transaction was cancelled by user.'
                  : error.message.includes('insufficient funds') || error.message.includes('insufficient balance')
                  ? 'Insufficient funds for this transaction.'
                  : error.message.includes('gas') || error.message.includes('Gas')
                  ? 'Transaction failed due to gas issues. Try increasing gas limit.'
                  : error.message.includes('nonce') || error.message.includes('Nonce')
                  ? 'Transaction nonce error. Please try again.'
                  : error.message.includes('reverted') || error.message.includes('execution reverted')
                  ? 'Transaction was reverted by the contract.'
                  : error.message || 'Transaction failed'
                }
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={retry}
                className="gradient-primary text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      onError={(error, errorInfo) => {
        console.error('Transaction error:', error, errorInfo)
        
        // Log specific transaction error types
        if (error.message.includes('user rejected')) {
          console.info('Transaction cancelled by user')
        } else if (error.message.includes('insufficient funds')) {
          console.warn('Insufficient funds for transaction')
        } else if (error.message.includes('gas')) {
          console.warn('Gas-related transaction failure')
        } else if (error.message.includes('reverted')) {
          console.error('Contract execution reverted:', error.message)
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}