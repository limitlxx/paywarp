'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBlockchainExpenseTracking } from './use-blockchain-expense-tracking'
import { useTransactionHistory } from './use-transaction-history'
import { useWallet } from './use-wallet'

export interface ExpenseAuditTransaction {
  id: string
  hash?: string
  timestamp: Date
  type: 'expense' | 'recurring_expense'
  amount: string
  tokenSymbol: string
  description: string
  status: 'pending' | 'confirmed' | 'failed'
  bucket: string
  vendor: string
  category: string
  frequency?: string
  nextDue?: Date
  verified?: boolean
  confidence?: number
}

export function useExpenseAudit() {
  const { isConnected } = useWallet()
  const {
    expenses: blockchainExpenses,
    recurringExpenses,
    isLoading: expenseLoading,
    loadExpenses
  } = useBlockchainExpenseTracking()
  
  const { transactions, refreshHistory } = useTransactionHistory()
  
  const [localExpenses, setLocalExpenses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load local expenses from localStorage
  useEffect(() => {
    const savedExpenses = localStorage.getItem('processedExpenses')
    if (savedExpenses) {
      try {
        const parsed = JSON.parse(savedExpenses).map((exp: any) => ({
          ...exp,
          date: new Date(exp.date),
          submittedAt: new Date(exp.submittedAt)
        }))
        setLocalExpenses(parsed)
      } catch (error) {
        console.error('Error loading local expenses:', error)
      }
    }
  }, [])

  // Convert blockchain expenses to audit format
  const blockchainExpenseAudit = useMemo<ExpenseAuditTransaction[]>(() => {
    return blockchainExpenses.map(expense => ({
      id: expense.id.toString(),
      hash: expense.receiptHash,
      timestamp: new Date(Number(expense.date) * 1000),
      type: 'expense' as const,
      amount: (parseFloat(expense.amount.toString()) / 1e18).toFixed(2),
      tokenSymbol: expense.currency,
      description: `${expense.vendor} - ${expense.category}`,
      status: expense.verified ? 'confirmed' : 'pending' as const,
      bucket: 'billings',
      vendor: expense.vendor,
      category: expense.category,
      verified: expense.verified,
      confidence: expense.confidence / 100
    }))
  }, [blockchainExpenses])

  // Convert recurring expenses to audit format
  const recurringExpenseAudit = useMemo<ExpenseAuditTransaction[]>(() => {
    return recurringExpenses.map(expense => {
      const frequencyMap = {
        604800: 'weekly',
        2629746: 'monthly', 
        7889238: 'quarterly',
        31556952: 'yearly'
      }
      
      const frequency = frequencyMap[Number(expense.frequency) as keyof typeof frequencyMap] || 'monthly'
      
      return {
        id: `recurring-${expense.id.toString()}`,
        timestamp: new Date(Number(expense.createdAt) * 1000),
        type: 'recurring_expense' as const,
        amount: (parseFloat(expense.amount.toString()) / 1e18).toFixed(2),
        tokenSymbol: expense.currency,
        description: `${expense.vendor} - ${expense.category} (${frequency})`,
        status: expense.active ? 'confirmed' : 'pending' as const,
        bucket: 'billings',
        vendor: expense.vendor,
        category: expense.category,
        frequency,
        nextDue: new Date(Number(expense.nextDue) * 1000),
        verified: true // Recurring expenses are considered verified when created
      }
    })
  }, [recurringExpenses])

  // Convert local expenses to audit format
  const localExpenseAudit = useMemo<ExpenseAuditTransaction[]>(() => {
    return localExpenses
      .filter(expense => !expense.onBlockchain) // Only local-only expenses
      .map(expense => ({
        id: expense.id,
        timestamp: expense.submittedAt,
        type: 'expense' as const,
        amount: expense.amount.toFixed(2),
        tokenSymbol: expense.currency || 'USD',
        description: `${expense.vendor} - ${expense.businessType || 'other'}`,
        status: expense.status === 'processed' ? 'confirmed' : expense.status as any,
        bucket: 'billings',
        vendor: expense.vendor,
        category: expense.businessType || 'other',
        verified: expense.verified || false,
        confidence: expense.confidence
      }))
  }, [localExpenses])

  // Combine all expense audit transactions
  const allExpenseAudit = useMemo<ExpenseAuditTransaction[]>(() => {
    const combined = [
      ...blockchainExpenseAudit,
      ...recurringExpenseAudit,
      ...localExpenseAudit
    ]
    
    // Sort by timestamp (newest first)
    return combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [blockchainExpenseAudit, recurringExpenseAudit, localExpenseAudit])

  // Get expense transactions from main transaction history
  const expenseTransactions = useMemo(() => {
    return transactions.filter(tx => tx.type === 'expense')
  }, [transactions])

  // Refresh all expense data
  const refreshExpenseAudit = useCallback(async () => {
    setIsLoading(true)
    try {
      // Refresh blockchain expenses
      if (isConnected) {
        await loadExpenses()
      }
      
      // Refresh transaction history
      await refreshHistory()
      
      // Reload local expenses
      const savedExpenses = localStorage.getItem('processedExpenses')
      if (savedExpenses) {
        try {
          const parsed = JSON.parse(savedExpenses).map((exp: any) => ({
            ...exp,
            date: new Date(exp.date),
            submittedAt: new Date(exp.submittedAt)
          }))
          setLocalExpenses(parsed)
        } catch (error) {
          console.error('Error reloading local expenses:', error)
        }
      }
    } catch (error) {
      console.error('Error refreshing expense audit:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isConnected, loadExpenses, refreshHistory])

  // Get expense statistics
  const expenseStats = useMemo(() => {
    const totalExpenses = allExpenseAudit.length
    const totalAmount = allExpenseAudit.reduce((sum, exp) => sum + parseFloat(exp.amount), 0)
    const recurringCount = recurringExpenseAudit.length
    const activeRecurring = recurringExpenseAudit.filter(exp => exp.status === 'confirmed').length
    
    // Monthly recurring total
    const monthlyRecurringTotal = recurringExpenseAudit
      .filter(exp => exp.status === 'confirmed')
      .reduce((sum, exp) => {
        const amount = parseFloat(exp.amount)
        switch (exp.frequency) {
          case 'weekly': return sum + (amount * 4.33)
          case 'monthly': return sum + amount
          case 'quarterly': return sum + (amount / 3)
          case 'yearly': return sum + (amount / 12)
          default: return sum + amount
        }
      }, 0)

    // Category breakdown
    const categoryBreakdown = allExpenseAudit.reduce((acc, exp) => {
      const category = exp.category
      if (!acc[category]) {
        acc[category] = { count: 0, total: 0 }
      }
      acc[category].count++
      acc[category].total += parseFloat(exp.amount)
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    return {
      totalExpenses,
      totalAmount,
      recurringCount,
      activeRecurring,
      monthlyRecurringTotal,
      categoryBreakdown
    }
  }, [allExpenseAudit, recurringExpenseAudit])

  // Add new expense to audit (for real-time updates)
  const addExpenseToAudit = useCallback((expense: any) => {
    const auditTransaction: ExpenseAuditTransaction = {
      id: expense.id || `temp-${Date.now()}`,
      hash: expense.receiptHash,
      timestamp: new Date(),
      type: 'expense',
      amount: expense.amount.toFixed(2),
      tokenSymbol: expense.currency || 'USD',
      description: `${expense.vendor} - ${expense.category || expense.businessType}`,
      status: 'pending',
      bucket: 'billings',
      vendor: expense.vendor,
      category: expense.category || expense.businessType || 'other',
      verified: false,
      confidence: expense.confidence
    }

    // This would be handled by the refresh mechanism in practice
    // but we can provide this for immediate UI updates
    return auditTransaction
  }, [])

  return {
    // Audit data
    expenseAudit: allExpenseAudit,
    expenseTransactions,
    expenseStats,
    
    // Loading states
    isLoading: isLoading || expenseLoading,
    
    // Actions
    refreshExpenseAudit,
    addExpenseToAudit,
    
    // Raw data access
    blockchainExpenses: blockchainExpenseAudit,
    recurringExpenses: recurringExpenseAudit,
    localExpenses: localExpenseAudit
  }
}