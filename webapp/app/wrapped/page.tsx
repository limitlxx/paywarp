"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { AnimatedBubbles } from "@/components/animated-bubbles"
import {
  X,
  Share2,
  Download,
  Zap,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  Calendar,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Play,
} from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/hooks/use-wallet"
import { useRouter } from "next/navigation"

const slides = [
  {
    id: "cover",
    type: "cover",
    title: "2025 WRAPPED",
    highlight: "20\n25",
    sub: "WRAPPED",
    color: "from-[#0D0B14] to-[#1A1625]",
    bg: "bg-[#0D0B14]",
  },
  {
    id: "volume",
    type: "stats",
    label: "TRANSACTIONS VOLUME",
    content: "YOU HAD A TOTAL TRANSACTION VOLUME OF",
    highlight: "0.19 SOL",
    value: "≈ $24.31",
    footer: { network: "Solana", status: "Normie" },
    color: "from-[#1F0E35] to-[#0D0B14]",
    icon: TrendingUp,
  },
  {
    id: "money-moves",
    type: "comparison",
    label: "FLOW ANALYSIS",
    title: "Money\nMoves",
    inflow: "+0 SOL",
    inflowUsd: "$0",
    outflow: "-0.19 SOL",
    outflowUsd: "$24.15",
    color: "from-[#141414] to-[#0D0B14]",
  },
  {
    id: "top-asset",
    type: "asset",
    label: "TOP ASSET",
    title: "SOL",
    balance: "4.657",
    value: "$595.735",
    color: "from-[#081C15] to-[#0D0B14]",
    icon: Wallet,
  },
  {
    id: "peak",
    type: "date",
    label: "PEAK ACTIVITY",
    date: "12/17/2025",
    count: "3551 Transactions",
    color: "from-[#1C0F08] to-[#0D0B14]",
    icon: Calendar,
  },
  {
    id: "biggest",
    type: "highlight",
    label: "BIGGEST TRANSACTION",
    highlight: "0 SOL",
    value: "$0.01",
    sub: "SENT TO",
    target: "4TQL...J3or",
    color: "from-[#0E0E1F] to-[#0D0B14]",
    icon: Zap,
  },
  {
    id: "top-5",
    type: "list",
    title: "Top 5\nTransactions",
    items: [
      { id: "2nyh...EYgD", count: 386, val: "0.02 SOL" },
      { id: "D2L6...e7NZ", count: 378, val: "0.02 SOL" },
      { id: "2q5p...fWGJ", count: 369, val: "0.02 SOL" },
      { id: "4ACf...hDEE", count: 366, val: "0.02 SOL" },
      { id: "4vie...N3Ey", count: 361, val: "0.02 SOL" },
    ],
    color: "from-[#0D0B14] to-[#1A1625]",
  },
  {
    id: "rank",
    type: "rank",
    label: "TOP GLOBAL PERCENTILE",
    percent: "90%",
    desc: "YOU RANKED TOP 90% IN THE SOLANA HOLDERS GLOBAL PERCENTAGE",
    rankLabel: "RANK DESIGNATION",
    rank: "Solana Plankton",
    color: "from-[#0D0B14] to-[#111111]",
  },
  {
    id: "archetype",
    type: "archetype",
    label: "YOUR ARCHETYPE",
    title: "The\nBot?",
    color: "from-[#160D14] to-[#0D0B14]",
  },
  {
    id: "summary",
    type: "summary",
    title: "2025 Wrapped",
    stats: [
      { label: "TOTAL VOLUME", value: "$24.31", sub: "10k+ TRANSACTIONS" },
      { label: "TOP ASSET", value: "SOL", sub: "$595.735 Value" },
      { label: "GLOBAL RANK", value: "90%", sub: "SOLANA PLANKTON" },
    ],
    color: "from-[#1A1625] to-[#0D0B14]",
  },
]

export default function WrappedExperience() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isSyncing, setIsSyncing] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const { isConnected, address } = useWallet()
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("[v0] Sync complete, starting transition to Wrapped story")
      setIsTransitioning(true)
      setTimeout(() => {
        setIsSyncing(false)
        setIsTransitioning(false)
      }, 500)
    }, 3500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isConnected) {
      router.push("/")
    }
  }, [isConnected, router])

  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1)
      setProgress(0)
    }
  }, [currentSlide])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1)
      setProgress(0)
    }
  }, [currentSlide])

  useEffect(() => {
    if (isSyncing || isPaused) return

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentSlide < slides.length - 1) {
            nextSlide()
            return 0
          }
          return 100
        }
        return prev + 1
      })
    }, 50)
    return () => clearInterval(timer)
  }, [currentSlide, isSyncing, isPaused, nextSlide])

  const slide = slides[currentSlide]

  if (isSyncing) {
    return (
      <motion.div
        animate={{ opacity: isTransitioning ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center"
      >
        <AnimatedBubbles count={40} />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-8"
        >
          <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/40 animate-pulse">
            <BarChart3 className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Syncing History</h2>
            <div className="flex items-center justify-center gap-2 text-purple-400 font-mono text-sm">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              INDEXING 2025 BLOCKS...
            </div>
          </div>
          <div className="w-64 h-1.5 bg-white/10 rounded-full mx-auto overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.8, ease: "linear" }}
            />
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0D0B14] z-[100] flex flex-col items-center justify-center overflow-hidden font-sans">
      <AnimatedBubbles count={20} />

      {/* Background Layer */}
      <div className={`absolute inset-0 bg-gradient-to-b ${slide.color} opacity-40 transition-colors duration-1000`} />

      {/* Progress Bars */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 max-w-lg mx-auto w-full space-y-4">
        <div className="flex gap-1.5 px-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
              onClick={() => {
                setCurrentSlide(i)
                setProgress(0)
              }}
            >
              <motion.div
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: i === currentSlide ? `${progress}%` : i < currentSlide ? "100%" : "0%" }}
                transition={{ duration: 0.1 }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center px-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[0.2em] text-white/50 uppercase">BLOCKWRAP © 2025</span>
            <div className="w-8 h-0.5 bg-white/20 mt-1" />
          </div>
          <Link href="/dashboard" className="text-white/40 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </Link>
        </div>
      </div>

      {/* Main Content Area - Story Card */}
      <div
        className="relative z-10 w-full max-w-[400px] aspect-[9/16] max-h-[85vh] p-6 flex flex-col select-none"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div className="absolute inset-0 z-30 pointer-events-none flex justify-between items-center px-2">
          <button
            className="pointer-events-auto w-12 h-12 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-sm border border-white/5 opacity-0 hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              prevSlide()
            }}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            className="pointer-events-auto w-12 h-12 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-sm border border-white/5 opacity-0 hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              nextSlide()
            }}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="flex-1 rounded-[2.5rem] bg-[#0D0B14]/80 backdrop-blur-xl border border-white/5 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Story Card Content Wrapper */}
            <div className="flex-1 flex flex-col p-8 relative overflow-hidden">
              {slide.type === "cover" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <h1 className="text-[120px] font-black leading-[0.8] tracking-tighter text-white mb-2 whitespace-pre">
                    {slide.highlight}
                  </h1>
                  <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-white to-indigo-400 tracking-tight">
                    {slide.sub}
                  </h2>
                  <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center">
                    <span className="text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase mb-2">
                      WALLET ADDRESS
                    </span>
                    <span className="text-sm font-mono text-white/60 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not Connected"}
                    </span>
                  </div>
                </div>
              )}

              {slide.type === "stats" && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-12">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase">
                      {slide.label}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-sm font-medium text-white/40 tracking-wider mb-6 leading-relaxed">
                      {slide.content}
                    </p>
                    <h2 className="text-[72px] font-black text-white leading-tight tracking-tighter">
                      {slide.highlight}
                    </h2>
                    <p className="text-2xl font-medium text-white/60 mt-2">{slide.value}</p>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-8">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">NETWORK</p>
                      <p className="text-lg font-bold text-white">{slide.footer?.network}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">STATUS</p>
                      <p className="text-lg font-bold text-purple-400">{slide.footer?.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {slide.type === "comparison" && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-center gap-2 mb-12 bg-white/5 py-2 rounded-full border border-white/10 self-center px-4">
                    <ArrowUpRight className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">
                      {slide.label}
                    </span>
                  </div>
                  <h2 className="text-6xl font-black text-white leading-[0.9] tracking-tighter text-center mb-12 whitespace-pre">
                    {slide.title}
                  </h2>
                  <div className="grid grid-cols-2 flex-1 items-center border-l border-white/10 ml-[-1px] relative">
                    <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-white/10" />
                    <div className="px-6 flex flex-col items-center">
                      <div className="flex items-center gap-1 text-green-400 mb-6">
                        <span className="text-[10px] font-black tracking-widest">INFLOW</span>
                        <ChevronLeft className="w-3 h-3 rotate-45" />
                      </div>
                      <p className="text-3xl font-black text-white">{slide.inflow}</p>
                      <p className="text-sm text-white/40">{slide.inflowUsd}</p>
                    </div>
                    <div className="px-6 flex flex-col items-center">
                      <div className="flex items-center gap-1 text-red-400 mb-6">
                        <span className="text-[10px] font-black tracking-widest">OUTFLOW</span>
                        <ChevronRight className="w-3 h-3 -rotate-45" />
                      </div>
                      <p className="text-3xl font-black text-white">{slide.outflow}</p>
                      <p className="text-sm text-white/40">{slide.outflowUsd}</p>
                    </div>
                  </div>
                </div>
              )}

              {slide.type === "asset" && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-12">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                      {slide.label}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <h2 className="text-[100px] font-black text-white leading-none tracking-tighter mb-4">
                      {slide.title}
                    </h2>
                    <div className="space-y-4">
                      <div className="h-[1px] w-12 bg-white/20" />
                      <div>
                        <p className="text-[10px] font-black tracking-widest text-white/30 uppercase mb-1">BALANCE</p>
                        <p className="text-3xl font-bold text-white">{slide.balance}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-widest text-white/30 uppercase mb-1">
                          VALUE (USD)
                        </p>
                        <p className="text-3xl font-bold text-emerald-400">{slide.value}</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 opacity-10">
                    <Wallet className="w-[300px] h-[300px] text-white" />
                  </div>
                </div>
              )}

              {slide.type === "list" && (
                <div className="flex-1 flex flex-col">
                  <h2 className="text-5xl font-black text-white leading-tight tracking-tighter mb-10 whitespace-pre">
                    {slide.title}
                  </h2>
                  <div className="space-y-4 flex-1">
                    {slide.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 group">
                        <span className="text-xs font-mono text-white/20">0{idx + 1}</span>
                        <div className="flex-1 flex items-center justify-between border-b border-white/5 pb-4">
                          <div>
                            <p className="text-lg font-bold text-white tracking-tight">{item.id}</p>
                            <span className="text-[10px] font-bold text-white/30 bg-white/5 px-2 py-0.5 rounded uppercase">
                              OUT
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">
                              {item.count} <span className="text-[10px] text-white/30">TXS</span>
                            </p>
                            <p className="text-xs text-white/40">{item.val}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {slide.type === "summary" && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-black text-white tracking-tighter">{slide.title}</h2>
                    <div className="flex items-center gap-1 bg-green-500/10 text-green-400 text-[10px] font-black px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      ON-CHAIN
                    </div>
                  </div>
                  <p className="text-xs font-mono text-white/40 mb-6 uppercase tracking-widest">
                    {address?.slice(0, 10)}...{address?.slice(-4)}
                  </p>
                  <div className="space-y-4">
                    {slide.stats?.map((stat, idx) => (
                      <div key={idx} className="glass-card bg-white/5 border-white/10 p-5 rounded-3xl group">
                        <p className="text-[10px] font-black tracking-widest text-white/30 uppercase mb-1">
                          {stat.label}
                        </p>
                        <div className="flex items-baseline justify-between">
                          <p className="text-3xl font-black text-white">{stat.value}</p>
                          <p className="text-xs font-bold text-white/40">{stat.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <Button className="rounded-2xl h-14 bg-white text-black font-bold text-sm flex items-center gap-2 hover:bg-white/90">
                      <Share2 className="w-4 h-4" />
                      SHARE
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl h-14 border-white/20 text-white font-bold text-sm flex items-center gap-2 bg-transparent"
                    >
                      <Download className="w-4 h-4" />
                      SAVE
                    </Button>
                  </div>
                </div>
              )}

              {/* Archetype Slide Special Layout */}
              {slide.type === "archetype" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-black tracking-[0.3em] text-purple-400 uppercase mb-12">
                    YOUR ARCHETYPE
                  </p>
                  <div className="relative">
                    <h2 className="text-[84px] font-black text-white leading-[0.85] tracking-tighter italic whitespace-pre relative z-10">
                      {slide.title}
                    </h2>
                    <h2 className="text-[84px] font-black text-white/20 leading-[0.85] tracking-tighter italic whitespace-pre absolute top-2 left-2 blur-[1px]">
                      {slide.title}
                    </h2>
                    <h2 className="text-[84px] font-black text-white/10 leading-[0.85] tracking-tighter italic whitespace-pre absolute top-4 left-4 blur-[2px]">
                      {slide.title}
                    </h2>
                  </div>
                  <div className="mt-16 text-purple-500/40">
                    <Zap className="w-12 h-12 fill-current" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-[10px] font-bold text-white/20 text-center mt-6 tracking-widest uppercase">
          Click on card to pause
        </p>

        {/* Card Navigation Controls */}
        <div
          className="absolute inset-y-0 left-0 w-1/2 z-20"
          onClick={(e) => {
            e.stopPropagation()
            prevSlide()
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/2 z-20"
          onClick={(e) => {
            e.stopPropagation()
            nextSlide()
          }}
        />
      </div>

      {/* Floating Action Controls */}
      <div className="absolute bottom-12 flex items-center gap-4 z-50">
        {currentSlide < slides.length - 1 && (
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentSlide(slides.length - 1)
              setProgress(0)
            }}
            className="text-white/40 hover:text-white hover:bg-white/5 rounded-full px-6 py-2 text-xs font-black tracking-widest uppercase"
          >
            Skip to Summary
          </Button>
        )}

        {currentSlide === slides.length - 1 && (
          <Button
            onClick={() => {
              setCurrentSlide(0)
              setProgress(0)
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full px-8 py-6 h-auto flex items-center gap-2 shadow-2xl shadow-purple-500/40"
          >
            <Play className="w-5 h-5" />
            REPLAY WRAPPED
          </Button>
        )}
      </div>
    </div>
  )
}
