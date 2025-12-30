"use client"

import { SimpleHeader } from "@/components/simple-header"
import { BottomNav } from "@/components/bottom-nav"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { History, ArrowDownLeft, TrendingUp, Droplet, Zap, ExternalLink, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Suspense } from "react" // added Suspense import

const historyItems = [
  {
    id: 1,
    type: "Split",
    amount: "$1,200.00",
    date: "2025-05-12",
    bucket: "Billings",
    status: "Completed",
    icon: Droplet,
    color: "text-purple-400",
  },
  {
    id: 2,
    type: "Yield",
    amount: "+$12.45",
    date: "2025-05-11",
    bucket: "Savings",
    status: "Accrued",
    icon: TrendingUp,
    color: "text-green-400",
  },
  {
    id: 3,
    type: "Payout",
    amount: "$5,400.00",
    date: "2025-05-10",
    bucket: "Instant",
    status: "Completed",
    icon: Zap,
    color: "text-amber-400",
  },
  {
    id: 4,
    type: "Transfer",
    amount: "$500.00",
    date: "2025-05-08",
    bucket: "Growth",
    status: "Completed",
    icon: TrendingUp,
    color: "text-blue-400",
  },
  {
    id: 5,
    type: "Deposit",
    amount: "$2,000.00",
    date: "2025-05-05",
    bucket: "Spendable",
    status: "Completed",
    icon: ArrowDownLeft,
    color: "text-green-400",
  },
  {
    id: 6,
    type: "Split",
    amount: "$850.00",
    date: "2025-05-03",
    bucket: "Billings",
    status: "Completed",
    icon: Droplet,
    color: "text-purple-400",
  },
  {
    id: 7,
    type: "Yield",
    amount: "+$8.20",
    date: "2025-05-01",
    bucket: "Growth",
    status: "Accrued",
    icon: TrendingUp,
    color: "text-green-400",
  },
]

function HistoryContent() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <History className="w-8 h-8 text-purple-400" />
            Warp History
          </h1>
          <p className="text-muted-foreground">Trace your financial movements through time</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tx hash..."
              className="pl-10 glass border-purple-500/20 bg-transparent w-[240px]"
            />
          </div>
          <Button variant="outline" size="icon" className="glass border-purple-500/20 bg-transparent">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="relative space-y-4">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-indigo-500/20 to-transparent" />

        {historyItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative pl-14"
          >
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full gradient-primary ring-4 ring-black/40 z-10" />

            <Card className="glass-card border-purple-500/20 hover:border-purple-500/40 transition-all group overflow-hidden">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-xl bg-opacity-10`}
                    style={{
                      backgroundColor: `${item.color.split("-")[1] === "green" ? "rgba(34, 197, 94, 0.1)" : "rgba(161, 0, 255, 0.1)"}`,
                    }}
                  >
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{item.type}</h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase bg-purple-500/10 border-purple-500/20 text-purple-300"
                      >
                        {item.bucket}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      0x{Math.random().toString(16).slice(2, 10)}...{Math.random().toString(16).slice(2, 6)}
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  <div className="space-y-1">
                    <p className={`text-xl font-bold ${item.color}`}>{item.amount}</p>
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Explorer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        <div className="text-center pt-8">
          <Button variant="outline" className="glass border-purple-500/20 bg-transparent text-foreground px-8">
            Load More History
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function WarpHistory() {
  return (
    <div className="min-h-screen gradient-bg pb-24">
      <SimpleHeader />

      <main className="p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<div>Loading...</div>}>
          <HistoryContent />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
