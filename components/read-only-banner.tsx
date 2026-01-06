'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorHandler } from '@/lib/error-handler'

export function ReadOnlyBanner() {
  const [readOnlyState, setReadOnlyState] = useState<{
    enabled: boolean
    reason?: string
    timestamp?: string
  }>({ enabled: false })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check read-only mode on mount
    const checkReadOnlyMode = () => {
      const state = errorHandler.isReadOnlyMode()
      setReadOnlyState(state)
      setIsVisible(state.enabled)
    }

    checkReadOnlyMode()

    // Check periodically
    const interval = setInterval(checkReadOnlyMode, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const handleRetry = async () => {
    try {
      // Try to disable read-only mode
      errorHandler.disableReadOnlyMode()
      setReadOnlyState({ enabled: false })
      setIsVisible(false)
      
      // Refresh the page to restore full functionality
      window.location.reload()
    } catch (error) {
      console.warn('Failed to exit read-only mode:', error)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
  }

  if (!isVisible || !readOnlyState.enabled) {
    return null
  }

  return (
    <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex-1">
          <strong>Read-Only Mode:</strong> {readOnlyState.reason || 'Some services are temporarily unavailable'}
          {readOnlyState.timestamp && (
            <div className="text-xs mt-1 opacity-75">
              Since: {new Date(readOnlyState.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button
            onClick={handleRetry}
            variant="outline"
            size="sm"
            className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="text-yellow-800 hover:bg-yellow-100 p-1"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

export function ServiceStatusIndicator() {
  const [status, setStatus] = useState<{
    rpc: 'good' | 'degraded' | 'poor'
    contracts: 'available' | 'limited' | 'unavailable'
    priceFeeds: 'live' | 'cached' | 'stale'
  }>({
    rpc: 'good',
    contracts: 'available',
    priceFeeds: 'live'
  })

  useEffect(() => {
    // This would be connected to actual service monitoring
    // For now, we'll simulate status checking
    const checkServices = async () => {
      try {
        // Check RPC health
        // const rpcHealth = await RPCProvider.getInstance('sepolia').checkHealth()
        
        // Check if in read-only mode
        const readOnly = errorHandler.isReadOnlyMode()
        
        if (readOnly.enabled) {
          setStatus({
            rpc: 'poor',
            contracts: 'unavailable',
            priceFeeds: 'stale'
          })
        } else {
          setStatus({
            rpc: 'good',
            contracts: 'available',
            priceFeeds: 'live'
          })
        }
      } catch (error) {
        console.warn('Service status check failed:', error)
      }
    }

    checkServices()
    const interval = setInterval(checkServices, 60000) // Every minute

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
      case 'available':
      case 'live':
        return 'bg-green-500'
      case 'degraded':
      case 'limited':
      case 'cached':
        return 'bg-yellow-500'
      case 'poor':
      case 'unavailable':
      case 'stale':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (service: string, status: string) => {
    return `${service}: ${status}`
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <span>Status:</span>
      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${getStatusColor(status.rpc)}`}
          title={getStatusText('Network', status.rpc)}
        />
        <div 
          className={`w-2 h-2 rounded-full ${getStatusColor(status.contracts)}`}
          title={getStatusText('Contracts', status.contracts)}
        />
        <div 
          className={`w-2 h-2 rounded-full ${getStatusColor(status.priceFeeds)}`}
          title={getStatusText('Price Feeds', status.priceFeeds)}
        />
      </div>
    </div>
  )
}