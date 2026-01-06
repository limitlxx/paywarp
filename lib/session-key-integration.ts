/**
 * Session Key Integration Utilities
 * 
 * Provides helper functions to integrate session key automation
 * with existing bucket and payroll operations.
 */

import { type Address, type Hash } from 'viem'
import { useSessionKeys } from '@/hooks/use-session-keys'
import { useContracts } from '@/lib/contracts'
import { encodeFunctionData } from 'viem'
import { BUCKET_VAULT_ABI, PAYROLL_ENGINE_ABI } from '@/lib/contracts'

export interface AutomatedTransactionOptions {
  sessionId: string
  amount: bigint
  gasLimit?: bigint
  onSuccess?: (hash: Hash) => void
  onError?: (error: string) => void
}

/**
 * Hook for automated bucket operations using session keys
 */
export function useAutomatedBucketOperations() {
  const { executeAutomatedTransaction, checkTransactionLimits } = useSessionKeys()
  const { bucketVaultAddress } = useContracts()
  
  const automatedDeposit = async (options: AutomatedTransactionOptions) => {
    if (!bucketVaultAddress) {
      throw new Error('BucketVault contract not available')
    }
    
    // Check limits first
    const limits = checkTransactionLimits(
      options.sessionId,
      options.amount,
      bucketVaultAddress,
      'depositAndSplit'
    )
    
    if (!limits.canExecuteTransaction) {
      throw new Error(limits.limitReachedReason || 'Transaction not allowed')
    }
    
    // Encode the deposit function call
    const data = encodeFunctionData({
      abi: BUCKET_VAULT_ABI,
      functionName: 'depositAndSplit',
      args: [options.amount]
    })
    
    try {
      const result = await executeAutomatedTransaction(
        options.sessionId,
        bucketVaultAddress,
        'depositAndSplit',
        options.amount,
        data,
        options.gasLimit
      )
      
      if (result.success && result.transactionHash) {
        options.onSuccess?.(result.transactionHash)
      } else {
        options.onError?.(result.error || 'Transaction failed')
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      options.onError?.(errorMessage)
      throw error
    }
  }
  
  const automatedTransfer = async (
    fromBucket: string,
    toBucket: string,
    options: AutomatedTransactionOptions
  ) => {
    if (!bucketVaultAddress) {
      throw new Error('BucketVault contract not available')
    }
    
    // Check limits
    const limits = checkTransactionLimits(
      options.sessionId,
      options.amount,
      bucketVaultAddress,
      'transferBetweenBuckets'
    )
    
    if (!limits.canExecuteTransaction) {
      throw new Error(limits.limitReachedReason || 'Transaction not allowed')
    }
    
    // Encode the transfer function call
    const data = encodeFunctionData({
      abi: BUCKET_VAULT_ABI,
      functionName: 'transferBetweenBuckets',
      args: [fromBucket, toBucket, options.amount]
    })
    
    try {
      const result = await executeAutomatedTransaction(
        options.sessionId,
        bucketVaultAddress,
        'transferBetweenBuckets',
        0n, // No ETH value for internal transfers
        data,
        options.gasLimit
      )
      
      if (result.success && result.transactionHash) {
        options.onSuccess?.(result.transactionHash)
      } else {
        options.onError?.(result.error || 'Transaction failed')
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      options.onError?.(errorMessage)
      throw error
    }
  }
  
  return {
    automatedDeposit,
    automatedTransfer,
    checkTransactionLimits
  }
}

/**
 * Hook for automated payroll operations using session keys
 */
export function useAutomatedPayrollOperations() {
  const { executeAutomatedTransaction, checkTransactionLimits } = useSessionKeys()
  const { payrollEngineAddress } = useContracts()
  
  const automatedPayrollExecution = async (
    batchId: bigint,
    options: AutomatedTransactionOptions
  ) => {
    if (!payrollEngineAddress) {
      throw new Error('PayrollEngine contract not available')
    }
    
    // Check limits
    const limits = checkTransactionLimits(
      options.sessionId,
      options.amount,
      payrollEngineAddress,
      'processPayroll'
    )
    
    if (!limits.canExecuteTransaction) {
      throw new Error(limits.limitReachedReason || 'Transaction not allowed')
    }
    
    // Encode the payroll execution call
    const data = encodeFunctionData({
      abi: PAYROLL_ENGINE_ABI,
      functionName: 'processPayroll',
      args: [batchId]
    })
    
    try {
      const result = await executeAutomatedTransaction(
        options.sessionId,
        payrollEngineAddress,
        'processPayroll',
        0n, // No ETH value for payroll processing
        data,
        options.gasLimit
      )
      
      if (result.success && result.transactionHash) {
        options.onSuccess?.(result.transactionHash)
      } else {
        options.onError?.(result.error || 'Transaction failed')
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      options.onError?.(errorMessage)
      throw error
    }
  }
  
  const automatedEmployeeAddition = async (
    employeeAddress: Address,
    salary: bigint,
    paymentDate: bigint,
    options: AutomatedTransactionOptions
  ) => {
    if (!payrollEngineAddress) {
      throw new Error('PayrollEngine contract not available')
    }
    
    // Check limits
    const limits = checkTransactionLimits(
      options.sessionId,
      0n, // No ETH value for adding employees
      payrollEngineAddress,
      'addEmployee'
    )
    
    if (!limits.canExecuteTransaction) {
      throw new Error(limits.limitReachedReason || 'Transaction not allowed')
    }
    
    // Encode the add employee call
    const data = encodeFunctionData({
      abi: PAYROLL_ENGINE_ABI,
      functionName: 'addEmployee',
      args: [employeeAddress, salary, paymentDate]
    })
    
    try {
      const result = await executeAutomatedTransaction(
        options.sessionId,
        payrollEngineAddress,
        'addEmployee',
        0n,
        data,
        options.gasLimit
      )
      
      if (result.success && result.transactionHash) {
        options.onSuccess?.(result.transactionHash)
      } else {
        options.onError?.(result.error || 'Transaction failed')
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      options.onError?.(errorMessage)
      throw error
    }
  }
  
  return {
    automatedPayrollExecution,
    automatedEmployeeAddition,
    checkTransactionLimits
  }
}

/**
 * Utility function to create session keys for common operations
 */
export function createSessionKeyForOperation(
  operation: 'micro' | 'standard' | 'highValue',
  durationHours: number = 24
) {
  // This would be used in components to create session keys
  // The actual implementation would use the useSessionKeys hook
  return {
    operation,
    durationHours,
    // Configuration would be applied based on operation type
  }
}

/**
 * Session key automation scheduler
 * Provides utilities for scheduling automated operations
 */
export class SessionKeyScheduler {
  private scheduledOperations: Map<string, NodeJS.Timeout> = new Map()
  
  /**
   * Schedule an automated operation to run at a specific time
   */
  scheduleOperation(
    operationId: string,
    executeAt: Date,
    operation: () => Promise<void>
  ): void {
    // Clear existing scheduled operation
    this.cancelOperation(operationId)
    
    const delay = executeAt.getTime() - Date.now()
    
    if (delay <= 0) {
      // Execute immediately if time has passed
      operation().catch(console.error)
      return
    }
    
    const timeout = setTimeout(async () => {
      try {
        await operation()
      } catch (error) {
        console.error(`Scheduled operation ${operationId} failed:`, error)
      } finally {
        this.scheduledOperations.delete(operationId)
      }
    }, delay)
    
    this.scheduledOperations.set(operationId, timeout)
  }
  
  /**
   * Cancel a scheduled operation
   */
  cancelOperation(operationId: string): boolean {
    const timeout = this.scheduledOperations.get(operationId)
    if (timeout) {
      clearTimeout(timeout)
      this.scheduledOperations.delete(operationId)
      return true
    }
    return false
  }
  
  /**
   * Get all scheduled operation IDs
   */
  getScheduledOperations(): string[] {
    return Array.from(this.scheduledOperations.keys())
  }
  
  /**
   * Cancel all scheduled operations
   */
  cancelAllOperations(): void {
    for (const timeout of this.scheduledOperations.values()) {
      clearTimeout(timeout)
    }
    this.scheduledOperations.clear()
  }
}

// Global scheduler instance
export const globalScheduler = new SessionKeyScheduler()