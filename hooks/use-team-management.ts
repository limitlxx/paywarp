"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { parseEther, formatEther, isAddress } from 'viem'
import { useContract, useContractWrite } from '@/lib/contracts'
import { useNetwork } from './use-network'
import type { PayrollEntry, PayrollBatch } from '@/lib/types'

export interface TeamMember {
  id: string
  name: string
  walletAddress?: string
  email?: string
  salary: number
  paymentDate: number // Day of month (1-31)
  status: 'active' | 'pending' | 'verified' | 'paused'
  joinDate: Date
  lastPaid?: Date
  nextPayment?: Date
  totalPaid: number
  paymentHistory: PaymentRecord[]
}

export interface PaymentRecord {
  id: string
  amount: number
  date: Date
  transactionHash: string
  status: 'successful' | 'failed' | 'pending'
  gasUsed: number
  processingTime: number
}

export interface PayrollBatchDetails {
  id: string
  scheduledDate: Date
  totalAmount: number
  employeeCount: number
  status: 'scheduled' | 'processing' | 'completed' | 'failed'
  processed: boolean
  failed: boolean
  failureReason?: string
  processedAt?: Date
  payments: PaymentRecord[]
}

export interface TeamManagementState {
  members: TeamMember[]
  upcomingPayrolls: PayrollBatchDetails[]
  payrollHistory: PayrollBatchDetails[]
  isLoading: boolean
  error: string | null
}

// Validation functions
export function isValidWalletAddress(address: string): boolean {
  return isAddress(address)
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateTeamMember(member: Partial<TeamMember>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!member.name || member.name.trim().length === 0) {
    errors.push('Name is required')
  }
  
  if (!member.walletAddress && !member.email) {
    errors.push('Either wallet address or email is required')
  }
  
  if (member.walletAddress && !isValidWalletAddress(member.walletAddress)) {
    errors.push('Invalid wallet address format')
  }
  
  if (member.email && !isValidEmail(member.email)) {
    errors.push('Invalid email format')
  }
  
  if (!member.salary || member.salary <= 0) {
    errors.push('Salary must be greater than 0')
  }
  
  if (!member.paymentDate || member.paymentDate < 1 || member.paymentDate > 31) {
    errors.push('Payment date must be between 1 and 31')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function useTeamManagement() {
  const { address } = useAccount()
  const { currentNetwork } = useNetwork()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const payrollContract = useContract('payrollEngine', currentNetwork)
  const payrollWriteContract = useContractWrite('payrollEngine', currentNetwork)
  
  const [state, setState] = useState<TeamManagementState>({
    members: [],
    upcomingPayrolls: [],
    payrollHistory: [],
    isLoading: false,
    error: null
  })
  
  // Load team members from contract
  const loadTeamMembers = useCallback(async () => {
    if (!payrollContract || !address) return
    
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      // Get employee count
      const employeeCount = await payrollContract.read.employeeCount([address]) as bigint
      const members: TeamMember[] = []
      
      // Load each employee
      for (let i = 0; i < Number(employeeCount); i++) {
        try {
          const employee = await payrollContract.read.getEmployee([address, BigInt(i)]) as {
            recipient: string
            salary: bigint
            paymentDate: bigint
            active: boolean
            totalPaid: bigint
            lastPaidDate: bigint
          }
          
          if (employee.active) {
            const member: TeamMember = {
              id: `${address}_${i}`,
              name: `Employee ${i + 1}`, // Contract doesn't store names, use placeholder
              walletAddress: employee.recipient,
              salary: Number(formatEther(employee.salary)),
              paymentDate: Number(employee.paymentDate),
              status: 'verified',
              joinDate: new Date(), // Contract doesn't store join date
              totalPaid: Number(formatEther(employee.totalPaid)),
              paymentHistory: []
            }
            
            // Calculate next payment date
            const now = new Date()
            const nextPayment = new Date(now.getFullYear(), now.getMonth(), member.paymentDate)
            if (nextPayment <= now) {
              nextPayment.setMonth(nextPayment.getMonth() + 1)
            }
            member.nextPayment = nextPayment
            
            // Set last paid date if available
            if (employee.lastPaidDate > 0) {
              member.lastPaid = new Date(Number(employee.lastPaidDate) * 1000)
            }
            
            members.push(member)
          }
        } catch (error) {
          console.error(`Error loading employee ${i}:`, error)
        }
      }
      
      setState(prev => ({ ...prev, members, isLoading: false }))
    } catch (error) {
      console.error('Error loading team members:', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load team members'
      }))
    }
  }, [payrollContract, address])
  
  // Load upcoming payrolls
  const loadUpcomingPayrolls = useCallback(async () => {
    if (!payrollContract || !address) return
    
    try {
      const upcomingBatches = await payrollContract.read.getUpcomingPayrolls([address]) as Array<{
        totalAmount: bigint
        scheduledDate: bigint
        employeeCount: bigint
        processed: boolean
        failed: boolean
        failureReason: string
        processedAt: bigint
      }>
      const payrolls: PayrollBatchDetails[] = []
      
      for (let i = 0; i < upcomingBatches.length; i++) {
        const batch = upcomingBatches[i]
        payrolls.push({
          id: `upcoming_${i}`,
          scheduledDate: new Date(Number(batch.scheduledDate) * 1000),
          totalAmount: Number(formatEther(batch.totalAmount)),
          employeeCount: Number(batch.employeeCount),
          status: 'scheduled',
          processed: false,
          failed: false,
          payments: []
        })
      }
      
      setState(prev => ({ ...prev, upcomingPayrolls: payrolls }))
    } catch (error) {
      console.error('Error loading upcoming payrolls:', error)
    }
  }, [payrollContract, address])
  
  // Load payroll history
  const loadPayrollHistory = useCallback(async () => {
    if (!payrollContract || !address) return
    
    try {
      const historyBatches = await payrollContract.read.getPayrollHistory([address]) as Array<{
        totalAmount: bigint
        scheduledDate: bigint
        employeeCount: bigint
        processed: boolean
        failed: boolean
        failureReason: string
        processedAt: bigint
      }>
      const history: PayrollBatchDetails[] = []
      
      for (let i = 0; i < historyBatches.length; i++) {
        const batch = historyBatches[i]
        
        // Load payment records for this batch
        const payments: PaymentRecord[] = []
        try {
          const batchPayments = await payrollContract.read.getBatchPayments([address, BigInt(i)]) as Array<{
            recipient: string
            amount: bigint
            date: bigint
            transactionHash: string
            successful: boolean
            gasUsed: bigint
          }>
          
          for (let j = 0; j < batchPayments.length; j++) {
            const payment = batchPayments[j]
            payments.push({
              id: `${i}_${j}`,
              amount: Number(formatEther(payment.amount)),
              date: new Date(Number(payment.date) * 1000),
              transactionHash: payment.transactionHash,
              status: payment.successful ? 'successful' : 'failed',
              gasUsed: Number(payment.gasUsed),
              processingTime: 0 // Not tracked in contract
            })
          }
        } catch (error) {
          console.error(`Error loading payments for batch ${i}:`, error)
        }
        
        history.push({
          id: `history_${i}`,
          scheduledDate: new Date(Number(batch.scheduledDate) * 1000),
          totalAmount: Number(formatEther(batch.totalAmount)),
          employeeCount: Number(batch.employeeCount),
          status: batch.failed ? 'failed' : 'completed',
          processed: batch.processed,
          failed: batch.failed,
          failureReason: batch.failureReason || undefined,
          processedAt: batch.processedAt > 0 ? new Date(Number(batch.processedAt) * 1000) : undefined,
          payments
        })
      }
      
      setState(prev => ({ ...prev, payrollHistory: history }))
    } catch (error) {
      console.error('Error loading payroll history:', error)
    }
  }, [payrollContract, address])
  
  // Add team member
  const addTeamMember = useCallback(async (memberData: Omit<TeamMember, 'id' | 'joinDate' | 'totalPaid' | 'paymentHistory'>) => {
    if (!payrollWriteContract || !address) {
      throw new Error('Contract not available')
    }
    
    const validation = validateTeamMember(memberData)
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '))
    }
    
    if (!memberData.walletAddress) {
      throw new Error('Wallet address is required for blockchain payments')
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const salaryWei = parseEther(memberData.salary.toString())
      
      const hash = await payrollWriteContract.write.addEmployee([
        memberData.walletAddress,
        salaryWei,
        BigInt(memberData.paymentDate)
      ])
      
      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }
      
      // Reload team members
      await loadTeamMembers()
      
      setState(prev => ({ ...prev, isLoading: false }))
      return hash
    } catch (error) {
      console.error('Error adding team member:', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add team member'
      }))
      throw error
    }
  }, [payrollWriteContract, address, publicClient, loadTeamMembers])
  
  // Update team member
  const updateTeamMember = useCallback(async (memberId: string, updates: Partial<Pick<TeamMember, 'salary' | 'paymentDate'>>) => {
    if (!payrollWriteContract || !address) {
      throw new Error('Contract not available')
    }
    
    // Extract employee ID from member ID
    const employeeId = parseInt(memberId.split('_')[1])
    if (isNaN(employeeId)) {
      throw new Error('Invalid member ID')
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const currentMember = state.members.find(m => m.id === memberId)
      if (!currentMember) {
        throw new Error('Member not found')
      }
      
      const newSalary = updates.salary !== undefined ? updates.salary : currentMember.salary
      const newPaymentDate = updates.paymentDate !== undefined ? updates.paymentDate : currentMember.paymentDate
      
      if (newSalary <= 0) {
        throw new Error('Salary must be greater than 0')
      }
      
      if (newPaymentDate < 1 || newPaymentDate > 31) {
        throw new Error('Payment date must be between 1 and 31')
      }
      
      const salaryWei = parseEther(newSalary.toString())
      
      const hash = await payrollWriteContract.write.updateEmployee([
        BigInt(employeeId),
        salaryWei,
        BigInt(newPaymentDate)
      ])
      
      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }
      
      // Reload team members
      await loadTeamMembers()
      
      setState(prev => ({ ...prev, isLoading: false }))
      return hash
    } catch (error) {
      console.error('Error updating team member:', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update team member'
      }))
      throw error
    }
  }, [payrollWriteContract, address, publicClient, loadTeamMembers, state.members])
  
  // Remove team member
  const removeTeamMember = useCallback(async (memberId: string) => {
    if (!payrollWriteContract || !address) {
      throw new Error('Contract not available')
    }
    
    // Extract employee ID from member ID
    const employeeId = parseInt(memberId.split('_')[1])
    if (isNaN(employeeId)) {
      throw new Error('Invalid member ID')
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const hash = await payrollWriteContract.write.removeEmployee([BigInt(employeeId)])
      
      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }
      
      // Reload team members
      await loadTeamMembers()
      
      setState(prev => ({ ...prev, isLoading: false }))
      return hash
    } catch (error) {
      console.error('Error removing team member:', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to remove team member'
      }))
      throw error
    }
  }, [payrollWriteContract, address, publicClient, loadTeamMembers])
  
  // Schedule payroll
  const schedulePayroll = useCallback(async (scheduledDate: Date) => {
    if (!payrollWriteContract || !address) {
      throw new Error('Contract not available')
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const timestamp = Math.floor(scheduledDate.getTime() / 1000)
      
      const hash = await payrollWriteContract.write.schedulePayroll([BigInt(timestamp)])
      
      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }
      
      // Reload upcoming payrolls
      await loadUpcomingPayrolls()
      
      setState(prev => ({ ...prev, isLoading: false }))
      return hash
    } catch (error) {
      console.error('Error scheduling payroll:', error)
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to schedule payroll'
      }))
      throw error
    }
  }, [payrollWriteContract, address, publicClient, loadUpcomingPayrolls])
  
  // Load all data
  const loadAllData = useCallback(async () => {
    await Promise.all([
      loadTeamMembers(),
      loadUpcomingPayrolls(),
      loadPayrollHistory()
    ])
  }, [loadTeamMembers, loadUpcomingPayrolls, loadPayrollHistory])
  
  // Load data on mount and when dependencies change
  useEffect(() => {
    if (payrollContract && address) {
      loadAllData()
    }
  }, [payrollContract, address, loadAllData])
  
  return {
    ...state,
    // Actions
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    schedulePayroll,
    loadAllData,
    // Utilities
    validateTeamMember,
    isValidWalletAddress,
    isValidEmail
  }
}