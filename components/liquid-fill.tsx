"use client"

import { motion } from "framer-motion"

interface LiquidFillProps {
  percentage: number
  color?: string
  className?: string
  size?: number
  variant?: "normal" | "swirling" | "fast-flow" | "clear" | "rising"
}

export function LiquidFill({ percentage, color = "#A100FF", className = "", variant = "normal" }: LiquidFillProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  // <CHANGE> Added different background patterns for each variant
  const getBackgroundStyle = () => {
    switch (variant) {
      case "swirling":
        return `radial-gradient(circle at 30% 50%, ${color}dd 0%, ${color} 50%, ${color}cc 100%)`
      case "rising":
        return `linear-gradient(to top, ${color} 0%, ${color}dd 70%, ${color}aa 100%)`
      case "clear":
        return `${color}40`
      default:
        return color
    }
  }

  return (
    <div className={`relative overflow-hidden bg-white/5 h-full w-full ${className}`}>
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        initial={{ height: 0 }}
        animate={{ height: `${clampedPercentage}%` }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        style={{
          background: getBackgroundStyle(),
        }}
      >
        {/* <CHANGE> Enhanced wave animation based on variant */}
        <div className={`absolute top-0 left-0 w-[200%] ${variant === "fast-flow" ? "h-16" : "h-12"} -translate-y-1/2`}>
          <svg
            className={`w-full h-full fill-current ${variant === "clear" ? "opacity-20" : "opacity-50"} ${
              variant === "fast-flow" ? "animate-wave-fast" : variant === "swirling" ? "animate-wave-slow" : "animate-wave"
            }`}
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            style={{ color }}
          >
            <path d="M0 10 Q 25 20 50 10 T 100 10 V 20 H 0 Z" />
          </svg>
        </div>
      </motion.div>
    </div>
  )
}

export function CircularLiquidFill({
  percentage,
  color = "#A100FF",
  size = 80,
  className = "",
  variant = "normal",
}: LiquidFillProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  // <CHANGE> Color-specific background for circular fills
  const getBackgroundStyle = () => {
    switch (variant) {
      case "swirling":
        return `radial-gradient(circle at center, ${color}dd 0%, ${color} 100%)`
      case "clear":
        return `${color}30`
      default:
        return color
    }
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-white/5 border border-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        initial={{ height: 0 }}
        animate={{ height: `${clampedPercentage}%` }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        style={{ background: getBackgroundStyle() }}
      >
        {/* <CHANGE> Wave animation adapts to variant */}
        <div className="absolute top-0 left-0 w-[200%] h-4 -translate-y-1/2">
          <svg
            className={`w-full h-full fill-current opacity-40 ${
              variant === "swirling" ? "animate-pulse" : "animate-wave-slow"
            }`}
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            style={{ color }}
          >
            <path d="M0 10 Q 25 0 50 10 T 100 10 V 20 H 0 Z" />
          </svg>
        </div>
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white z-10">{Math.round(clampedPercentage)}%</span>
      </div>
    </div>
  )
}
