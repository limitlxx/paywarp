"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { AnimatedBubbles } from "@/components/animated-bubbles"
import { Button } from "@/components/ui/button"
import { RadarScanner } from "@/components/radar-scanner"

export function OnboardingFlow() {
  const { isConnected, connect } = useWallet()
  const [step, setStep] = useState<"landing" | "syncing" | "warp">("landing")
  const [logs, setLogs] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    if (isConnected && step === "landing") {
      setStep("syncing")
    }
  }, [isConnected, step])

  useEffect(() => {
    if (step === "syncing") {
      setLogs([])
      const logSequence = [
        "> Accessing blockchain data...",
        "> Analyzing wallet activity...",
        "> Syncing with Mantle L2...",
        "> Generating dashboard report...",
      ]

      logSequence.forEach((log, i) => {
        setTimeout(() => {
          setLogs((prev) => [...prev, log])
          if (i === logSequence.length - 1) {
            setTimeout(() => setStep("warp"), 1000)
          }
        }, i * 800)
      })
    }
  }, [step])

  useEffect(() => {
    if (step === "warp") {
      const warpTimer = setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
      return () => clearTimeout(warpTimer)
    }
  }, [step, router])

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-black overflow-hidden grid-background">
      <AnimatePresence mode="wait">
        {step === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="z-10 text-center px-4 w-full max-w-xl flex flex-col items-center"
          >
            <h1 className="text-8xl font-bold mb-4 tracking-tighter bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
              PayWarp
            </h1>
            <p className="text-xl text-zinc-400 mb-10 max-w-md mx-auto leading-relaxed text-balance">
              Get deep insight on your Mantle transactions. <br />
              Unwrap your blockchain story.
            </p>

            <div className="relative glass-card p-2 rounded-[32px] border border-white/5 bg-white/[0.02] backdrop-blur-3xl shadow-2xl w-full max-w-md">
              <div className="p-6 space-y-4">
                <Button
                  size="lg"
                  onClick={async () => {
                    await connect()
                  }}
                  className="w-full bg-gradient-to-r from-[#4A3AFF] to-[#E01EAD] hover:opacity-90 text-white h-14 rounded-2xl text-lg font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_8px_32px_rgba(74,58,255,0.25)]"
                >
                  Get Started →
                </Button>
              </div>
            </div>

            <div className="mt-12 flex items-center justify-center gap-3 text-zinc-400 text-sm font-medium">
              <span className="w-1 h-1 bg-[#5E4DFF] rounded-full" />
              Mantle L2
              <span className="w-1 h-1 bg-[#E01EAD] rounded-full" />
            </div>

            <div className="mt-10 flex flex-col items-center gap-8">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                Powered by
                <div className="flex items-center gap-1.5 text-white font-bold tracking-tight uppercase">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-black" />
                  </div>
                  Mantle
                </div>
              </div>

              <div className="text-[10px] text-zinc-600 font-medium tracking-wide">
                built with ☕ by <span className="underline underline-offset-4 decoration-zinc-800">Limitlxx</span>
              </div>
            </div>
          </motion.div>
        )}

        {step === "syncing" && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="z-10 flex flex-col items-center"
          >
            <RadarScanner />
            <div className="mt-8 text-center">
              <h2 className="text-emerald-400 font-mono text-2xl tracking-[0.2em] font-bold text-glow-neon uppercase">
                Initialising Sync
              </h2>
              <div className="flex gap-1 mt-2 justify-center">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, delay: i * 0.2 }}
                    className="w-2 h-2 bg-emerald-400 rounded-full blur-[1px]"
                  />
                ))}
              </div>
            </div>

            <div className="mt-12 w-64 font-mono text-xs text-emerald-500/70 space-y-2">
              {logs.map((log, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="whitespace-nowrap"
                >
                  {log}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}

        {step === "warp" && (
          <motion.div
            key="warp"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="z-50 fixed inset-0 bg-black pointer-events-none"
          >
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 50 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: "50%",
                    y: "50%",
                    scale: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: `${Math.random() * 100}%`,
                    y: `${Math.random() * 100}%`,
                    scale: 2,
                    opacity: 0,
                  }}
                  transition={{
                    duration: 1.5,
                    ease: "easeIn",
                    repeat: Number.POSITIVE_INFINITY,
                    delay: Math.random() * 0.5,
                  }}
                  className="absolute w-1 h-1 bg-violet-500 rounded-full blur-[1px]"
                />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.h2
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                className="text-4xl font-bold tracking-[1em] text-white"
              >
                PAYWARP
              </motion.h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <AnimatedBubbles count={15} />
      </div>
    </div>
  )
}
