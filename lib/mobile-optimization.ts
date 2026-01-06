/**
 * Mobile Optimization Utilities
 * Optimizes performance and user experience for mobile Web3 usage
 * Requirements: 3.5, 4.5, 6.4
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { debounce, throttle } from 'lodash-es'

/**
 * Mobile device detection and capabilities
 */
export interface MobileCapabilities {
  isMobile: boolean
  isTablet: boolean
  isIOS: boolean
  isAndroid: boolean
  hasTouch: boolean
  screenSize: 'small' | 'medium' | 'large'
  connectionType: 'slow' | 'fast' | 'unknown'
  memoryLevel: 'low' | 'medium' | 'high'
  performanceLevel: 'low' | 'medium' | 'high'
}

/**
 * Detect mobile capabilities
 */
export function detectMobileCapabilities(): MobileCapabilities {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined'
  
  const userAgent = isBrowser ? navigator.userAgent : ''
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent)
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isAndroid = /Android/.test(userAgent)
  const hasTouch = isBrowser && 'ontouchstart' in window

  // Screen size detection
  const screenWidth = isBrowser ? window.innerWidth : 1920
  let screenSize: 'small' | 'medium' | 'large' = 'large'
  if (screenWidth < 640) screenSize = 'small'
  else if (screenWidth < 1024) screenSize = 'medium'

  // Connection type estimation
  const connection = isBrowser ? (navigator as any)?.connection : null
  let connectionType: 'slow' | 'fast' | 'unknown' = 'unknown'
  if (connection) {
    const effectiveType = connection.effectiveType
    connectionType = ['slow-2g', '2g', '3g'].includes(effectiveType) ? 'slow' : 'fast'
  }

  // Memory level estimation
  const deviceMemory = isBrowser ? (navigator as any)?.deviceMemory || 4 : 4
  let memoryLevel: 'low' | 'medium' | 'high' = 'medium'
  if (deviceMemory < 2) memoryLevel = 'low'
  else if (deviceMemory >= 8) memoryLevel = 'high'

  // Performance level estimation
  const hardwareConcurrency = isBrowser ? navigator.hardwareConcurrency || 4 : 4
  let performanceLevel: 'low' | 'medium' | 'high' = 'medium'
  if (hardwareConcurrency < 4 || memoryLevel === 'low') performanceLevel = 'low'
  else if (hardwareConcurrency >= 8 && memoryLevel === 'high') performanceLevel = 'high'

  return {
    isMobile,
    isTablet,
    isIOS,
    isAndroid,
    hasTouch,
    screenSize,
    connectionType,
    memoryLevel,
    performanceLevel,
  }
}

/**
 * Hook for mobile capabilities
 */
export function useMobileCapabilities() {
  const [capabilities, setCapabilities] = useState<MobileCapabilities>(() => {
    // Return default values during SSR
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isIOS: false,
        isAndroid: false,
        hasTouch: false,
        screenSize: 'large',
        connectionType: 'unknown',
        memoryLevel: 'medium',
        performanceLevel: 'medium',
      }
    }
    return detectMobileCapabilities()
  })

  useEffect(() => {
    // Update capabilities on client-side hydration
    setCapabilities(detectMobileCapabilities())

    const handleResize = debounce(() => {
      setCapabilities(detectMobileCapabilities())
    }, 250)

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return capabilities
}

/**
 * Mobile-optimized animation configuration
 */
export function getMobileAnimationConfig(capabilities: MobileCapabilities) {
  const baseConfig = {
    duration: 300,
    easing: 'ease-out',
    reducedMotion: false,
  }

  // Reduce animations on low-performance devices
  if (capabilities.performanceLevel === 'low') {
    return {
      ...baseConfig,
      duration: 150,
      reducedMotion: true,
    }
  }

  // Optimize for mobile screens
  if (capabilities.isMobile) {
    return {
      ...baseConfig,
      duration: 250,
      easing: 'ease-in-out',
    }
  }

  return baseConfig
}

/**
 * Touch interaction optimization
 */
export class TouchOptimizer {
  private touchStartTime = 0
  private touchStartPosition = { x: 0, y: 0 }
  private isScrolling = false

  constructor(private element: HTMLElement) {
    this.setupTouchHandlers()
  }

  private setupTouchHandlers() {
    // Passive touch listeners for better performance
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: true })
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: true })
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: true })
  }

  private handleTouchStart = (event: TouchEvent) => {
    this.touchStartTime = performance.now()
    const touch = event.touches[0]
    this.touchStartPosition = { x: touch.clientX, y: touch.clientY }
    this.isScrolling = false

    // Add visual feedback
    this.element.style.transform = 'scale(0.98)'
    this.element.style.transition = 'transform 0.1s ease-out'
  }

  private handleTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    const deltaX = Math.abs(touch.clientX - this.touchStartPosition.x)
    const deltaY = Math.abs(touch.clientY - this.touchStartPosition.y)

    // Detect if user is scrolling
    if (deltaY > 10 || deltaX > 10) {
      this.isScrolling = true
      this.element.style.transform = 'scale(1)'
    }
  }

  private handleTouchEnd = (event: TouchEvent) => {
    const touchDuration = performance.now() - this.touchStartTime
    
    // Reset visual feedback
    this.element.style.transform = 'scale(1)'
    
    // Only trigger action if it was a tap (not scroll) and quick
    if (!this.isScrolling && touchDuration < 300) {
      // Dispatch optimized touch event
      this.element.dispatchEvent(new CustomEvent('optimizedTap', {
        detail: { duration: touchDuration }
      }))
    }
  }

  destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStart)
    this.element.removeEventListener('touchmove', this.handleTouchMove)
    this.element.removeEventListener('touchend', this.handleTouchEnd)
  }
}

/**
 * Hook for optimized touch interactions
 */
export function useOptimizedTouch(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!ref.current) return

    const optimizer = new TouchOptimizer(ref.current)
    return () => optimizer.destroy()
  }, [ref])
}

/**
 * Mobile-optimized rendering strategies
 */
export class MobileRenderOptimizer {
  private intersectionObserver?: IntersectionObserver
  private visibleElements = new Set<Element>()

  constructor(private capabilities: MobileCapabilities) {
    this.setupIntersectionObserver()
  }

  private setupIntersectionObserver() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

    // Use larger root margin on mobile for better perceived performance
    const rootMargin = this.capabilities.isMobile ? '50px' : '20px'

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.visibleElements.add(entry.target)
            entry.target.dispatchEvent(new CustomEvent('enterViewport'))
          } else {
            this.visibleElements.delete(entry.target)
            entry.target.dispatchEvent(new CustomEvent('exitViewport'))
          }
        })
      },
      { rootMargin, threshold: 0.1 }
    )
  }

  observeElement(element: Element) {
    this.intersectionObserver?.observe(element)
  }

  unobserveElement(element: Element) {
    this.intersectionObserver?.unobserve(element)
    this.visibleElements.delete(element)
  }

  isElementVisible(element: Element): boolean {
    return this.visibleElements.has(element)
  }

  getVisibleElementCount(): number {
    return this.visibleElements.size
  }

  destroy() {
    this.intersectionObserver?.disconnect()
    this.visibleElements.clear()
  }
}

/**
 * Hook for mobile render optimization
 */
export function useMobileRenderOptimization() {
  const capabilities = useMobileCapabilities()
  const [optimizer] = useState(() => new MobileRenderOptimizer(capabilities))

  useEffect(() => {
    return () => optimizer.destroy()
  }, [optimizer])

  const observeElement = useCallback((element: Element | null) => {
    if (element) {
      optimizer.observeElement(element)
    }
  }, [optimizer])

  const unobserveElement = useCallback((element: Element | null) => {
    if (element) {
      optimizer.unobserveElement(element)
    }
  }, [optimizer])

  return {
    observeElement,
    unobserveElement,
    isElementVisible: optimizer.isElementVisible.bind(optimizer),
    getVisibleElementCount: optimizer.getVisibleElementCount.bind(optimizer),
  }
}

/**
 * Mobile-optimized data fetching
 */
export function useMobileOptimizedFetch<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = [],
  options: {
    throttleMs?: number
    cacheTime?: number
    retryOnSlowConnection?: boolean
  } = {}
) {
  const capabilities = useMobileCapabilities()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const {
    throttleMs = capabilities.connectionType === 'slow' ? 2000 : 1000,
    cacheTime = capabilities.connectionType === 'slow' ? 60000 : 30000,
    retryOnSlowConnection = true,
  } = options

  // Throttle fetch function based on connection speed
  const throttledFetch = useMemo(
    () => throttle(async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await fetchFn()
        setData(result)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Fetch failed')
        setError(error)

        // Retry on slow connections
        if (retryOnSlowConnection && capabilities.connectionType === 'slow') {
          setTimeout(() => {
            throttledFetch()
          }, 5000)
        }
      } finally {
        setLoading(false)
      }
    }, throttleMs),
    [fetchFn, throttleMs, retryOnSlowConnection, capabilities.connectionType]
  )

  useEffect(() => {
    throttledFetch()
  }, dependencies)

  return { data, loading, error, refetch: throttledFetch }
}

/**
 * Mobile performance monitoring
 */
export class MobilePerformanceMonitor {
  private metrics: {
    renderTimes: number[]
    touchResponseTimes: number[]
    networkRequestTimes: number[]
    memoryUsage: number[]
  } = {
    renderTimes: [],
    touchResponseTimes: [],
    networkRequestTimes: [],
    memoryUsage: [],
  }

  recordRenderTime(time: number) {
    this.metrics.renderTimes.push(time)
    this.keepRecentMetrics('renderTimes')
  }

  recordTouchResponseTime(time: number) {
    this.metrics.touchResponseTimes.push(time)
    this.keepRecentMetrics('touchResponseTimes')
  }

  recordNetworkRequestTime(time: number) {
    this.metrics.networkRequestTimes.push(time)
    this.keepRecentMetrics('networkRequestTimes')
  }

  recordMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage.push(memory.usedJSHeapSize)
      this.keepRecentMetrics('memoryUsage')
    }
  }

  private keepRecentMetrics(key: keyof typeof this.metrics, maxCount = 100) {
    if (this.metrics[key].length > maxCount) {
      this.metrics[key] = this.metrics[key].slice(-maxCount)
    }
  }

  getAverageRenderTime(): number {
    return this.getAverage(this.metrics.renderTimes)
  }

  getAverageTouchResponseTime(): number {
    return this.getAverage(this.metrics.touchResponseTimes)
  }

  getAverageNetworkRequestTime(): number {
    return this.getAverage(this.metrics.networkRequestTimes)
  }

  getCurrentMemoryUsage(): number {
    return this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] || 0
  }

  private getAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  getPerformanceReport() {
    return {
      averageRenderTime: this.getAverageRenderTime(),
      averageTouchResponseTime: this.getAverageTouchResponseTime(),
      averageNetworkRequestTime: this.getAverageNetworkRequestTime(),
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      totalMetrics: {
        renders: this.metrics.renderTimes.length,
        touches: this.metrics.touchResponseTimes.length,
        networkRequests: this.metrics.networkRequestTimes.length,
        memorySnapshots: this.metrics.memoryUsage.length,
      },
    }
  }

  clear() {
    this.metrics = {
      renderTimes: [],
      touchResponseTimes: [],
      networkRequestTimes: [],
      memoryUsage: [],
    }
  }
}

export const mobilePerformanceMonitor = new MobilePerformanceMonitor()

/**
 * Hook for mobile performance monitoring
 */
export function useMobilePerformanceMonitoring() {
  useEffect(() => {
    // Monitor memory usage periodically
    const memoryInterval = setInterval(() => {
      mobilePerformanceMonitor.recordMemoryUsage()
    }, 10000) // Every 10 seconds

    return () => clearInterval(memoryInterval)
  }, [])

  return {
    recordRenderTime: mobilePerformanceMonitor.recordRenderTime.bind(mobilePerformanceMonitor),
    recordTouchResponseTime: mobilePerformanceMonitor.recordTouchResponseTime.bind(mobilePerformanceMonitor),
    recordNetworkRequestTime: mobilePerformanceMonitor.recordNetworkRequestTime.bind(mobilePerformanceMonitor),
    getPerformanceReport: mobilePerformanceMonitor.getPerformanceReport.bind(mobilePerformanceMonitor),
  }
}