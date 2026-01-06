import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WrappedReportService } from '@/lib/wrapped-report-service'
import { BlockchainTransaction } from '@/lib/transaction-sync'

// Mock the hooks and components
vi.mock('@/hooks/use-wrapped-reports', () => ({
  useWrappedReports: () => ({
    reports: [],
    currentReport: null,
    availableYears: [2023, 2024],
    isLoading: false,
    error: null,
    selectedYear: 2024,
    selectYear: vi.fn(),
    hasActivity: true,
    overallSummary: {
      totalYears: 2,
      totalTransactions: 10,
      totalVolume: 1000,
      firstTransactionDate: new Date('2023-01-01'),
      mostActiveYear: 2024,
      dominantArchetype: 'Automated Budgeter'
    },
    formattedCurrentReport: null
  })
}))

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true
  })
}))

describe('Wrapped Report Integration Tests', () => {
  let mockTransactions: BlockchainTransaction[]

  beforeEach(() => {
    mockTransactions = [
      {
        id: 'test-1',
        hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        type: 'split',
        amount: BigInt(1000),
        timestamp: new Date('2024-01-15'),
        blockNumber: BigInt(1000),
        status: 'completed',
        gasUsed: BigInt(21000),
        gasCost: BigInt(1000000000),
        description: 'Test split transaction',
        metadata: {},
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'FundsSplit'
      },
      {
        id: 'test-2',
        hash: '0x2234567890123456789012345678901234567890123456789012345678901234',
        type: 'transfer',
        amount: BigInt(500),
        fromBucket: 'savings',
        toBucket: 'instant',
        timestamp: new Date('2024-02-15'),
        blockNumber: BigInt(1001),
        status: 'completed',
        gasUsed: BigInt(25000),
        gasCost: BigInt(1200000000),
        description: 'Test transfer transaction',
        metadata: {},
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'BucketTransfer'
      }
    ]
  })

  describe('WrappedReportService Integration', () => {
    it('should generate wrapped reports for multiple years', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      
      // Add transactions for different years
      const multiYearTransactions = [
        ...mockTransactions,
        {
          ...mockTransactions[0],
          id: 'test-3',
          timestamp: new Date('2023-06-15')
        }
      ]

      const reports = await WrappedReportService.generateAllWrappedReports(
        multiYearTransactions,
        walletAddress
      )

      expect(reports).toHaveLength(2) // 2023 and 2024
      expect(reports.map(r => r.year)).toEqual([2024, 2023]) // Most recent first
      
      reports.forEach(report => {
        expect(report.walletAddress).toBe(walletAddress)
        expect(report.totalTransactions).toBeGreaterThan(0)
        expect(report.monthlyBreakdown).toHaveLength(12)
        expect(report.userArchetype.type).toBeTruthy()
      })
    })

    it('should get available years correctly', () => {
      const years = WrappedReportService.getAvailableYears(mockTransactions)
      expect(years).toEqual([2024]) // Only 2024 has transactions
    })

    it('should detect wrapped activity', () => {
      expect(WrappedReportService.hasWrappedActivity(mockTransactions)).toBe(true)
      expect(WrappedReportService.hasWrappedActivity([])).toBe(false)
    })

    it('should generate overall summary', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      const summary = WrappedReportService.getOverallSummary(mockTransactions, walletAddress)

      expect(summary.totalYears).toBe(1)
      expect(summary.totalTransactions).toBe(2)
      expect(summary.totalVolume).toBe(1500) // 1000 + 500
      expect(summary.mostActiveYear).toBe(2024)
      expect(summary.dominantArchetype).toBeTruthy()
    })

    it('should format report for display', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      const report = WrappedReportService.generateYearlyReport(
        mockTransactions, 
        2024, 
        walletAddress
      )

      const formatted = WrappedReportService.formatReportForDisplay(report)

      expect(formatted.formattedVolume).toBeTruthy()
      expect(formatted.formattedTransactionCount).toBeTruthy()
      expect(formatted.topMonth).toBeTruthy()
      expect(formatted.consistencyLevel).toBeTruthy()
      expect(formatted.archetypeEmoji).toBeTruthy()
      expect(Array.isArray(formatted.achievements)).toBe(true)
    })

    it('should handle edge cases gracefully', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      
      // Empty transactions
      const emptyReport = WrappedReportService.generateYearlyReport([], 2024, walletAddress)
      expect(emptyReport.totalTransactions).toBe(0)
      expect(emptyReport.totalVolume).toBe(0)
      
      // Single transaction
      const singleTxReport = WrappedReportService.generateYearlyReport(
        [mockTransactions[0]], 
        2024, 
        walletAddress
      )
      expect(singleTxReport.totalTransactions).toBe(1)
      expect(singleTxReport.totalVolume).toBe(1000)
    })

    it('should respect minimum transaction threshold', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      
      const reports = await WrappedReportService.generateAllWrappedReports(
        mockTransactions,
        walletAddress,
        { minTransactionsForReport: 5 } // Higher than our 2 transactions
      )

      expect(reports).toHaveLength(0) // No reports due to insufficient transactions
    })

    it('should limit years back correctly', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'
      
      // Add very old transaction
      const oldTransactions = [
        ...mockTransactions,
        {
          ...mockTransactions[0],
          id: 'old-tx',
          timestamp: new Date('2020-01-01')
        }
      ]

      const reports = await WrappedReportService.generateAllWrappedReports(
        oldTransactions,
        walletAddress,
        { maxYearsBack: 2 } // Only last 2 years
      )

      // Should not include 2020 transaction
      expect(reports.every(r => r.year >= new Date().getFullYear() - 2)).toBe(true)
    })
  })

  describe('User Archetype Detection', () => {
    it('should detect Team Manager archetype', () => {
      const payrollTransactions = Array.from({ length: 10 }, (_, i) => ({
        ...mockTransactions[0],
        id: `payroll-${i}`,
        type: 'payroll_processed' as const,
        timestamp: new Date(2024, i % 12, 1)
      }))

      const walletAddress = '0x1234567890123456789012345678901234567890'
      const report = WrappedReportService.generateYearlyReport(
        payrollTransactions,
        2024,
        walletAddress
      )

      expect(report.userArchetype.type).toBe('Team Manager')
    })

    it('should detect Goal-Oriented Saver archetype', () => {
      const goalTransactions = [
        ...Array.from({ length: 3 }, (_, i) => ({
          ...mockTransactions[0],
          id: `goal-${i}`,
          type: 'goal_completed' as const,
          timestamp: new Date(2024, i, 1)
        })),
        ...Array.from({ length: 7 }, (_, i) => ({
          ...mockTransactions[0],
          id: `split-${i}`,
          type: 'split' as const,
          timestamp: new Date(2024, i + 3, 1)
        }))
      ]

      const walletAddress = '0x1234567890123456789012345678901234567890'
      const report = WrappedReportService.generateYearlyReport(
        goalTransactions,
        2024,
        walletAddress
      )

      expect(report.userArchetype.type).toBe('Goal-Oriented Saver')
    })

    it('should detect Automated Budgeter archetype', () => {
      const splitTransactions = Array.from({ length: 10 }, (_, i) => ({
        ...mockTransactions[0],
        id: `split-${i}`,
        type: 'split' as const,
        timestamp: new Date(2024, i % 12, 1)
      }))

      const walletAddress = '0x1234567890123456789012345678901234567890'
      const report = WrappedReportService.generateYearlyReport(
        splitTransactions,
        2024,
        walletAddress
      )

      expect(report.userArchetype.type).toBe('Automated Budgeter')
    })
  })
})