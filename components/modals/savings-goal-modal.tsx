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
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Target, Calendar as CalendarIcon, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useSavingsGoals } from "@/hooks/use-savings-goals"
import { useToast } from "@/hooks/use-toast"

interface SavingsGoalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SavingsGoalModal({ open, onOpenChange }: SavingsGoalModalProps) {
  const [step, setStep] = useState<"form" | "processing" | "success">("form")
  const [formData, setFormData] = useState({
    name: "",
    targetAmount: "",
    targetDate: undefined as Date | undefined,
    description: "",
  })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  
  const { createSavingsGoal, isLoading } = useSavingsGoals()
  const { toast } = useToast()

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a goal name.",
        variant: "destructive",
      })
      return
    }

    if (!formData.targetAmount || Number(formData.targetAmount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid target amount.",
        variant: "destructive",
      })
      return
    }

    if (!formData.targetDate) {
      toast({
        title: "Validation Error",
        description: "Please select a target date.",
        variant: "destructive",
      })
      return
    }

    if (formData.targetDate <= new Date()) {
      toast({
        title: "Validation Error",
        description: "Target date must be in the future.",
        variant: "destructive",
      })
      return
    }

    setStep("processing")
    
    try {
      await createSavingsGoal(
        Number(formData.targetAmount),
        formData.targetDate,
        formData.description || formData.name
      )
      
      setStep("success")
    } catch (err) {
      console.error('Failed to create savings goal:', err)
      setStep("form") // Go back to form on error
    }
  }

  const reset = () => {
    setStep("form")
    setFormData({
      name: "",
      targetAmount: "",
      targetDate: undefined,
      description: "",
    })
    onOpenChange(false)
  }

  const handleClose = (open: boolean) => {
    if (!open && step !== "processing") {
      reset()
    }
    onOpenChange(open)
  }

  const isFormValid = formData.name.trim() && 
                     formData.targetAmount && 
                     Number(formData.targetAmount) > 0 && 
                     formData.targetDate &&
                     formData.targetDate > new Date()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass border-purple-500/20 sm:max-w-md bg-black/90 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <Target className="w-5 h-5 text-purple-400" />
            </div>
            Create Savings Goal
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Set a target amount and date to start building towards your financial goals.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="goal-name" className="text-purple-300 font-bold">
                  Goal Name
                </Label>
                <Input
                  id="goal-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Emergency Fund, Vacation, New Car"
                  className="glass border-purple-500/30 focus:border-purple-500 bg-transparent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-amount" className="text-purple-300 font-bold">
                  Target Amount (USDC)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="target-amount"
                    type="number"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetAmount: e.target.value }))}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="pl-8 text-2xl h-14 glass border-purple-500/30 focus:border-purple-500 font-bold bg-transparent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-purple-300 font-bold">Target Date</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal glass border-purple-500/30 bg-transparent",
                        !formData.targetDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.targetDate ? format(formData.targetDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 glass border-purple-500/20" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.targetDate}
                      onSelect={(date) => {
                        setFormData(prev => ({ ...prev, targetDate: date }))
                        setIsCalendarOpen(false)
                      }}
                      disabled={(date) => date <= new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-purple-300 font-bold">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What is this goal for? Any additional details..."
                  className="glass border-purple-500/30 focus:border-purple-500 bg-transparent resize-none"
                  rows={3}
                />
              </div>

              {formData.targetAmount && formData.targetDate && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Goal Summary</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Target: <span className="text-foreground font-bold">${Number(formData.targetAmount).toLocaleString()}</span></div>
                    <div>Deadline: <span className="text-foreground font-bold">{format(formData.targetDate, "PPP")}</span></div>
                    <div className="text-xs text-purple-400 mt-2">
                      💡 Funds will be locked until goal completion to earn bonus APY
                    </div>
                  </div>
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
                <p className="text-xl font-bold text-foreground">Creating Goal</p>
                <p className="text-sm text-muted-foreground mt-1">Setting up your savings target...</p>
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
                <p className="text-2xl font-bold text-foreground">Goal Created!</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
                  Your savings goal "{formData.name}" has been created successfully. Start contributing to unlock bonus rewards!
                </p>
              </div>
              <Button onClick={reset} className="w-full gradient-primary text-white h-12 font-bold">
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {step === "form" && (
          <DialogFooter>
            <Button
              disabled={!isFormValid || isLoading}
              onClick={handleSubmit}
              className="w-full gradient-primary text-white h-12 text-lg font-bold flex gap-2"
            >
              Create Savings Goal
              <Target className="w-5 h-5" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}