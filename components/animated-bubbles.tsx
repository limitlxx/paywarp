"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, TrendingUp, CheckCircle2, X, Sparkles } from "lucide-react"

interface YieldBubblesProps {
  active?: boolean
  type?: "default" | "lightning" | "compounding" | "milestone" | "neutral" | "expense"
  color?: string
}

export function YieldBubbles({ active = false, type = "default", color }: YieldBubblesProps) {
  const [bubbles, setBubbles] = useState<{ id: number; x: number; size: number; icon?: any }[]>([])

  useEffect(() => {
    if (!active) {
      setBubbles([])
      return
    }

    // <CHANGE> Added expense bubble type with icon mapping
    const interval = setInterval(
      () => {
        let icon = undefined
        if (type === "lightning") icon = Zap
        if (type === "compounding") icon = TrendingUp
        if (type === "milestone") icon = CheckCircle2
        if (type === "expense") icon = X

        setBubbles((prev) => [
          ...prev.slice(-15),
          {
            id: Date.now(),
            x: Math.random() * 100,
            size: type === "lightning" ? 12 : type === "expense" ? 14 : Math.random() * 6 + 4,
            icon,
          },
        ])
      },
      type === "lightning" ? 600 : type === "expense" ? 800 : 400,
    )
    return () => clearInterval(interval)
  }, [active, type])

  // <CHANGE> Custom animation variants for different bubble types
  const getAnimationVariant = () => {
    switch (type) {
      case "expense":
        return {
          initial: { y: "110%", opacity: 0, scale: 1 },
          animate: { y: ["110%", "50%", "50%"], opacity: [0, 1, 0], scale: [1, 1.2, 0] },
          duration: 2,
        }
      case "milestone":
        return {
          initial: { y: "110%", opacity: 0, scale: 0.5, rotate: 0 },
          animate: { y: "-10%", opacity: [0, 0.8, 0], scale: [0.5, 1.5, 0], rotate: 360 },
          duration: 2.5,
        }
      case "lightning":
        return {
          initial: { y: "110%", opacity: 0, scale: 0.5 },
          animate: { y: "-10%", opacity: [0, 0.8, 0], scale: 1 },
          duration: 1.5,
        }
      case "compounding":
        return {
          initial: { y: "110%", opacity: 0, scale: 0.8, x: 0 },
          animate: { y: "-10%", opacity: [0, 0.7, 0], scale: 1.1, x: [0, 5, -5, 0] },
          duration: 3.5,
        }
      default:
        return {
          initial: { y: "110%", opacity: 0, scale: 0.5 },
          animate: { y: "-10%", opacity: [0, 0.6, 0], scale: 1 },
          duration: 3,
        }
    }
  }

  const variant = getAnimationVariant()

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <AnimatePresence>
        {bubbles.map((bubble) => (
          <motion.div
            key={bubble.id}
            initial={variant.initial}
            animate={variant.animate}
            exit={{ opacity: 0 }}
            transition={{
              duration: variant.duration,
              ease: type === "lightning" ? "easeIn" : type === "expense" ? "easeOut" : "linear",
            }}
            className={`absolute flex items-center justify-center rounded-full ${
              type === "neutral" ? "bg-white/10" : type === "expense" ? "bg-red-500/30" : "bg-current/20"
            } ${type === "expense" ? "blur-[0.5px]" : "blur-[1px]"}`}
            style={{
              left: `${bubble.x}%`,
              width: bubble.size,
              height: bubble.size,
              color: color || (type === "lightning" ? "#10b981" : type === "expense" ? "#ef4444" : "#4ade80"),
            }}
          >
            {bubble.icon && <bubble.icon className="w-full h-full p-0.5 opacity-60" />}
            {/* <CHANGE> Add confetti sparkles for milestone bubbles */}
            {type === "milestone" && (
              <Sparkles className="absolute w-full h-full p-1 opacity-80 animate-spin" style={{ color: "#4ade80" }} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function AnimatedBubbles() {
  return <YieldBubbles active={true} />
}
