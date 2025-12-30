"use client"

import { Button } from "@/components/ui/button"
import { BottomNav } from "@/components/bottom-nav"
import { SimpleHeader } from "@/components/simple-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowUp,
  ArrowDown,
  Activity,
  TrendingUp,
  DollarSign,
  Wallet,
  Plus,
  Share2,
  RefreshCw,
  Droplet,
  Scan,
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"

const data = [
  { name: "Mon", inflow: 400, outflow: 240 },
  { name: "Tue", inflow: 300, outflow: 139 },
  { name: "Wed", inflow: 200, outflow: 980 },
  { name: "Thu", inflow: 278, outflow: 390 },
  { name: "Fri", inflow: 189, outflow: 480 },
  { name: "Sat", inflow: 239, outflow: 380 },
  { name: "Sun", inflow: 349, outflow: 430 },
]

export default function Dashboard() {
  return (
    <div className="min-h-screen gradient-bg pb-24">
      <SimpleHeader />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground text-glow-neon">Dashboard</h1>
              <p className="text-muted-foreground text-sm">Track your DeFi budgets and earnings</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="glass-card border-green-500/30 text-green-400 hover:bg-green-500/10 gap-2 bg-transparent"
                asChild
              >
                <Link href="/faucet">
                  <Droplet className="w-4 h-4" />
                  Faucet
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="glass-card border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 bg-transparent"
              >
                <Scan className="w-4 h-4" />
                Scan QR
              </Button>
              <Link href="/wrapped">
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-card border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4" />
                  Replay wrap
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="glass-card border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 bg-transparent"
              >
                <Share2 className="w-4 h-4" />
                Share wrap
              </Button>
            </div>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Balance</p>
                  <p className="text-xl font-bold text-foreground">$124,590.25</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-green-500/20 text-green-400">
                  <ArrowDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Inflow</p>
                  <p className="text-xl font-bold text-foreground">+$12,450</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-red-500/20 text-red-400">
                  <ArrowUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Outflow</p>
                  <p className="text-xl font-bold text-foreground">-$8,230</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="glass-card border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-purple-400" />
                    Spendable Balance
                  </h3>
                  <p className="text-3xl font-bold text-foreground mt-2">$22,989.90</p>
                  <p className="text-sm text-muted-foreground mt-1">Available for withdrawal</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="gradient-primary text-white border-0 flex-1 h-14 text-xl font-bold gap-2 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform"
                  onClick={() => {
                    // This would typically open a universal deposit modal
                    console.log("[v0] Universal Deposit & Auto-Split triggered")
                  }}
                >
                  <Plus className="w-6 h-6" />
                  Deposit & Auto-Split
                </Button>
                <div className="flex flex-col justify-center px-2">
                  <p className="text-xs text-purple-400 font-bold uppercase tracking-widest">Smart Routing</p>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Directly to your 8 active buckets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Chart */}
          <Card className="glass-card border-purple-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold text-foreground">Net Cash Flow</CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-muted-foreground">In</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <span className="text-muted-foreground">Out</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(163, 0, 255, 0.1)" />
                    <XAxis
                      dataKey="name"
                      stroke="rgba(163, 0, 255, 0.4)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgba(163, 0, 255, 0.4)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(0, 0, 0, 0.95)",
                        border: "1px solid rgba(163, 0, 255, 0.2)",
                        borderRadius: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="inflow"
                      stroke="#A100FF"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                    <Line type="monotone" dataKey="outflow" stroke="#6366F1" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-muted-foreground">Total Yield</p>
                </div>
                <p className="text-2xl font-bold text-foreground">$2,145.30</p>
                <p className="text-xs text-green-400 mt-1">+12.5% this month</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-muted-foreground">Avg APY</p>
                </div>
                <p className="text-2xl font-bold text-foreground">8.4%</p>
                <p className="text-xs text-muted-foreground mt-1">Across all buckets</p>
              </CardContent>
            </Card>
          </div>

          {/* View All Buckets CTA */}
          <Link href="/buckets">
            <Card className="glass-card border-purple-500/30 hover:border-purple-500/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <p className="text-lg font-semibold text-foreground mb-1">View All Buckets</p>
                <p className="text-sm text-muted-foreground">Manage your budget allocations</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
