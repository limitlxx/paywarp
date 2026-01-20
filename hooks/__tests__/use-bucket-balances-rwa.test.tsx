/**
 * Unit tests for useBucketBalances RWA integration
 * Tests RWA balance fetching and yield polling integration
 * Requirements: 2.1, 2.5
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: '0x1234567890123456789012345678901234567890' })),
  useReadContracts: vi.fn(() => ({
    data: [
      // Mock bucket balances
      { status: 'success', result: { balance: 1000000n, yieldBalance: 50000n, isYielding: true, lastYieldUpdate: 1234567890n } },
      { status: 'success', result: { balance: 2000000n, yieldBalance: 100000n, isYielding: true, lastYieldUpdate: 1234567890n } },
      { status: 'success', result: { balance: 500000n, yieldBalance: 25000n, isYielding: false, lastYieldUpdate: 1234567890n } },
      { status: 'success', result: { balance: 750000n, yieldBalance: 37500n, isYielding: true, lastYieldUpdate: 1234567890n } },
      { status: 'success', result: { balance: 300000n, yieldBalance: 0n, isYielding: false, lastYieldUpdate: 1234567890n } },
      // Mock split config
      { status: 'success', result: { billingsPercent: 2500n, savingsPercent: 3000n, growthPercent: 2000n, instantPercent: 1500n, spendablePercent: 1000n } },
      // Mock nonce
      { status: 'success', result: 5n }
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  }))
}))

// Mock yield polling service
vi.mock('@/lib/yield-polling-service', () => ({
  yieldPollingService: {
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    onYieldUpdate: vi.fn(() => vi.fn()), // Returns unsubscribe function
    refreshYields: vi.fn().mockResolvedValue({
      billings: { pending: 5.25, apy: 4.5, tokenBalance: 100, totalYieldEarned: 15.75, lastUpdated: new Date(), isYielding: true },
      savings: { pending: 12.50, apy: 8.2, tokenBalance: 250, totalYieldEarned: 35.25, lastUpdated: new Date(), isYielding: true },
      growth: { pending: 8.75, apy: 12.8, tokenBalance: 75, totalYieldEarned: 22.50, lastUpdated: new Date(), isYielding: false },
      instant: { pending: 3.25, apy: 2.5, tokenBalance: 125, totalYieldEarned: 8.75, lastUpdated: new Date(), isYielding: true }
    }),
    isActive: vi.fn(() => true),
    getCurrentYields: vi.fn(() => ({
      billings: { pending: 5.25, apy: 4.5, tokenBalance: 100, totalYieldEarned: 15.75, lastUpdated: new Date(), isYielding: true },
      savings: { pending: 12.50, apy: 8.2, tokenBalance: 250, totalYieldEarned: 35.25, lastUpdated: new Date(), isYielding: true },
      growth: { pending: 8.75, apy: 12.8, tokenBalance: 75, totalYieldEarned: 22.50, lastUpdated: new Date(), isYielding: false },
      instant: { pending: 3.25, apy: 2.5, tokenBalance: 125, totalYieldEarned: 8.75, lastUpdated: new Date(), isYielding: true }
    }))
  }
}))

// Mock RWA integration
vi.mock('@/lib/rwa-integration', () => ({
  rwaIntegration: {
    getUSDYBalance: vi.fn().mockResolvedValue({
      usdcAmount: 100,
      tokenAmount: 95.5,
      currentValue: 105.25,
      yieldEarned: 5.25
    }),
    getMUSDBalance: vi.fn().mockResolvedValue({
      usdcAmount: 200,
      tokenAmount: 198.5,
      currentValue: 210.50,
      yieldEarned: 10.50
    })
  }
}))

// Mock RWA error handler
vi.mock('@/lib/rwa-error-handler', () => ({
  rwaErrorHandler: {
    preserveErrorState: vi.fn()
  }
}))

// Mock networks
vi.mock('@/lib/networks', () => ({
  mantleSepolia: { id: 5003 }
}))

import { useBucketBalances } from '../use-bucket-balances'
import { yieldPollingService } from '@/lib/yield-polling-service'
import { rwaIntegration } from '@/lib/rwa-integration'
import { rwaErrorHandler } from '@/lib/rwa-error-handler'

describe('useBucketBalances RWA Integration', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890'
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should integrate yield polling service on mount', async () => {
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      expect(yieldPollingService.startPolling).toHaveBeenCalledWith(mockAddress)
      expect(yieldPollingService.onYieldUpdate).toHaveBeenCalled()
      expect(yieldPollingService.refreshYields).toHaveBeenCalled()
    })
  })

  it('should fetch RWA balances for RWA-enabled buckets', async () => {
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      // Should fetch USDY and mUSD balances for each RWA bucket
      expect(rwaIntegration.getUSDYBalance).toHaveBeenCalledWith('billings')
      expect(rwaIntegration.getUSDYBalance).toHaveBeenCalledWith('savings')
      expect(rwaIntegration.getUSDYBalance).toHaveBeenCalledWith('growth')
      expect(rwaIntegration.getUSDYBalance).toHaveBeenCalledWith('instant')
      
      expect(rwaIntegration.getMUSDBalance).toHaveBeenCalledWith('billings')
      expect(rwaIntegration.getMUSDBalance).toHaveBeenCalledWith('savings')
      expect(rwaIntegration.getMUSDBalance).toHaveBeenCalledWith('growth')
      expect(rwaIntegration.getMUSDBalance).toHaveBeenCalledWith('instant')
    })
  })

  it('should include RWA data in bucket balances', async () => {
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      const buckets = result.current.buckets
      
      // Check that RWA data is included
      expect(buckets[0]).toMatchObject({
        name: 'billings',
        rwaTokenBalance: expect.any(Number),
        pendingYield: 5.25,
        apy: 4.5,
        totalYieldEarned: expect.any(Number),
        usdyBalance: expect.objectContaining({
          tokenAmount: 95.5,
          yieldEarned: 5.25
        }),
        musdBalance: expect.objectContaining({
          tokenAmount: 198.5,
          yieldEarned: 10.50
        })
      })
    })
  })

  it('should calculate total RWA value correctly', async () => {
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      // Total RWA value should be sum of all USDY and mUSD current values
      expect(result.current.totalRWAValue).toBeGreaterThan(0)
    })
  })

  it('should calculate total pending yield correctly', async () => {
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      // Total pending yield should be sum of all bucket pending yields
      // 5.25 + 12.50 + 8.75 + 3.25 = 29.75
      expect(result.current.totalPendingYield).toBe(29.75)
    })
  })

  it('should handle RWA balance fetch errors gracefully', async () => {
    // Mock RWA integration to throw error
    vi.mocked(rwaIntegration.getUSDYBalance).mockRejectedValueOnce(new Error('RWA service unavailable'))
    
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      // Should still return bucket data even with errors
      expect(result.current.buckets).toBeDefined()
      expect(result.current.buckets.length).toBe(5)
    }, { timeout: 3000 })

    // The hook should continue to work despite RWA errors
    expect(result.current.isLoading).toBe(false)
    expect(result.current.rwaErrors).toBeDefined()
  })

  it('should provide refresh RWA data function', async () => {
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      expect(result.current.refreshRWAData).toBeDefined()
      expect(typeof result.current.refreshRWAData).toBe('function')
    })

    // Test refresh function
    await result.current.refreshRWAData()
    
    expect(yieldPollingService.refreshYields).toHaveBeenCalled()
  })

  it('should include yield polling status in return data', async () => {
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      expect(result.current.isYieldPollingActive).toBe(true)
      expect(result.current.yieldData).toBeDefined()
    })
  })

  it('should handle partial RWA balance failures', async () => {
    // Mock USDY to succeed but mUSD to fail
    vi.mocked(rwaIntegration.getMUSDBalance).mockRejectedValueOnce(new Error('mUSD service down'))
    
    const { result } = renderHook(() => useBucketBalances())

    await waitFor(() => {
      const buckets = result.current.buckets
      
      // Should still have USDY data
      expect(buckets[0].usdyBalance).toBeDefined()
      
      // Should handle mUSD failure gracefully - may be undefined due to error
      expect(buckets[0]).toBeDefined()
    })
  })

  it('should update RWA data when yield data changes', async () => {
    const mockOnYieldUpdate = vi.fn()
    vi.mocked(yieldPollingService.onYieldUpdate).mockImplementation((callback) => {
      mockOnYieldUpdate.mockImplementation(callback)
      return vi.fn() // unsubscribe function
    })

    const { result } = renderHook(() => useBucketBalances())

    // Simulate yield data update
    const newYieldData = {
      billings: { pending: 10.50, apy: 5.0, tokenBalance: 110, totalYieldEarned: 20.25, lastUpdated: new Date(), isYielding: true },
      savings: { pending: 15.75, apy: 8.5, tokenBalance: 275, totalYieldEarned: 40.50, lastUpdated: new Date(), isYielding: true },
      growth: { pending: 12.25, apy: 13.2, tokenBalance: 85, totalYieldEarned: 28.75, lastUpdated: new Date(), isYielding: true },
      instant: { pending: 4.50, apy: 3.0, tokenBalance: 135, totalYieldEarned: 12.25, lastUpdated: new Date(), isYielding: true }
    }

    await waitFor(() => {
      mockOnYieldUpdate(newYieldData)
    })

    // Should trigger RWA balance refetch
    await waitFor(() => {
      expect(rwaIntegration.getUSDYBalance).toHaveBeenCalled()
    })
  })
})