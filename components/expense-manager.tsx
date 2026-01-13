"use client"

import { useState, useRef } from "react"
import { useExpenses } from "@/hooks/use-buckets"
import { useOCRMode } from "@/contexts/ocr-mode-context"
import { useExpenseTracking } from "@/hooks/use-expense-tracking"
import { EnhancedOCRProcessor, DynamicReceiptData } from "@/lib/enhanced-ocr-processor"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Receipt, Zap, FileSearch, Calendar, CreditCard, Repeat, Upload, Check, X, Edit, Settings } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"

export function ExpenseManager() {
  const { expenses } = useExpenses()
  const { mode, isOnline, apiBaseUrl } = useOCRMode()
  const { addExpense } = useExpenseTracking()
  const [isScanning, setIsScanning] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false)
  const [ocrProgress, setOCRProgress] = useState(0)
  const [extractedExpense, setExtractedExpense] = useState<DynamicReceiptData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize OCR processor with current settings
  const ocrProcessor = new EnhancedOCRProcessor(apiBaseUrl)

  const handleScanClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setIsOCRModalOpen(true)
    setIsProcessing(true)
    setOCRProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setOCRProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      // Process the receipt with enhanced OCR
      const result = await ocrProcessor.processReceipt(file, mode)
      setExtractedExpense(result)

      clearInterval(progressInterval)
      setOCRProgress(100)
      setIsProcessing(false)

      toast.success(`Receipt processed with ${mode.toUpperCase()} (${Math.round(result.confidence * 100)}% confidence)`)
    } catch (error) {
      console.error('OCR processing failed:', error)
      toast.error('Failed to process receipt. Please try again.')
      setIsOCRModalOpen(false)
      setIsProcessing(false)
    }
  }

  const handleOCRSave = async () => {
    if (!extractedExpense) return

    try {
      // Add expense using the expense tracking hook
      const newExpense = addExpense(extractedExpense, {
        bucketId: 'billings', // Default to billings bucket for expenses
        category: extractedExpense.businessType || 'other',
        tags: ['ocr-processed', extractedExpense.businessType || 'other'],
        notes: `Processed with ${mode.toUpperCase()} OCR (${Math.round(extractedExpense.confidence * 100)}% confidence)`
      })
      
      toast.success('Expense added to billing tracker!')
      
      setIsOCRModalOpen(false)
      setExtractedExpense(null)
      setOCRProgress(0)
    } catch (error) {
      console.error('Failed to save expense:', error)
      toast.error('Failed to save expense. Please try again.')
    }
  }

  const handleExpenseFieldChange = (field: keyof DynamicReceiptData, value: any) => {
    if (!extractedExpense) return
    
    setExtractedExpense(prev => prev ? {
      ...prev,
      [field]: value
    } : null)
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-400" />
              OCR Receipt Scanner
              <Badge variant="outline" className="text-xs">
                {mode.toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription className="text-[10px]">
              {mode === 'gemini' && 'High accuracy AI processing'}
              {mode === 'tesseract' && 'Offline browser processing'}
              {mode === 'hybrid' && 'Smart adaptive processing'}
              {!isOnline && mode === 'gemini' && ' (Offline - using Tesseract)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleScanClick}
              disabled={isScanning}
              className="w-full glass border-purple-500/30 hover:bg-purple-500/10 text-foreground h-12 gap-2 bg-transparent"
            >
              {isScanning ? (
                <Zap className="w-4 h-4 animate-pulse text-yellow-400" />
              ) : (
                <Upload className="w-4 h-4 text-purple-400" />
              )}
              {isScanning ? "Analyzing..." : "Upload Receipt"}
            </Button>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <Link href="/settings" className="ml-2">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Settings className="w-3 h-3 mr-1" />
                  Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-400" />
              Manual Entry
            </CardTitle>
            <CardDescription className="text-[10px]">Quickly add expenses to Billings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="w-full glass border-green-500/30 hover:bg-green-500/10 text-foreground h-12 bg-transparent"
            >
              Add Expense Manually
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* OCR Processing Modal */}
      <Dialog open={isOCRModalOpen} onOpenChange={setIsOCRModalOpen}>
        <DialogContent className="glass-card border-purple-500/30 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-purple-400" />
              Receipt Processing
            </DialogTitle>
            <DialogDescription>
              {isProcessing ? `Analyzing receipt with ${mode.toUpperCase()} OCR...` : "Review and confirm extracted data"}
            </DialogDescription>
          </DialogHeader>
          
          {isProcessing ? (
            <div className="space-y-4 py-6">
              <Progress value={ocrProgress} className="w-full" />
              <p className="text-center text-sm text-muted-foreground">
                Processing receipt with {mode.toUpperCase()}... {ocrProgress}%
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                {!isOnline && mode === 'gemini' && (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400/20">
                    Offline - Using Tesseract fallback
                  </Badge>
                )}
                {mode === 'hybrid' && (
                  <Badge variant="outline" className="text-blue-400 border-blue-400/20">
                    Hybrid Mode - Best accuracy
                  </Badge>
                )}
              </div>
            </div>
          ) : extractedExpense ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ocr-vendor" className="flex items-center gap-2">
                    Vendor
                    <Badge variant="outline" className="text-xs">
                      {Math.round(extractedExpense.confidence * 100)}% confidence
                    </Badge>
                  </Label>
                  <Input
                    id="ocr-vendor"
                    value={extractedExpense.vendor}
                    onChange={(e) => handleExpenseFieldChange('vendor', e.target.value)}
                    className="glass border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ocr-amount">Amount ($)</Label>
                  <Input
                    id="ocr-amount"
                    type="number"
                    value={extractedExpense.amount}
                    onChange={(e) => handleExpenseFieldChange('amount', parseFloat(e.target.value))}
                    className="glass border-white/10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ocr-category" className="flex items-center gap-2">
                  Business Type
                  <Badge 
                    variant="outline" 
                    className="text-xs border-blue-500/20 text-blue-400"
                  >
                    {extractedExpense.businessType || 'other'}
                  </Badge>
                </Label>
                <Select 
                  value={extractedExpense.businessType || 'other'}
                  onValueChange={(value) => handleExpenseFieldChange('businessType', value)}
                >
                  <SelectTrigger className="glass border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass border-purple-500/20">
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="gas-station">Gas Station</SelectItem>
                    <SelectItem value="grocery">Grocery</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ocr-currency">Currency</Label>
                  <Input
                    id="ocr-currency"
                    value={extractedExpense.currency}
                    onChange={(e) => handleExpenseFieldChange('currency', e.target.value)}
                    className="glass border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ocr-payment">Payment Method</Label>
                  <Input
                    id="ocr-payment"
                    value={extractedExpense.paymentMethod || ''}
                    onChange={(e) => handleExpenseFieldChange('paymentMethod', e.target.value)}
                    className="glass border-white/10"
                    placeholder="e.g., Credit Card"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ocr-date">Date</Label>
                <Input
                  id="ocr-date"
                  type="date"
                  value={extractedExpense.date.toISOString().split('T')[0]}
                  onChange={(e) => handleExpenseFieldChange('date', new Date(e.target.value))}
                  className="glass border-white/10"
                />
              </div>

              {extractedExpense.items && extractedExpense.items.length > 0 && (
                <div className="space-y-2">
                  <Label>Items ({extractedExpense.items.length})</Label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {extractedExpense.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-white/5 rounded text-xs">
                        <span>{item.name}</span>
                        <div className="flex items-center gap-2">
                          {item.quantity && (
                            <Badge variant="outline" className="text-xs">
                              Qty: {item.quantity}
                            </Badge>
                          )}
                          <span className="font-mono">${item.price.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(extractedExpense.location || extractedExpense.contact) && (
                <div className="space-y-2">
                  <Label>Additional Info</Label>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {extractedExpense.location && (
                      <div>
                        <strong>Location:</strong> {[
                          extractedExpense.location.address,
                          extractedExpense.location.city,
                          extractedExpense.location.state
                        ].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {extractedExpense.contact?.phone && (
                      <div><strong>Phone:</strong> {extractedExpense.contact.phone}</div>
                    )}
                    {extractedExpense.receiptNumber && (
                      <div><strong>Receipt #:</strong> {extractedExpense.receiptNumber}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setIsOCRModalOpen(false)} 
              className="hover:bg-white/5"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            {!isProcessing && extractedExpense && (
              <Button 
                onClick={handleOCRSave} 
                className="gradient-primary text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Save Expense
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="glass-card border-purple-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-400" />
              Log New Expense
            </DialogTitle>
            <DialogDescription>Enter the details of your billing obligation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input id="vendor" placeholder="e.g. AWS" className="glass border-white/10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input id="amount" type="number" placeholder="0.00" className="glass border-white/10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select defaultValue="infrastructure">
                <SelectTrigger className="glass border-white/10">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="glass border-purple-500/20">
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="payroll">Payroll</SelectItem>
                  <SelectItem value="software">Software SaaS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> Due Date
                </Label>
                <Input type="date" className="glass border-white/10 block h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Repeat className="w-3.5 h-3.5" /> Frequency
                </Label>
                <Select defaultValue="monthly">
                  <SelectTrigger className="glass border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass border-purple-500/20">
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input type="radio" id="pending" name="status" defaultChecked className="accent-purple-500" />
                  <Label htmlFor="pending" className="text-yellow-400">
                    Pending
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="paid" name="status" className="accent-green-500" />
                  <Label htmlFor="paid" className="text-green-400">
                    Paid
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="hover:bg-white/5">
              Cancel
            </Button>
            <Button onClick={() => setIsModalOpen(false)} className="gradient-primary text-white">
              Save Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle>Tracked Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-purple-500/10 hover:bg-transparent">
                <TableHead className="text-purple-300">Vendor</TableHead>
                <TableHead className="text-purple-300">Category</TableHead>
                <TableHead className="text-purple-300">Status</TableHead>
                <TableHead className="text-purple-300 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium text-foreground flex items-center gap-2">
                    {expense.vendor}
                    {expense.ocrData && (
                      <Badge variant="outline" className="text-xs border-blue-500/20 text-blue-400">
                        OCR
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{expense.category}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        expense.status === "paid"
                          ? "border-green-500/20 text-green-400"
                          : "border-yellow-500/20 text-yellow-400"
                      }
                    >
                      {expense.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground">${expense.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
