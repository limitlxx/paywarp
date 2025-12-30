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
import { Wallet, CreditCard, Droplet, ArrowRight, CheckCircle2, Loader2, Info } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useBuckets } from "@/hooks/use-buckets"
import { useToast } from "@/hooks/use-toast"
import type { BucketType } from "@/lib/types"

interface DepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bucketId?: BucketType | "auto-split"
  bucketName?: string
}

export function DepositModal({ open, onOpenChange, bucketId = "auto-split", bucketName }: DepositModalProps) {
  const [step, setStep] = useState<"amount" | "method" | "processing" | "success">("amount")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"paystack" | "wallet" | "faucet">("paystack")
  const { updateBucketBalance, buckets } = useBuckets()
  const { toast } = useToast()

  const isSpendable = bucketId === "spendable"
  const isAutoSplit = bucketId === "auto-split"

  const handleNext = () => {
    if (step === "amount") setStep("method")
    else if (step === "method") {
      setStep("processing")
      // Simulate transaction
      setTimeout(() => {
        const numAmount = Number(amount)
        if (isAutoSplit) {
          // Auto-split logic across all buckets based on their split configuration
          buckets.forEach((b) => {
            const splitAmount = (numAmount * b.percentage) / 100
            updateBucketBalance(b.id, splitAmount)
          })
        } else {
          updateBucketBalance(bucketId as BucketType, numAmount)
        }
        setStep("success")
        toast({
          title: "Deposit Successful",
          description: `Successfully deposited $${numAmount.toLocaleString()} via ${method}.`,
        })
      }, 2000)
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
              ? "Funds will be automatically routed to your 8 active buckets."
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
                    Based on your settings, this will be split:
                    <span className="text-purple-300 font-bold ml-1">Billings (45%)</span>,
                    <span className="text-blue-300 font-bold ml-1">Savings (20%)</span>, etc.
                  </p>
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
                      <p className="text-xs text-muted-foreground">Connect via MetaMask/WalletConnect</p>
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
                  {method === "paystack" ? "Verifying with Paystack..." : "Confirming on Mantle Network..."}
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
              disabled={!amount || (step === "amount" && Number(amount) <= 0)}
              onClick={handleNext}
              className="w-full gradient-primary text-white h-12 text-lg font-bold group"
            >
              {step === "amount" ? "Select Method" : `Deposit $${amount}`}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
