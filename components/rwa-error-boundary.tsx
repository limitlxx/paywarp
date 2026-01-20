"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react"
import { useRWAErrorHandling } from '@/hooks/use-rwa-error-handling'

interface RWAErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void; isRWAError: boolean }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface RWAErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  isRWAError: boolean
}

export class RWAErrorBoundary extends React.Component<RWAErrorBoundaryProps, RWAErrorBoundaryState> {
  constructor(props: RWAErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, isRWAError: false }
  }

  static getDerivedStateFromError(error: Error): RWAErrorBoundaryState {
    // Check if this is an RWA-related error
    const isRWAError = error.message.toLowerCase().includes('rwa') ||
                      error.message.toLowerCase().includes('contract') ||
                      error.message.toLowerCase().includes('yield') ||
                      error.message.toLowerCase().includes('usdy') ||
                      error.message.toLowerCase().includes('musd')

    return { hasError: true, error, isRWAError }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RWAErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo,
      isRWAError: this.state.isRWAError
    })

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, isRWAError: false })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent 
          error={this.state.error!} 
          retry={this.handleRetry} 
          isRWAError={this.state.isRWAError}
        />
      }

      // Default RWA-specific error UI
      return (
        <RWAErrorFallback 
          error={this.state.error!}
          retry={this.handleRetry}
          isRWAError={this.state.isRWAError}
        />
      )
    }

    return this.props.children
  }
}

// Default fallback component for RWA errors
function RWAErrorFallback({ 
  error, 
  retry, 
  isRWAError 
}: { 
  error: Error
  retry: () => void
  isRWAError: boolean 
}) {
  const { cacheStats, clearAllErrors } = useRWAErrorHandling()

  const getErrorIcon = () => {
    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('connection')) {
      return <WifiOff className="w-5 h-5" />
    }
    return <AlertTriangle className="w-5 h-5" />
  }

  const getErrorTitle = () => {
    if (isRWAError) {
      return 'RWA Service Issue'
    }
    if (error.message.toLowerCase().includes('network')) {
      return 'Connection Issue'
    }
    return 'Something went wrong'
  }

  const getErrorDescription = () => {
    if (isRWAError) {
      return 'The RWA yield service is temporarily unavailable. Your funds are safe and basic operations will continue normally.'
    }
    if (error.message.toLowerCase().includes('network')) {
      return 'Unable to connect to RWA services. Please check your internet connection.'
    }
    return error.message || 'An unexpected error occurred'
  }

  const getRecoveryActions = () => {
    const actions = [
      <Button 
        key="retry"
        onClick={retry}
        className="gradient-primary text-white"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Try Again
      </Button>
    ]

    if (isRWAError) {
      actions.push(
        <Button 
          key="clear-cache"
          variant="outline" 
          onClick={clearAllErrors}
          className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
        >
          Clear Cache
        </Button>
      )
    }

    actions.push(
      <Button 
        key="reload"
        variant="outline" 
        onClick={() => window.location.reload()}
        className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
      >
        Reload Page
      </Button>
    )

    return actions
  }

  return (
    <Card className="glass-card border-red-500/20 max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-400">
          {getErrorIcon()}
          {getErrorTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-red-500/20 bg-red-500/5">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-300">
            {getErrorDescription()}
          </AlertDescription>
        </Alert>

        {isRWAError && (
          <Alert className="border-blue-500/20 bg-blue-500/5">
            <Wifi className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-300">
              <strong>Fallback Mode Active:</strong> Basic bucket operations are still available. 
              RWA yield features will resume automatically when the service recovers.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex gap-2 flex-wrap">
          {getRecoveryActions()}
        </div>

        {isRWAError && cacheStats && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Cache Status
            </summary>
            <div className="mt-2 p-3 bg-black/20 rounded text-xs">
              <div>Total cached entries: {cacheStats.totalEntries}</div>
              <div>Fresh entries: {cacheStats.freshEntries}</div>
              <div>Stale entries: {cacheStats.staleEntries}</div>
              <div>Expired entries: {cacheStats.expiredEntries}</div>
            </div>
          </details>
        )}

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Error Details (Development)
            </summary>
            <pre className="mt-2 p-4 bg-black/20 rounded text-xs overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

// Specific error boundary for bucket operations
export function BucketRWAErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <RWAErrorBoundary
      fallback={({ error, retry, isRWAError }) => (
        <Card className="glass-card border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              {isRWAError ? 'RWA Yield Service Issue' : 'Bucket Operation Error'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-500/20 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {isRWAError 
                  ? 'RWA yield features are temporarily unavailable. Your bucket operations will continue with standard functionality.'
                  : 'Failed to load bucket data. Please try again.'
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
        console.error('Bucket RWA operation error:', error, errorInfo)
        
        // Log specific error types for debugging
        if (error.message.includes('RWA')) {
          console.warn('RWA service degradation detected - fallback mode should be active')
        }
      }}
    >
      {children}
    </RWAErrorBoundary>
  )
}