'use client'

import React, { useState, useEffect } from 'react'
import { EnhancedExpenseForm } from '@/components/enhanced-expense-form'
import { OCRSettings } from '@/components/ocr-settings'
import { BottomNav } from '@/components/bottom-nav'
import { DynamicReceiptData } from '@/lib/enhanced-ocr-processor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { 
  Receipt, 
  Settings, 
  History, 
  TrendingUp, 
  Calendar,
  DollarSign,
  Building,
  Tag,
  Link,
  Wallet,
  CheckCircle,
  Clock
} from 'lucide-react'
import { Label } from '@radix-ui/react-label'
import { useBlockchainExpenseTracking } from '@/hooks/use-blockchain-expense-tracking'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { formatEther } from 'viem'

interface ProcessedExpense extends DynamicReceiptData {
  id: string
  submittedAt: Date
  bucketId?: string
  status: 'pending' | 'processed' | 'failed' | 'verified'
  onBlockchain?: boolean
  blockchainId?: string
  verified?: boolean
}

export default function ExpensesPage() {
  const { address, isConnected } = useAccount()
  const {
    expenses: blockchainExpenses,
    recurringExpenses,
    stats: blockchainStats,
    isLoading: blockchainLoading,
    isSubmitting,
    addExpense: addBlockchainExpense,
    verifyExpense,
    formatExpenseForDisplay,
    isConnected: contractConnected
  } = useBlockchainExpenseTracking()

  const [expenses, setExpenses] = useState<ProcessedExpense[]>([])
  const [selectedExpense, setSelectedExpense] = useState<ProcessedExpense | null>(null)
  const [useBlockchain, setUseBlockchain] = useState(true)
  const [stats, setStats] = useState({
    totalExpenses: 0,
    totalAmount: 0,
    thisMonth: 0,
    avgConfidence: 0
  })
  const [showBlockchainExpenses, setShowBlockchainExpenses] = useState(true)

  // Load expenses from localStorage on mount
  useEffect(() => {
    const savedExpenses = localStorage.getItem('processedExpenses')
    if (savedExpenses) {
      try {
        const parsed = JSON.parse(savedExpenses).map((exp: any) => ({
          ...exp,
          date: new Date(exp.date),
          submittedAt: new Date(exp.submittedAt)
        }))
        setExpenses(parsed)
      } catch (error) {
        console.error('Error loading expenses:', error)
      }
    }
  }, [])

  // Save expenses to localStorage whenever expenses change
  useEffect(() => {
    if (expenses.length > 0) {
      localStorage.setItem('processedExpenses', JSON.stringify(expenses))
    }
  }, [expenses])

  // Calculate combined stats from both local and blockchain expenses
  useEffect(() => {
    const localStats = calculateLocalStats(expenses)
    
    if (useBlockchain && blockchainExpenses.length > 0) {
      // Only use blockchain stats when blockchain is enabled
      const blockchainStats = calculateBlockchainStats(blockchainExpenses)
      
      setStats({
        totalExpenses: blockchainStats.totalExpenses + localStats.totalExpenses,
        totalAmount: blockchainStats.totalAmount + localStats.totalAmount,
        thisMonth: blockchainStats.thisMonth + localStats.thisMonth,
        avgConfidence: localStats.totalExpenses > 0 && blockchainStats.totalExpenses > 0
          ? (localStats.avgConfidence + blockchainStats.avgConfidence) / 2
          : localStats.avgConfidence || blockchainStats.avgConfidence
      })
    } else {
      // Only local stats when blockchain is disabled
      setStats(localStats)
    }
  }, [expenses, blockchainExpenses, useBlockchain])

  const calculateLocalStats = (expenseList: ProcessedExpense[]) => {
    const now = new Date()
    const thisMonth = expenseList.filter(exp => 
      exp.date.getMonth() === now.getMonth() && 
      exp.date.getFullYear() === now.getFullYear()
    )

    const totalAmount = expenseList.reduce((sum, exp) => sum + exp.amount, 0)
    const avgConfidence = expenseList.length > 0 
      ? expenseList.reduce((sum, exp) => sum + exp.confidence, 0) / expenseList.length 
      : 0

    return {
      totalExpenses: expenseList.length,
      totalAmount,
      thisMonth: thisMonth.reduce((sum, exp) => sum + exp.amount, 0),
      avgConfidence
    }
  }

  const calculateBlockchainStats = (blockchainExpenseList: any[]) => {
    const now = new Date()
    const formattedExpenses = blockchainExpenseList.map(formatExpenseForDisplay)
    const thisMonth = formattedExpenses.filter(exp => 
      exp.date.getMonth() === now.getMonth() && 
      exp.date.getFullYear() === now.getFullYear()
    )

    const totalAmount = formattedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
    const avgConfidence = formattedExpenses.length > 0 
      ? formattedExpenses.reduce((sum, exp) => sum + exp.confidence, 0) / formattedExpenses.length 
      : 0

    return {
      totalExpenses: formattedExpenses.length,
      totalAmount,
      thisMonth: thisMonth.reduce((sum, exp) => sum + exp.amount, 0),
      avgConfidence
    }
  }

  const handleExpenseExtracted = (data: DynamicReceiptData) => {
    console.log('Expense extracted:', data)
  }

  const handleExpenseSubmitted = async (data: DynamicReceiptData) => {
    // If blockchain is enabled and connected, submit to blockchain only
    if (useBlockchain && contractConnected && isConnected) {
      try {
        const success = await addBlockchainExpense(data)
        if (success) {
          toast.success('Expense saved on blockchain!')
          // Don't save locally - it will be fetched from blockchain
          return
        } else {
          toast.warning('Blockchain submission failed, saving locally instead')
        }
      } catch (error) {
        console.error('Blockchain submission error:', error)
        toast.warning('Blockchain submission failed, saving locally instead')
      }
    }
    
    // Only save locally if blockchain is disabled or submission failed
    const newExpense: ProcessedExpense = {
      ...data,
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      submittedAt: new Date(),
      status: 'processed',
      onBlockchain: false
    }

    setExpenses(prev => [newExpense, ...prev])
    toast.success('Expense saved locally!')
    
    console.log('Expense submitted:', newExpense)
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  // Get combined expenses for display
  const getCombinedExpenses = () => {
    // Only show local expenses that are NOT on blockchain
    const localOnlyExpenses = expenses
      .filter(exp => !exp.onBlockchain)
      .map(exp => ({ ...exp, source: 'local' }))
    
    if (useBlockchain && showBlockchainExpenses && blockchainExpenses.length > 0) {
      const blockchainExpensesFormatted = blockchainExpenses.map(exp => ({
        ...formatExpenseForDisplay(exp),
        source: 'blockchain',
        onBlockchain: true,
        verified: true // Blockchain expenses are inherently verified
      }))
      
      // Combine and sort by date
      return [...localOnlyExpenses, ...blockchainExpensesFormatted]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    
    return localOnlyExpenses
  }

  const getBusinessTypeIcon = (type: string) => {
    switch (type) {
      case 'restaurant': return '🍽️'
      case 'retail': return '🛍️'
      case 'gas-station': return '⛽'
      case 'grocery': return '🛒'
      case 'pharmacy': return '💊'
      case 'service': return '🔧'
      default: return '📄'
    }
  }

  const handleVerifyExpense = async (expense: any) => {
    if (expense.source === 'blockchain' && expense.id) {
      try {
        const success = await verifyExpense(Number(expense.id))
        if (success) {
          toast.success('Expense verified on blockchain!')
        }
      } catch (error) {
        console.error('Verification error:', error)
        toast.error('Failed to verify expense')
      }
    }
  }

  const combinedExpenses = getCombinedExpenses()

  return (
    <div className="min-h-screen pb-24">
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expense Tracking</h1>
          <p className="text-muted-foreground">
            Scan receipts and track expenses with AI-powered OCR
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            {stats.totalExpenses} receipts
          </Badge>
          {isConnected && contractConnected && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Blockchain Connected
            </Badge>
          )}
          {blockchainLoading && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3 animate-spin" />
              Loading...
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-semibold">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-lg font-semibold">{formatCurrency(stats.thisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Receipts</p>
                <p className="text-lg font-semibold">{stats.totalExpenses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-lg font-semibold">{Math.round(stats.avgConfidence * 100)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="scan" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scan" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Scan Receipt
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recurring
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan">
          <div className="space-y-4">
            {/* Blockchain Toggle */}
            {isConnected && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      <Label htmlFor="blockchain-toggle">Save to Blockchain</Label>
                    </div>
                    <Switch
                      id="blockchain-toggle"
                      checked={useBlockchain}
                      onCheckedChange={setUseBlockchain}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {useBlockchain 
                      ? 'Expenses will be saved both locally and on the blockchain for permanent record'
                      : 'Expenses will only be saved locally'
                    }
                  </p>
                  {useBlockchain && !contractConnected && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      Blockchain contract not connected. Expenses will be saved locally only.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            <EnhancedExpenseForm
              onExpenseExtracted={handleExpenseExtracted}
              onExpenseSubmitted={handleExpenseSubmitted}
              useBlockchain={useBlockchain && contractConnected}
            />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Expense History</CardTitle>
                {useBlockchain && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-blockchain">Show Blockchain</Label>
                    <Switch
                      id="show-blockchain"
                      checked={showBlockchainExpenses}
                      onCheckedChange={setShowBlockchainExpenses}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {combinedExpenses.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No expenses recorded yet</p>
                  <p className="text-sm text-muted-foreground">
                    Start by scanning your first receipt
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {combinedExpenses.map((expense: any, index: number) => (
                    <div
                      key={`${expense.source}-${expense.id}-${index}`}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {getBusinessTypeIcon(expense.businessType || 'other')}
                          </span>
                          <div>
                            <h3 className="font-medium">{expense.vendor}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {expense.date.toLocaleDateString()}
                              <Separator orientation="vertical" className="h-3" />
                              <Tag className="h-3 w-3" />
                              {expense.businessType || 'other'}
                              {expense.source === 'blockchain' && (
                                <>
                                  <Separator orientation="vertical" className="h-3" />
                                  <Link className="h-3 w-3" />
                                  <span>Blockchain</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(expense.amount, expense.currency)}
                          </p>
                          <div className="flex items-center gap-1">
                            <Badge 
                              variant={expense.confidence > 0.8 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {Math.round(expense.confidence * 100)}%
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {expense.source === 'blockchain' ? 'verified' : expense.status}
                            </Badge>
                            {expense.onBlockchain && (
                              <Badge variant="default" className="text-xs bg-green-500">
                                <Link className="h-2 w-2 mr-1" />
                                Chain
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {expense.items && expense.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">
                            {expense.items.length} items
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {expense.items.slice(0, 3).map((item: any, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {item.name} - {formatCurrency(item.price, expense.currency)}
                              </Badge>
                            ))}
                            {expense.items.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{expense.items.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring">
          <Card>
            <CardHeader>
              <CardTitle>Recurring Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {!isConnected || !contractConnected ? (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Connect wallet to manage recurring expenses</p>
                  <p className="text-sm text-muted-foreground">
                    Recurring expenses are stored on the blockchain
                  </p>
                </div>
              ) : recurringExpenses.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No recurring expenses set up</p>
                  <p className="text-sm text-muted-foreground">
                    Add recurring expenses like subscriptions or monthly bills
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recurringExpenses.map((recurring: any) => (
                    <div
                      key={recurring.id.toString()}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🔄</span>
                          <div>
                            <h3 className="font-medium">{recurring.vendor}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(parseFloat(formatEther(recurring.amount)), recurring.currency)}
                              <Separator orientation="vertical" className="h-3" />
                              <Tag className="h-3 w-3" />
                              {recurring.category}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={recurring.active ? "default" : "secondary"}>
                            {recurring.active ? "Active" : "Inactive"}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            Next: {new Date(Number(recurring.nextDue) * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <OCRSettings />
        </TabsContent>
      </Tabs>

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">
                    {getBusinessTypeIcon(selectedExpense.businessType || 'other')}
                  </span>
                  {selectedExpense.vendor}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedExpense(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Amount</Label>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedExpense.amount, selectedExpense.currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <p>{selectedExpense.date.toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Business Type</Label>
                  <p className="capitalize">{selectedExpense.businessType || 'other'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Confidence</Label>
                  <Badge variant={selectedExpense.confidence > 0.8 ? "default" : "secondary"}>
                    {Math.round(selectedExpense.confidence * 100)}%
                  </Badge>
                </div>
              </div>

              {selectedExpense.items && selectedExpense.items.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Items</Label>
                  <div className="mt-2 space-y-2">
                    {selectedExpense.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span>{item.name}</span>
                        <div className="flex items-center gap-2">
                          {item.quantity && (
                            <Badge variant="outline">Qty: {item.quantity}</Badge>
                          )}
                          <span className="font-medium">
                            {formatCurrency(item.price, selectedExpense.currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedExpense.location && (
                <div>
                  <Label className="text-sm font-medium">Location</Label>
                  <p className="text-sm text-muted-foreground">
                    {[
                      selectedExpense.location.address,
                      selectedExpense.location.city,
                      selectedExpense.location.state,
                      selectedExpense.location.zipCode
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Processed on {selectedExpense.submittedAt.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
      
      <BottomNav />
    </div>
  )
}