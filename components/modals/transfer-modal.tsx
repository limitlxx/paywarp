"use client"

import { useState, useMemo } from "react"
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
import { useBucketBalances } from "@/hooks/use-bucket-balances"
import { useWallet } from "@/hooks/use-wallet"
import { useToast } from "@/hooks/use-toast"
import type { BucketType } from "@/lib/types"
import { useEffect } from "react"
import { useContract, useContractWrite } from "@/lib/contracts"
import { useNetwork } from "@/hooks/use-network"
import { parseUnits } from "viem"
import { usePublicClient } from "wagmi"

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
  const { buckets, isLoading: bucketsLoading, refetch } = useBucketBalances()
  const { isConnected, connect } = useWallet()
  const { toast } = useToast()
  const { currentNetwork } = useNetwork()
  const bucketVaultWriteContract = useContractWrite('bucketVault', currentNetwork)
  const publicClient = usePublicClient()
  const [isTransferring, setIsTransferring] = useState(false)

  // Convert bucket balances to the format expected by the UI
  const uiBuckets = useMemo(() => {
    return buckets.map(bucket => ({
      id: bucket.name as BucketType,
      name: bucket.name.charAt(0).toUpperCase() + bucket.name.slice(1),
      balance: Number(bucket.formattedBalance), // Display balance (formatted from contract's 18 decimals with 6 decimal display)
      rawBalance: bucket.balance, // Keep raw bigint for contract calls
      isYielding: bucket.isYielding,
    }))
  }, [buckets])

  // Debug: Log buckets data
  useEffect(() => {
    console.log('🔍 Transfer Modal - Buckets data:', {
      bucketsCount: uiBuckets.length,
      buckets: uiBuckets.map(b => ({ id: b.id, name: b.name, balance: b.balance })),
    })
  }, [uiBuckets])

  // Update fromId when initialFromId changes
  useEffect(() => {
    if (initialFromId) {
      setFromId(initialFromId)
    }
  }, [initialFromId])

  const fromBucket = uiBuckets.find(b => b.id === fromId)
  const toBucket = uiBuckets.find(b => b.id === toId)

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

    if (!bucketVaultWriteContract) {
      toast({
        title: "Contract Not Available",
        description: "Please switch to Sepolia testnet.",
        variant: "destructive",
      })
      return
    }

    // Validate before processing
    if (!isValid) {
      toast({
        title: "Invalid Transfer",
        description: "Please check the amount and selected buckets.",
        variant: "destructive",
      })
      return
    }

    setStep("processing")
    setIsTransferring(true)
    
    try {
      const numAmount = Number(amount)
      
      // Get the actual bucket data to see the raw balance
      const fromBucketData = buckets.find(b => b.name === fromId)
      
      console.log('🔄 Initiating transfer:', { 
        fromId, 
        toId, 
        amount: numAmount,
        displayBalance: fromBucket?.balance,
        rawBalance: fromBucketData?.balance.toString(),
        formattedBalance: fromBucketData?.formattedBalance,
      })
      
      // CRITICAL FIX: The contract stores balances in 6 decimals (USDC format)
      // NOT 18 decimals as initially thought!
      // So we just need to parse the amount with 6 decimals
      const amountIn6Decimals = parseUnits(amount, 6)
      
      console.log('💱 Decimal conversion:', {
        inputAmount: amount,
        amountIn6Decimals: amountIn6Decimals.toString(),
        rawBalance: fromBucketData?.balance.toString(),
        sufficientBalance: fromBucketData ? amountIn6Decimals <= fromBucketData.balance : false,
      })
      
      const hash = await bucketVaultWriteContract.write.transferBetweenBuckets([
        fromId,
        toId,
        amountIn6Decimals
      ])
      
      console.log('📝 Transaction hash:', hash)
      
      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        if (receipt.status === 'success') {
          console.log('✅ Transfer successful')
          
          // Refresh balances
          await refetch()
          
          setStep("success")
          
          // Show success toast
          toast({
            title: "Transfer Complete",
            description: `Successfully moved $${numAmount.toFixed(2)} from ${fromBucket?.name} to ${toBucket?.name}`,
          })
        } else {
          throw new Error('Transaction failed')
        }
      }
    } catch (err) {
      console.error('❌ Transfer error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed'
      toast({
        title: "Transfer Failed",
        description: errorMessage,
        variant: "destructive",
      })
      setStep("setup") // Go back to setup
    } finally {
      setIsTransferring(false)
    }
  }

  const reset = () => {
    setStep("setup")
    setAmount("")
    if (initialFromId) {
      setFromId(initialFromId)
    }
    onOpenChange(false)
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  const isValid = amount && Number(amount) > 0 && Number(amount) <= (fromBucket?.balance || 0) && fromId !== toId

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                      {uiBuckets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <div className="flex justify-between items-center w-full">
                            <span>{b.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ${b.balance.toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fromBucket && (
                    <p className="text-xs text-muted-foreground">
                      Balance: <span className="text-foreground font-mono font-bold">${fromBucket.balance.toFixed(2)}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-purple-300">To</Label>
                  <Select value={toId} onValueChange={(val) => setToId(val as BucketType)}>
                    <SelectTrigger className="glass border-purple-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-purple-500/20">
                      {uiBuckets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <div className="flex justify-between items-center w-full">
                            <span>{b.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ${b.balance.toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {toBucket && (
                    <p className="text-xs text-muted-foreground">
                      Balance: <span className="text-foreground font-mono font-bold">${toBucket.balance.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-purple-300">Amount (USDC)</Label>
                  <button
                    type="button"
                    onClick={() => setAmount(fromBucket?.balance.toString() || "0")}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                  >
                    Max: ${fromBucket?.balance.toFixed(2) || "0.00"}
                  </button>
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
                    step="0.01"
                    min="0"
                    max={fromBucket?.balance || 0}
                    className="pl-8 text-3xl h-16 glass border-purple-500/30 focus:border-purple-500 font-bold bg-transparent"
                  />
                </div>
                {amount && Number(amount) > 0 && fromBucket && (
                  <p className="text-xs text-muted-foreground">
                    After transfer: {fromBucket.name} will have ${(fromBucket.balance - Number(amount)).toFixed(2)}
                  </p>
                )}
              </div>

              {fromId === toId && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  Please select different buckets for transfer
                </div>
              )}

              {amount && Number(amount) > (fromBucket?.balance || 0) && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  Insufficient balance in {fromBucket?.name}
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
                <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
                  ${Number(amount).toFixed(2)} has been moved from {fromBucket?.name} to {toBucket?.name}.
                </p>
                {fromBucket && toBucket && (
                  <div className="mt-4 p-3 rounded-lg bg-background/50 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{fromBucket.name}:</span>
                      <span className="font-mono">${fromBucket.balance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{toBucket.name}:</span>
                      <span className="font-mono">${toBucket.balance.toFixed(2)}</span>
                    </div>
                  </div>
                )}
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
              disabled={!isValid || bucketsLoading || isTransferring}
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