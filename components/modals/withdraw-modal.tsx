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
import { Wallet, ArrowUpRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useBlockchainBuckets } from "@/hooks/use-blockchain-buckets"
import { useWallet } from "@/hooks/use-wallet.tsx"
import { useToast } from "@/hooks/use-toast"
import type { BucketType } from "@/lib/types"

interface WithdrawModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bucketId: BucketType
  bucketName: string
}

export function WithdrawModal({ open, onOpenChange, bucketId, bucketName }: WithdrawModalProps) {
  const [step, setStep] = useState<"amount" | "processing" | "success">("amount")
  const [amount, setAmount] = useState("")
  const { withdrawFromBucket, getBucket, isLoading } = useBlockchainBuckets()
  const { isConnected, connect } = useWallet()
  const { toast } = useToast()

  const bucket = getBucket(bucketId)
  const isSpendable = bucketId === "spendable"

  const handleWithdraw = async () => {
    if (!isConnected) {
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
      await withdrawFromBucket(bucketId, numAmount)
      setStep("success")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Withdrawal failed'
      toast({
        title: "Withdrawal Failed",
        description: errorMessage,
        variant: "destructive",
      })
      setStep("amount") // Go back to amount input
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
            <div className="p-2 rounded-xl bg-indigo-500/20">
              <Wallet className="w-5 h-5 text-indigo-400" />
            </div>
            Withdraw from {bucketName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isSpendable
              ? "Withdraw spendable funds directly to your connected wallet."
              : "Withdrawals from this bucket will move funds to your Spendable bucket first."}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "amount" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 py-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="withdraw-amount" className="text-indigo-300 font-bold">
                    Amount to Withdraw
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Available:{" "}
                    <span className="text-foreground font-mono font-bold">${bucket?.balance.toLocaleString()}</span>
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 text-3xl h-16 glass border-indigo-500/30 focus:border-indigo-500 font-bold bg-transparent"
                  />
                </div>
              </div>

              {!isSpendable && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Withdrawals from <span className="text-amber-300 font-bold uppercase">{bucketName}</span> are routed
                    through your <span className="text-green-300 font-bold uppercase">Spendable</span> bucket for
                    compliance tracking.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 flex flex-col items-center justify-center space-y-4"
            >
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">Initiating Withdrawal</p>
                <p className="text-sm text-muted-foreground mt-1">Securing on-chain routing...</p>
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
                <p className="text-2xl font-bold text-foreground">Withdrawal Complete!</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-[240px] mx-auto">
                  ${Number(amount).toLocaleString()} has been sent to your wallet.
                </p>
              </div>
              <Button onClick={reset} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-12 font-bold">
                Finish
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {step === "amount" && (
          <DialogFooter>
            <Button
              disabled={!amount || Number(amount) <= 0 || Number(amount) > (bucket?.balance || 0) || isLoading}
              onClick={handleWithdraw}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-12 text-lg font-bold flex gap-2"
            >
              {isConnected ? "Withdraw Funds" : "Connect & Withdraw"}
              <ArrowUpRight className="w-5 h-5" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}