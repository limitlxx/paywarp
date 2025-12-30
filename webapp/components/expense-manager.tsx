"use client"

import { useState } from "react"
import { useExpenses } from "@/hooks/use-buckets"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Receipt, Zap, FileSearch, Calendar, CreditCard, Repeat } from "lucide-react"
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

export function ExpenseManager() {
  const { expenses } = useExpenses()
  const [isScanning, setIsScanning] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleScan = () => {
    setIsScanning(true)
    setTimeout(() => setIsScanning(false), 2000)
  }

  return (
    <div className="space-y-6">
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
              onClick={handleScan}
              disabled={isScanning}
              className="w-full glass border-purple-500/30 hover:bg-purple-500/10 text-foreground h-12 gap-2 bg-transparent"
            >
              {isScanning ? (
                <Zap className="w-4 h-4 animate-pulse text-yellow-400" />
              ) : (
                <FileSearch className="w-4 h-4 text-purple-400" />
              )}
              {isScanning ? "Analyzing..." : "Scan New Receipt"}
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
                  <TableCell className="font-medium text-foreground">{expense.vendor}</TableCell>
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
