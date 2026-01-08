"use client"

import { useState, useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { parseUnits, type Address } from 'viem'
import { useBlockchainBuckets } from './use-blockchain-buckets'
import { useSessionKeys } from './use-session-keys'
import { useToast } from './use-toast'
import type { SplitConfig } from '@/types/contracts/BucketVault'

export interface BucketAllocation {
  id: string
  name: string
  percentage: number
  enabled: boolean
  color: string
}

export interface TokenAllowance {
  token: Address
  spender: Address
  amount: bigint
  enabled: boolean
}

export interface SecuritySettings {
  multiSigApproval: boolean
  autoRevokeApprovals: boolean
  dailyWithdrawLimit: bigint
}

export interface NotificationSettings {
  yieldAlerts: boolean
  payrollConfirmations: boolean
  transactionAlerts: boolean
  securityAlerts: boolean
}

export interface SettingsState {
  bucketAllocations: BucketAllocation[]
  tokenAllowances: TokenAllowance[]
  securitySettings: SecuritySettings
  notificationSettings: NotificationSettings
  hasUnsavedChanges: boolean
}

// Bucket allocation suggestions based on user profile
export interface BucketSuggestion {
  id: string
  name: string
  description: string
  allocations: BucketAllocation[]
  targetUser: string
}

const BUCKET_SUGGESTIONS: BucketSuggestion[] = [
  {
    id: 'conservative',
    name: 'Conservative Saver',
    description: 'Focus on savings and emergency funds with minimal risk',
    targetUser: 'Users who prioritize financial security',
    allocations: [
      { id: 'billings', name: 'Billings Bucket', percentage: 35, enabled: true, color: '#3B82F6' },
      { id: 'savings', name: 'Savings Bucket', percentage: 30, enabled: true, color: '#10B981' },
      { id: 'instant', name: 'Instant Bucket', percentage: 20, enabled: true, color: '#F59E0B' },
      { id: 'growth', name: 'Growth Bucket', percentage: 10, enabled: true, color: '#8B5CF6' },
      { id: 'spendable', name: 'Spendables Bucket', percentage: 5, enabled: true, color: '#EF4444' },
    ]
  },
  {
    id: 'balanced',
    name: 'Balanced Approach',
    description: 'Equal focus on savings, growth, and spending flexibility',
    targetUser: 'Users seeking balanced financial growth',
    allocations: [
      { id: 'billings', name: 'Billings Bucket', percentage: 30, enabled: true, color: '#3B82F6' },
      { id: 'growth', name: 'Growth Bucket', percentage: 25, enabled: true, color: '#8B5CF6' },
      { id: 'savings', name: 'Savings Bucket', percentage: 20, enabled: true, color: '#10B981' },
      { id: 'instant', name: 'Instant Bucket', percentage: 15, enabled: true, color: '#F59E0B' },
      { id: 'spendable', name: 'Spendables Bucket', percentage: 10, enabled: true, color: '#EF4444' },
    ]
  },
  {
    id: 'aggressive',
    name: 'Growth Focused',
    description: 'Maximize yield generation and DeFi opportunities',
    targetUser: 'Users comfortable with higher risk for better returns',
    allocations: [
      { id: 'growth', name: 'Growth Bucket', percentage: 40, enabled: true, color: '#8B5CF6' },
      { id: 'billings', name: 'Billings Bucket', percentage: 25, enabled: true, color: '#3B82F6' },
      { id: 'savings', name: 'Savings Bucket', percentage: 15, enabled: true, color: '#10B981' },
      { id: 'instant', name: 'Instant Bucket', percentage: 10, enabled: true, color: '#F59E0B' },
      { id: 'spendable', name: 'Spendables Bucket', percentage: 10, enabled: true, color: '#EF4444' },
    ]
  },
  {
    id: 'spender',
    name: 'Active Spender',
    description: 'Higher allocation for daily expenses and flexible spending',
    targetUser: 'Users with high transaction volume',
    allocations: [
      { id: 'spendable', name: 'Spendables Bucket', percentage: 30, enabled: true, color: '#EF4444' },
      { id: 'billings', name: 'Billings Bucket', percentage: 25, enabled: true, color: '#3B82F6' },
      { id: 'instant', name: 'Instant Bucket', percentage: 20, enabled: true, color: '#F59E0B' },
      { id: 'savings', name: 'Savings Bucket', percentage: 15, enabled: true, color: '#10B981' },
      { id: 'growth', name: 'Growth Bucket', percentage: 10, enabled: true, color: '#8B5CF6' },
    ]
  },
  {
    id: 'freelancer',
    name: 'Freelancer/Gig Worker',
    description: 'Optimized for irregular income with strong emergency fund',
    targetUser: 'Freelancers and gig economy workers',
    allocations: [
      { id: 'instant', name: 'Instant Bucket', percentage: 35, enabled: true, color: '#F59E0B' },
      { id: 'billings', name: 'Billings Bucket', percentage: 30, enabled: true, color: '#3B82F6' },
      { id: 'savings', name: 'Savings Bucket', percentage: 20, enabled: true, color: '#10B981' },
      { id: 'spendable', name: 'Spendables Bucket', percentage: 10, enabled: true, color: '#EF4444' },
      { id: 'growth', name: 'Growth Bucket', percentage: 5, enabled: true, color: '#8B5CF6' },
    ]
  }
]

const DEFAULT_BUCKET_ALLOCATIONS: BucketAllocation[] = BUCKET_SUGGESTIONS[1].allocations // Use balanced as default

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  multiSigApproval: false,
  autoRevokeApprovals: true,
  dailyWithdrawLimit: parseUnits('1000', 18),
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  yieldAlerts: true,
  payrollConfirmations: true,
  transactionAlerts: true,
  securityAlerts: true,
}

export function useSettings() {
  const { address } = useAccount()
  const { toast } = useToast()
  const { splitConfig, updateSplitConfig, isLoading: isBucketLoading } = useBlockchainBuckets()
  const { createStandardSessionKey, isCreatingSession } = useSessionKeys()

  const [settings, setSettings] = useState<SettingsState>({
    bucketAllocations: DEFAULT_BUCKET_ALLOCATIONS,
    tokenAllowances: [],
    securitySettings: DEFAULT_SECURITY_SETTINGS,
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    hasUnsavedChanges: false,
  })

  const [isSaving, setIsSaving] = useState(false)

  // Load settings from contract when available
  useEffect(() => {
    if (splitConfig) {
      const allocations = settings.bucketAllocations.map(allocation => {
        let percentage = 0
        switch (allocation.id) {
          case 'billings':
            percentage = Number(splitConfig.billingsPercent) / 100 // Convert basis points to percentage
            break
          case 'savings':
            percentage = Number(splitConfig.savingsPercent) / 100
            break
          case 'growth':
            percentage = Number(splitConfig.growthPercent) / 100
            break
          case 'instant':
            percentage = Number(splitConfig.instantPercent) / 100
            break
          case 'spendable':
            percentage = Number(splitConfig.spendablePercent) / 100
            break
        }
        return { ...allocation, percentage }
      })

      setSettings(prev => ({
        ...prev,
        bucketAllocations: allocations,
        hasUnsavedChanges: false,
      }))
    }
  }, [splitConfig])

  // Helper function to redistribute percentages when buckets are disabled
  const redistributePercentages = useCallback((bucketAllocations: BucketAllocation[]) => {
    const enabledBuckets = bucketAllocations.filter(a => a.enabled)
    const disabledBuckets = bucketAllocations.filter(a => !a.enabled)
    
    if (enabledBuckets.length === 0) {
      // If no buckets are enabled, enable the first one with 100%
      return bucketAllocations.map((bucket, index) => ({
        ...bucket,
        enabled: index === 0,
        percentage: index === 0 ? 100 : 0
      }))
    }
    
    // Calculate total percentage from disabled buckets to redistribute
    const disabledPercentage = disabledBuckets.reduce((sum, bucket) => sum + bucket.percentage, 0)
    const enabledPercentage = enabledBuckets.reduce((sum, bucket) => sum + bucket.percentage, 0)
    const totalToRedistribute = disabledPercentage
    const currentEnabledTotal = enabledPercentage
    
    // If enabled buckets already sum to 100%, just set disabled to 0
    if (currentEnabledTotal === 100) {
      return bucketAllocations.map(bucket => ({
        ...bucket,
        percentage: bucket.enabled ? bucket.percentage : 0
      }))
    }
    
    // Redistribute to make enabled buckets sum to 100%
    const targetTotal = 100
    const scaleFactor = targetTotal / currentEnabledTotal
    
    return bucketAllocations.map(bucket => {
      if (!bucket.enabled) {
        return { ...bucket, percentage: 0 }
      }
      
      const newPercentage = Math.round(bucket.percentage * scaleFactor)
      return { ...bucket, percentage: newPercentage }
    })
  }, [])

  // Update bucket allocation
  const updateBucketAllocation = useCallback((id: string, updates: Partial<BucketAllocation>) => {
    setSettings(prev => {
      const updatedAllocations = prev.bucketAllocations.map(allocation =>
        allocation.id === id ? { ...allocation, ...updates } : allocation
      )
      
      // If we're disabling a bucket, redistribute percentages
      if (updates.enabled === false) {
        const redistributed = redistributePercentages(updatedAllocations)
        return {
          ...prev,
          bucketAllocations: redistributed,
          hasUnsavedChanges: true,
        }
      }
      
      return {
        ...prev,
        bucketAllocations: updatedAllocations,
        hasUnsavedChanges: true,
      }
    })
  }, [redistributePercentages])

  // Update security settings
  const updateSecuritySettings = useCallback((updates: Partial<SecuritySettings>) => {
    setSettings(prev => ({
      ...prev,
      securitySettings: { ...prev.securitySettings, ...updates },
      hasUnsavedChanges: true,
    }))
  }, [])

  // Update notification settings
  const updateNotificationSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setSettings(prev => ({
      ...prev,
      notificationSettings: { ...prev.notificationSettings, ...updates },
      hasUnsavedChanges: true,
    }))
  }, [])

  // Add token allowance
  const addTokenAllowance = useCallback((allowance: Omit<TokenAllowance, 'enabled'>) => {
    setSettings(prev => ({
      ...prev,
      tokenAllowances: [...prev.tokenAllowances, { ...allowance, enabled: true }],
      hasUnsavedChanges: true,
    }))
  }, [])

  // Update token allowance
  const updateTokenAllowance = useCallback((index: number, updates: Partial<TokenAllowance>) => {
    setSettings(prev => ({
      ...prev,
      tokenAllowances: prev.tokenAllowances.map((allowance, i) =>
        i === index ? { ...allowance, ...updates } : allowance
      ),
      hasUnsavedChanges: true,
    }))
  }, [])

  // Remove token allowance
  const removeTokenAllowance = useCallback((index: number) => {
    setSettings(prev => ({
      ...prev,
      tokenAllowances: prev.tokenAllowances.filter((_, i) => i !== index),
      hasUnsavedChanges: true,
    }))
  }, [])

  // Clear all token allowances
  const clearTokenAllowances = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      tokenAllowances: [],
      hasUnsavedChanges: true,
    }))
  }, [])

  // Validate bucket allocations
  const validateBucketAllocations = useCallback(() => {
    const enabledAllocations = settings.bucketAllocations.filter(a => a.enabled)
    const totalPercentage = enabledAllocations.reduce((sum, a) => sum + a.percentage, 0)
    
    // Check if there are any enabled allocations
    if (enabledAllocations.length === 0) {
      return {
        isValid: false,
        error: 'At least one bucket must be enabled'
      }
    }
    
    if (totalPercentage !== 100) {
      return {
        isValid: false,
        error: `Enabled buckets must sum to 100%. Current total: ${totalPercentage}%`
      }
    }

    if (enabledAllocations.some(a => a.percentage < 0 || a.percentage > 100)) {
      return {
        isValid: false,
        error: 'Individual allocations must be between 0% and 100%'
      }
    }

    return { isValid: true }
  }, [settings.bucketAllocations])

  // Save all settings
  const saveSettings = useCallback(async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to save settings.",
        variant: "destructive",
      })
      return false
    }

    // Validate bucket allocations
    const validation = validateBucketAllocations()
    if (!validation.isValid) {
      toast({
        title: "Invalid Allocation",
        description: validation.error,
        variant: "destructive",
      })
      return false
    }

    try {
      setIsSaving(true)

      // Convert bucket allocations to contract format
      // Note: Contract expects ALL percentages to sum to 10000 (BASIS_POINTS), disabled buckets should be 0
      // Convert percentage (30) to basis points (3000)
      const splitConfigUpdate: SplitConfig = {
        billingsPercent: BigInt((settings.bucketAllocations.find(a => a.id === 'billings')?.enabled ? 
          settings.bucketAllocations.find(a => a.id === 'billings')?.percentage || 0 : 0) * 100),
        savingsPercent: BigInt((settings.bucketAllocations.find(a => a.id === 'savings')?.enabled ? 
          settings.bucketAllocations.find(a => a.id === 'savings')?.percentage || 0 : 0) * 100),
        growthPercent: BigInt((settings.bucketAllocations.find(a => a.id === 'growth')?.enabled ? 
          settings.bucketAllocations.find(a => a.id === 'growth')?.percentage || 0 : 0) * 100),
        instantPercent: BigInt((settings.bucketAllocations.find(a => a.id === 'instant')?.enabled ? 
          settings.bucketAllocations.find(a => a.id === 'instant')?.percentage || 0 : 0) * 100),
        spendablePercent: BigInt((settings.bucketAllocations.find(a => a.id === 'spendable')?.enabled ? 
          settings.bucketAllocations.find(a => a.id === 'spendable')?.percentage || 0 : 0) * 100),
      }

      // Debug: Log the values being sent to contract
      const totalContractPercentage = Number(splitConfigUpdate.billingsPercent) + 
        Number(splitConfigUpdate.savingsPercent) + 
        Number(splitConfigUpdate.growthPercent) + 
        Number(splitConfigUpdate.instantPercent) + 
        Number(splitConfigUpdate.spendablePercent)
      
      console.log('Split config being sent to contract:', {
        billings: `${Number(splitConfigUpdate.billingsPercent)} basis points (${Number(splitConfigUpdate.billingsPercent)/100}%)`,
        savings: `${Number(splitConfigUpdate.savingsPercent)} basis points (${Number(splitConfigUpdate.savingsPercent)/100}%)`,
        growth: `${Number(splitConfigUpdate.growthPercent)} basis points (${Number(splitConfigUpdate.growthPercent)/100}%)`,
        instant: `${Number(splitConfigUpdate.instantPercent)} basis points (${Number(splitConfigUpdate.instantPercent)/100}%)`,
        spendable: `${Number(splitConfigUpdate.spendablePercent)} basis points (${Number(splitConfigUpdate.spendablePercent)/100}%)`,
        totalBasisPoints: totalContractPercentage,
        totalPercentage: totalContractPercentage / 100
      })

      if (totalContractPercentage !== 10000) {
        throw new Error(`Contract validation will fail: percentages sum to ${totalContractPercentage} basis points (${totalContractPercentage/100}%) instead of 10000 basis points (100%)`)
      }

      // Update split configuration on contract
      await updateSplitConfig(splitConfigUpdate)

      // Save other settings to local storage (since they're not on-chain)
      const settingsToStore = {
        securitySettings: settings.securitySettings,
        notificationSettings: settings.notificationSettings,
        tokenAllowances: settings.tokenAllowances,
      }
      
      localStorage.setItem(`settings_${address}`, JSON.stringify(settingsToStore))

      setSettings(prev => ({ ...prev, hasUnsavedChanges: false }))

      toast({
        title: "Settings Saved",
        description: "Your settings have been saved successfully.",
      })

      return true
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save settings.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }, [address, settings, updateSplitConfig, validateBucketAllocations, toast])

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings({
      bucketAllocations: DEFAULT_BUCKET_ALLOCATIONS,
      tokenAllowances: [],
      securitySettings: DEFAULT_SECURITY_SETTINGS,
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      hasUnsavedChanges: true,
    })
  }, [])

  // Load settings from local storage
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`settings_${address}`)
      if (stored) {
        try {
          const parsedSettings = JSON.parse(stored)
          setSettings(prev => ({
            ...prev,
            securitySettings: parsedSettings.securitySettings || DEFAULT_SECURITY_SETTINGS,
            notificationSettings: parsedSettings.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS,
            tokenAllowances: parsedSettings.tokenAllowances || [],
          }))
        } catch (error) {
          console.error('Error loading settings from storage:', error)
        }
      }
    }
  }, [address])

  // Apply bucket suggestion
  const applySuggestion = useCallback((suggestionId: string) => {
    const suggestion = BUCKET_SUGGESTIONS.find(s => s.id === suggestionId)
    if (!suggestion) return

    setSettings(prev => ({
      ...prev,
      bucketAllocations: suggestion.allocations,
      hasUnsavedChanges: true,
    }))
  }, [])

  // Get bucket suggestions
  const getBucketSuggestions = useCallback(() => {
    return BUCKET_SUGGESTIONS
  }, [])

  // Auto-balance allocations when one changes
  const autoBalanceAllocations = useCallback((changedId: string, newPercentage: number) => {
    const enabledAllocations = settings.bucketAllocations.filter(a => a.enabled && a.id !== changedId)
    const remainingPercentage = 100 - newPercentage
    const totalOtherPercentage = enabledAllocations.reduce((sum, a) => sum + a.percentage, 0)

    if (totalOtherPercentage === 0) {
      // If no other enabled buckets, we can't auto-balance
      return
    }

    // Proportionally adjust other enabled allocations
    const adjustedAllocations = settings.bucketAllocations.map(allocation => {
      if (allocation.id === changedId) {
        return { ...allocation, percentage: newPercentage }
      }
      if (!allocation.enabled) {
        // Keep disabled buckets at 0
        return { ...allocation, percentage: 0 }
      }
      
      const proportion = allocation.percentage / totalOtherPercentage
      const newAllocationPercentage = Math.round(remainingPercentage * proportion)
      return { ...allocation, percentage: newAllocationPercentage }
    })

    setSettings(prev => ({
      ...prev,
      bucketAllocations: adjustedAllocations,
      hasUnsavedChanges: true,
    }))
  }, [settings.bucketAllocations])

  return {
    // State
    settings,
    isSaving,
    isBucketLoading,
    isCreatingSession,
    
    // Actions
    updateBucketAllocation,
    updateSecuritySettings,
    updateNotificationSettings,
    addTokenAllowance,
    updateTokenAllowance,
    removeTokenAllowance,
    clearTokenAllowances,
    saveSettings,
    resetToDefaults,
    autoBalanceAllocations,
    
    // Validation
    validateBucketAllocations,
    
    // Suggestions
    applySuggestion,
    getBucketSuggestions,
    redistributePercentages,
    
    // Session key creation
    createSessionKey: createStandardSessionKey,
  }
}