import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import fc from 'fast-check'
import React from 'react'
import { parseUnits, formatUnits } from 'viem'

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
  usePublicClient: vi.fn(() => ({
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
  })),
  useWatchContractEvent: vi.fn(),
}))

// Mock contract hooks
vi.mock('@/lib/contracts', () => ({
  useContract: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    abi: [],
    read: {
      getBucketBalance: vi.fn(),
      getSplitConfig: vi.fn(),
    },
  })),
  useContractWrite: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    abi: [],
    write: {
      depositAndSplit: vi.fn(),
      transferBetweenBuckets: vi.fn(),
      withdrawFromBucket: vi.fn(),
    },
  })),
}))

// Mock network hook
vi.mock('@/hooks/use-network', () => ({
  useNetwork: vi.fn(() => ({
    currentNetwork: 'sepolia',
  })),
}))

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

import { useBlockchainBuckets } from '../use-blockchain-buckets'
import type { BucketType } from '@/lib/types'

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement('div', {}, children)
}

describe('Blockchain Buckets Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    expect(result.current.buckets).toEqual([])
    expect(result.current.isLoading).toBe(true) // Should be true initially when connected
    expect(result.current.error).toBeNull()
    expect(result.current.pendingTransactions).toEqual([])
  })

  it('should fetch bucket balances from contract', async () => {
    const { useContract } = await import('@/lib/contracts')
    const mockContract = {
      address: '0x1234567890123456789012345678901234567890',
      abi: [],
      read: {
        getBucketBalance: vi.fn().mockResolvedValue({
          balance: parseUnits('1000', 18),
          yieldBalance: parseUnits('50', 18),
          isYielding: true,
        }),
        getSplitConfig: vi.fn().mockResolvedValue({
          billingsPercent: 4500n, // 45%
          savingsPercent: 2000n,  // 20%
          growthPercent: 2000n,   // 20%
          instantPercent: 1000n,  // 10%
          spendablePercent: 500n, // 5%
        }),
      },
    }
    
    vi.mocked(useContract).mockReturnValue(mockContract)

    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    // Wait for initial data fetch
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    expect(mockContract.read.getBucketBalance).toHaveBeenCalled()
    expect(mockContract.read.getSplitConfig).toHaveBeenCalled()
  })

  it('should handle deposit and split transactions', async () => {
    const { useContractWrite } = await import('@/lib/contracts')
    const { usePublicClient } = await import('wagmi')
    
    const mockWriteContract = {
      write: {
        depositAndSplit: vi.fn().mockResolvedValue('0xhash123'),
      },
    }
    
    const mockPublicClient = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    }
    
    vi.mocked(useContractWrite).mockReturnValue(mockWriteContract)
    vi.mocked(usePublicClient).mockReturnValue(mockPublicClient)

    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      const hash = await result.current.depositAndSplit(1000)
      expect(hash).toBe('0xhash123')
    })

    expect(mockWriteContract.write.depositAndSplit).toHaveBeenCalledWith([
      parseUnits('1000', 18)
    ])
    expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: '0xhash123'
    })
  })

  it('should handle transfer between buckets', async () => {
    const { useContractWrite } = await import('@/lib/contracts')
    const { usePublicClient } = await import('wagmi')
    
    const mockWriteContract = {
      write: {
        transferBetweenBuckets: vi.fn().mockResolvedValue('0xhash456'),
      },
    }
    
    const mockPublicClient = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    }
    
    vi.mocked(useContractWrite).mockReturnValue(mockWriteContract)
    vi.mocked(usePublicClient).mockReturnValue(mockPublicClient)

    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      const hash = await result.current.transferBetweenBuckets('spendable', 'savings', 500)
      expect(hash).toBe('0xhash456')
    })

    expect(mockWriteContract.write.transferBetweenBuckets).toHaveBeenCalledWith([
      'spendable',
      'savings',
      parseUnits('500', 18)
    ])
  })

  it('should handle withdrawal from bucket', async () => {
    const { useContractWrite } = await import('@/lib/contracts')
    const { usePublicClient } = await import('wagmi')
    
    const mockWriteContract = {
      write: {
        withdrawFromBucket: vi.fn().mockResolvedValue('0xhash789'),
      },
    }
    
    const mockPublicClient = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    }
    
    vi.mocked(useContractWrite).mockReturnValue(mockWriteContract)
    vi.mocked(usePublicClient).mockReturnValue(mockPublicClient)

    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      const hash = await result.current.withdrawFromBucket('spendable', 250)
      expect(hash).toBe('0xhash789')
    })

    expect(mockWriteContract.write.withdrawFromBucket).toHaveBeenCalledWith([
      'spendable',
      parseUnits('250', 18)
    ])
  })

  it('should handle contract errors gracefully', async () => {
    const { useContractWrite } = await import('@/lib/contracts')
    const { useToast } = await import('@/hooks/use-toast')
    
    const mockToast = vi.fn()
    const mockWriteContract = {
      write: {
        depositAndSplit: vi.fn().mockRejectedValue(new Error('Transaction failed')),
      },
    }
    
    vi.mocked(useContractWrite).mockReturnValue(mockWriteContract)
    vi.mocked(useToast).mockReturnValue({ toast: mockToast })

    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    await act(async () => {
      try {
        await result.current.depositAndSplit(1000)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Transaction failed')
      }
    })

    expect(result.current.error).toBe('Transaction failed')
    expect(mockToast).toHaveBeenCalledWith({
      title: "Deposit Failed",
      description: "Transaction failed",
      variant: "destructive",
    })
  })

  it('should provide bucket lookup functionality', () => {
    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    // Test getBucket function with empty buckets array
    const bucket = result.current.getBucket('savings')
    expect(bucket).toBeUndefined()
  })

  it('should handle disconnected wallet state', async () => {
    const { useAccount } = await import('wagmi')
    
    vi.mocked(useAccount).mockReturnValue({
      address: undefined,
      isConnected: false,
    })

    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.buckets).toEqual([])
    
    // Should throw error when trying to perform operations without connection
    await expect(result.current.depositAndSplit(1000)).rejects.toThrow(
      'Contract not available or wallet not connected'
    )
  })

  it('should refresh balances on demand', async () => {
    // Clear all mocks first
    vi.clearAllMocks()
    
    const { useContract } = await import('@/lib/contracts')
    const mockContract = {
      address: '0x1234567890123456789012345678901234567890',
      abi: [],
      read: {
        getBucketBalance: vi.fn().mockResolvedValue({
          balance: parseUnits('2000', 18),
          yieldBalance: parseUnits('100', 18),
          isYielding: true,
        }),
        getSplitConfig: vi.fn().mockResolvedValue({
          billingsPercent: 4500n,
          savingsPercent: 2000n,
          growthPercent: 2000n,
          instantPercent: 1000n,
          spendablePercent: 500n,
        }),
      },
    }
    
    vi.mocked(useContract).mockReturnValue(mockContract)

    const { result } = renderHook(() => useBlockchainBuckets(), {
      wrapper: TestWrapper,
    })

    // Wait for initial load to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Clear the mock calls from initial load
    vi.clearAllMocks()

    await act(async () => {
      await result.current.refreshBalances()
    })

    expect(mockContract.read.getBucketBalance).toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })
})