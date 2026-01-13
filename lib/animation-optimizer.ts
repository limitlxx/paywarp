/**
 * Animation Performance Optimizer
 * Optimizes animation performance during high transaction volumes
 * Requirements: 3.5, 4.5, 6.4
 */

import { useEffect, useRef, useCallback, useState } from 'react'

export interface AnimationConfig {
  duration: number
  easing: string
  fps: number
  priority: 'low' | 'medium' | 'high'
  canSkipFrames: boolean
  useGPU: boolean
}

export interface PerformanceMetrics {
  fps: number
  frameDrops: number
  averageFrameTime: number
  gpuMemoryUsage?: number
}

/**
 * Animation Performance Manager
 */
export class AnimationPerformanceManager {
  private activeAnimations = new Map<string, AnimationConfig>()
  private frameMetrics: number[] = []
  private lastFrameTime = 0
  private frameDropCount = 0
  private performanceLevel: 'low' | 'medium' | 'high' = 'high'
  private maxConcurrentAnimations = 10
  private animationQueue: Array<{ id: string; config: AnimationConfig; callback: () => void }> = []

  constructor() {
    this.detectPerformanceLevel()
    this.startPerformanceMonitoring()
  }

  /**
   * Detect device performance level
   */
  private detectPerformanceLevel() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      // Default to medium performance for SSR
      this.performanceLevel = 'medium'
      this.maxConcurrentAnimations = 8
      return
    }

    const hardwareConcurrency = navigator.hardwareConcurrency || 4
    const deviceMemory = (navigator as any)?.deviceMemory || 4

    if (hardwareConcurrency < 4 || deviceMemory < 2) {
      this.performanceLevel = 'low'
      this.maxConcurrentAnimations = 3
    } else if (hardwareConcurrency >= 8 && deviceMemory >= 8) {
      this.performanceLevel = 'high'
      this.maxConcurrentAnimations = 15
    } else {
      this.performanceLevel = 'medium'
      this.maxConcurrentAnimations = 8
    }
  }

  /**
   * Start monitoring animation performance
   */
  private startPerformanceMonitoring() {
    // Only start monitoring in browser environment
    if (typeof window === 'undefined' || typeof performance === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return
    }

    let frameCount = 0
    let lastTime = performance.now()

    const measureFrame = () => {
      const currentTime = performance.now()
      const frameTime = currentTime - this.lastFrameTime

      if (this.lastFrameTime > 0) {
        this.frameMetrics.push(frameTime)
        
        // Keep only recent metrics
        if (this.frameMetrics.length > 60) {
          this.frameMetrics = this.frameMetrics.slice(-60)
        }

        // Detect frame drops (> 16.67ms for 60fps)
        if (frameTime > 16.67) {
          this.frameDropCount++
        }
      }

      this.lastFrameTime = currentTime
      frameCount++

      // Calculate FPS every second
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime))
        this.adjustPerformanceLevel(fps)
        frameCount = 0
        lastTime = currentTime
      }

      requestAnimationFrame(measureFrame)
    }

    requestAnimationFrame(measureFrame)
  }

  /**
   * Adjust performance level based on current FPS
   */
  private adjustPerformanceLevel(fps: number) {
    if (fps < 30 && this.performanceLevel !== 'low') {
      this.performanceLevel = 'low'
      this.maxConcurrentAnimations = 3
      this.optimizeActiveAnimations()
    } else if (fps >= 50 && this.performanceLevel === 'low') {
      this.performanceLevel = 'medium'
      this.maxConcurrentAnimations = 8
    } else if (fps >= 58 && this.performanceLevel === 'medium') {
      this.performanceLevel = 'high'
      this.maxConcurrentAnimations = 15
    }
  }

  /**
   * Optimize active animations when performance drops
   */
  private optimizeActiveAnimations() {
    // Reduce animation quality for low-priority animations
    this.activeAnimations.forEach((config, id) => {
      if (config.priority === 'low') {
        config.fps = Math.min(config.fps, 30)
        config.canSkipFrames = true
      } else if (config.priority === 'medium') {
        config.fps = Math.min(config.fps, 45)
      }
    })
  }

  /**
   * Register an animation
   */
  registerAnimation(id: string, config: AnimationConfig): boolean {
    // Check if we can run the animation immediately
    if (this.activeAnimations.size < this.maxConcurrentAnimations) {
      this.activeAnimations.set(id, this.optimizeConfig(config))
      return true
    }

    // Queue low-priority animations
    if (config.priority === 'low') {
      this.animationQueue.push({ id, config, callback: () => {} })
      return false
    }

    // For high-priority animations, pause low-priority ones
    if (config.priority === 'high') {
      this.pauseLowPriorityAnimations()
      this.activeAnimations.set(id, this.optimizeConfig(config))
      return true
    }

    return false
  }

  /**
   * Unregister an animation
   */
  unregisterAnimation(id: string) {
    this.activeAnimations.delete(id)
    this.processQueue()
  }

  /**
   * Process queued animations
   */
  private processQueue() {
    while (this.animationQueue.length > 0 && this.activeAnimations.size < this.maxConcurrentAnimations) {
      const queued = this.animationQueue.shift()
      if (queued) {
        this.activeAnimations.set(queued.id, this.optimizeConfig(queued.config))
        queued.callback()
      }
    }
  }

  /**
   * Pause low-priority animations
   */
  private pauseLowPriorityAnimations() {
    const lowPriorityAnimations: string[] = []
    
    this.activeAnimations.forEach((config, id) => {
      if (config.priority === 'low') {
        lowPriorityAnimations.push(id)
      }
    })

    // Remove one low-priority animation to make room
    if (lowPriorityAnimations.length > 0) {
      const idToRemove = lowPriorityAnimations[0]
      this.activeAnimations.delete(idToRemove)
    }
  }

  /**
   * Optimize animation config based on performance level
   */
  private optimizeConfig(config: AnimationConfig): AnimationConfig {
    const optimized = { ...config }

    switch (this.performanceLevel) {
      case 'low':
        optimized.fps = Math.min(config.fps, 30)
        optimized.canSkipFrames = true
        optimized.useGPU = false
        if (config.priority === 'low') {
          optimized.duration = Math.min(config.duration, 200)
        }
        break
      case 'medium':
        optimized.fps = Math.min(config.fps, 45)
        optimized.canSkipFrames = config.priority === 'low'
        break
      case 'high':
        // No optimization needed
        break
    }

    return optimized
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const averageFrameTime = this.frameMetrics.length > 0
      ? this.frameMetrics.reduce((sum, time) => sum + time, 0) / this.frameMetrics.length
      : 0

    const fps = averageFrameTime > 0 ? 1000 / averageFrameTime : 60

    return {
      fps: Math.round(fps),
      frameDrops: this.frameDropCount,
      averageFrameTime,
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = []
    const metrics = this.getPerformanceMetrics()

    if (metrics.fps < 30) {
      recommendations.push('Consider reducing animation complexity')
      recommendations.push('Disable non-essential animations')
    }

    if (metrics.frameDrops > 10) {
      recommendations.push('Enable frame skipping for low-priority animations')
      recommendations.push('Reduce concurrent animation count')
    }

    if (this.activeAnimations.size > this.maxConcurrentAnimations) {
      recommendations.push('Too many concurrent animations - some will be queued')
    }

    return recommendations
  }

  /**
   * Clear all animations and reset metrics
   */
  clear() {
    this.activeAnimations.clear()
    this.animationQueue = []
    this.frameMetrics = []
    this.frameDropCount = 0
  }
}

// Global animation manager instance (lazy-loaded)
let _animationManager: AnimationPerformanceManager | null = null

export const getAnimationManager = (): AnimationPerformanceManager => {
  if (!_animationManager) {
    _animationManager = new AnimationPerformanceManager()
  }
  return _animationManager
}

/**
 * Hook for optimized animations
 */
export function useOptimizedAnimation(
  animationId: string,
  config: Partial<AnimationConfig> = {}
) {
  const [isActive, setIsActive] = useState(false)
  const [optimizedConfig, setOptimizedConfig] = useState<AnimationConfig | null>(null)

  const defaultConfig: AnimationConfig = {
    duration: 300,
    easing: 'ease-out',
    fps: 60,
    priority: 'medium',
    canSkipFrames: false,
    useGPU: true,
    ...config,
  }

  const startAnimation = useCallback(() => {
    const animationManager = getAnimationManager()
    const canStart = animationManager.registerAnimation(animationId, defaultConfig)
    setIsActive(canStart)
    
    if (canStart) {
      const optimized = animationManager['optimizeConfig'](defaultConfig)
      setOptimizedConfig(optimized)
    }

    return canStart
  }, [animationId, defaultConfig])

  const stopAnimation = useCallback(() => {
    const animationManager = getAnimationManager()
    animationManager.unregisterAnimation(animationId)
    setIsActive(false)
    setOptimizedConfig(null)
  }, [animationId])

  useEffect(() => {
    return () => {
      if (isActive) {
        stopAnimation()
      }
    }
  }, [isActive, stopAnimation])

  return {
    isActive,
    optimizedConfig,
    startAnimation,
    stopAnimation,
    performanceMetrics: getAnimationManager().getPerformanceMetrics(),
  }
}

/**
 * Hook for liquid fill animation optimization
 */
export function useOptimizedLiquidFill(percentage: number, color: string) {
  const animationId = `liquid-fill-${color}`
  const { isActive, optimizedConfig, startAnimation, stopAnimation } = useOptimizedAnimation(
    animationId,
    {
      duration: 800,
      priority: 'medium',
      canSkipFrames: true,
      useGPU: true,
    }
  )

  const [currentPercentage, setCurrentPercentage] = useState(percentage)
  const animationRef = useRef<number | undefined>()

  useEffect(() => {
    if (Math.abs(currentPercentage - percentage) > 0.1) {
      startAnimation()
      
      const startValue = currentPercentage
      const endValue = percentage
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const duration = optimizedConfig?.duration || 800

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Use optimized easing
        const easeProgress = optimizedConfig?.canSkipFrames && progress > 0.5 
          ? 1 // Skip to end if performance is low
          : 1 - Math.pow(1 - progress, 3) // Ease-out cubic

        const newValue = startValue + (endValue - startValue) * easeProgress
        setCurrentPercentage(newValue)

        if (progress < 1 && typeof requestAnimationFrame !== 'undefined') {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          stopAnimation()
        }
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        // Fallback for SSR
        setCurrentPercentage(percentage)
        stopAnimation()
      }
    }

    return () => {
      if (animationRef.current && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [percentage, currentPercentage, optimizedConfig, startAnimation, stopAnimation])

  return {
    currentPercentage,
    isAnimating: isActive,
    shouldUseGPU: optimizedConfig?.useGPU ?? true,
  }
}

/**
 * Hook for bubble animation optimization
 */
export function useOptimizedBubbles(active: boolean, type: string) {
  const animationId = `bubbles-${type}`
  const { isActive, optimizedConfig, startAnimation, stopAnimation } = useOptimizedAnimation(
    animationId,
    {
      duration: Infinity, // Continuous animation
      priority: 'low',
      canSkipFrames: true,
      useGPU: true,
    }
  )

  const [bubbleCount, setBubbleCount] = useState(0)

  useEffect(() => {
    if (active) {
      startAnimation()
      
      // Adjust bubble count based on performance
      const baseCount = 8
      let adjustedCount = baseCount

      if (optimizedConfig?.canSkipFrames) {
        adjustedCount = Math.max(3, Math.floor(baseCount * 0.5))
      }

      setBubbleCount(adjustedCount)
    } else {
      stopAnimation()
      setBubbleCount(0)
    }
  }, [active, optimizedConfig, startAnimation, stopAnimation])

  return {
    bubbleCount,
    isAnimating: isActive,
    shouldUseGPU: optimizedConfig?.useGPU ?? true,
    animationSpeed: optimizedConfig?.canSkipFrames ? 0.5 : 1,
  }
}

/**
 * Performance monitoring hook
 */
export function useAnimationPerformanceMonitoring() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(() => 
    getAnimationManager().getPerformanceMetrics()
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getAnimationManager().getPerformanceMetrics())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return {
    metrics,
    recommendations: getAnimationManager().getOptimizationRecommendations(),
    clearMetrics: () => getAnimationManager().clear(),
  }
}