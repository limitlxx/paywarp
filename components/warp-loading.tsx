"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { useLoadingStore } from "@/lib/loading-state-manager"

interface WarpLoadingProps {
  children: React.ReactNode
}

export function WarpLoading({ children }: WarpLoadingProps) {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const [previousPath, setPreviousPath] = useState(pathname)
  const { globalLoading } = useLoadingStore()

  useEffect(() => {
    if (pathname !== previousPath) {
      setIsNavigating(true)
      setPreviousPath(pathname)
      
      // Reset navigation state after animation
      const timer = setTimeout(() => {
        setIsNavigating(false)
      }, 800)
      
      return () => clearTimeout(timer)
    }
  }, [pathname, previousPath])

  const showWarp = isNavigating || globalLoading

  return (
    <>
      <AnimatePresence mode="wait">
        {showWarp && (
          <motion.div
            key="warp-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <WarpEffect />
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div
        key={pathname}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ 
          duration: 0.4,
          ease: [0.25, 0.46, 0.45, 0.94]
        }}
      >
        {children}
      </motion.div>
    </>
  )
}

function WarpEffect() {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer warp rings */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-purple-500/30"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ 
          scale: [0.5, 1.2, 0.5],
          opacity: [0, 0.8, 0],
          rotate: [0, 180, 360]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute inset-4 rounded-full border-2 border-blue-500/40"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
          scale: [0.8, 1.1, 0.8],
          opacity: [0, 0.6, 0],
          rotate: [360, 180, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3
        }}
      />
      
      <motion.div
        className="absolute inset-8 rounded-full border-2 border-cyan-500/50"
        initial={{ scale: 1, opacity: 0 }}
        animate={{ 
          scale: [1, 0.9, 1],
          opacity: [0, 0.4, 0],
          rotate: [0, -180, -360]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.6
        }}
      />

      {/* Central warp core */}
      <motion.div
        className="relative w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500"
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 360],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <motion.div
          className="absolute inset-2 rounded-full bg-black/50 backdrop-blur-sm"
          animate={{
            scale: [1, 0.8, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Inner glow */}
        <motion.div
          className="absolute inset-4 rounded-full bg-white/80"
          animate={{
            opacity: [0.8, 0.3, 0.8],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>

      {/* Warp particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{
            left: "50%",
            top: "50%",
          }}
          animate={{
            x: [0, Math.cos(i * 30 * Math.PI / 180) * 100],
            y: [0, Math.sin(i * 30 * Math.PI / 180) * 100],
            opacity: [1, 0],
            scale: [1, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 0.1,
          }}
        />
      ))}

      {/* Loading text */}
      <motion.div
        className="absolute -bottom-16 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <motion.p
          className="text-sm text-purple-300 font-medium tracking-wider"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          WARPING...
        </motion.p>
      </motion.div>
    </div>
  )
}