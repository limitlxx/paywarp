"use client"

import { useState, useEffect } from "react"
import type { Bucket, Expense, SavingsGoal, PayrollEntry } from "@/lib/types"
import { rwaIntegration } from "@/lib/rwa-integration"

// Mock initial bucket data with RWA integration
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
    isYielding: true,
    apy: 2.5,
    usdyBalance: 0,
    musdBalance: 0,
    totalYieldEarned: 0,
    currentRWAValue: 0,
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
    usdyBalance: 0,
    musdBalance: 0,
    totalYieldEarned: 0,
    currentRWAValue: 0,
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
    usdyBalance: 0,
    musdBalance: 0,
    totalYieldEarned: 0,
    currentRWAValue: 0,
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
    isYielding: true,
    usdyBalance: 0,
    musdBalance: 0,
    totalYieldEarned: 0,
    currentRWAValue: 0,
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
    isYielding: false,
    apy: 1.0,
    usdyBalance: 0,
    musdBalance: 0,
    totalYieldEarned: 0,
    currentRWAValue: 0,
  },
]

export function useBuckets() {
  const [buckets, setBuckets] = useState<Bucket[]>(initialBuckets)
  const [isLoading, setIsLoading] = useState(false)

  // Update RWA data periodically
  useEffect(() => {
    const updateRWAData = async () => {
      try {
        // Update redemption values to simulate yield accrual
        rwaIntegration.updateRedemptionValues()

        const updatedBuckets = await Promise.all(
          buckets.map(async (bucket) => {
            if (!bucket.isYielding || !bucket.rwaConnection?.enabled) {
              return bucket
            }

            // Get current yield data
            const yieldData = await rwaIntegration.getCurrentYield(bucket.id)
            
            // Get RWA balances
            const usdyBalance = await rwaIntegration.getUSDYBalance(bucket.id)
            const musdBalance = await rwaIntegration.getMUSDBalance(bucket.id)

            // Calculate real-time APY with slight variance
            const realTimeAPY = bucket.id === 'savings' 
              ? rwaIntegration.getRealTimeAPY('USDY')
              : bucket.id === 'growth'
              ? rwaIntegration.getRealTimeAPY('mUSD')
              : yieldData.currentAPY

            return {
              ...bucket,
              apy: realTimeAPY,
              totalYieldEarned: yieldData.totalYieldEarned + usdyBalance.yieldEarned + musdBalance.yieldEarned,
              usdyBalance: usdyBalance.tokenAmount,
              musdBalance: musdBalance.tokenAmount,
              currentRWAValue: usdyBalance.currentValue + musdBalance.currentValue,
            }
          })
        )

        setBuckets(updatedBuckets)
      } catch (error) {
        console.error('Failed to update RWA data:', error)
      }
    }

    // Update immediately and then every 30 seconds
    updateRWAData()
    const interval = setInterval(updateRWAData, 30000)

    return () => clearInterval(interval)
  }, [buckets.length]) // Only depend on buckets length to avoid infinite loops

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

  const convertToRWA = async (bucketId: string, amount: number, tokenType: 'USDY' | 'mUSD') => {
    setIsLoading(true)
    try {
      const bucket = getBucket(bucketId)
      if (!bucket) {
        throw new Error('Bucket not found')
      }

      let result
      if (tokenType === 'USDY') {
        result = await rwaIntegration.convertToUSDY(amount, bucket.id as any)
      } else {
        result = await rwaIntegration.convertToMUSD(amount, bucket.id as any)
      }

      if (result.success) {
        // Update bucket with new RWA balance
        setBuckets((prev) =>
          prev.map((b) => {
            if (b.id === bucketId) {
              return {
                ...b,
                balance: b.balance - amount, // Reduce USDC balance
                [tokenType === 'USDY' ? 'usdyBalance' : 'musdBalance']: 
                  (b[tokenType === 'USDY' ? 'usdyBalance' : 'musdBalance'] || 0) + (result.tokenAmount || 0)
              }
            }
            return b
          })
        )
      }

      return result
    } catch (error) {
      console.error('RWA conversion failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      setIsLoading(false)
    }
  }

  const redeemFromRWA = async (bucketId: string, tokenAmount: number) => {
    setIsLoading(true)
    try {
      const result = await rwaIntegration.redeemUSDY(tokenAmount, bucketId as any)

      if (result.success) {
        // Update bucket with redeemed USDC
        setBuckets((prev) =>
          prev.map((b) => {
            if (b.id === bucketId) {
              return {
                ...b,
                balance: b.balance + (result.tokenAmount || 0), // Add redeemed USDC
                usdyBalance: Math.max(0, (b.usdyBalance || 0) - tokenAmount) // Reduce USDY balance
              }
            }
            return b
          })
        )
      }

      return result
    } catch (error) {
      console.error('RWA redemption failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    buckets,
    isLoading,
    getBucket,
    updateBucketBalance,
    transferBetweenBuckets,
    convertToRWA,
    redeemFromRWA,
    // RWA-specific functions
    getRWAStats: () => {
      const totalRWAValue = buckets.reduce((sum, bucket) => sum + (bucket.currentRWAValue || 0), 0)
      const totalYieldEarned = buckets.reduce((sum, bucket) => sum + (bucket.totalYieldEarned || 0), 0)
      const avgAPY = buckets
        .filter(b => b.isYielding && b.apy)
        .reduce((sum, bucket, _, arr) => sum + (bucket.apy || 0) / arr.length, 0)
      
      return {
        totalRWAValue,
        totalYieldEarned,
        avgAPY,
        rwaEnabled: buckets.some(b => b.rwaConnection?.enabled)
      }
    },
    getProjectedYield: (bucketId: string, days: number) => {
      const bucket = getBucket(bucketId)
      if (!bucket || !bucket.isYielding) return 0
      
      const tokenType = bucket.id === 'savings' ? 'USDY' : 'mUSD'
      return rwaIntegration.calculateProjectedYield(bucket.balance, tokenType, days)
    }
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
