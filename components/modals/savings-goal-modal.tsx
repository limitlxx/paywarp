"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Target, Loader2, DollarSign, Clock, FileText } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useSavingsGoals } from "@/hooks/use-savings-goals"

interface SavingsGoalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SavingsGoalModal({ open, onOpenChange }: SavingsGoalModalProps) {
  const { createSavingsGoal, isLoading } = useSavingsGoals()
  
  const [formData, setFormData] = useState({
    name: "",
    targetAmount: "",
    targetDate: undefined as Date | undefined,
    description: "",
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = "Goal name is required"
    }
    
    if (!formData.targetAmount || parseFloat(formData.targetAmount) <= 0) {
      newErrors.targetAmount = "Target amount must be greater than 0"
    }
    
    if (!formData.targetDate) {
      newErrors.targetDate = "Target date is required"
    } else if (formData.targetDate <= new Date()) {
      newErrors.targetDate = "Target date must be in the future"
    }
    
    if (!formData.description.trim()) {
      newErrors.description = "Description is required"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    try {
      await createSavingsGoal(
        parseFloat(formData.targetAmount),
        formData.targetDate!,
        formData.description
      )
      
      // Reset form and close modal
      setFormData({
        name: "",
        targetAmount: "",
        targetDate: undefined,
        description: "",
      })
      setErrors({})
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create savings goal:', error)
    }
  }

  const handleInputChange = (field: string, value: string | Date | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const calculateMonthsToTarget = () => {
    if (!formData.targetDate) return null
    
    const now = new Date()
    const target = formData.targetDate
    const diffTime = target.getTime() - now.getTime()
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))
    
    return diffMonths
  }

  const calculateMonthlySavings = () => {
    const months = calculateMonthsToTarget()
    const amount = parseFloat(formData.targetAmount)
    
    if (!months || !amount || months <= 0) return null
    
    return amount / months
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-purple-500/20 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className="w-6 h-6 text-purple-400" />
            Create Savings Goal
          </DialogTitle>
          <DialogDescription>
            Set up a new savings goal with fund locking and progress tracking. 
            Funds will be locked until the goal is completed and earn bonus APY upon completion.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Goal Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Goal Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Emergency Fund, Vacation, New Car"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={cn(
                  "glass border-white/10 bg-transparent",
                  errors.name && "border-red-500"
                )}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Target Amount */}
            <div className="space-y-2">
              <Label htmlFor="targetAmount" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Target Amount
              </Label>
              <div className="relative">
                <Input
                  id="targetAmount"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={formData.targetAmount}
                  onChange={(e) => handleInputChange("targetAmount", e.target.value)}
                  className={cn(
                    "glass border-white/10 bg-transparent pl-8",
                    errors.targetAmount && "border-red-500"
                  )}
                  disabled={isLoading}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
              </div>
              {errors.targetAmount && (
                <p className="text-sm text-red-400">{errors.targetAmount}</p>
              )}
            </div>
          </div>

          {/* Target Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Target Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal glass border-white/10 bg-transparent",
                    !formData.targetDate && "text-muted-foreground",
                    errors.targetDate && "border-red-500"
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.targetDate ? format(formData.targetDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 glass border-purple-500/20" align="start">
                <Calendar
                  mode="single"
                  selected={formData.targetDate}
                  onSelect={(date) => handleInputChange("targetDate", date)}
                  disabled={(date) => date <= new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.targetDate && (
              <p className="text-sm text-red-400">{errors.targetDate}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your savings goal and what you plan to achieve..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className={cn(
                "glass border-white/10 bg-transparent min-h-[100px]",
                errors.description && "border-red-500"
              )}
              disabled={isLoading}
            />
            {errors.description && (
              <p className="text-sm text-red-400">{errors.description}</p>
            )}
          </div>

          {/* Goal Summary */}
          {formData.targetAmount && formData.targetDate && (
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  Goal Summary
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Target Amount</p>
                    <p className="font-bold text-green-400">
                      ${parseFloat(formData.targetAmount).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time to Goal</p>
                    <p className="font-bold text-blue-400">
                      {calculateMonthsToTarget()} months
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly Savings Needed</p>
                    <p className="font-bold text-purple-400">
                      ${calculateMonthlySavings()?.toLocaleString() || "0"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-green-500/20 text-green-400">
                    Fund Locking Enabled
                  </Badge>
                  <Badge variant="outline" className="border-purple-500/20 text-purple-400">
                    +1% Bonus APY on Completion
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 glass border-white/10 bg-transparent"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gradient-primary text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Goal...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Create Goal
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}