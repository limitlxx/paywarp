'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { RefreshCw, Database, Trash2, Clock, Wifi, WifiOff } from 'lucide-react'
import { useTransactionHistory } from '@/hooks/use-transaction-history'
import { useAccount } from 'wagmi'
import { formatDistanceToNow } from 'date-fns'

export function TransactionCacheStatus() {
  const { address } = useAccount()
  const { 
    transactions, 
    isLoading, 
    fromCache, 
    refreshHistory, 
    clearCache, 
    getCacheInfo 
  } = useTransactionHistory()
  
  const [cacheInfo, setCacheInfo] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // Load cache info
  useEffect(() => {
    const loadCacheInfo = async () => {
      if (address) {
        const info = await getCacheInfo()
        setCacheInfo(info)
      }
    }
    
    loadCacheInfo()
  }, [address, getCacheInfo, transactions])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshHistory()
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      await clearCache()
      setCacheInfo(null)
    } finally {
      setIsClearing(false)
    }
  }

  if (!address) {
    return null
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Transaction Cache Status
        </CardTitle>
        <CardDescription>
          Manage your local transaction data and sync status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {fromCache ? (
              <>
                <WifiOff className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Using cached data</span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm">Live data</span>
              </>
            )}
          </div>
          <Badge variant={fromCache ? "secondary" : "default"}>
            {transactions.length} transactions
          </Badge>
        </div>

        {/* Cache Information */}
        {cacheInfo && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Cache Size:</span>
              <div className="font-medium">
                {Math.round(cacheInfo.stats.cacheSize / 1024)} KB
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Total Cached:</span>
              <div className="font-medium">
                {cacheInfo.stats.totalTransactions} transactions
              </div>
            </div>
            {cacheInfo.metadata && (
              <>
                <div>
                  <span className="text-muted-foreground">Last Sync:</span>
                  <div className="font-medium">
                    {formatDistanceToNow(new Date(cacheInfo.metadata.lastUpdated), { addSuffix: true })}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Block:</span>
                  <div className="font-medium">
                    #{cacheInfo.metadata.lastSyncedBlock.slice(-6)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Sync New'}
          </Button>
          
          <Button
            onClick={handleClearCache}
            disabled={isLoading || isClearing || !cacheInfo?.hasCache}
            size="sm"
            variant="outline"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isClearing ? 'Clearing...' : 'Clear Cache'}
          </Button>
        </div>

        {/* Cache Benefits Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3" />
            <span className="font-medium">Cache Benefits:</span>
          </div>
          <ul className="space-y-1 ml-4">
            <li>• Instant loading of transaction history</li>
            <li>• Reduced RPC calls and network usage</li>
            <li>• Works offline with cached data</li>
            <li>• Automatic incremental updates</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Compact cache status indicator for headers/toolbars
 */
export function CacheStatusIndicator() {
  const { fromCache, transactions, isLoading } = useTransactionHistory()

  if (isLoading) {
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Syncing...
      </Badge>
    )
  }

  if (transactions.length === 0) {
    return null
  }

  return (
    <Badge variant={fromCache ? "secondary" : "default"} className="flex items-center gap-1">
      {fromCache ? (
        <WifiOff className="h-3 w-3" />
      ) : (
        <Wifi className="h-3 w-3" />
      )}
      {fromCache ? 'Cached' : 'Live'} ({transactions.length})
    </Badge>
  )
}