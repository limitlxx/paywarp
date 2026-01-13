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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRightLeft, CheckCircle2, Loader2, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useBlockchainBuckets } from "@/hooks/use-blockchain-buckets"
import { useWallet } from "@/hooks/use-wallet.tsx"
import { useToast } from "@/hooks/use-toast"
import type { BucketType } from "@/lib/types"

interface TransferModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFromId?: BucketType
}

export function TransferModal({ open, onOpenChange, initialFromId }: TransferModalProps) {
  const [step, setStep] = useState<"setup" | "processing" | "success">("setup")
  const [amount, setAmount] = useState("")
  const [fromId, setFromId] = useState<BucketType>(initialFromId || "spendable")
  const [toId, setToId] = useState<BucketType>("savings")
  const { transferBetweenBuckets, buckets, getBucket, isLoading } = useBlockchainBuckets()
  const { isConnected, connect } = useWallet()
  const { toast } = useToast()

  const fromBucket = getBucket(fromId)
  const toBucket = getBucket(toId)

  const handleTransfer = async () => {
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
      await transferBetweenBuckets(fromId, toId, numAmount)
      setStep("success")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed'
      toast({
        title: "Transfer Failed",
        description: errorMessage,
        variant: "destructive",
      })
      setStep("setup") // Go back to setup
    }
  }

  const reset = () => {
    setStep("setup")
    setAmount("")
    onOpenChange(false)
  }

  const isValid = amount && Number(amount) > 0 && Number(amount) <= (fromBucket?.balance || 0) && fromId !== toId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-purple-500/20 sm:max-w-md bg-black/90 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <ArrowRightLeft className="w-5 h-5 text-purple-400" />
            </div>
            Transfer Funds
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Move liquidity instantly between your PayWarp buckets.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "setup" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-purple-300">From</Label>
                  <Select value={fromId} onValueChange={(val) => setFromId(val as BucketType)}>
                    <SelectTrigger className="glass border-purple-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-purple-500/20">
                      {buckets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-purple-300">To</Label>
                  <Select value={toId} onValueChange={(val) => setToId(val as BucketType)}>
                    <SelectTrigger className="glass border-purple-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-purple-500/20">
                      {buckets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-purple-300">Amount</Label>
                  <span className="text-xs text-muted-foreground">
                    Available:{" "}
                    <span className="text-foreground font-mono font-bold">${fromBucket?.balance.toLocaleString()}</span>
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 text-3xl h-16 glass border-purple-500/30 focus:border-purple-500 font-bold bg-transparent"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Network Fee</span>
                <span className="text-xs font-bold text-green-400">
                  {isConnected ? "~$0.01" : "Connect wallet"}
                </span>
              </div>
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
                <p className="text-xl font-bold text-foreground">Moving Liquidity</p>
                <p className="text-sm text-muted-foreground mt-1">Rebalancing bucket allocations...</p>
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
                <p className="text-2xl font-bold text-foreground">Transfer Complete!</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-[240px] mx-auto">
                  ${Number(amount).toLocaleString()} has been moved to {toBucket?.name}.
                </p>
              </div>
              <Button onClick={reset} className="w-full gradient-primary text-white h-12 font-bold">
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {step === "setup" && (
          <DialogFooter>
            <Button
              disabled={!isValid || isLoading}
              onClick={handleTransfer}
              className="w-full gradient-primary text-white h-12 text-lg font-bold flex gap-2"
            >
              {isConnected ? "Confirm Transfer" : "Connect & Transfer"}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}