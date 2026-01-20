import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YieldPollingService, yieldPollingService } from '@/lib/yield-polling-service'
import { rwaIntegration } from '@/lib/rwa-integration'
import type { YieldData, RWABalance } from '@/lib/rwa-integration'

// Mock the RWA integration
vi.mock('@/lib/rwa-integration', () => ({
  rwaIntegration: {
    getCurrentYield: vi.fn(),
    getUSDYBalance: vi.fn(),
    getMUSDBalance: vi.fn(),
  }
}))

// Mock React for the hook
vi.mock('react', () => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
}))

describe('YieldPollingService', () => {
  let service: YieldPollingService
  const mockAddress = '0x1234567890123456789012345678901234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    service = new YieldPollingService()
  })

  afterEach(() => {
    vi.useRealTimers()
    service.stopPolling()
  })

  describe('Polling Management', () => {
    it('should start polling with valid address', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      service.startPolling(mockAddress)
      
      expect(service.isActive()).toBe(true)
      expect(service.getStatus().userAddress).toBe(mockAddress)
      expect(consoleSpy).toHaveBeenCalledWith(
        `[YieldPollingService] Started polling for address: ${mockAddress}`
      )
      
      consoleSpy.mockRestore()
    })

    it('should not start duplicate polling for same address', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      service.startPolling(mockAddress)
      
      // Clear the console spy to only count calls from the duplicate attempt
      consoleSpy.mockClear()
      
      service.startPolling(mockAddress) // Should not create new polling
      
      expect(service.isActive()).toBe(true)
      // Should not log anything for the duplicate attempt
      expect(consoleSpy).not.toHaveBeenCalledWith(
        `[YieldPollingService] Started polling for address: ${mockAddress}`
      )
      
      consoleSpy.mockRestore()
    })

    it('should stop existing polling when starting with new address', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      service.startPolling(mockAddress)
      expect(service.getStatus().userAddress).toBe(mockAddress)
      
      const newAddress = '0x9876543210987654321098765432109876543210'
      service.startPolling(newAddress)
      
      expect(service.getStatus().userAddress).toBe(newAddress)
      // Should log: start, stop, start again, plus yield update notifications
      expect(consoleSpy).toHaveBeenCalledWith('[YieldPollingService] Stopped polling')
      expect(consoleSpy).toHaveBeenCalledWith(`[YieldPollingService] Started polling for address: ${newAddress}`)
      
      consoleSpy.mockRestore()
    })

    it('should stop polling correctly', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      service.startPolling(mockAddress)
      expect(service.isActive()).toBe(true)
      
      service.stopPolling()
      
      expect(service.isActive()).toBe(false)
      expect(service.getStatus().userAddress).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('[YieldPollingService] Stopped polling')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Yield Data Fetching', () => {
    const mockYieldData: YieldData = {
      currentAPY: 4.5,
      totalYieldEarned: 100,
      yieldToday: 0.12,
      projectedYearlyYield: 45,
      lastAccrualTime: new Date(),
    }

    const mockUSDYBalance: RWABalance = {
      usdcAmount: 1000,
      tokenAmount: 950,
      currentValue: 1045,
      yieldEarned: 45,
    }

    const mockMUSDBalance: RWABalance = {
      usdcAmount: 500,
      tokenAmount: 485,
      currentValue: 516,
      yieldEarned: 16,
    }

    beforeEach(() => {
      vi.mocked(rwaIntegration.getCurrentYield).mockResolvedValue(mockYieldData)
      vi.mocked(rwaIntegration.getUSDYBalance).mockResolvedValue(mockUSDYBalance)
      vi.mocked(rwaIntegration.getMUSDBalance).mockResolvedValue(mockMUSDBalance)
    })

    it('should fetch bucket yields correctly', async () => {
      service.startPolling(mockAddress)
      
      const yields = await service.getBucketYields()
      
      expect(yields.billings.apy).toBe(4.5)
      expect(yields.billings.pending).toBe(0.12)
      expect(yields.billings.tokenBalance).toBe(1435) // 950 + 485
      expect(yields.billings.totalYieldEarned).toBe(61) // 45 + 16
      expect(yields.billings.isYielding).toBe(true)
      
      // All buckets should have the same data in this mock
      expect(yields.savings).toEqual(yields.billings)
      expect(yields.growth).toEqual(yields.billings)
      expect(yields.instant).toEqual(yields.billings)
    })

    it('should return empty yields when no address is set', async () => {
      const yields = await service.getBucketYields()
      
      expect(yields.billings.pending).toBe(0)
      expect(yields.billings.apy).toBe(0)
      expect(yields.billings.tokenBalance).toBe(0)
      expect(yields.billings.totalYieldEarned).toBe(0)
      expect(yields.billings.isYielding).toBe(false)
    })

    it('should handle RWA integration errors gracefully', async () => {
      vi.mocked(rwaIntegration.getCurrentYield).mockRejectedValue(new Error('Network error'))
      vi.mocked(rwaIntegration.getUSDYBalance).mockRejectedValue(new Error('Network error'))
      vi.mocked(rwaIntegration.getMUSDBalance).mockRejectedValue(new Error('Network error'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      service.startPolling(mockAddress)
      const yields = await service.getBucketYields()
      
      expect(yields.billings.pending).toBe(0)
      expect(yields.billings.apy).toBe(0)
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should handle partial RWA balance errors', async () => {
      vi.mocked(rwaIntegration.getUSDYBalance).mockRejectedValue(new Error('USDY error'))
      // mUSD balance should still work
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      service.startPolling(mockAddress)
      const yields = await service.getBucketYields()
      
      // Should still get data from mUSD balance and yield data
      expect(yields.billings.apy).toBe(4.5)
      expect(yields.billings.tokenBalance).toBe(485) // Only mUSD balance
      expect(yields.billings.totalYieldEarned).toBe(16) // Only mUSD yield
      
      consoleSpy.mockRestore()
    })
  })

  describe('Event System', () => {
    it('should register and unregister callbacks', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      const unsubscribe1 = service.onYieldUpdate(callback1)
      const unsubscribe2 = service.onYieldUpdate(callback2)
      
      expect(service.getStatus().callbackCount).toBe(2)
      
      unsubscribe1()
      expect(service.getStatus().callbackCount).toBe(1)
      
      unsubscribe2()
      expect(service.getStatus().callbackCount).toBe(0)
    })

    it('should notify callbacks when yields change', async () => {
      const callback = vi.fn()
      service.onYieldUpdate(callback)
      
      // Mock yield data
      vi.mocked(rwaIntegration.getCurrentYield).mockResolvedValue({
        currentAPY: 4.5,
        totalYieldEarned: 100,
        yieldToday: 0.12,
        projectedYearlyYield: 45,
        lastAccrualTime: new Date(),
      })
      vi.mocked(rwaIntegration.getUSDYBalance).mockResolvedValue({
        usdcAmount: 1000,
        tokenAmount: 950,
        currentValue: 1045,
        yieldEarned: 45,
      })
      vi.mocked(rwaIntegration.getMUSDBalance).mockResolvedValue({
        usdcAmount: 500,
        tokenAmount: 485,
        currentValue: 516,
        yieldEarned: 16,
      })
      
      service.startPolling(mockAddress)
      
      // Wait for initial fetch
      await vi.runOnlyPendingTimersAsync()
      
      expect(callback).toHaveBeenCalled()
    })

    it('should not notify callbacks when yields have not changed', async () => {
      const callback = vi.fn()
      service.onYieldUpdate(callback)
      
      // Mock same yield data
      const mockData = {
        currentAPY: 4.5,
        totalYieldEarned: 100,
        yieldToday: 0.12,
        projectedYearlyYield: 45,
        lastAccrualTime: new Date(),
      }
      
      vi.mocked(rwaIntegration.getCurrentYield).mockResolvedValue(mockData)
      vi.mocked(rwaIntegration.getUSDYBalance).mockResolvedValue({
        usdcAmount: 1000,
        tokenBalance: 950,
        currentValue: 1045,
        yieldEarned: 45,
      })
      vi.mocked(rwaIntegration.getMUSDBalance).mockResolvedValue({
        usdcAmount: 500,
        tokenBalance: 485,
        currentValue: 516,
        yieldEarned: 16,
      })
      
      service.startPolling(mockAddress)
      
      // Wait for initial fetch
      await vi.runOnlyPendingTimersAsync()
      const initialCallCount = callback.mock.calls.length
      
      // Trigger another fetch with same data
      await vi.runOnlyPendingTimersAsync()
      
      // Should not have called callback again
      expect(callback.mock.calls.length).toBe(initialCallCount)
    })

    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })
      const goodCallback = vi.fn()
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      service.onYieldUpdate(errorCallback)
      service.onYieldUpdate(goodCallback)
      
      // Mock yield data
      vi.mocked(rwaIntegration.getCurrentYield).mockResolvedValue({
        currentAPY: 4.5,
        totalYieldEarned: 100,
        yieldToday: 0.12,
        projectedYearlyYield: 45,
        lastAccrualTime: new Date(),
      })
      vi.mocked(rwaIntegration.getUSDYBalance).mockResolvedValue({
        usdcAmount: 1000,
        tokenAmount: 950,
        currentValue: 1045,
        yieldEarned: 45,
      })
      vi.mocked(rwaIntegration.getMUSDBalance).mockResolvedValue({
        usdcAmount: 500,
        tokenAmount: 485,
        currentValue: 516,
        yieldEarned: 16,
      })
      
      service.startPolling(mockAddress)
      
      // Wait for initial fetch
      await vi.runOnlyPendingTimersAsync()
      
      // Both callbacks should have been called, error should be logged
      expect(errorCallback).toHaveBeenCalled()
      expect(goodCallback).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        '[YieldPollingService] Error in yield update callback:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Polling Intervals', () => {
    it('should poll at 30-second intervals', async () => {
      // Create a fresh service for this test to avoid interference
      const testService = new YieldPollingService()
      
      // Mock the getBucketYields method to avoid RWA integration calls
      const getBucketYieldsSpy = vi.spyOn(testService, 'getBucketYields').mockResolvedValue(testService.getCurrentYields())
      
      testService.startPolling(mockAddress)
      
      // Wait for initial call to complete
      await vi.runOnlyPendingTimersAsync()
      
      // Clear the initial call
      getBucketYieldsSpy.mockClear()
      
      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000)
      await vi.runOnlyPendingTimersAsync()
      
      expect(getBucketYieldsSpy).toHaveBeenCalledTimes(1)
      
      // Advance another 30 seconds
      vi.advanceTimersByTime(30000)
      await vi.runOnlyPendingTimersAsync()
      
      expect(getBucketYieldsSpy).toHaveBeenCalledTimes(2)
      
      testService.stopPolling()
      getBucketYieldsSpy.mockRestore()
    })

    it('should stop polling when service is stopped', async () => {
      const fetchSpy = vi.spyOn(service, 'getBucketYields')
      
      service.startPolling(mockAddress)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      
      service.stopPolling()
      
      // Advance time - should not trigger more fetches
      vi.advanceTimersByTime(60000)
      await vi.runOnlyPendingTimersAsync()
      
      expect(fetchSpy).toHaveBeenCalledTimes(1) // Still only the initial call
    })
  })

  describe('Error Handling', () => {
    it('should handle fetch errors during polling', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(rwaIntegration.getCurrentYield).mockRejectedValue(new Error('Network error'))
      
      service.startPolling(mockAddress)
      
      // Wait for initial fetch to complete
      await vi.runOnlyPendingTimersAsync()
      
      // Should log errors for each bucket type
      expect(consoleSpy).toHaveBeenCalledWith(
        '[YieldPollingService] Error fetching yield for billings:',
        expect.any(Error)
      )
      
      // Service should still be active despite errors
      expect(service.isActive()).toBe(true)
      
      consoleSpy.mockRestore()
    })
  })

  describe('Status and State', () => {
    it('should return correct status information', () => {
      // Create a fresh service instance for this test
      const freshService = new YieldPollingService()
      
      const initialStatus = freshService.getStatus()
      
      expect(initialStatus.isPolling).toBe(false)
      expect(initialStatus.userAddress).toBeNull()
      expect(initialStatus.callbackCount).toBe(0)
      // Check that lastUpdate is either null or epoch time (for empty state)
      expect(initialStatus.lastUpdate === null || initialStatus.lastUpdate?.getTime() === 0).toBe(true)
      
      freshService.startPolling(mockAddress)
      const activeStatus = freshService.getStatus()
      
      expect(activeStatus.isPolling).toBe(true)
      expect(activeStatus.userAddress).toBe(mockAddress)
      
      freshService.stopPolling()
    })

    it('should return current yields from cache', () => {
      const yields = service.getCurrentYields()
      
      // Should return empty yields initially
      expect(yields.billings.pending).toBe(0)
      expect(yields.billings.apy).toBe(0)
      expect(yields.billings.tokenBalance).toBe(0)
      expect(yields.billings.totalYieldEarned).toBe(0)
      expect(yields.billings.isYielding).toBe(false)
    })

    it('should refresh yields on demand', async () => {
      const fetchSpy = vi.spyOn(service, 'getBucketYields')
      
      service.startPolling(mockAddress)
      fetchSpy.mockClear() // Clear the initial call
      
      await service.refreshYields()
      
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Singleton Instance', () => {
    it('should export a singleton instance', async () => {
      expect(yieldPollingService).toBeInstanceOf(YieldPollingService)
      
      // Test that it's a working instance
      expect(typeof yieldPollingService.startPolling).toBe('function')
      expect(typeof yieldPollingService.stopPolling).toBe('function')
      expect(typeof yieldPollingService.getBucketYields).toBe('function')
    })
  })
})