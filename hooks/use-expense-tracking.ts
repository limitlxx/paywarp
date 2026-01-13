'use client'

import { useState, useEffect, useCallback } from 'react'
import { DynamicReceiptData } from '@/lib/enhanced-ocr-processor'
import { BucketType } from '@/lib/types'

export interface TrackedExpense extends DynamicReceiptData {
  id: string
  submittedAt: Date
  bucketId?: BucketType
  status: 'pending' | 'processed' | 'failed' | 'paid'
  category: string
  tags: string[]
  notes?: string
  recurring?: {
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    nextDue?: Date
    autoProcess?: boolean
  }
}

export interface ExpenseStats {
  totalExpenses: number
  totalAmount: number
  thisMonth: number
  lastMonth: number
  avgConfidence: number
  byCategory: Record<string, { count: number; amount: number }>
  byBucket: Record<BucketType, { count: number; amount: number }>
  monthlyTrend: Array<{ month: string; amount: number; count: number }>
}

export function useExpenseTracking() {
  const [expenses, setExpenses] = useState<TrackedExpense[]>([])
  const [stats, setStats] = useState<ExpenseStats>({
    totalExpenses: 0,
    totalAmount: 0,
    thisMonth: 0,
    lastMonth: 0,
    avgConfidence: 0,
    byCategory: {},
    byBucket: {} as Record<BucketType, { count: number; amount: number }>,
    monthlyTrend: []
  })
  const [isLoading, setIsLoading] = useState(true)

  // Load expenses from localStorage
  useEffect(() => {
    const loadExpenses = () => {
      try {
        const saved = localStorage.getItem('trackedExpenses')
        if (saved) {
          const parsed = JSON.parse(saved).map((exp: any) => ({
            ...exp,
            date: new Date(exp.date),
            submittedAt: new Date(exp.submittedAt),
            recurring: exp.recurring ? {
              ...exp.recurring,
              nextDue: exp.recurring.nextDue ? new Date(exp.recurring.nextDue) : undefined
            } : undefined
          }))
          setExpenses(parsed)
        }
      } catch (error) {
        console.error('Error loading expenses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExpenses()
  }, [])

  // Save expenses to localStorage
  useEffect(() => {
    if (!isLoading && expenses.length >= 0) {
      localStorage.setItem('trackedExpenses', JSON.stringify(expenses))
      calculateStats(expenses)
    }
  }, [expenses, isLoading])

  const calculateStats = useCallback((expenseList: TrackedExpense[]) => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const thisMonthExpenses = expenseList.filter(exp => 
      exp.date >= thisMonth && exp.date < nextMonth
    )
    const lastMonthExpenses = expenseList.filter(exp => 
      exp.date >= lastMonth && exp.date < thisMonth
    )

    const totalAmount = expenseList.reduce((sum, exp) => sum + exp.amount, 0)
    const thisMonthAmount = thisMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0)
    const lastMonthAmount = lastMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0)
    
    const avgConfidence = expenseList.length > 0 
      ? expenseList.reduce((sum, exp) => sum + exp.confidence, 0) / expenseList.length 
      : 0

    // Calculate by category
    const byCategory: Record<string, { count: number; amount: number }> = {}
    expenseList.forEach(exp => {
      const category = exp.category || exp.businessType || 'other'
      if (!byCategory[category]) {
        byCategory[category] = { count: 0, amount: 0 }
      }
      byCategory[category].count++
      byCategory[category].amount += exp.amount
    })

    // Calculate by bucket
    const byBucket = {} as Record<BucketType, { count: number; amount: number }>
    const bucketTypes: BucketType[] = ['billings', 'savings', 'growth', 'instant', 'spendable']
    bucketTypes.forEach(bucket => {
      byBucket[bucket] = { count: 0, amount: 0 }
    })
    
    expenseList.forEach(exp => {
      if (exp.bucketId) {
        byBucket[exp.bucketId].count++
        byBucket[exp.bucketId].amount += exp.amount
      }
    })

    // Calculate monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthExpenses = expenseList.filter(exp => 
        exp.date >= monthStart && exp.date < monthEnd
      )
      
      monthlyTrend.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        amount: monthExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        count: monthExpenses.length
      })
    }

    setStats({
      totalExpenses: expenseList.length,
      totalAmount,
      thisMonth: thisMonthAmount,
      lastMonth: lastMonthAmount,
      avgConfidence,
      byCategory,
      byBucket,
      monthlyTrend
    })
  }, [])

  const addExpense = useCallback((receiptData: DynamicReceiptData, options?: {
    bucketId?: BucketType
    category?: string
    tags?: string[]
    notes?: string
    recurring?: TrackedExpense['recurring']
  }) => {
    const newExpense: TrackedExpense = {
      ...receiptData,
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      submittedAt: new Date(),
      status: 'processed',
      category: options?.category || receiptData.businessType || 'other',
      tags: options?.tags || [],
      notes: options?.notes,
      bucketId: options?.bucketId,
      recurring: options?.recurring
    }

    setExpenses(prev => [newExpense, ...prev])
    return newExpense
  }, [])

  const updateExpense = useCallback((id: string, updates: Partial<TrackedExpense>) => {
    setExpenses(prev => prev.map(exp => 
      exp.id === id ? { ...exp, ...updates } : exp
    ))
  }, [])

  const deleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== id))
  }, [])

  const getExpensesByCategory = useCallback((category: string) => {
    return expenses.filter(exp => exp.category === category)
  }, [expenses])

  const getExpensesByBucket = useCallback((bucketId: BucketType) => {
    return expenses.filter(exp => exp.bucketId === bucketId)
  }, [expenses])

  const getRecurringExpenses = useCallback(() => {
    return expenses.filter(exp => exp.recurring)
  }, [expenses])

  const getPendingExpenses = useCallback(() => {
    return expenses.filter(exp => exp.status === 'pending')
  }, [expenses])

  const searchExpenses = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase()
    return expenses.filter(exp => 
      exp.vendor.toLowerCase().includes(lowercaseQuery) ||
      exp.category.toLowerCase().includes(lowercaseQuery) ||
      exp.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
      (exp.notes && exp.notes.toLowerCase().includes(lowercaseQuery))
    )
  }, [expenses])

  const categorizeExpense = useCallback((expense: TrackedExpense): string => {
    // Auto-categorization logic based on vendor and business type
    const vendor = expense.vendor.toLowerCase()
    const businessType = expense.businessType

    if (businessType === 'restaurant' || vendor.includes('restaurant') || vendor.includes('cafe')) {
      return 'meals'
    }
    if (businessType === 'gas-station' || vendor.includes('gas') || vendor.includes('fuel')) {
      return 'transportation'
    }
    if (businessType === 'grocery' || vendor.includes('market') || vendor.includes('grocery')) {
      return 'groceries'
    }
    if (businessType === 'pharmacy' || vendor.includes('pharmacy') || vendor.includes('cvs')) {
      return 'healthcare'
    }
    if (vendor.includes('office') || vendor.includes('supplies')) {
      return 'office-supplies'
    }
    if (vendor.includes('software') || vendor.includes('subscription')) {
      return 'software'
    }
    if (vendor.includes('hotel') || vendor.includes('airbnb') || vendor.includes('uber')) {
      return 'travel'
    }

    return businessType || 'other'
  }, [])

  const suggestBucket = useCallback((expense: TrackedExpense): BucketType => {
    const category = expense.category || categorizeExpense(expense)
    
    // Business expenses go to billings bucket
    if (['office-supplies', 'software', 'professional-services'].includes(category)) {
      return 'billings'
    }
    
    // Regular recurring expenses
    if (expense.recurring) {
      return 'billings'
    }
    
    // Large amounts might be better for growth bucket (investments)
    if (expense.amount > 1000) {
      return 'growth'
    }
    
    // Daily expenses go to spendable
    if (['meals', 'groceries', 'transportation'].includes(category)) {
      return 'spendable'
    }
    
    // Default to instant for quick access
    return 'instant'
  }, [categorizeExpense])

  const exportExpenses = useCallback((format: 'csv' | 'json' = 'csv') => {
    if (format === 'json') {
      return JSON.stringify(expenses, null, 2)
    }
    
    // CSV export
    const headers = [
      'Date', 'Vendor', 'Amount', 'Currency', 'Category', 'Business Type',
      'Bucket', 'Status', 'Confidence', 'Tags', 'Notes'
    ]
    
    const rows = expenses.map(exp => [
      exp.date.toISOString().split('T')[0],
      exp.vendor,
      exp.amount,
      exp.currency,
      exp.category,
      exp.businessType || '',
      exp.bucketId || '',
      exp.status,
      Math.round(exp.confidence * 100),
      exp.tags.join(';'),
      exp.notes || ''
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }, [expenses])

  return {
    expenses,
    stats,
    isLoading,
    addExpense,
    updateExpense,
    deleteExpense,
    getExpensesByCategory,
    getExpensesByBucket,
    getRecurringExpenses,
    getPendingExpenses,
    searchExpenses,
    categorizeExpense,
    suggestBucket,
    exportExpenses
  }
}