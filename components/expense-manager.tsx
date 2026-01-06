"use client"

import { useState, useRef } from "react"
import { useExpenses } from "@/hooks/use-buckets"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Receipt, Zap, FileSearch, Calendar, CreditCard, Repeat, Upload, Check, X, Edit } from "lucide-react"
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
import { ocrProcessor } from "@/lib/ocr-expense-processor"
import { ExpenseData, OCRResult } from "@/lib/types"
import { toast } from "sonner"

export function ExpenseManager() {
  const { expenses } = useExpenses()
  const [isScanning, setIsScanning] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false)
  const [ocrProgress, setOCRProgress] = useState(0)
  const [ocrResult, setOCRResult] = useState<OCRResult | null>(null)
  const [extractedExpense, setExtractedExpense] = useState<ExpenseData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      // Process the receipt
      const result = await ocrProcessor.processReceipt(file)
      setOCRResult(result)
      
      // Extract expense data
      const expenseData = await ocrProcessor.extractExpenseData(result)
      setExtractedExpense(expenseData)

      clearInterval(progressInterval)
      setOCRProgress(100)
      setIsProcessing(false)

      toast.success('Receipt processed successfully!')
    } catch (error) {
      console.error('OCR processing failed:', error)
      toast.error('Failed to process receipt. Please try again.')
      setIsOCRModalOpen(false)
      setIsProcessing(false)
    }
  }

  const handleOCRSave = async () => {
    if (!extractedExpense || !ocrResult) return

    try {
      // Store the receipt image
      const imageFile = fileInputRef.current?.files?.[0]
      if (imageFile) {
        const expenseId = `exp_${Date.now()}`
        const storagePath = await ocrProcessor.storeReceiptImage(imageFile, expenseId)
        
        // Link to billing system
        await ocrProcessor.linkExpenseToBilling(extractedExpense)
        
        toast.success('Expense added to billing tracker!')
      }
      
      setIsOCRModalOpen(false)
      setOCRResult(null)
      setExtractedExpense(null)
      setOCRProgress(0)
    } catch (error) {
      console.error('Failed to save expense:', error)
      toast.error('Failed to save expense. Please try again.')
    }
  }

  const handleExpenseFieldChange = (field: keyof ExpenseData, value: any) => {
    if (!extractedExpense) return
    
    setExtractedExpense(prev => prev ? {
      ...prev,
      [field]: value,
      manualCorrections: {
        ...prev.manualCorrections,
        [field]: value
      }
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
            </CardTitle>
            <CardDescription className="text-[10px]">Instantly extract data from invoices</CardDescription>
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
              {isProcessing ? "Analyzing receipt with OCR..." : "Review and confirm extracted data"}
            </DialogDescription>
          </DialogHeader>
          
          {isProcessing ? (
            <div className="space-y-4 py-6">
              <Progress value={ocrProgress} className="w-full" />
              <p className="text-center text-sm text-muted-foreground">
                Processing receipt... {ocrProgress}%
              </p>
            </div>
          ) : extractedExpense && ocrResult ? (
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
                  Category
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${extractedExpense.category.autoApproved ? 'border-green-500/20 text-green-400' : 'border-yellow-500/20 text-yellow-400'}`}
                  >
                    {extractedExpense.category.autoApproved ? 'Auto-approved' : 'Needs review'}
                  </Badge>
                </Label>
                <Select 
                  value={extractedExpense.category.name}
                  onValueChange={(value) => handleExpenseFieldChange('category', { ...extractedExpense.category, name: value })}
                >
                  <SelectTrigger className="glass border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass border-purple-500/20">
                    <SelectItem value="office-supplies">Office Supplies</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="meals">Meals</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="professional-services">Professional Services</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
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

              {ocrResult.extractedText && (
                <div className="space-y-2">
                  <Label>Extracted Text (for reference)</Label>
                  <Textarea
                    value={ocrResult.extractedText}
                    readOnly
                    className="glass border-white/10 text-xs h-20"
                  />
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
