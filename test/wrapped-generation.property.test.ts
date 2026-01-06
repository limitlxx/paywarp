import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { 
  TransactionSyncService, 
  BlockchainTransaction, 
  TransactionType,
  WrappedReport 
} from '@/lib/transaction-sync'

/**
 * **Feature: paywarp-web3-integration, Property 4: Historical Wrapped Generation Completeness**
 * **Validates: Requirements 1.4, 1.5, 11.1, 11.2, 11.3**
 * 
 * Property: For any wallet with transaction history, wrapped reports should be generated 
 * for all calendar years with sufficient activity, and first-time connections should 
 * display all available historical reports
 */

describe('Wrapped Report Generation Property Tests', () => {
  
  describe('Property 4: Historical Wrapped Generation Completeness', () => {
    
    it('should generate wrapped reports for all years with transaction activity', () => {
      fc.assert(fc.property(
        // Generate arbitrary transaction data across multiple years
        fc.record({
          walletAddress: fc.string({ minLength: 40, maxLength: 40 }).map(s => `0x${s.replace(/[^0-9a-f]/gi, '0').toLowerCase()}`),
          transactions: fc.array(
            fc.record({
              year: fc.integer({ min: 2020, max: 2025 }),
              month: fc.integer({ min: 0, max: 11 }),
              day: fc.integer({ min: 1, max: 28 }),
              type: fc.constantFrom('split', 'transfer', 'withdrawal', 'goal_created', 'payroll_processed'),
              amount: fc.bigInt({ min: 1n, max: 1000000n })
            }),
            { minLength: 1, maxLength: 100 }
          )
        }),
        (data) => {
          // Convert generated data to BlockchainTransaction format
          const transactions: BlockchainTransaction[] = data.transactions.map((tx, index) => ({
            id: `test-${index}`,
            hash: `0x${index.toString(16).padStart(64, '0')}`,
            type: tx.type as TransactionType,
            amount: tx.amount,
            timestamp: new Date(tx.year, tx.month, tx.day),
            blockNumber: BigInt(1000 + index),
            status: 'completed' as const,
            gasUsed: BigInt(21000),
            gasCost: BigInt(1000000000),
            description: `Test ${tx.type} transaction`,
            metadata: {},
            contractAddress: '0x1234567890123456789012345678901234567890',
            eventName: 'TestEvent'
          }))

          // Get unique years from transactions
          const yearsWithActivity = new Set(
            transactions.map(tx => tx.timestamp.getFullYear())
          )

          // Generate wrapped reports for each year
          const wrappedReports: WrappedReport[] = []
          for (const year of yearsWithActivity) {
            const report = TransactionSyncService.generateWrappedData(
              transactions,
              year,
              data.walletAddress
            )
            wrappedReports.push(report)
          }

          // Property: Should generate exactly one report per year with activity
          expect(wrappedReports.length).toBe(yearsWithActivity.size)

          // Property: Each report should correspond to a year with transactions
          wrappedReports.forEach(report => {
            expect(yearsWithActivity.has(report.year)).toBe(true)
          })

          // Property: Each report should have correct wallet address
          wrappedReports.forEach(report => {
            expect(report.walletAddress).toBe(data.walletAddress)
          })

          // Property: Each report should have valid structure
          wrappedReports.forEach(report => {
            expect(report.year).toBeGreaterThanOrEqual(2020)
            expect(report.year).toBeLessThanOrEqual(2025)
            expect(report.totalTransactions).toBeGreaterThanOrEqual(0)
            expect(report.totalVolume).toBeGreaterThanOrEqual(0)
            expect(report.monthlyBreakdown).toHaveLength(12)
            expect(report.generatedAt).toBeInstanceOf(Date)
            expect(typeof report.userArchetype.type).toBe('string')
            expect(Array.isArray(report.userArchetype.traits)).toBe(true)
            expect(Array.isArray(report.achievements)).toBe(true)
          })

          // Property: Reports should only include transactions from their respective years
          wrappedReports.forEach(report => {
            const yearTransactions = transactions.filter(tx => 
              tx.timestamp.getFullYear() === report.year
            )
            expect(report.totalTransactions).toBe(yearTransactions.length)
            
            const expectedVolume = yearTransactions.reduce((sum, tx) => 
              sum + Number(tx.amount), 0
            )
            expect(report.totalVolume).toBe(expectedVolume)
          })

          // Property: Monthly breakdown should accurately reflect transaction distribution
          wrappedReports.forEach(report => {
            const yearTransactions = transactions.filter(tx => 
              tx.timestamp.getFullYear() === report.year
            )
            
            const monthlyTransactionCounts = new Array(12).fill(0)
            yearTransactions.forEach(tx => {
              monthlyTransactionCounts[tx.timestamp.getMonth()]++
            })

            report.monthlyBreakdown.forEach((monthData, index) => {
              expect(monthData.month).toBe(index + 1) // 1-indexed
              expect(monthData.transactionCount).toBe(monthlyTransactionCounts[index])
            })
          })
        }
      ), { numRuns: 100 })
    })

    it('should handle edge cases in wrapped report generation', () => {
      fc.assert(fc.property(
        fc.record({
          walletAddress: fc.string({ minLength: 40, maxLength: 40 }).map(s => `0x${s.replace(/[^0-9a-f]/gi, '0').toLowerCase()}`),
          year: fc.integer({ min: 2020, max: 2025 }),
          transactionCount: fc.integer({ min: 0, max: 5 })
        }),
        (data) => {
          // Generate minimal transaction data for edge cases
          const transactions: BlockchainTransaction[] = Array.from(
            { length: data.transactionCount }, 
            (_, index) => ({
              id: `edge-test-${index}`,
              hash: `0x${index.toString(16).padStart(64, '0')}`,
              type: 'split' as TransactionType,
              amount: BigInt(100),
              timestamp: new Date(data.year, 0, 1), // All in January
              blockNumber: BigInt(1000 + index),
              status: 'completed' as const,
              gasUsed: BigInt(21000),
              gasCost: BigInt(1000000000),
              description: `Edge test transaction ${index}`,
              metadata: {},
              contractAddress: '0x1234567890123456789012345678901234567890',
              eventName: 'TestEvent'
            })
          )

          const report = TransactionSyncService.generateWrappedData(
            transactions,
            data.year,
            data.walletAddress
          )

          // Property: Should handle zero transactions gracefully
          if (data.transactionCount === 0) {
            expect(report.totalTransactions).toBe(0)
            expect(report.totalVolume).toBe(0)
            expect(report.topAsset.type).toBe('none')
            expect(report.topAsset.count).toBe(0)
          }

          // Property: Should handle single transaction correctly
          if (data.transactionCount === 1) {
            expect(report.totalTransactions).toBe(1)
            expect(report.totalVolume).toBe(100)
            expect(report.topAsset.type).toBe('split')
            expect(report.topAsset.count).toBe(1)
          }

          // Property: Activity pattern should be valid regardless of transaction count
          expect(report.activityPattern.peakMonth).toBeGreaterThanOrEqual(1)
          expect(report.activityPattern.peakMonth).toBeLessThanOrEqual(12)
          expect(report.activityPattern.averageMonthlyTransactions).toBeGreaterThanOrEqual(0)
          
          // Handle consistency calculation for edge cases
          if (data.transactionCount === 0) {
            expect(report.activityPattern.consistency).toBe(100) // Perfect consistency when no activity
          } else {
            expect(report.activityPattern.consistency).toBeGreaterThanOrEqual(0)
            expect(report.activityPattern.consistency).toBeLessThanOrEqual(100)
          }

          // Property: User archetype should always be determined
          expect(typeof report.userArchetype.type).toBe('string')
          expect(report.userArchetype.type.length).toBeGreaterThan(0)
          expect(typeof report.userArchetype.description).toBe('string')
          expect(Array.isArray(report.userArchetype.traits)).toBe(true)
        }
      ), { numRuns: 100 })
    })

    it('should maintain consistency across multiple report generations', () => {
      fc.assert(fc.property(
        fc.record({
          walletAddress: fc.string({ minLength: 40, maxLength: 40 }).map(s => `0x${s.replace(/[^0-9a-f]/gi, '0').toLowerCase()}`),
          transactions: fc.array(
            fc.record({
              type: fc.constantFrom('split', 'transfer', 'goal_completed'),
              amount: fc.bigInt({ min: 1n, max: 10000n }),
              timestamp: fc.date({ min: new Date('2023-01-01'), max: new Date('2023-12-31') })
            }),
            { minLength: 5, maxLength: 50 }
          )
        }),
        (data) => {
          const transactions: BlockchainTransaction[] = data.transactions.map((tx, index) => ({
            id: `consistency-test-${index}`,
            hash: `0x${index.toString(16).padStart(64, '0')}`,
            type: tx.type as TransactionType,
            amount: tx.amount,
            timestamp: tx.timestamp,
            blockNumber: BigInt(1000 + index),
            status: 'completed' as const,
            gasUsed: BigInt(21000),
            gasCost: BigInt(1000000000),
            description: `Consistency test transaction ${index}`,
            metadata: {},
            contractAddress: '0x1234567890123456789012345678901234567890',
            eventName: 'TestEvent'
          }))

          // Generate the same report multiple times
          const report1 = TransactionSyncService.generateWrappedData(
            transactions, 2023, data.walletAddress
          )
          const report2 = TransactionSyncService.generateWrappedData(
            transactions, 2023, data.walletAddress
          )

          // Property: Multiple generations should produce identical results (except generatedAt and achievements with timestamps)
          expect(report1.year).toBe(report2.year)
          expect(report1.walletAddress).toBe(report2.walletAddress)
          expect(report1.totalTransactions).toBe(report2.totalTransactions)
          expect(report1.totalVolume).toBe(report2.totalVolume)
          expect(report1.topAsset).toEqual(report2.topAsset)
          expect(report1.userArchetype).toEqual(report2.userArchetype)
          expect(report1.monthlyBreakdown).toEqual(report2.monthlyBreakdown)
          
          // Compare achievements without timestamp-sensitive fields
          expect(report1.achievements.length).toBe(report2.achievements.length)
          report1.achievements.forEach((achievement1, index) => {
            const achievement2 = report2.achievements[index]
            expect(achievement1.id).toBe(achievement2.id)
            expect(achievement1.name).toBe(achievement2.name)
            expect(achievement1.description).toBe(achievement2.description)
          })

          // Property: Activity pattern should be deterministic
          expect(report1.activityPattern.peakMonth).toBe(report2.activityPattern.peakMonth)
          expect(report1.activityPattern.averageMonthlyTransactions).toBe(report2.activityPattern.averageMonthlyTransactions)
          expect(report1.activityPattern.mostActiveDay).toBe(report2.activityPattern.mostActiveDay)
          expect(report1.activityPattern.consistency).toBe(report2.activityPattern.consistency)
        }
      ), { numRuns: 50 })
    })

    it('should correctly identify user archetypes based on transaction patterns', () => {
      const testCases = [
        {
          name: 'Team Manager archetype',
          transactions: Array.from({ length: 10 }, (_, i) => ({
            type: 'payroll_processed' as TransactionType,
            amount: BigInt(1000),
            timestamp: new Date(2023, i % 12, 1)
          }))
        },
        {
          name: 'Goal-Oriented Saver archetype', 
          transactions: Array.from({ length: 10 }, (_, i) => ({
            type: i < 3 ? 'goal_completed' as TransactionType : 'split' as TransactionType,
            amount: BigInt(500),
            timestamp: new Date(2023, i % 12, 1)
          }))
        },
        {
          name: 'Automated Budgeter archetype',
          transactions: Array.from({ length: 10 }, (_, i) => ({
            type: 'split' as TransactionType,
            amount: BigInt(800),
            timestamp: new Date(2023, i % 12, 1)
          }))
        }
      ]

      testCases.forEach(testCase => {
        const transactions: BlockchainTransaction[] = testCase.transactions.map((tx, index) => ({
          id: `archetype-test-${index}`,
          hash: `0x${index.toString(16).padStart(64, '0')}`,
          type: tx.type,
          amount: tx.amount,
          timestamp: tx.timestamp,
          blockNumber: BigInt(1000 + index),
          status: 'completed' as const,
          gasUsed: BigInt(21000),
          gasCost: BigInt(1000000000),
          description: `Archetype test transaction ${index}`,
          metadata: {},
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventName: 'TestEvent'
        }))

        const report = TransactionSyncService.generateWrappedData(
          transactions, 2023, '0x1234567890123456789012345678901234567890'
        )

        // Property: User archetype should be determined based on transaction patterns
        expect(typeof report.userArchetype.type).toBe('string')
        expect(report.userArchetype.type.length).toBeGreaterThan(0)
        
        // Property: Archetype should match expected pattern for known transaction types
        if (testCase.name.includes('Team Manager')) {
          expect(report.userArchetype.type).toBe('Team Manager')
        } else if (testCase.name.includes('Goal-Oriented')) {
          expect(report.userArchetype.type).toBe('Goal-Oriented Saver')
        } else if (testCase.name.includes('Automated')) {
          expect(report.userArchetype.type).toBe('Automated Budgeter')
        }
      })
    })
  })
})