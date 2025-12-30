"use client"

import { useState } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { SimpleHeader } from "@/components/simple-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Droplet, Coins, ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const tokens = [
  {
    symbol: "MNT",
    name: "Mantle",
    amount: "10",
    color: "from-purple-500 to-indigo-500",
    description: "Gas and governance token for Mantle Network",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    amount: "100",
    color: "from-blue-500 to-cyan-500",
    description: "Stablecoin for payroll and settlements",
  },
]

export default function FaucetPage() {
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<Set<string>>(new Set())

  const handleClaim = (symbol: string) => {
    setClaiming(symbol)
    // Simulate on-chain claim
    setTimeout(() => {
      setClaiming(null)
      setClaimed((prev) => new Set(prev).add(symbol))
      console.log(`[v0] Faucet claim successful for ${symbol}`)
    }, 2000)
  }

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <SimpleHeader />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Droplet className="w-8 h-8 text-purple-400" />
              Token Faucet
            </h1>
            <p className="text-muted-foreground">Get testnet tokens to explore PayWarp features</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tokens.map((token) => (
              <Card key={token.symbol} className="glass-card border-purple-500/20 overflow-hidden group">
                <div className={`h-2 bg-gradient-to-r ${token.color}`} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      <div className={`p-2 rounded-xl bg-gradient-to-br ${token.color} bg-opacity-10`}>
                        <Coins className="w-6 h-6 text-white" />
                      </div>
                      {token.symbol}
                    </CardTitle>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Amount</p>
                      <p className="text-xl font-bold text-foreground">
                        {token.amount} <span className="text-sm font-normal text-muted-foreground">{token.symbol}</span>
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">{token.description}</p>

                  <AnimatePresence mode="wait">
                    {claimed.has(token.symbol) ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-bold"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Tokens Claimed
                      </motion.div>
                    ) : (
                      <Button
                        onClick={() => handleClaim(token.symbol)}
                        disabled={claiming === token.symbol}
                        className="w-full h-12 gradient-primary text-white border-0 font-bold text-lg group/btn"
                      >
                        {claiming === token.symbol ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            Request Tokens
                            <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass-card border-purple-500/20 bg-purple-500/5">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 shrink-0 h-fit">
                  <Droplet className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">How it works</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Faucet tokens are distributed once every 24 hours per wallet address. These tokens have no
                    real-world value and are strictly for use on the Mantle testnet within the PayWarp ecosystem.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
