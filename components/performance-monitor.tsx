"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Activity, Smartphone, Wifi, Zap, RefreshCw } from "lucide-react"
import { useMobileCapabilities, useMobilePerformanceMonitoring } from "@/lib/mobile-optimization"
import { useAnimationPerformanceMonitoring } from "@/lib/animation-optimizer"
import { useLoadingStore } from "@/lib/loading-state-manager"

interface PerformanceMonitorProps {
  showDetails?: boolean
  className?: string
}

export function PerformanceMonitor({ showDetails = false, className = "" }: PerformanceMonitorProps) {
  const capabilities = useMobileCapabilities()
  const { getPerformanceReport } = useMobilePerformanceMonitoring()
  const { metrics: animationMetrics, clearMetrics } = useAnimationPerformanceMonitoring()
  const { operations, globalLoading } = useLoadingStore()
  
  const [performanceReport, setPerformanceReport] = useState(() => getPerformanceReport())
  const [isVisible, setIsVisible] = useState(false)

  // Update performance report periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPerformanceReport(getPerformanceReport())
    }, 2000)

    return () => clearInterval(interval)
  }, [getPerformanceReport])

  // Only show in development or when explicitly requested
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development' || showDetails)
  }, [showDetails])

  if (!isVisible) return null

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getConnectionColor = (type: string) => {
    switch (type) {
      case 'fast': return 'text-green-400'
      case 'slow': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const activeOperations = Object.values(operations).filter(op => 
    op.status === 'pending' || op.status === 'processing'
  )

  return (
    <Card className={`glass border-purple-500/20 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Performance Monitor
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMetrics}
            className="ml-auto h-6 w-6 p-0"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Device Capabilities */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              Device
            </span>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`text-xs ${getPerformanceColor(capabilities.performanceLevel)} text-white border-0`}
              >
                {capabilities.performanceLevel}
              </Badge>
              <span className="text-muted-foreground">
                {capabilities.screenSize}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              Connection
            </span>
            <span className={getConnectionColor(capabilities.connectionType)}>
              {capabilities.connectionType}
            </span>
          </div>
        </div>

        {/* Animation Performance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Animation FPS
            </span>
            <span className={animationMetrics.fps >= 50 ? 'text-green-400' : 
                           animationMetrics.fps >= 30 ? 'text-yellow-400' : 'text-red-400'}>
              {animationMetrics.fps}
            </span>
          </div>
          
          <Progress 
            value={Math.min(100, (animationMetrics.fps / 60) * 100)} 
            className="h-1"
          />
          
          {animationMetrics.frameDrops > 0 && (
            <div className="text-xs text-red-400">
              {animationMetrics.frameDrops} frame drops
            </div>
          )}
        </div>

        {/* Active Operations */}
        {activeOperations.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium">Active Operations</div>
            {activeOperations.slice(0, 3).map((operation) => (
              <div key={operation.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{operation.description}</span>
                  <Badge variant="outline" className="text-xs">
                    {operation.status}
                  </Badge>
                </div>
                <Progress value={operation.progress} className="h-1" />
              </div>
            ))}
            {activeOperations.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{activeOperations.length - 3} more operations
              </div>
            )}
          </div>
        )}

        {/* Performance Metrics */}
        {showDetails && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="text-xs font-medium">Detailed Metrics</div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Avg Render</div>
                <div>{performanceReport.averageRenderTime.toFixed(1)}ms</div>
              </div>
              <div>
                <div className="text-muted-foreground">Avg Touch</div>
                <div>{performanceReport.averageTouchResponseTime.toFixed(1)}ms</div>
              </div>
              <div>
                <div className="text-muted-foreground">Avg Network</div>
                <div>{performanceReport.averageNetworkRequestTime.toFixed(1)}ms</div>
              </div>
              <div>
                <div className="text-muted-foreground">Memory</div>
                <div>{(performanceReport.currentMemoryUsage / 1024 / 1024).toFixed(1)}MB</div>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Total: {performanceReport.totalMetrics.renders} renders, 
              {performanceReport.totalMetrics.touches} touches, 
              {performanceReport.totalMetrics.networkRequests} requests
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Floating performance indicator for development
 */
export function FloatingPerformanceIndicator() {
  const capabilities = useMobileCapabilities()
  const { metrics } = useAnimationPerformanceMonitoring()
  const { globalLoading } = useLoadingStore()
  
  if (process.env.NODE_ENV !== 'development') return null

  const getStatusColor = () => {
    if (globalLoading) return 'bg-blue-500'
    if (metrics.fps < 30) return 'bg-red-500'
    if (metrics.fps < 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span>{capabilities.performanceLevel}</span>
        <span>{metrics.fps}fps</span>
        {globalLoading && <span>Loading...</span>}
      </div>
    </div>
  )
}