"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Clock, 
  Plus, 
  Calendar, 
  DollarSign, 
  Building, 
  Tag,
  Trash2,
  Edit,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from "lucide-react"
import { useBlockchainExpenseTracking } from "@/hooks/use-blockchain-expense-tracking"
import { useExpenseAudit } from "@/hooks/use-expense-audit"
import { useWallet } from "@/hooks/use-wallet"
import { toast } from "sonner"
import { formatEther } from "viem"

interface RecurringExpenseForm {
  vendor: string
  amount: string
  currency: string
  category: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  nextDue: string
}

const initialForm: RecurringExpenseForm = {
  vendor: '',
  amount: '',
  currency: 'USD',
  frequency: 'monthly',
  category: 'utilities',
  nextDue: ''
}

const frequencyLabels = {
  weekly: 'Weekly',
  monthly: 'Monthly', 
  quarterly: 'Quarterly',
  yearly: 'Yearly'
}

const categoryOptions = [
  { value: 'utilities', label: 'Utilities', icon: '⚡' },
  { value: 'rent', label: 'Rent/Mortgage', icon: '🏠' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'subscriptions', label: 'Subscriptions', icon: '📱' },
  { value: 'loans', label: 'Loans', icon: '🏦' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '📄' }
]

export function RecurringExpensesManager() {
  const { isConnected } = useWallet()
  const {
    recurringExpenses,
    isLoading,
    isSubmitting,
    addRecurringExpense,
    loadExpenses,
    isConnected: contractConnected
  } = useBlockchainExpenseTracking()
  
  const { refreshExpenseAudit } = useExpenseAudit()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<RecurringExpenseForm>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Debug logging
  useEffect(() => {
    console.log('RecurringExpensesManager state:', {
      isConnected,
      contractConnected,
      isLoading,
      recurringExpensesCount: recurringExpenses.length
    })
  }, [isConnected, contractConnected, isLoading, recurringExpenses.length])

  // Set default next due date to next month
  useEffect(() => {
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(1) // First of next month
    setForm(prev => ({
      ...prev,
      nextDue: nextMonth.toISOString().split('T')[0]
    }))
  }, [])

  // Load expenses when wallet connects (only once)
  useEffect(() => {
    if (isConnected && contractConnected) {
      console.log('Wallet and contract connected, expenses should load automatically')
      // Don't call loadExpenses here - let the hook handle it automatically
    } else {
      console.log('Not loading expenses:', { isConnected, contractConnected })
    }
  }, [isConnected, contractConnected]) // Remove loadExpenses from dependencies

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!form.vendor || !form.amount || !form.nextDue) {
      toast.error('Please fill in all required fields')
      return
    }

    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const nextDueDate = new Date(form.nextDue)
    if (nextDueDate <= new Date()) {
      toast.error('Next due date must be in the future')
      return
    }

    try {
      const success = await addRecurringExpense(
        form.vendor,
        amount,
        form.currency,
        form.category,
        form.frequency,
        nextDueDate
      )

      if (success) {
        setForm(initialForm)
        setIsDialogOpen(false)
        setEditingId(null)
        
        // Refresh expense audit to include new recurring expense
        await refreshExpenseAudit()
        
        // Set next month as default for next form
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setDate(1)
        setForm(prev => ({
          ...prev,
          nextDue: nextMonth.toISOString().split('T')[0]
        }))
      }
    } catch (error) {
      console.error('Error adding recurring expense:', error)
    }
  }

  const formatCurrency = (amount: string, currency: string = 'USD') => {
    const numAmount = parseFloat(formatEther(BigInt(amount)))
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(numAmount)
  }

  const getNextDueStatus = (nextDue: bigint) => {
    const dueDate = new Date(Number(nextDue) * 1000)
    const now = new Date()
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { status: 'overdue', label: 'Overdue', color: 'text-red-400' }
    } else if (diffDays <= 7) {
      return { status: 'due-soon', label: `Due in ${diffDays} days`, color: 'text-yellow-400' }
    } else {
      return { status: 'upcoming', label: `Due in ${diffDays} days`, color: 'text-green-400' }
    }
  }

  const getCategoryIcon = (category: string) => {
    const option = categoryOptions.find(opt => opt.value === category)
    return option?.icon || '📄'
  }

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              Recurring Expenses
            </CardTitle>
            <CardDescription>
              Manage automated recurring bills and subscriptions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                await loadExpenses()
                await refreshExpenseAudit()
              }}
              size="sm"
              variant="outline"
              className="glass border-blue-500/20 text-blue-400 gap-1"
              disabled={isLoading}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-white gap-2">
                  <Plus className="w-4 h-4" />
                  Add Recurring Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-purple-500/20 max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Recurring Expense</DialogTitle>
                  <DialogDescription>
                    Set up a new recurring expense that will be tracked automatically
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor">Vendor/Company *</Label>
                    <Input
                      id="vendor"
                      placeholder="e.g., Netflix, Electric Company"
                      value={form.vendor}
                      onChange={(e) => setForm(prev => ({ ...prev, vendor: e.target.value }))}
                      className="glass border-white/10 bg-transparent"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.amount}
                          onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="glass border-white/10 pl-10 bg-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={form.currency} onValueChange={(value) => setForm(prev => ({ ...prev, currency: value }))}>
                        <SelectTrigger className="glass border-white/10 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass border-purple-500/20">
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={form.category} onValueChange={(value) => setForm(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger className="glass border-white/10 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass border-purple-500/20">
                        {categoryOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <span>{option.icon}</span>
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select value={form.frequency} onValueChange={(value: any) => setForm(prev => ({ ...prev, frequency: value }))}>
                      <SelectTrigger className="glass border-white/10 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass border-purple-500/20">
                        {Object.entries(frequencyLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nextDue">Next Due Date *</Label>
                    <Input
                      id="nextDue"
                      type="date"
                      value={form.nextDue}
                      onChange={(e) => setForm(prev => ({ ...prev, nextDue: e.target.value }))}
                      className="glass border-white/10 bg-transparent"
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false)
                        setForm(initialForm)
                        setEditingId(null)
                      }}
                      className="flex-1 glass border-white/10 bg-transparent"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 gradient-primary text-white"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Add Expense'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!isConnected ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Connect your wallet to manage recurring expenses</p>
          </div>
        ) : !contractConnected ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Contract not available. Please check your network connection.</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" />
            <p className="text-muted-foreground">Loading recurring expenses...</p>
          </div>
        ) : recurringExpenses.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No recurring expenses set up</p>
            <p className="text-sm text-muted-foreground">
              Add your first recurring expense to start automated tracking
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="glass border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-sm text-muted-foreground">Active Expenses</p>
                      <p className="text-lg font-semibold">
                        {recurringExpenses.filter(exp => exp.active).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Total</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(
                          recurringExpenses
                            .filter(exp => exp.active)
                            .reduce((sum, exp) => {
                              // Convert to monthly equivalent
                              const amount = parseFloat(formatEther(exp.amount))
                              const frequency = Number(exp.frequency)
                              const monthlyAmount = frequency === 2629746 ? amount : // monthly
                                                  frequency === 604800 ? amount * 4.33 : // weekly
                                                  frequency === 7889238 ? amount / 3 : // quarterly  
                                                  frequency === 31556952 ? amount / 12 : // yearly
                                                  amount
                              return sum + monthlyAmount
                            }, 0).toString()
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <div>
                      <p className="text-sm text-muted-foreground">Due Soon</p>
                      <p className="text-lg font-semibold">
                        {recurringExpenses.filter(exp => {
                          const dueDate = new Date(Number(exp.nextDue) * 1000)
                          const now = new Date()
                          const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                          return diffDays <= 7 && diffDays >= 0
                        }).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Expenses Table */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-purple-500/10 hover:bg-transparent">
                    <TableHead className="text-purple-300">Expense</TableHead>
                    <TableHead className="text-purple-300">Amount</TableHead>
                    <TableHead className="text-purple-300">Frequency</TableHead>
                    <TableHead className="text-purple-300">Next Due</TableHead>
                    <TableHead className="text-purple-300">Status</TableHead>
                    <TableHead className="text-purple-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringExpenses.map((expense) => {
                    const dueStatus = getNextDueStatus(expense.nextDue)
                    return (
                      <TableRow key={expense.id.toString()} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="text-xl">
                              {getCategoryIcon(expense.category)}
                            </span>
                            <div>
                              <p className="font-medium">{expense.vendor}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {expense.category}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono">
                            {formatCurrency(expense.amount.toString(), expense.currency)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-blue-500/20 text-blue-400">
                            {frequencyLabels[
                              Number(expense.frequency) === 604800 ? 'weekly' :
                              Number(expense.frequency) === 2629746 ? 'monthly' :
                              Number(expense.frequency) === 7889238 ? 'quarterly' :
                              Number(expense.frequency) === 31556952 ? 'yearly' : 'monthly'
                            ]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{new Date(Number(expense.nextDue) * 1000).toLocaleDateString()}</p>
                            <p className={`text-xs ${dueStatus.color}`}>
                              {dueStatus.label}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={expense.active 
                              ? "border-green-500/20 text-green-400" 
                              : "border-gray-500/20 text-gray-400"
                            }
                          >
                            {expense.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-blue-500/20"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-red-500/20 text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}