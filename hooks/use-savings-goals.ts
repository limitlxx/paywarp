"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, usePublicClient, useWatchContractEvent } from "wagmi"
import { parseUnits, formatUnits } from "viem"
import { useContract, useContractWrite } from "@/lib/contracts"
import { useNetwork } from "./use-network"
import { useToast } from "./use-toast"
import type { SavingsGoal as ContractSavingsGoal } from "@/types/contracts/BucketVault"

// Enhanced savings goal interface for UI
export interface SavingsGoal {
  id: number
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: Date
  description: string
  completed: boolean
  locked: boolean
  bonusAPY: number
  progressPercent: number
  createdAt: Date
  lastUpdated: Date
}

// Transaction status for monitoring goal operations
interface GoalTransactionStatus {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  type: 'create' | 'contribute' | 'withdraw'
  goalId?: number
  timestamp: Date
}

export function useSavingsGoals() {
  const { address, isConnected } = useAccount()
  const { currentNetwork } = useNetwork()
  const { toast } = useToast()
  const publicClient = usePublicClient()
  
  // Contract instances
  const bucketVaultContract = useContract('bucketVault', currentNetwork)
  const bucketVaultWriteContract = useContractWrite('bucketVault', currentNetwork)
  
  // State management
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingTransactions, setPendingTransactions] = useState<GoalTransactionStatus[]>([])
  const [goalCount, setGoalCount] = useState(0)

  // Convert contract goal to UI goal
  const convertContractGoal = useCallback((contractGoal: ContractSavingsGoal, goalId: number): SavingsGoal => {
    const targetAmount = Number(formatUnits(contractGoal.targetAmount, 18))
    const currentAmount = Number(formatUnits(contractGoal.currentAmount, 18))
    const progressPercent = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0
    
    return {
      id: goalId,
      name: contractGoal.description || `Goal ${goalId + 1}`,
      targetAmount,
      currentAmount,
      targetDate: new Date(Number(contractGoal.targetDate) * 1000),
      description: contractGoal.description,
      completed: contractGoal.completed,
      locked: contractGoal.locked,
      bonusAPY: Number(contractGoal.bonusAPY) / 100, // Convert from basis points
      progressPercent,
      createdAt: new Date(), // We don't have creation date from contract
      lastUpdated: new Date(),
    }
  }, [])

  // Fetch all savings goals for the user
  const fetchSavingsGoals = useCallback(async () => {
    if (!bucketVaultContract || !address || !isConnected) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get total goal count
      const totalGoals = await bucketVaultContract.read.userGoalCount([address])
      const goalCountNumber = Number(totalGoals)
      setGoalCount(goalCountNumber)

      if (goalCountNumber === 0) {
        setGoals([])
        return
      }

      // Fetch all goals
      const goalPromises = Array.from({ length: goalCountNumber }, async (_, index) => {
        try {
          const contractGoal = await bucketVaultContract.read.getSavingsGoal([
            address,
            BigInt(index)
          ]) as ContractSavingsGoal
          return convertContractGoal(contractGoal, index)
        } catch (err) {
          console.error(`Error fetching goal ${index}:`, err)
          return null
        }
      })

      const fetchedGoals = await Promise.all(goalPromises)
      const validGoals = fetchedGoals.filter((goal): goal is SavingsGoal => goal !== null)
      
      setGoals(validGoals)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch savings goals'
      setError(errorMessage)
      console.error('Error fetching savings goals:', err)
    } finally {
      setIsLoading(false)
    }
  }, [bucketVaultContract, address, isConnected, convertContractGoal])

  // Create a new savings goal
  const createSavingsGoal = useCallback(async (
    targetAmount: number,
    targetDate: Date,
    description: string
  ) => {
    if (!bucketVaultWriteContract || !address) {
      throw new Error('Contract not available or wallet not connected')
    }

    try {
      setIsLoading(true)
      
      // Validate inputs
      if (targetAmount <= 0) {
        throw new Error('Target amount must be greater than 0')
      }
      
      if (targetDate <= new Date()) {
        throw new Error('Target date must be in the future')
      }

      const targetAmountWei = parseUnits(targetAmount.toString(), 18)
      const targetDateTimestamp = BigInt(Math.floor(targetDate.getTime() / 1000))
      
      const hash = await bucketVaultWriteContract.write.createSavingsGoal([
        targetAmountWei,
        targetDateTimestamp,
        description
      ])
      
      // Track pending transaction
      const pendingTx: GoalTransactionStatus = {
        hash,
        status: 'pending',
        type: 'create',
        timestamp: new Date(),
      }
      setPendingTransactions(prev => [...prev, pendingTx])

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        // Update transaction status
        setPendingTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: receipt.status === 'success' ? 'confirmed' : 'failed' }
              : tx
          )
        )

        if (receipt.status === 'success') {
          toast({
            title: "Goal Created",
            description: `Successfully created savings goal: ${description}`,
          })
          
          // Refresh goals
          await fetchSavingsGoals()
        } else {
          throw new Error('Transaction failed')
        }
      }

      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create savings goal'
      setError(errorMessage)
      toast({
        title: "Goal Creation Failed",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [bucketVaultWriteContract, address, publicClient, toast, fetchSavingsGoals])

  // Contribute to a savings goal
  const contributeToGoal = useCallback(async (goalId: number, amount: number) => {
    if (!bucketVaultWriteContract || !address) {
      throw new Error('Contract not available or wallet not connected')
    }

    try {
      setIsLoading(true)
      
      if (amount <= 0) {
        throw new Error('Contribution amount must be greater than 0')
      }

      const amountWei = parseUnits(amount.toString(), 18)
      
      const hash = await bucketVaultWriteContract.write.contributeToGoal([
        BigInt(goalId),
        amountWei
      ])
      
      // Track pending transaction
      const pendingTx: GoalTransactionStatus = {
        hash,
        status: 'pending',
        type: 'contribute',
        goalId,
        timestamp: new Date(),
      }
      setPendingTransactions(prev => [...prev, pendingTx])

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        // Update transaction status
        setPendingTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: receipt.status === 'success' ? 'confirmed' : 'failed' }
              : tx
          )
        )

        if (receipt.status === 'success') {
          const goal = goals.find(g => g.id === goalId)
          toast({
            title: "Contribution Successful",
            description: `Added ${amount.toLocaleString()} to ${goal?.name || 'your goal'}`,
          })
          
          // Refresh goals
          await fetchSavingsGoals()
        } else {
          throw new Error('Transaction failed')
        }
      }

      return hash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to contribute to goal'
      setError(errorMessage)
      toast({
        title: "Contribution Failed",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [bucketVaultWriteContract, address, publicClient, toast, fetchSavingsGoals, goals])

  // Get a specific goal by ID
  const getGoal = useCallback((goalId: number) => {
    return goals.find(g => g.id === goalId)
  }, [goals])

  // Get active (incomplete) goals
  const getActiveGoals = useCallback(() => {
    return goals.filter(g => !g.completed)
  }, [goals])

  // Get completed goals
  const getCompletedGoals = useCallback(() => {
    return goals.filter(g => g.completed)
  }, [goals])

  // Calculate total savings goal progress
  const getTotalProgress = useCallback(() => {
    if (goals.length === 0) return { totalTarget: 0, totalCurrent: 0, overallProgress: 0 }
    
    const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0)
    const totalCurrent = goals.reduce((sum, goal) => sum + goal.currentAmount, 0)
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0
    
    return { totalTarget, totalCurrent, overallProgress }
  }, [goals])

  // Watch for goal-related contract events
  useWatchContractEvent({
    address: bucketVaultContract?.address,
    abi: bucketVaultContract?.abi,
    eventName: 'GoalCreated',
    onLogs: (logs) => {
      console.log('GoalCreated event detected:', logs)
      fetchSavingsGoals()
    },
  })

  useWatchContractEvent({
    address: bucketVaultContract?.address,
    abi: bucketVaultContract?.abi,
    eventName: 'GoalCompleted',
    onLogs: (logs) => {
      console.log('GoalCompleted event detected:', logs)
      
      // Show celebration toast for completed goals
      logs.forEach((log: any) => {
        if (log.args && typeof log.args === 'object' && 'goalId' in log.args && 'bonusApy' in log.args) {
          const goalId = Number(log.args.goalId)
          const bonusApy = Number(log.args.bonusApy) / 100
          const goal = goals.find(g => g.id === goalId)
          
          toast({
            title: "🎉 Goal Completed!",
            description: `${goal?.name || 'Your goal'} is complete! Earned ${bonusApy}% bonus APY.`,
          })
        }
      })
      
      fetchSavingsGoals()
    },
  })

  // Initial data fetch and refresh on connection changes
  useEffect(() => {
    if (isConnected && address && bucketVaultContract) {
      fetchSavingsGoals()
    } else {
      // Clear data when disconnected
      setGoals([])
      setGoalCount(0)
      setError(null)
    }
  }, [isConnected, address, bucketVaultContract, fetchSavingsGoals])

  // Clean up old pending transactions
  useEffect(() => {
    const cleanup = setInterval(() => {
      setPendingTransactions(prev => 
        prev.filter(tx => 
          tx.status === 'pending' && 
          Date.now() - tx.timestamp.getTime() < 5 * 60 * 1000 // Keep for 5 minutes
        )
      )
    }, 60000) // Check every minute

    return () => clearInterval(cleanup)
  }, [])

  return {
    // Data
    goals,
    goalCount,
    pendingTransactions,
    
    // State
    isLoading,
    error,
    isConnected,
    
    // Actions
    createSavingsGoal,
    contributeToGoal,
    refreshGoals: fetchSavingsGoals,
    
    // Utilities
    getGoal,
    getActiveGoals,
    getCompletedGoals,
    getTotalProgress,
    clearError: () => setError(null),
  }
}