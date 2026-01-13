'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { useContract, useContractWrite } from '@/lib/contracts'
import { useNetwork } from './use-network'
import { DynamicReceiptData } from '@/lib/enhanced-ocr-processor'
import { toast } from 'sonner'

export interface BlockchainExpense {
  id: bigint
  user: string
  vendor: string
  amount: bigint
  currency: string
  date: bigint
  category: string
  receiptHash: string
  confidence: number
  verified: boolean
  createdAt: bigint
}

export interface BlockchainRecurringExpense {
  id: bigint
  user: string
  vendor: string
  amount: bigint
  currency: string
  category: string
  frequency: bigint
  nextDue: bigint
  active: boolean
  createdAt: bigint
}

export interface BlockchainExpenseStats {
  totalExpenses: number
  totalAmount: string
  expenseCount: number
  byCategory: Record<string, string>
}

export function useBlockchainExpenseTracking() {
  const { address } = useAccount()
  const { currentNetwork } = useNetwork()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const readContract = useContract('expenseTracker', currentNetwork)
  const writeContract = useContractWrite('expenseTracker', currentNetwork)
  
  const [expenses, setExpenses] = useState<BlockchainExpense[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<BlockchainRecurringExpense[]>([])
  const [stats, setStats] = useState<BlockchainExpenseStats>({
    totalExpenses: 0,
    totalAmount: '0',
    expenseCount: 0,
    byCategory: {}
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load expenses from blockchain
  const loadExpenses = useCallback(async () => {
    if (!readContract || !address) return

    setIsLoading(true)
    try {
      // Get user expenses
      const userExpenses = await readContract.read.getUserExpenses([address])
      const formattedExpenses = userExpenses.map((expense: any) => ({
        id: expense.id,
        user: expense.user,
        vendor: expense.vendor,
        amount: expense.amount,
        currency: expense.currency,
        date: expense.date,
        category: expense.category,
        receiptHash: expense.receiptHash,
        confidence: expense.confidence,
        verified: expense.verified,
        createdAt: expense.createdAt
      }))
      setExpenses(formattedExpenses)

      // Get recurring expenses
      const userRecurring = await readContract.read.getUserRecurringExpenses([address])
      const formattedRecurring = userRecurring.map((recurring: any) => ({
        id: recurring.id,
        user: recurring.user,
        vendor: recurring.vendor,
        amount: recurring.amount,
        currency: recurring.currency,
        category: recurring.category,
        frequency: recurring.frequency,
        nextDue: recurring.nextDue,
        active: recurring.active,
        createdAt: recurring.createdAt
      }))
      setRecurringExpenses(formattedRecurring)

      // Get stats
      const totalAmount = await readContract.read.getUserTotalExpenses([address])
      const expenseCount = await readContract.read.getUserExpenseCount([address])

      setStats({
        totalExpenses: Number(expenseCount),
        totalAmount: formatEther(totalAmount),
        expenseCount: Number(expenseCount),
        byCategory: {} // We'll calculate this from the expenses
      })

    } catch (error) {
      console.error('Error loading expenses from blockchain:', error)
      toast.error('Failed to load expenses from blockchain')
    } finally {
      setIsLoading(false)
    }
  }, [readContract, address])

  // Load expenses on mount and when dependencies change
  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  // Add expense to blockchain
  const addExpense = useCallback(async (receiptData: DynamicReceiptData, receiptHash?: string) => {
    if (!writeContract || !address) {
      toast.error('Wallet not connected')
      return false
    }

    setIsSubmitting(true)
    try {
      // Convert amount to wei (assuming USD for now, multiply by 1e18 for precision)
      const amountInWei = parseEther(receiptData.amount.toString())
      
      // Convert date to Unix timestamp
      const dateTimestamp = BigInt(Math.floor(receiptData.date.getTime() / 1000))
      
      // Use business type as category
      const category = receiptData.businessType || 'other'
      
      // Use provided hash or generate a simple one
      const hash = receiptHash || `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Convert confidence to 0-100 scale
      const confidenceScore = Math.round(receiptData.confidence * 100)

      const tx = await writeContract.write.addExpense([
        receiptData.vendor,
        amountInWei,
        receiptData.currency,
        dateTimestamp,
        category,
        hash,
        confidenceScore
      ])

      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx })
      }

      toast.success('Expense added to blockchain successfully!')
      
      // Reload expenses
      await loadExpenses()
      
      return true
    } catch (error: any) {
      console.error('Error adding expense to blockchain:', error)
      toast.error(`Failed to add expense: ${error.message || 'Unknown error'}`)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [writeContract, address, publicClient, loadExpenses])

  // Add recurring expense
  const addRecurringExpense = useCallback(async (
    vendor: string,
    amount: number,
    currency: string,
    category: string,
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    nextDue: Date
  ) => {
    if (!writeContract || !address) {
      toast.error('Wallet not connected')
      return false
    }

    setIsSubmitting(true)
    try {
      const amountInWei = parseEther(amount.toString())
      const nextDueTimestamp = BigInt(Math.floor(nextDue.getTime() / 1000))
      
      // Convert frequency to seconds
      const frequencyMap = {
        weekly: 604800n, // 7 days
        monthly: 2629746n, // ~30.44 days
        quarterly: 7889238n, // ~91.31 days  
        yearly: 31556952n // ~365.24 days
      }
      const frequencySeconds = frequencyMap[frequency]

      const tx = await writeContract.write.addRecurringExpense([
        vendor,
        amountInWei,
        currency,
        category,
        frequencySeconds,
        nextDueTimestamp
      ])

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx })
      }

      toast.success('Recurring expense added successfully!')
      await loadExpenses()
      return true
    } catch (error: any) {
      console.error('Error adding recurring expense:', error)
      toast.error(`Failed to add recurring expense: ${error.message || 'Unknown error'}`)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [writeContract, address, publicClient, loadExpenses])

  // Verify expense
  const verifyExpense = useCallback(async (expenseIndex: number) => {
    if (!writeContract || !address) {
      toast.error('Wallet not connected')
      return false
    }

    setIsSubmitting(true)
    try {
      const tx = await writeContract.write.verifyExpense([BigInt(expenseIndex)])

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx })
      }

      toast.success('Expense verified successfully!')
      await loadExpenses()
      return true
    } catch (error: any) {
      console.error('Error verifying expense:', error)
      toast.error(`Failed to verify expense: ${error.message || 'Unknown error'}`)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [writeContract, address, publicClient, loadExpenses])

  // Get expenses by date range
  const getExpensesByDateRange = useCallback(async (startDate: Date, endDate: Date) => {
    if (!readContract || !address) return []

    try {
      const startTimestamp = BigInt(Math.floor(startDate.getTime() / 1000))
      const endTimestamp = BigInt(Math.floor(endDate.getTime() / 1000))
      
      const expenses = await readContract.read.getExpensesByDateRange([
        address,
        startTimestamp,
        endTimestamp
      ])

      return expenses.map((expense: any) => ({
        id: expense.id,
        user: expense.user,
        vendor: expense.vendor,
        amount: expense.amount,
        currency: expense.currency,
        date: expense.date,
        category: expense.category,
        receiptHash: expense.receiptHash,
        confidence: expense.confidence,
        verified: expense.verified,
        createdAt: expense.createdAt
      }))
    } catch (error) {
      console.error('Error getting expenses by date range:', error)
      return []
    }
  }, [readContract, address])

  // Get category total
  const getCategoryTotal = useCallback(async (category: string) => {
    if (!readContract || !address) return '0'

    try {
      const total = await readContract.read.getUserCategoryTotal([address, category])
      return formatEther(total)
    } catch (error) {
      console.error('Error getting category total:', error)
      return '0'
    }
  }, [readContract, address])

  // Format amount for display
  const formatAmount = useCallback((amount: bigint, currency: string = 'USD') => {
    const formatted = formatEther(amount)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(parseFloat(formatted))
  }, [])

  // Convert blockchain expense to display format
  const formatExpenseForDisplay = useCallback((expense: BlockchainExpense) => {
    return {
      id: expense.id.toString(),
      vendor: expense.vendor,
      amount: parseFloat(formatEther(expense.amount)),
      currency: expense.currency,
      date: new Date(Number(expense.date) * 1000),
      category: expense.category,
      businessType: expense.category,
      confidence: expense.confidence / 100,
      verified: expense.verified,
      receiptHash: expense.receiptHash,
      submittedAt: new Date(Number(expense.createdAt) * 1000),
      status: expense.verified ? 'verified' : 'pending' as const
    }
  }, [])

  return {
    // State
    expenses,
    recurringExpenses,
    stats,
    isLoading,
    isSubmitting,
    
    // Actions
    addExpense,
    addRecurringExpense,
    verifyExpense,
    loadExpenses,
    getExpensesByDateRange,
    getCategoryTotal,
    
    // Utilities
    formatAmount,
    formatExpenseForDisplay,
    
    // Connection status
    isConnected: !!address && !!readContract
  }
}