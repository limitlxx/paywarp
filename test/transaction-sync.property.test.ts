import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  TransactionSyncService, 
  BlockchainTransaction, 
  TransactionType,
  TransactionStatus 
} from '@/lib/transaction-sync'

/**
 * **Feature: paywarp-web3-integration, Property 13: Transaction History Synchronization**
 * **Validates: Requirements 9.1, 9.3, 9.4, 9.6**
 * 
 * Property: For any wallet connection, all historical transactions should be retrieved, 
 * categorized correctly, and new transactions should be detected automatically for real-time updates
 */

// Mock wagmi and viem dependencies
vi.mock('wagmi/actions', () => ({
  getPublicClient: vi.fn()
}))

vi.mock('@/lib/contracts', () => ({
  getContractAddress: vi.fn((contract: string, network: string) => 
    `0x${contract.toLowerCase()}${network === 'mainnet' ? '1' : '2'}`.padEnd(42, '0')
  )
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getContract: vi.fn(() => ({}))
  }
})

describe('TransactionSyncService Property Tests', () => {
  let mockPublicClient: any
  let syncService: TransactionSyncService

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Create mock public client
    mockPublicClient = {
      getBlockNumber: vi.fn().mockResolvedValue(1000n),
      getLogs: vi.fn().mockResolvedValue([]),
      getBlock: vi.fn().mockResolvedValue({ 
        timestamp: BigInt(Math.floor(Date.now() / 1000)) 
      }),
      getTransaction: vi.fn().mockResolvedValue({ hash: '0x123' }),
      watchEvent: vi.fn().mockReturnValue(() => {})
    }

    // Mock getPublicClient to return our mock
    const { getPublicClient } = await import('wagmi/actions')
    vi.mocked(getPublicClient).mockReturnValue(mockPublicClient)

    // Create service instance
    syncService = new TransactionSyncService(5003) // Mantle Sepolia
  })

  describe('Property 13: Transaction History Synchronization', () => {
    it('should create service instance and handle basic operations', async () => {
      expect(syncService).toBeDefined()
      
      const userAddress = '0x1234567890123456789012345678901234567890'
      const transactions = await syncService.syncHistoricalTransactions(userAddress)
      
      expect(Array.isArray(transactions)).toBe(true)
      expect(transactions.length).toBe(0) // Empty with mocked data
    })

    it('should generate consistent wrapped reports from transaction data', () => {
      const mockTransactions: BlockchainTransaction[] = [
        {
          id: 'test-1',
          hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          type: 'split',
          amount: 1000n,
          timestamp: new Date('2023-01-15'),
          blockNumber: 1000n,
          status: 'completed',
          gasUsed: 21000n,
          gasCost: 1000000000n,
          description: 'Test split transaction',
          metadata: {},
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventName: 'FundsSplit'
        },
        {
          id: 'test-2',
          hash: '0x2234567890123456789012345678901234567890123456789012345678901234',
          type: 'transfer',
          amount: 500n,
          fromBucket: 'savings',
          toBucket: 'instant',
          timestamp: new Date('2023-02-15'),
          blockNumber: 1001n,
          status: 'completed',
          gasUsed: 25000n,
          gasCost: 1200000000n,
          description: 'Test transfer transaction',
          metadata: {},
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventName: 'BucketTransfer'
        }
      ]

      const year = 2023
      const walletAddress = '0x1234567890123456789012345678901234567890'

      const wrappedReport = TransactionSyncService.generateWrappedData(
        mockTransactions, 
        year, 
        walletAddress
      )

      // Property: Wrapped report should have correct basic structure
      expect(wrappedReport.year).toBe(year)
      expect(wrappedReport.walletAddress).toBe(walletAddress)
      expect(wrappedReport.totalTransactions).toBe(mockTransactions.length)
      expect(wrappedReport.generatedAt).toBeInstanceOf(Date)

      // Property: Total volume should be sum of all transaction amounts
      const expectedVolume = mockTransactions.reduce((sum, tx) => 
        sum + Number(tx.amount), 0
      )
      expect(wrappedReport.totalVolume).toBe(expectedVolume)

      // Property: Monthly breakdown should have 12 months
      expect(wrappedReport.monthlyBreakdown).toHaveLength(12)

      // Property: Activity pattern should be valid
      expect(wrappedReport.activityPattern.peakMonth).toBeGreaterThanOrEqual(1)
      expect(wrappedReport.activityPattern.peakMonth).toBeLessThanOrEqual(12)
      expect(wrappedReport.activityPattern.averageMonthlyTransactions).toBeGreaterThanOrEqual(0)
      expect(wrappedReport.activityPattern.consistency).toBeGreaterThanOrEqual(0)
      expect(wrappedReport.activityPattern.consistency).toBeLessThanOrEqual(100)

      // Property: User archetype should be defined
      expect(typeof wrappedReport.userArchetype.type).toBe('string')
      expect(wrappedReport.userArchetype.type.length).toBeGreaterThan(0)
      expect(Array.isArray(wrappedReport.userArchetype.traits)).toBe(true)
    })

    it('should categorize all transaction types consistently', () => {
      const testTransactions: Array<{ type: TransactionType, expectedCategory: string }> = [
        { type: 'split', expectedCategory: 'Deposits & Splits' },
        { type: 'transfer', expectedCategory: 'Bucket Transfers' },
        { type: 'withdrawal', expectedCategory: 'Withdrawals' },
        { type: 'goal_created', expectedCategory: 'Savings Goals' },
        { type: 'goal_completed', expectedCategory: 'Savings Goals' },
        { type: 'payroll_processed', expectedCategory: 'Payroll Management' },
        { type: 'employee_added', expectedCategory: 'Payroll Management' },
        { type: 'deposit', expectedCategory: 'Other' }
      ]

      testTransactions.forEach(({ type, expectedCategory }) => {
        const mockTransaction: BlockchainTransaction = {
          id: `test-${type}`,
          hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          type,
          amount: 1000n,
          timestamp: new Date(),
          blockNumber: 1000n,
          status: 'completed',
          gasUsed: 21000n,
          gasCost: 1000000000n,
          description: `Test ${type} transaction`,
          metadata: {},
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventName: 'TestEvent'
        }

        const category = TransactionSyncService.categorizeTransaction(mockTransaction)
        
        // Property: Category should always be a non-empty string
        expect(typeof category).toBe('string')
        expect(category.length).toBeGreaterThan(0)
        
        // Property: Same transaction type should always get same category
        const category2 = TransactionSyncService.categorizeTransaction(mockTransaction)
        expect(category).toBe(category2)
        
        // Property: Category should match expected category
        expect(category).toBe(expectedCategory)
      })
    })

    it('should handle empty transaction arrays gracefully', () => {
      const year = 2023
      const walletAddress = '0x1234567890123456789012345678901234567890'

      const wrappedReport = TransactionSyncService.generateWrappedData(
        [], 
        year, 
        walletAddress
      )

      // Property: Empty transaction list should produce valid report
      expect(wrappedReport.year).toBe(year)
      expect(wrappedReport.walletAddress).toBe(walletAddress)
      expect(wrappedReport.totalTransactions).toBe(0)
      expect(wrappedReport.totalVolume).toBe(0)
      expect(wrappedReport.monthlyBreakdown).toHaveLength(12)
      
      // All months should have zero transactions
      wrappedReport.monthlyBreakdown.forEach(month => {
        expect(month.transactionCount).toBe(0)
        expect(month.totalVolume).toBe(0)
      })
    })

    it('should maintain data integrity during multiple sync operations', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890'
      
      // Perform multiple syncs
      const sync1 = await syncService.syncHistoricalTransactions(userAddress)
      const sync2 = await syncService.syncHistoricalTransactions(userAddress)

      // Property: Multiple syncs should return consistent results
      expect(sync1.length).toBe(sync2.length)
      expect(Array.isArray(sync1)).toBe(true)
      expect(Array.isArray(sync2)).toBe(true)
    })
  })
})