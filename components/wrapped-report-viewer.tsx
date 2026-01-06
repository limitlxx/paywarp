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
  Users,
  Target,
  Bot,
  Scale,
  Star
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useWrappedReports } from "@/hooks/use-wrapped-reports"
import { WrappedReport } from "@/lib/transaction-sync"

interface WrappedSlide {
  id: string
  type: 'cover' | 'stats' | 'comparison' | 'asset' | 'date' | 'highlight' | 'list' | 'rank' | 'archetype' | 'summary' | 'year-selector'
  data?: any
}

interface WrappedReportViewerProps {
  onComplete?: () => void
  showCloseButton?: boolean
  isOnboarding?: boolean
}

export default function WrappedReportViewer({ 
  onComplete, 
  showCloseButton = true, 
  isOnboarding = false 
}: WrappedReportViewerProps = {}) {
  const {
    reports,
    currentReport,
    availableYears,
    isLoading,
    error,
    selectedYear,
    selectYear,
    hasActivity,
    overallSummary,
    formattedCurrentReport
  } = useWrappedReports()

  const [currentSlide, setCurrentSlide] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [slides, setSlides] = useState<WrappedSlide[]>([])

  // Generate slides based on current report
  const generateSlides = useCallback((report: WrappedReport | null): WrappedSlide[] => {
    if (!report || !formattedCurrentReport) {
      return [
        {
          id: 'year-selector',
          type: 'year-selector'
        }
      ]
    }

    const baseSlides: WrappedSlide[] = [
      {
        id: 'cover',
        type: 'cover',
        data: {
          year: report.year,
          walletAddress: report.walletAddress
        }
      },
      {
        id: 'volume',
        type: 'stats',
        data: {
          label: 'TRANSACTION VOLUME',
          content: `YOU HAD A TOTAL TRANSACTION VOLUME OF`,
          highlight: formattedCurrentReport.formattedVolume,
          value: `${report.totalTransactions} TRANSACTIONS`,
          footer: { 
            network: 'Mantle', 
            status: formattedCurrentReport.consistencyLevel 
          }
        }
      },
      {
        id: 'activity',
        type: 'date',
        data: {
          label: 'PEAK ACTIVITY',
          date: formattedCurrentReport.topMonth,
          count: `${report.activityPattern.averageMonthlyTransactions.toFixed(1)} Avg/Month`,
          consistency: formattedCurrentReport.consistencyLevel
        }
      },
      {
        id: 'archetype',
        type: 'archetype',
        data: {
          title: report.userArchetype.type,
          description: report.userArchetype.description,
          traits: report.userArchetype.traits,
          emoji: formattedCurrentReport.archetypeEmoji
        }
      }
    ]

    // Add achievements slide if there are achievements
    if (report.achievements.length > 0) {
      baseSlides.push({
        id: 'achievements',
        type: 'list',
        data: {
          title: 'Your\nAchievements',
          items: formattedCurrentReport.achievements.map((achievement, index) => ({
            id: achievement.name,
            emoji: achievement.emoji,
            description: achievement.description,
            count: index + 1
          }))
        }
      })
    }

    // Add monthly breakdown if there's significant activity
    if (report.totalTransactions > 5) {
      const topMonths = report.monthlyBreakdown
        .filter(month => month.transactionCount > 0)
        .sort((a, b) => b.transactionCount - a.transactionCount)
        .slice(0, 5)

      if (topMonths.length > 0) {
        baseSlides.push({
          id: 'top-months',
          type: 'list',
          data: {
            title: 'Top 5\nMonths',
            items: topMonths.map(month => ({
              id: new Date(2023, month.month - 1).toLocaleString('default', { month: 'short' }),
              count: month.transactionCount,
              val: `${month.totalVolume.toFixed(2)} tokens`
            }))
          }
        })
      }
    }

    // Add summary slide
    baseSlides.push({
      id: 'summary',
      type: 'summary',
      data: {
        title: `${report.year} Wrapped`,
        stats: [
          { 
            label: 'TOTAL VOLUME', 
            value: formattedCurrentReport.formattedVolume, 
            sub: `${formattedCurrentReport.formattedTransactionCount} TRANSACTIONS` 
          },
          { 
            label: 'TOP MONTH', 
            value: formattedCurrentReport.topMonth, 
            sub: `${formattedCurrentReport.consistencyLevel} Activity` 
          },
          { 
            label: 'ARCHETYPE', 
            value: report.userArchetype.type, 
            sub: formattedCurrentReport.archetypeEmoji 
          }
        ]
      }
    })

    return baseSlides
  }, [formattedCurrentReport])

  // Update slides when report changes
  useEffect(() => {
    const newSlides = generateSlides(currentReport)
    setSlides(newSlides)
    setCurrentSlide(0)
    setProgress(0)
  }, [currentReport, generateSlides])

  const nextSlide = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1)
      setProgress(0)
    }
  }, [currentSlide, slides.length])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
      setProgress(0)
    }
  }, [currentSlide])

  // Auto-progress slides
  useEffect(() => {
    if (isPaused || slides.length === 0) return

    const timer = setInterval(() => {
      setProgress(prev => {
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
  }, [currentSlide, isPaused, slides.length, nextSlide])

  const getArchetypeIcon = (archetype: string) => {
    switch (archetype) {
      case 'Team Manager': return Users
      case 'Goal-Oriented Saver': return Target
      case 'Automated Budgeter': return Bot
      case 'Balanced User': return Scale
      default: return Star
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
        <AnimatedBubbles />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-8"
        >
          <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/40 animate-pulse">
            <BarChart3 className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
              Generating Wrapped
            </h2>
            <div className="flex items-center justify-center gap-2 text-purple-400 font-mono text-sm">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              ANALYZING BLOCKCHAIN DATA...
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Error Loading Wrapped</h2>
          <p className="text-red-400">{error}</p>
          <Link href="/dashboard">
            <Button variant="outline" className="text-white border-white/20">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!hasActivity) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
        <AnimatedBubbles />
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center mx-auto">
            <BarChart3 className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white tracking-tighter">
              No Activity Yet
            </h2>
            <p className="text-gray-400">
              Start using PayWarp to generate your wrapped report! Make some transactions and come back later.
            </p>
          </div>
          <Link href="/dashboard">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              Start Using PayWarp
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const slide = slides[currentSlide]

  return (
    <div className="fixed inset-0 bg-[#0D0B14] z-[100] flex flex-col items-center justify-center overflow-hidden font-sans">
      <AnimatedBubbles />

      {/* Background Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0D0B14] to-[#1A1625] opacity-40 transition-colors duration-1000" />

      {/* Year Selector */}
      {availableYears.length > 1 && (
        <div className="absolute top-4 left-4 z-50">
          <select
            value={selectedYear || ''}
            onChange={(e) => selectYear(parseInt(e.target.value))}
            className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            {availableYears.map(year => (
              <option key={year} value={year} className="bg-black text-white">
                {year}
              </option>
            ))}
          </select>
        </div>
      )}

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
            <span className="text-[10px] font-black tracking-[0.2em] text-white/50 uppercase">
              PayWarp © {selectedYear || new Date().getFullYear()}
            </span>
            <div className="w-8 h-0.5 bg-white/20 mt-1" />
          </div>
          {showCloseButton && (
            isOnboarding ? (
              <button 
                onClick={() => onComplete?.()}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            ) : (
              <Link href="/dashboard" className="text-white/40 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </Link>
            )
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="relative z-10 w-full max-w-[400px] aspect-[9/16] max-h-[85vh] p-6 flex flex-col select-none"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Navigation buttons */}
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
            <div className="flex-1 flex flex-col p-8 relative overflow-hidden">
              {slide?.type === 'cover' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <h1 className="text-[120px] font-black leading-[0.8] tracking-tighter text-white mb-2">
                    {slide.data.year}
                  </h1>
                  <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-white to-indigo-400 tracking-tight">
                    WRAPPED
                  </h2>
                  <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center">
                    <span className="text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase mb-2">
                      WALLET ADDRESS
                    </span>
                    <span className="text-sm font-mono text-white/60 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                      {slide.data.walletAddress ? 
                        `${slide.data.walletAddress.slice(0, 6)}...${slide.data.walletAddress.slice(-4)}` : 
                        "Not Connected"
                      }
                    </span>
                  </div>
                </div>
              )}

              {slide?.type === 'stats' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-12">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase">
                      {slide.data.label}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-sm font-medium text-white/40 tracking-wider mb-6 leading-relaxed">
                      {slide.data.content}
                    </p>
                    <h2 className="text-[72px] font-black text-white leading-tight tracking-tighter">
                      {slide.data.highlight}
                    </h2>
                    <p className="text-2xl font-medium text-white/60 mt-2">{slide.data.value}</p>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-8">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">NETWORK</p>
                      <p className="text-lg font-bold text-white">{slide.data.footer?.network}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">STATUS</p>
                      <p className="text-lg font-bold text-purple-400">{slide.data.footer?.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {slide?.type === 'archetype' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-black tracking-[0.3em] text-purple-400 uppercase mb-12">
                    YOUR ARCHETYPE
                  </p>
                  <div className="relative mb-8">
                    <h2 className="text-[64px] font-black text-white leading-[0.85] tracking-tighter relative z-10">
                      {slide.data.title}
                    </h2>
                  </div>
                  <p className="text-white/60 text-center mb-8 max-w-xs">
                    {slide.data.description}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {slide.data.traits.map((trait: string, index: number) => (
                      <span 
                        key={index}
                        className="text-xs bg-white/10 text-white/80 px-3 py-1 rounded-full border border-white/20"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                  <div className="mt-16 text-purple-500/40 text-6xl">
                    {slide.data.emoji}
                  </div>
                </div>
              )}

              {slide?.type === 'list' && (
                <div className="flex-1 flex flex-col">
                  <h2 className="text-5xl font-black text-white leading-tight tracking-tighter mb-10 whitespace-pre">
                    {slide.data.title}
                  </h2>
                  <div className="space-y-4 flex-1">
                    {slide.data.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4 group">
                        <span className="text-xs font-mono text-white/20">0{idx + 1}</span>
                        <div className="flex-1 flex items-center justify-between border-b border-white/5 pb-4">
                          <div className="flex items-center gap-3">
                            {item.emoji && <span className="text-2xl">{item.emoji}</span>}
                            <div>
                              <p className="text-lg font-bold text-white tracking-tight">{item.id}</p>
                              {item.description && (
                                <p className="text-xs text-white/40">{item.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {item.count && (
                              <p className="text-lg font-bold text-white">
                                {item.count} <span className="text-[10px] text-white/30">
                                  {slide.data.title.includes('Achievement') ? '' : 'TXS'}
                                </span>
                              </p>
                            )}
                            {item.val && <p className="text-xs text-white/40">{item.val}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {slide?.type === 'summary' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-black text-white tracking-tighter">{slide.data.title}</h2>
                    <div className="flex items-center gap-1 bg-green-500/10 text-green-400 text-[10px] font-black px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      ON-CHAIN
                    </div>
                  </div>
                  <div className="space-y-4">
                    {slide.data.stats?.map((stat: any, idx: number) => (
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