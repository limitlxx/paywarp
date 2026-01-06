'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Activity, Wifi, WifiOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useErrorHandler, useRPCErrorHandler } from '@/hooks/use-error-handler'
import type { NetworkType } from '@/lib/types'

interface ErrorDashboardProps {
  network?: NetworkType
  className?: string
}

export function ErrorDashboard({ network = 'sepolia', className }: ErrorDashboardProps) {
  const errorHandler = useErrorHandler()
  const rpcHandler = useRPCErrorHandler(network)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Check network health on mount
    errorHandler.checkNetworkHealth(network)
  }, [network, errorHandler])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await errorHandler.checkNetworkHealth(network)
      errorHandler.clearErrors()
    } catch (error) {
      console.warn('Failed to refresh network health:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'poor':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case 'poor':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Activity className="w-4 h-4 text-gray-600" />
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Network Health Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Network Health</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {errorHandler.networkHealth ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getHealthIcon(errorHandler.networkHealth.overallHealth)}
                  <span className={`font-medium ${getHealthColor(errorHandler.networkHealth.overallHealth)}`}>
                    {errorHandler.networkHealth.overallHealth.toUpperCase()}
                  </span>
                </div>
                <Badge variant="outline">
                  {errorHandler.networkHealth.network}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Primary RPC</div>
                  <div className="flex items-center gap-1">
                    {errorHandler.networkHealth.primaryHealthy ? (
                      <Wifi className="w-3 h-3 text-green-600" />
                    ) : (
                      <WifiOff className="w-3 h-3 text-red-600" />
                    )}
                    <span>
                      {errorHandler.networkHealth.primaryHealthy ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div className="text-gray-600">Fallbacks</div>
                  <div>{errorHandler.networkHealth.fallbacksAvailable} available</div>
                </div>
                
                <div>
                  <div className="text-gray-600">Best Latency</div>
                  <div>
                    {errorHandler.networkHealth.bestLatency === Infinity 
                      ? 'N/A' 
                      : `${errorHandler.networkHealth.bestLatency}ms`
                    }
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div>Checking network health...</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Read-Only Mode Status */}
      {errorHandler.isReadOnlyMode && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Read-Only Mode Active
            </CardTitle>
            <CardDescription className="text-yellow-700">
              {errorHandler.readOnlyReason || 'Some services are temporarily unavailable'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={errorHandler.exitReadOnlyMode}
              variant="outline"
              size="sm"
              className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
            >
              Try to Exit Read-Only Mode
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Error Statistics</CardTitle>
          <CardDescription>Last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Errors</span>
              <Badge variant={errorHandler.errorStats.total > 0 ? 'destructive' : 'secondary'}>
                {errorHandler.errorStats.total}
              </Badge>
            </div>
            
            {Object.entries(errorHandler.errorStats.bySeverity).map(([severity, count]) => (
              <div key={severity} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{severity}</span>
                <span className="text-sm">{count}</span>
              </div>
            ))}
            
            {errorHandler.errorStats.total > 0 && (
              <div className="pt-2">
                <Button
                  onClick={errorHandler.clearErrors}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Clear Error History
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      {errorHandler.errorStats.recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errorHandler.errorStats.recent.slice(0, 3).map((error) => (
                <div key={error.id} className="p-2 bg-gray-50 rounded text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <Badge 
                      variant={error.severity === 'critical' || error.severity === 'high' ? 'destructive' : 'secondary'}
                    >
                      {error.severity}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {error.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-700 truncate">
                    {error.message}
                  </div>
                  {error.context.component && (
                    <div className="text-xs text-gray-500 mt-1">
                      {error.context.component} • {error.context.action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Error with Retry Option */}
      {errorHandler.hasError && errorHandler.lastError && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Last Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-red-700">
                {errorHandler.lastError.message}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={errorHandler.retryLastOperation}
                  variant="outline"
                  size="sm"
                  className="text-red-800 border-red-300 hover:bg-red-100"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
                <Button
                  onClick={errorHandler.clearErrors}
                  variant="ghost"
                  size="sm"
                  className="text-red-800 hover:bg-red-100"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Compact version for header/status bar
export function ErrorStatusIndicator({ network = 'sepolia' }: { network?: NetworkType }) {
  const errorHandler = useErrorHandler()

  useEffect(() => {
    errorHandler.checkNetworkHealth(network)
  }, [network, errorHandler])

  if (!errorHandler.networkHealth) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Activity className="w-3 h-3 animate-pulse" />
        <span>Checking...</span>
      </div>
    )
  }

  const { overallHealth, primaryHealthy, fallbacksAvailable } = errorHandler.networkHealth

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1">
        {overallHealth === 'good' && <CheckCircle className="w-3 h-3 text-green-600" />}
        {overallHealth === 'degraded' && <AlertTriangle className="w-3 h-3 text-yellow-600" />}
        {overallHealth === 'poor' && <XCircle className="w-3 h-3 text-red-600" />}
        <span className={getHealthColor(overallHealth)}>
          {overallHealth}
        </span>
      </div>
      
      {errorHandler.isReadOnlyMode && (
        <Badge variant="outline" className="text-xs">
          Read-Only
        </Badge>
      )}
      
      {errorHandler.hasError && (
        <Badge variant="destructive" className="text-xs">
          Error
        </Badge>
      )}
    </div>
  )
}

function getHealthColor(health: string) {
  switch (health) {
    case 'good':
      return 'text-green-600'
    case 'degraded':
      return 'text-yellow-600'
    case 'poor':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}