"use client"

import { motion } from "framer-motion"

export function RadarScanner() {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Outer Circle */}
      <div className="absolute inset-0 border border-emerald-500/20 rounded-full" />
      <div className="absolute inset-4 border border-emerald-500/30 rounded-full" />
      <div className="absolute inset-12 border border-emerald-500/40 rounded-full" />

      {/* Crosshair */}
      <div className="absolute h-full w-[1px] bg-emerald-500/20" />
      <div className="absolute w-full h-[1px] bg-emerald-500/20" />

      {/* Rotating Sweep */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        className="absolute inset-0 origin-center"
      >
        <div
          className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(16, 185, 129, 0.4) 360deg)",
            transform: "rotate(-90deg)",
          }}
        />
        <div className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
      </motion.div>

      {/* Random Blips */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 1.3,
          }}
          className="absolute w-2 h-2 bg-emerald-400 rounded-full blur-[2px]"
          style={{
            top: `${20 + Math.random() * 60}%`,
            left: `${20 + Math.random() * 60}%`,
          }}
        />
      ))}
    </div>
  )
}
