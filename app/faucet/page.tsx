"use client"

import { useState, useEffect } from "react"
import { SimpleHeader } from "@/components/simple-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Droplet, Coins, ArrowRight, CheckCircle2, Loader2, Clock, AlertTriangle, ExternalLink, ArrowLeft } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useFaucet } from "@/hooks/use-faucet"
import { useWallet } from "@/hooks/use-wallet"
import { useNetwork } from "@/hooks/use-network"

const tokens = [
  {
    symbol: "MNT" as const,
    name: "Mantle",
    amount: "10",
    color: "from-purple-500 to-indigo-500",
    description: "Gas and governance token for Mantle Network",
  },
  {
    symbol: "USDC" as const,
    name: "USD Coin",
    amount: "100",
    color: "from-blue-500 to-cyan-500",
    description: "Stablecoin for payroll and settlements",
  },
]

export default function FaucetPage() {
  const router = useRouter()
  const { isConnected, connect, address } = useWallet()
  const { isTestnet, switchToTestnet, currentNetwork } = useNetwork()
  const {
    isFaucetAvailable,
    canClaim,
    checkClaimEligibility,
    requestTokens,
    claimStatus,
    transactionHashes,
    isLoading,
    isTokenLoading,
    error,
    clearError
  } = useFaucet()

  const [nextClaimTimes, setNextClaimTimes] = useState<Record<string, number>>({})
  const [claimEligibility, setClaimEligibility] = useState<Record<string, boolean>>({})

  // Update next claim times and eligibility
  useEffect(() => {
    if (address && isFaucetAvailable) {
      const checkAllTokens = async () => {
        const times: Record<string, number> = {}
        const eligibility: Record<string, boolean> = {}
        
        for (const token of tokens) {
          const result = await checkClaimEligibility(token.symbol)
          eligibility[token.symbol] = result.canClaim
          if (result.nextClaimTime) {
            times[token.symbol] = result.nextClaimTime
          }
        }
        
        setNextClaimTimes(times)
        setClaimEligibility(eligibility)
      }
      
      checkAllTokens()
    }
  }, [address, isFaucetAvailable, checkClaimEligibility])

  const handleClaim = async (symbol: 'MNT' | 'USDC') => {
    clearError()
    const result = await requestTokens(symbol)
    
    if (result.success && result.transactionHash) {
      console.log(`Faucet claim successful for ${symbol}:`, result.transactionHash)
    }
  }

  const formatTimeRemaining = (timestamp: number) => {
    const now = Date.now()
    const remaining = timestamp - now
    
    if (remaining <= 0) return "Available now"
    
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    }
    return `${minutes}m remaining`
  }

  const getTokenStatus = (symbol: 'MNT' | 'USDC') => {
    const status = claimStatus[symbol] || 'idle'
    const nextClaimTime = nextClaimTimes[symbol]
    const canClaimToken = claimEligibility[symbol] ?? true
    
    if (status === 'success') return 'success'
    if (status === 'pending') return 'pending'
    if (nextClaimTime && nextClaimTime > Date.now()) return 'rate-limited'
    if (!canClaimToken) return 'unavailable'
    return 'available'
  }

  return (
    <div className="min-h-screen gradient-bg">
      <SimpleHeader />

    <main className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
            className="glass-card border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-2 bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Droplet className="w-8 h-8 text-purple-400" />
            Token Faucet
          </h1>
          <p className="text-muted-foreground">Get testnet tokens to explore PayWarp features</p>
        </div>

          {/* Network and Connection Status */}
          {!isConnected && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please connect your wallet to access the faucet.
                <Button 
                  onClick={connect} 
                  variant="link" 
                  className="p-0 ml-2 h-auto text-purple-400 hover:text-purple-300"
                >
                  Connect Wallet
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isConnected && !isTestnet && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Faucet is only available on Mantle Sepolia testnet.
                <Button 
                  onClick={switchToTestnet} 
                  variant="link" 
                  className="p-0 ml-2 h-auto text-purple-400 hover:text-purple-300"
                >
                  Switch to Testnet
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tokens.map((token) => {
              const tokenStatus = getTokenStatus(token.symbol)
              const nextClaimTime = nextClaimTimes[token.symbol]
              const txHash = transactionHashes[token.symbol]

              return (
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
                      {tokenStatus === 'success' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-bold">
                            <CheckCircle2 className="w-5 h-5" />
                            Tokens Claimed Successfully
                          </div>
                          {txHash && (
                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                              <ExternalLink className="w-3 h-3" />
                              <a 
                                href={`https://explorer.sepolia.mantle.xyz/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-purple-400 transition-colors"
                              >
                                View Transaction
                              </a>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {tokenStatus === 'pending' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold"
                        >
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing Transaction...
                        </motion.div>
                      )}

                      {tokenStatus === 'rate-limited' && nextClaimTime && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-center gap-2 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold"
                        >
                          <Clock className="w-5 h-5" />
                          {formatTimeRemaining(nextClaimTime)}
                        </motion.div>
                      )}

                      {tokenStatus === 'available' && isFaucetAvailable && (
                        <Button
                          onClick={() => handleClaim(token.symbol)}
                          disabled={isTokenLoading(token.symbol)}
                          className="w-full h-12 gradient-primary text-white border-0 font-bold text-lg group/btn"
                        >
                          {isTokenLoading(token.symbol) ? (
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

                      {tokenStatus === 'unavailable' && (
                        <Button
                          disabled
                          className="w-full h-12 bg-gray-500/20 text-gray-400 border-0 font-bold text-lg cursor-not-allowed"
                        >
                          {!isConnected ? 'Connect Wallet' : !isTestnet ? 'Switch to Testnet' : 'Unavailable'}
                        </Button>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="glass-card border-purple-500/20 bg-purple-500/5">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 shrink-0 h-fit">
                  <Droplet className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">How it works</h3>
                  <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                    <p>
                      Faucet tokens are distributed once every 24 hours per wallet address. These tokens have no
                      real-world value and are strictly for use on the Mantle Sepolia testnet within the PayWarp ecosystem.
                    </p>
                    <p>
                      Current network: <span className="font-semibold text-foreground">{currentNetwork === 'sepolia' ? 'Mantle Sepolia (Testnet)' : 'Mantle Mainnet'}</span>
                    </p>
                    {address && (
                      <p>
                        Connected wallet: <span className="font-mono text-xs text-foreground">{address}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
