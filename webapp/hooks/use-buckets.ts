"use client"

import { useState } from "react"
import type { Bucket, Expense, SavingsGoal, PayrollEntry } from "@/lib/types"

// Mock initial bucket data
const initialBuckets: Bucket[] = [
  {
    id: "billings",
    name: "Billings",
    balance: 12450,
    percentage: 45,
    color: "#EF4444", // Red liquid
    description: "Automated expenses & bills",
    rwaConnection: {
      provider: "Ondo",
      type: "receivables",
      enabled: true,
    },
    features: {
      autoFill: true,
      overflowTarget: "growth",
      expenseTracking: true,
      directPayout: true,
    },
  },
  {
    id: "savings",
    name: "Savings",
    balance: 45230,
    percentage: 82,
    color: "#3B82F6", // Blue pooling liquid
    description: "Long-term goal oriented funds",
    isYielding: true,
    apy: 4.5,
    rwaConnection: {
      provider: "Ondo",
      type: "t-bills",
      enabled: true,
    },
    features: {
      goalTracking: true,
      directPayout: false,
    },
  },
  {
    id: "growth",
    name: "Growth",
    balance: 28120,
    percentage: 35,
    color: "#EAB308", // Golden swirling liquid
    description: "DeFi yield optimization",
    isYielding: true,
    apy: 12.8,
    rwaConnection: {
      provider: "Ondo",
      type: "equity-vaults",
      enabled: true,
    },
    features: {
      minSplitPercent: 20,
      autoCompound: true,
      directPayout: false,
    },
  },
  {
    id: "instant",
    name: "Instant",
    balance: 15800,
    percentage: 60,
    color: "#22C55E", // Green fast-flow liquid
    description: "Team payroll & salaries",
    apy: 2.5,
    rwaConnection: {
      provider: "Mantle",
      type: "payroll-yields",
      enabled: true,
    },
    features: {
      payrollManagement: true,
      directPayout: true,
    },
  },
  {
    id: "spendable",
    name: "Spendable",
    balance: 22989.9,
    percentage: 100,
    color: "#94A3B8", // Clear/Neutral water level
    description: "Available for immediate use",
    rwaConnection: {
      provider: "Mantle",
      type: "native",
      enabled: true,
    },
    features: {
      directPayout: true,
    },
  },
]

export function useBuckets() {
  const [buckets, setBuckets] = useState<Bucket[]>(initialBuckets)
  const [isLoading, setIsLoading] = useState(false)

  const getBucket = (id: string) => {
    return buckets.find((b) => b.id === id)
  }

  const updateBucketBalance = (id: string, amount: number) => {
    setBuckets((prev) =>
      prev.map((bucket) => (bucket.id === id ? { ...bucket, balance: bucket.balance + amount } : bucket)),
    )
  }

  const transferBetweenBuckets = (fromId: string, toId: string, amount: number) => {
    setIsLoading(true)
    setTimeout(() => {
      setBuckets((prev) =>
        prev.map((bucket) => {
          if (bucket.id === fromId) {
            return { ...bucket, balance: bucket.balance - amount }
          }
          if (bucket.id === toId) {
            return { ...bucket, balance: bucket.balance + amount }
          }
          return bucket
        }),
      )
      setIsLoading(false)
    }, 1000)
  }

  return {
    buckets,
    isLoading,
    getBucket,
    updateBucketBalance,
    transferBetweenBuckets,
  }
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: "1",
      vendor: "AWS Cloud Services",
      amount: 850,
      category: "Infrastructure",
      dueDate: new Date("2025-01-15"),
      status: "pending",
      recurring: true,
      frequency: "monthly",
      autoPayout: true,
    },
    {
      id: "2",
      vendor: "Office Supplies Co.",
      amount: 320,
      category: "Operations",
      dueDate: new Date("2025-01-10"),
      status: "paid",
    },
  ])

  const addExpense = (expense: Omit<Expense, "id">) => {
    const newExpense = {
      ...expense,
      id: Date.now().toString(),
    }
    setExpenses((prev) => [...prev, newExpense])
  }

  const updateExpenseStatus = (id: string, status: Expense["status"]) => {
    setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, status } : exp)))
  }

  return { expenses, addExpense, updateExpenseStatus }
}

export function useSavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([
    {
      id: "1",
      name: "Emergency Fund",
      targetAmount: 50000,
      currentAmount: 45230,
      targetDate: new Date("2025-06-30"),
      progressPercent: 90,
      completed: false,
    },
  ])

  const addGoal = (goal: Omit<SavingsGoal, "id" | "progressPercent" | "completed">) => {
    const newGoal = {
      ...goal,
      id: Date.now().toString(),
      progressPercent: (goal.currentAmount / goal.targetAmount) * 100,
      completed: goal.currentAmount >= goal.targetAmount,
    }
    setGoals((prev) => [...prev, newGoal])
  }

  const updateGoalProgress = (id: string, amount: number) => {
    setGoals((prev) =>
      prev.map((goal) => {
        if (goal.id === id) {
          const newAmount = goal.currentAmount + amount
          const progressPercent = (newAmount / goal.targetAmount) * 100
          return {
            ...goal,
            currentAmount: newAmount,
            progressPercent,
            completed: newAmount >= goal.targetAmount,
            bonusApy: newAmount >= goal.targetAmount ? 1 : undefined,
          }
        }
        return goal
      }),
    )
  }

  return { goals, addGoal, updateGoalProgress }
}

export function usePayroll() {
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([
    {
      id: "1",
      employeeName: "John Doe",
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      salary: 5000,
      paymentDate: 15,
      status: "verified",
      lastPaid: new Date("2024-12-15"),
      nextPayment: new Date("2025-01-15"),
    },
    {
      id: "2",
      employeeName: "Jane Smith",
      email: "jane@example.com",
      salary: 6500,
      paymentDate: 15,
      status: "pending",
      nextPayment: new Date("2025-01-15"),
    },
  ])

  const addPayrollEntry = (entry: Omit<PayrollEntry, "id" | "status">) => {
    const newEntry = {
      ...entry,
      id: Date.now().toString(),
      status: "pending" as const,
    }
    setPayrollEntries((prev) => [...prev, newEntry])
  }

  const uploadCSV = async (file: File) => {
    // Mock CSV parsing
    console.log("[v0] Parsing CSV:", file.name)
    // In production, parse CSV and add entries
  }

  return { payrollEntries, addPayrollEntry, uploadCSV }
}
