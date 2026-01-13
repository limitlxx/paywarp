/**
 * **Feature: paywarp-web3-integration, Property 5: RWA Yield Consistency**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 * 
 * Property-based tests for RWA yield consistency and token conversion accuracy
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { RWAIntegration } from '@/lib/rwa-integration'
import type { BucketType } from '@/lib/types'

describe('RWA Yield Consistency Properties', () => {
  let rwaIntegration: RWAIntegration

  beforeEach(() => {
    rwaIntegration = new RWAIntegration('sepolia')
  })

  /**
   * Property 5.1: USDC to USDY conversion consistency
   * For any positive USDC amount, conversion should result in positive USDY tokens
   * and the conversion should be mathematically consistent with redemption value
   */
  it('should maintain USDC to USDY conversion consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.constantFrom('billings' as BucketType, 'savings' as BucketType, 'growth' as BucketType, 'instant' as BucketType, 'spendable' as BucketType),
        async (amount, bucket) => {
          const result = await rwaIntegration.convertToUSDY(amount, bucket)
          
          if (!result.success) {
            // Conversion should only fail for invalid inputs, not valid ones
            return amount <= 0
          }

          // Successful conversion should have positive token amount
          const tokenAmount = result.tokenAmount!
          if (tokenAmount <= 0) return false

          // Get USDY token data to verify conversion math
          const usdyToken = rwaIntegration.getTokenData('USDY')
          if (!usdyToken) return false

          // Expected token amount = USDC amount / redemption value
          const expectedTokens = amount / usdyToken.redemptionValue
          const tolerance = Math.max(expectedTokens * 0.001, 0.001) // 0.1% tolerance

          return Math.abs(tokenAmount - expectedTokens) <= tolerance
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.2: USDC to mUSD conversion consistency
   * For any positive USDC amount, conversion should result in positive mUSD tokens
   * and the conversion should be mathematically consistent with redemption value
   */
  it('should maintain USDC to mUSD conversion consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.constantFrom('billings' as BucketType, 'savings' as BucketType, 'growth' as BucketType, 'instant' as BucketType, 'spendable' as BucketType),
        async (amount, bucket) => {
          const result = await rwaIntegration.convertToMUSD(amount, bucket)
          
          if (!result.success) {
            // Conversion should only fail for invalid inputs, not valid ones
            return amount <= 0
          }

          // Successful conversion should have positive token amount
          const tokenAmount = result.tokenAmount!
          if (tokenAmount <= 0) return false

          // Get mUSD token data to verify conversion math
          const musdToken = rwaIntegration.getTokenData('mUSD')
          if (!musdToken) return false

          // Expected token amount = USDC amount / redemption value
          const expectedTokens = amount / musdToken.redemptionValue
          const tolerance = Math.max(expectedTokens * 0.001, 0.001) // 0.1% tolerance

          return Math.abs(tokenAmount - expectedTokens) <= tolerance
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.3: Yield accrual increases redemption value over time
   * For any RWA token, redemption value should increase over time when yield is accrued
   */
  it('should increase redemption value over time with yield accrual', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('USDY' as const, 'mUSD' as const),
        (tokenSymbol) => {
          const initialToken = rwaIntegration.getTokenData(tokenSymbol)
          if (!initialToken) return false

          const initialRedemptionValue = initialToken.redemptionValue

          // Simulate yield accrual by updating redemption values
          rwaIntegration.updateRedemptionValues()

          const updatedToken = rwaIntegration.getTokenData(tokenSymbol)
          if (!updatedToken) return false

          // Redemption value should increase (or stay the same if no time passed)
          return updatedToken.redemptionValue >= initialRedemptionValue
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.4: Yield data consistency across buckets
   * For any bucket, yield data should be consistent and within reasonable bounds
   */
  it('should provide consistent yield data within reasonable bounds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('billings' as BucketType, 'savings' as BucketType, 'growth' as BucketType, 'instant' as BucketType, 'spendable' as BucketType),
        async (bucket) => {
          const yieldData = await rwaIntegration.getCurrentYield(bucket)

          // APY should be positive and reasonable (0.1% to 50%)
          if (yieldData.currentAPY < 0.1 || yieldData.currentAPY > 50) return false

          // Total yield earned should be non-negative
          if (yieldData.totalYieldEarned < 0) return false

          // Today's yield should be non-negative
          if (yieldData.yieldToday < 0) return false

          // Projected yearly yield should be non-negative
          if (yieldData.projectedYearlyYield < 0) return false

          // Last accrual time should be recent (within last day for active system)
          const timeDiff = Date.now() - yieldData.lastAccrualTime.getTime()
          const oneDayMs = 24 * 60 * 60 * 1000
          
          return timeDiff <= oneDayMs
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.5: RWA balance calculations are mathematically correct
   * For any RWA balance, current value should equal token amount * redemption value
   */
  it('should calculate RWA balances correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('billings' as BucketType, 'savings' as BucketType, 'growth' as BucketType, 'instant' as BucketType, 'spendable' as BucketType),
        fc.constantFrom('USDY' as const, 'mUSD' as const),
        async (bucket, tokenType) => {
          let balance
          let tokenData

          if (tokenType === 'USDY') {
            balance = await rwaIntegration.getUSDYBalance(bucket)
            tokenData = rwaIntegration.getTokenData('USDY')
          } else {
            balance = await rwaIntegration.getMUSDBalance(bucket)
            tokenData = rwaIntegration.getTokenData('mUSD')
          }

          if (!tokenData) return false

          // Current value should equal token amount * redemption value
          const expectedValue = balance.tokenAmount * tokenData.redemptionValue
          const tolerance = Math.max(expectedValue * 0.001, 0.001) // 0.1% tolerance

          const valueCorrect = Math.abs(balance.currentValue - expectedValue) <= tolerance

          // Yield earned should be non-negative
          const yieldValid = balance.yieldEarned >= 0

          // Current value should be >= original USDC amount (due to yield)
          const valueIncreased = balance.currentValue >= balance.usdcAmount

          return valueCorrect && yieldValid && valueIncreased
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.6: Token redemption is inverse of conversion
   * For any token amount, redeeming should give back USDC proportional to current redemption value
   */
  it('should maintain redemption consistency with conversion rates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
        fc.constantFrom('billings' as BucketType, 'savings' as BucketType, 'growth' as BucketType, 'instant' as BucketType, 'spendable' as BucketType),
        async (tokenAmount, bucket) => {
          const redemptionResult = await rwaIntegration.redeemUSDY(tokenAmount, bucket)
          
          if (!redemptionResult.success) {
            // Redemption should only fail for invalid inputs
            return tokenAmount <= 0
          }

          const usdcAmount = redemptionResult.tokenAmount!
          if (usdcAmount <= 0) return false

          // Get USDY token data to verify redemption math
          const usdyToken = rwaIntegration.getTokenData('USDY')
          if (!usdyToken) return false

          // Expected USDC amount = token amount * redemption value
          const expectedUSDC = tokenAmount * usdyToken.redemptionValue
          const tolerance = Math.max(expectedUSDC * 0.001, 0.001) // 0.1% tolerance

          return Math.abs(usdcAmount - expectedUSDC) <= tolerance
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.7: Historical yield data consistency
   * For any bucket and time period, historical yield data should be consistent and ordered
   */
  it('should provide consistent historical yield data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('billings' as BucketType, 'savings' as BucketType, 'growth' as BucketType, 'instant' as BucketType, 'spendable' as BucketType),
        fc.constantFrom('day' as const, 'week' as const, 'month' as const, 'year' as const),
        async (bucket, period) => {
          const history = await rwaIntegration.getHistoricalYield(bucket, period)

          // Should have data points
          if (history.data.length === 0) return false

          // All data points should have valid values
          for (const point of history.data) {
            // APY should be positive and reasonable
            if (point.apy < 0.1 || point.apy > 50) return false
            
            // Yield earned should be non-negative
            if (point.yieldEarned < 0) return false
            
            // Balance should be positive
            if (point.balance <= 0) return false
            
            // Timestamp should be valid
            if (!(point.timestamp instanceof Date) || isNaN(point.timestamp.getTime())) return false
          }

          // Data should be ordered by timestamp (oldest to newest)
          for (let i = 1; i < history.data.length; i++) {
            if (history.data[i].timestamp < history.data[i-1].timestamp) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.8: Error handling for invalid inputs
   * For any invalid input (negative amounts, etc.), operations should fail gracefully
   */
  it('should handle invalid inputs gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(-1000), max: Math.fround(0), noNaN: true }), // Negative or zero amounts
        fc.constantFrom('billings' as BucketType, 'savings' as BucketType, 'growth' as BucketType, 'instant' as BucketType, 'spendable' as BucketType),
        async (invalidAmount, bucket) => {
          // All operations with invalid amounts should fail gracefully
          const usdyResult = await rwaIntegration.convertToUSDY(invalidAmount, bucket)
          const musdResult = await rwaIntegration.convertToMUSD(invalidAmount, bucket)
          const redeemResult = await rwaIntegration.redeemUSDY(invalidAmount, bucket)

          // All should fail with proper error messages
          const usdyFailed = !usdyResult.success && usdyResult.error !== undefined
          const musdFailed = !musdResult.success && musdResult.error !== undefined
          const redeemFailed = !redeemResult.success && redeemResult.error !== undefined

          return usdyFailed && musdFailed && redeemFailed
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.9: Network consistency
   * Token addresses and configurations should be consistent within each network
   */
  it('should maintain network-specific configuration consistency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mainnet' as const, 'sepolia' as const),
        (network) => {
          const rwa = new RWAIntegration(network)
          
          const usdyToken = rwa.getTokenData('USDY')
          const musdToken = rwa.getTokenData('mUSD')

          if (!usdyToken || !musdToken) return false

          // Addresses should be valid (non-zero for configured networks)
          const usdyAddressValid = usdyToken.address.length === 42 && usdyToken.address.startsWith('0x')
          const musdAddressValid = musdToken.address.length === 42 && musdToken.address.startsWith('0x')

          // Symbols should be correct
          const symbolsCorrect = usdyToken.symbol === 'USDY' && musdToken.symbol === 'mUSD'

          // Decimals should be 18 (standard for these tokens)
          const decimalsCorrect = usdyToken.decimals === 18 && musdToken.decimals === 18

          // APY should be reasonable
          const apyReasonable = usdyToken.currentAPY > 0 && usdyToken.currentAPY < 50 &&
                               musdToken.currentAPY > 0 && musdToken.currentAPY < 50

          // Redemption values should start at or above 1.0
          const redemptionValid = usdyToken.redemptionValue >= 1.0 && musdToken.redemptionValue >= 1.0

          return usdyAddressValid && musdAddressValid && symbolsCorrect && 
                 decimalsCorrect && apyReasonable && redemptionValid
        }
      ),
      { numRuns: 100 }
    )
  })
})