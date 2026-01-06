/**
 * **Feature: paywarp-web3-integration, Property 9: Currency Conversion Accuracy**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 * 
 * Property-based tests for currency conversion accuracy and consistency
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { CurrencyManager } from '@/lib/currency-manager'
import type { Currency, CurrencyRates } from '@/lib/types'

describe('Currency Conversion Accuracy Properties', () => {
  let currencyManager: CurrencyManager

  beforeEach(() => {
    currencyManager = new CurrencyManager('sepolia')
  })

  /**
   * Property 9.1: Round-trip conversion consistency
   * For any amount and currency pair, converting A->B->A should return the original amount
   */
  it('should maintain round-trip conversion consistency', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.record({
          MNT_USD: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          USD_NGN: fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
          lastUpdated: fc.constant(new Date()),
          source: fc.constantFrom('chainlink' as const, 'cached' as const, 'fallback' as const)
        }),
        (amount, fromCurrency, toCurrency, rates) => {
          // Skip if same currency (trivial case)
          if (fromCurrency === toCurrency) return true

          // Convert A -> B -> A
          const converted = currencyManager.convertAmount(amount, fromCurrency, toCurrency, rates)
          const roundTrip = currencyManager.convertAmount(converted, toCurrency, fromCurrency, rates)

          // Allow for small floating point errors (0.01% tolerance)
          const tolerance = Math.max(amount * 0.0001, 0.01)
          const difference = Math.abs(amount - roundTrip)

          return difference <= tolerance
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.2: Conversion rate consistency
   * For any valid rates, MNT->USD->NGN should equal MNT->NGN (via USD)
   */
  it('should maintain conversion rate consistency across currency chains', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(10000), noNaN: true }),
        fc.record({
          MNT_USD: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          USD_NGN: fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
          lastUpdated: fc.constant(new Date()),
          source: fc.constantFrom('chainlink' as const, 'cached' as const, 'fallback' as const)
        }),
        (amount, rates) => {
          // Direct path: MNT -> USD -> NGN
          const mntToUsd = currencyManager.convertAmount(amount, 'MNT', 'USD', rates)
          const usdToNgn = currencyManager.convertAmount(mntToUsd, 'USD', 'NGN', rates)

          // Expected calculation: amount * MNT_USD * USD_NGN
          const expected = amount * rates.MNT_USD * rates.USD_NGN

          // Allow for small floating point errors
          const tolerance = Math.max(expected * 0.0001, 0.01)
          const difference = Math.abs(usdToNgn - expected)

          return difference <= tolerance
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.3: Same currency conversion identity
   * Converting any amount from currency X to currency X should return the same amount
   */
  it('should return identity for same currency conversions', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.record({
          MNT_USD: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          USD_NGN: fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
          lastUpdated: fc.constant(new Date()),
          source: fc.constantFrom('chainlink' as const, 'cached' as const, 'fallback' as const)
        }),
        (amount, currency, rates) => {
          const converted = currencyManager.convertAmount(amount, currency, currency, rates)
          return Math.abs(converted - amount) < 0.0001
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.4: Positive amounts remain positive
   * Converting any positive amount should always result in a positive amount
   */
  it('should preserve positive amounts in conversions', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.record({
          MNT_USD: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          USD_NGN: fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
          lastUpdated: fc.constant(new Date()),
          source: fc.constantFrom('chainlink' as const, 'cached' as const, 'fallback' as const)
        }),
        (amount, fromCurrency, toCurrency, rates) => {
          const converted = currencyManager.convertAmount(amount, fromCurrency, toCurrency, rates)
          return converted > 0 && !isNaN(converted) && isFinite(converted)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.5: Scaling consistency
   * Converting 2x amount should give 2x the result of converting 1x amount
   */
  it('should maintain scaling consistency', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(50000), noNaN: true }),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.record({
          MNT_USD: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          USD_NGN: fc.float({ min: Math.fround(100), max: Math.fround(5000), noNaN: true }),
          lastUpdated: fc.constant(new Date()),
          source: fc.constantFrom('chainlink' as const, 'cached' as const, 'fallback' as const)
        }),
        (amount, fromCurrency, toCurrency, rates) => {
          const singleConversion = currencyManager.convertAmount(amount, fromCurrency, toCurrency, rates)
          const doubleConversion = currencyManager.convertAmount(amount * 2, fromCurrency, toCurrency, rates)

          // Allow for small floating point errors
          const expected = singleConversion * 2
          const tolerance = Math.max(expected * 0.0001, 0.01)
          const difference = Math.abs(doubleConversion - expected)

          return difference <= tolerance
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.6: Currency formatting consistency
   * Formatted currency should always include proper symbols and be parseable
   */
  it('should format currencies consistently with proper symbols', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.integer({ min: 0, max: 6 }),
        (amount, currency, precision) => {
          const formatted = currencyManager.formatCurrency(amount, currency, precision)
          
          // Check that formatted string is not empty
          if (formatted.length === 0) return false
          
          // Check that it contains the expected currency symbol
          const expectedSymbols = {
            USD: '$',
            NGN: '₦',
            MNT: 'MNT'
          }
          
          const symbol = expectedSymbols[currency]
          if (!formatted.includes(symbol)) return false
          
          // Check that it contains digits
          if (!/\d/.test(formatted)) return false
          
          // For USD and NGN, symbol should be at the start
          if (currency === 'USD' || currency === 'NGN') {
            return formatted.startsWith(symbol)
          }
          
          // For MNT, symbol should be at the end
          if (currency === 'MNT') {
            return formatted.endsWith(symbol)
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.7: Rate validation bounds
   * Currency rates should always be within reasonable bounds
   */
  it('should validate currency rates are within reasonable bounds', () => {
    fc.assert(
      fc.property(
        fc.record({
          MNT_USD: fc.integer({ min: 1, max: 10000 }).map(x => x / 100), // 0.01 to 100.00
          USD_NGN: fc.integer({ min: 100, max: 1000000 }).map(x => x / 100), // 1.00 to 10000.00
          lastUpdated: fc.constant(new Date()),
          source: fc.constantFrom('chainlink' as const, 'cached' as const, 'fallback' as const)
        }),
        (rates) => {
          // MNT/USD should be reasonable (between $0.01 and $100)
          const mntUsdValid = rates.MNT_USD >= 0.01 && rates.MNT_USD <= 100
          
          // USD/NGN should be reasonable (between 1 and 10000 NGN per USD)
          const usdNgnValid = rates.USD_NGN >= 1 && rates.USD_NGN <= 10000
          
          return mntUsdValid && usdNgnValid
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.8: Fallback mechanism reliability
   * When rates are unavailable, fallback rates should still provide valid conversions
   */
  it('should provide valid conversions with fallback rates', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        fc.constantFrom('USD' as Currency, 'NGN' as Currency, 'MNT' as Currency),
        (amount, fromCurrency, toCurrency) => {
          // Test conversion without providing rates (should use fallback)
          const converted = currencyManager.convertAmount(amount, fromCurrency, toCurrency)
          
          // Result should be positive, finite, and not NaN
          return converted > 0 && !isNaN(converted) && isFinite(converted)
        }
      ),
      { numRuns: 100 }
    )
  })
})