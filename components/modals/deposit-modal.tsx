"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Wallet, CreditCard, Droplet, ArrowRight, CheckCircle2, Loader2, Info, TrendingUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useBlockchainBuckets } from "@/hooks/use-blockchain-buckets"
import { useBuckets } from "@/hooks/use-buckets"
import { useWallet } from "@/hooks/use-wallet"
import { useToast } from "@/hooks/use-toast"
import { PaystackDeposit } from "@/components/paystack-deposit"
import type { BucketType } from "@/lib/types"

interface DepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bucketId?: BucketType | "auto-split"
  bucketName?: string
}

export function DepositModal({ open, onOpenChange, bucketId = "auto-split", bucketName }: DepositModalProps) {
  const [step, setStep] = useState<"amount" | "method" | "paystack" | "processing" | "success">("amount")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"paystack" | "wallet" | "faucet">("paystack")
  const [enableRWAConversion, setEnableRWAConversion] = useState(true)
  const [rwaTokenType, setRwaTokenType] = useState<"USDY" | "mUSD">("USDY")
  const { depositAndSplit, isLoading, error } = useBlockchainBuckets()
  const { convertToRWA } = useBuckets()
  const { isConnected, connect } = useWallet()
  const { toast } = useToast()

  const isSpendable = bucketId === "spendable"
  const isAutoSplit = bucketId === "auto-split"
  const isYieldingBucket = bucketId === "savings" || bucketId === "growth" || bucketId === "billings"

  const handleNext = async () => {
    if (step === "amount") {
      setStep("method")
    } else if (step === "method") {
      if (method === "paystack") {
        setStep("paystack")
        return
      }
      
      if (method === "wallet" && !isConnected) {
        try {
          await connect()
        } catch (err) {
          toast({
            title: "Connection Failed",
            description: "Please connect your wallet to continue.",
            variant: "destructive",
          })
          return
        }
      }
      
      setStep("processing")
      
      try {
        const numAmount = Number(amount)
        
        if (method === "wallet" && isAutoSplit) {
          await depositAndSplit(numAmount)
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000))
          toast({
            title: "Deposit Successful",
            description: `Successfully deposited ${numAmount.toLocaleString()} via ${method}.`,
          })
        }
        
        setStep("success")
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Deposit failed'
        toast({
          title: "Deposit Failed",
          description: errorMessage,
          variant: "destructive",
        })
        setStep("method")
      }
    }
  }

  const reset = () => {
    setStep("amount")
    setAmount("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-purple-500/20 sm:max-w-md bg-black/90 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <CreditCard className="w-5 h-5 text-purple-400" />
            </div>
            {isAutoSplit ? "Deposit & Auto-Split" : `Deposit to ${bucketName}`}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isAutoSplit
              ? "Funds will be automatically routed to your active buckets."
              : `Add liquidity directly to your ${bucketName} bucket.`}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "amount" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 py-4"
            >
              <div className="space-y-2">
                <Label htmlFor="deposit-amount" className="text-purple-300">
                  Amount (USD)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="deposit-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 text-3xl h-16 glass border-purple-500/30 focus:border-purple-500 font-bold bg-transparent"
                  />
                </div>
              </div>
              {isAutoSplit && (
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 flex gap-3">
                  <Info className="w-5 h-5 text-purple-400 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Based on your settings, this will be split across your configured buckets automatically.
                  </p>
                </div>
              )}
              
              {!isAutoSplit && isYieldingBucket && (
                <div className="space-y-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <Label className="text-green-300 text-sm font-medium">Enable Yield Generation</Label>
                      <p className="text-xs text-muted-foreground">Convert to RWA tokens for automatic yield</p>
                    </div>
                    <Switch
                      checked={enableRWAConversion}
                      onCheckedChange={setEnableRWAConversion}
                    />
                  </div>
                  
                  {enableRWAConversion && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">RWA Token Type</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRwaTokenType("USDY")}
                          className={`flex-1 p-2 rounded-lg text-xs font-medium transition-all ${
                            rwaTokenType === "USDY" 
                              ? "bg-green-500/20 text-green-300 border border-green-500/30" 
                              : "bg-background/50 text-muted-foreground border border-border/30 hover:bg-background/70"
                          }`}
                        >
                          USDY (4.5% APY)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRwaTokenType("mUSD")}
                          className={`flex-1 p-2 rounded-lg text-xs font-medium transition-all ${
                            rwaTokenType === "mUSD" 
                              ? "bg-green-500/20 text-green-300 border border-green-500/30" 
                              : "bg-background/50 text-muted-foreground border border-border/30 hover:bg-background/70"
                          }`}
                        >
                          mUSD (3.2% APY)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {step === "method" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3 py-4"
            >
              <Label className="text-purple-300">Select Payment Method</Label>

              <button
                onClick={() => setMethod("paystack")}
                className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${method === "paystack" ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500" : "border-white/10 glass hover:bg-white/5"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CreditCard className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-foreground">Paystack</p>
                    <p className="text-xs text-muted-foreground">Cards, Bank, USSD</p>
                  </div>
                </div>
                {method === "paystack" && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
              </button>

              {!isSpendable && (
                <button
                  onClick={() => setMethod("wallet")}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${method === "wallet" ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500" : "border-white/10 glass hover:bg-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Wallet className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Crypto Wallet</p>
                      <p className="text-xs text-muted-foreground">
                        {isConnected ? "Connected" : "Connect via MetaMask/WalletConnect"}
                      </p>
                    </div>
                  </div>
                  {method === "wallet" && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
                </button>
              )}

              {isSpendable && (
                <button
                  onClick={() => setMethod("faucet")}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${method === "faucet" ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500" : "border-white/10 glass hover:bg-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                      <Droplet className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Mantle Faucet</p>
                      <p className="text-xs text-muted-foreground">Claim testnet MNT/USDC</p>
                    </div>
                  </div>
                  {method === "faucet" && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
                </button>
              )}
            </motion.div>
          )}

          {step === "paystack" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-4"
            >
              <PaystackDeposit
                onSuccess={(depositAmount) => {
                  toast({
                    title: "Deposit Successful",
                    description: `Successfully deposited $${depositAmount.toLocaleString()} via Paystack.`,
                  })
                  setStep("success")
                }}
                onError={(error) => {
                  toast({
                    title: "Deposit Failed",
                    description: error,
                    variant: "destructive",
                  })
                  setStep("method")
                }}
              />
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 flex flex-col items-center justify-center space-y-4"
            >
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">Processing Deposit</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {method === "paystack" 
                    ? "Verifying with Paystack..." 
                    : method === "wallet" 
                    ? "Confirming on Mantle Network..." 
                    : "Processing faucet request..."}
                </p>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 flex flex-col items-center justify-center space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center ring-4 ring-green-500/10">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">Deposit Confirmed!</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-[240px] mx-auto">
                  ${Number(amount).toLocaleString()} has been added to your {isAutoSplit ? "buckets" : bucketName}.
                </p>
              </div>
              <Button onClick={reset} className="w-full gradient-primary text-white h-12 font-bold">
                Back to Dashboard
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {(step === "amount" || step === "method") && (
          <DialogFooter>
            <Button
              disabled={!amount || (step === "amount" && Number(amount) <= 0) || isLoading}
              onClick={handleNext}
              className="w-full gradient-primary text-white h-12 text-lg font-bold group"
            >
              {step === "amount" ? "Select Method" : `Deposit $${amount}`}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </DialogFooter>
        )}

        {step === "paystack" && (
          <DialogFooter>
            <Button
              onClick={() => setStep("method")}
              variant="outline"
              className="w-full"
            >
              Back to Payment Methods
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}