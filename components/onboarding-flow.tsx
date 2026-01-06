"use client"

import { useState, useEffect, useCallback } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useWrappedReports } from "@/hooks/use-wrapped-reports"
import { useUserRegistration } from "@/lib/user-registration"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { AnimatedBubbles } from "@/components/animated-bubbles"
import { Button } from "@/components/ui/button"
import { RadarScanner } from "@/components/radar-scanner"
import { CommunityStats, UserRegistration } from "@/components/user-registration"
import WrappedReportViewer from "@/components/wrapped-report-viewer"
import { X, ArrowRight, SkipForward } from "lucide-react"

// Preference storage utilities
const WRAPPED_PREFERENCE_KEY = 'paywarp-show-wrapped-onboarding'
const WRAPPED_VIEWED_KEY = 'paywarp-wrapped-viewed'

const getWrappedPreference = (): boolean => {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(WRAPPED_PREFERENCE_KEY)
  return stored !== 'false' // Default to true, only false if explicitly set
}

const setWrappedPreference = (show: boolean): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(WRAPPED_PREFERENCE_KEY, show.toString())
}

const getWrappedViewed = (address: string): boolean => {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem(`${WRAPPED_VIEWED_KEY}-${address}`)
  return stored === 'true'
}

const setWrappedViewed = (address: string): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${WRAPPED_VIEWED_KEY}-${address}`, 'true')
}

export function OnboardingFlow() {
  const { isConnected, connect, address, isHistoryLoading, syncHistory } = useWallet()
  const { hasActivity, isLoading: isWrappedLoading, reports, currentReport, generateReports } = useWrappedReports()
  const { isRegistered, refetchRegistrationStatus } = useUserRegistration()
  const [step, setStep] = useState<"landing" | "registration" | "syncing" | "wrapped" | "warp">("landing")
  const [logs, setLogs] = useState<string[]>([])
  const [showWrappedViewer, setShowWrappedViewer] = useState(false)
  const [syncComplete, setSyncComplete] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  // Check if user should see wrapped display
  const shouldShowWrapped = useCallback(() => {
    if (!address || !hasActivity) return false
    
    const preference = getWrappedPreference()
    const hasViewed = getWrappedViewed(address)
    
    return preference && !hasViewed
  }, [address, hasActivity])

  // Check authentication status when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      // Refetch registration status to get latest data
      refetchRegistrationStatus()
    }
  }, [isConnected, address, refetchRegistrationStatus])

  // Handle wallet connection - check registration status
  useEffect(() => {
    if (isConnected && step === "landing") {
      if (isRegistered) {
        // User is already registered, mark as authenticated and start syncing
        setIsAuthenticated(true)
        setStep("syncing")
      } else {
        // User needs to register
        setStep("registration")
      }
    }
  }, [isConnected, step, isRegistered])

  // Handle successful registration - move to syncing
  const handleRegistrationComplete = useCallback(() => {
    setIsAuthenticated(true)
    setStep("syncing")
  }, [])

  // Handle sync process - only start when authenticated
  useEffect(() => {
    if (step === "syncing" && isAuthenticated && address) {
      setLogs([])
      setSyncComplete(false)
      
      const logSequence = [
        "> Accessing blockchain data...",
        "> Verifying registration status...",
        "> Analyzing wallet activity...",
        "> Syncing with Mantle L2...",
        "> Generating historical reports...",
        "> Preparing dashboard...",
      ]

      // Start the actual data sync
      syncHistory()

      logSequence.forEach((log, i) => {
        setTimeout(() => {
          setLogs((prev) => [...prev, log])
          if (i === logSequence.length - 1) {
            // Wait a bit more for sync to complete
            setTimeout(() => {
              setSyncComplete(true)
            }, 1500)
          }
        }, i * 800)
      })
    }
  }, [step, isAuthenticated, address, syncHistory])

  // Handle post-sync navigation - wait for all data to load
  useEffect(() => {
    if (syncComplete && !isHistoryLoading && !isWrappedLoading && isAuthenticated) {
      // Generate wrapped reports after sync is complete
      generateReports()
      
      // Add a delay to ensure all data is loaded
      const navigationTimer = setTimeout(() => {
        if (shouldShowWrapped()) {
          setStep("wrapped")
        } else {
          setStep("warp")
        }
      }, 1000)
      
      return () => clearTimeout(navigationTimer)
    }
  }, [syncComplete, isHistoryLoading, isWrappedLoading, shouldShowWrapped, isAuthenticated, generateReports])

  // Handle final navigation to dashboard
  useEffect(() => {
    if (step === "warp") {
      const warpTimer = setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
      return () => clearTimeout(warpTimer)
    }
  }, [step, router])

  // Handle wrapped viewing completion
  const handleWrappedComplete = useCallback(() => {
    if (address) {
      setWrappedViewed(address)
    }
    setStep("warp")
  }, [address])

  // Handle skip wrapped
  const handleSkipWrapped = useCallback(() => {
    if (address) {
      setWrappedViewed(address)
      setWrappedPreference(false) // Remember user preference
    }
    setStep("warp")
  }, [address])

  // Handle wrapped viewer toggle
  const toggleWrappedViewer = useCallback(() => {
    setShowWrappedViewer(!showWrappedViewer)
  }, [showWrappedViewer])

  const onboardingContent = (
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
                  Open App →
                </Button>
                
                {/* Community Stats */}
                <div className="flex justify-center pt-2">
                  <CommunityStats />
                </div>
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

        {step === "registration" && (
          <motion.div
            key="registration"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="z-10 flex flex-col items-center justify-center w-full max-w-md"
          >
            <UserRegistration
              onRegistrationComplete={handleRegistrationComplete}
              showCommunityStats={true}
            />
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

        {step === "wrapped" && (
          <motion.div
            key="wrapped"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="z-10 w-full h-full flex flex-col items-center justify-center relative"
          >
            {/* Wrapped Introduction */}
            <div className="text-center mb-8 px-4">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-black text-white mb-4 tracking-tighter"
              >
                Your Blockchain Story
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-zinc-400 text-lg max-w-md mx-auto"
              >
                We found {reports.length} year{reports.length !== 1 ? 's' : ''} of activity. 
                Ready to see your wrapped?
              </motion.p>
            </div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
              <Button
                onClick={toggleWrappedViewer}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-6 h-auto rounded-2xl text-lg font-bold flex items-center gap-3 shadow-2xl shadow-purple-500/40"
              >
                <ArrowRight className="w-5 h-5" />
                View My Wrapped
              </Button>
              
              <Button
                onClick={handleSkipWrapped}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5 px-8 py-6 h-auto rounded-2xl text-lg font-bold flex items-center gap-3"
              >
                <SkipForward className="w-5 h-5" />
                Skip for Now
              </Button>
            </motion.div>

            {/* Preference Note */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-zinc-500 text-center max-w-sm"
            >
              You can always view your wrapped reports later from the dashboard
            </motion.p>
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
        <AnimatedBubbles />
      </div>

      {/* Wrapped Viewer Overlay */}
      <AnimatePresence>
        {showWrappedViewer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black"
          >
            {/* Close Button */}
            <div className="absolute top-4 right-4 z-[210]">
              <Button
                onClick={() => {
                  setShowWrappedViewer(false)
                  handleWrappedComplete()
                }}
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white hover:bg-white/10 rounded-full p-2"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
            
            {/* Continue Button */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[210]">
              <Button
                onClick={() => {
                  setShowWrappedViewer(false)
                  handleWrappedComplete()
                }}
                className="bg-white text-black hover:bg-white/90 px-8 py-3 rounded-full font-bold"
              >
                Continue to Dashboard
              </Button>
            </div>

            <WrappedReportViewer 
              onComplete={handleWrappedComplete}
              showCloseButton={true}
              isOnboarding={true}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return onboardingContent
}