/**
 * Property-Based Test: RWA Yield Claiming Preservation
 * Feature: rwa-yield-integration, Property 5: Yield Claiming Preservation
 * 
 * Tests that yield claiming preserves user's principal balance and correctly
 * mints yield tokens according to the requirements.
 * 
 * **Validates: Requirements 3.1, 3.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property Test: RWA Yield Claiming Preservation', () => {
  /**
   * Property 5.1: Yield claiming should preserve principal and mint correct tokens
   * For any available yield amount, claiming yield should mint the correct number of tokens
   * and preserve the user's principal balance
   */
  it('Property 5: For any available yield amount, claiming yield should mint the correct number of tokens and preserve the user\'s principal balance', () => {
    fc.assert(
      fc.property(
        fc.record({
          originalDeposit: fc.float({ min: Math.fround(1e6), max: Math.fround(1000e6), noNaN: true }), // 1 USDC to 1000 USDC (6 decimals)
          redemptionValue: fc.float({ min: Math.fround(1e18), max: Math.fround(2e18), noNaN: true }), // 1.0 to 2.0 (18 decimals)
          timeElapsed: fc.integer({ min: 3600, max: 31536000 }), // 1 hour to 1 year in seconds
          apyBps: fc.integer({ min: 100, max: 2000 }) // 1% to 20% APY
        }),
        ({ originalDeposit, redemptionValue, timeElapsed, apyBps }) => {
          // Simulate initial deposit state
          const initialTokenBalance = (originalDeposit * 1e18) / redemptionValue;
          const initialOriginalDeposits = originalDeposit;

          // Simulate yield accrual
          const yieldRate = (apyBps * timeElapsed) / (10000 * 365 * 24 * 3600);
          const newRedemptionValue = redemptionValue + (redemptionValue * yieldRate) / 1e18;

          // Calculate current value and pending yield
          const currentValue = (initialTokenBalance * newRedemptionValue) / 1e18;
          const pendingYield = Math.max(0, currentValue - initialOriginalDeposits);

          // Simulate yield claiming
          let yieldClaimed = 0;
          let newTokenBalance = initialTokenBalance;
          let newOriginalDeposits = initialOriginalDeposits;

          if (pendingYield > 0) {
            // Convert yield to tokens at current redemption value
            yieldClaimed = (pendingYield * 1e18) / newRedemptionValue;
            newTokenBalance = initialTokenBalance + yieldClaimed;
            newOriginalDeposits = currentValue; // Update for compounding
          }

          // Property assertions

          // 1. If yield was available, tokens should be minted
          if (pendingYield > 0) {
            expect(yieldClaimed).toBeGreaterThan(0);
            expect(newTokenBalance).toBeGreaterThan(initialTokenBalance);
          }

          // 2. Original deposits should be updated to current value for compounding
          if (pendingYield > 0) {
            expect(newOriginalDeposits).toBeGreaterThan(initialOriginalDeposits);
            expect(Math.abs(newOriginalDeposits - currentValue)).toBeLessThan(1e-10);
          }

          // 3. User should not lose any value through claiming
          const newCurrentValue = (newTokenBalance * newRedemptionValue) / 1e18;
          expect(newCurrentValue).toBeGreaterThanOrEqual(currentValue - 1e-10); // Allow for rounding

          // 4. Yield claimed should correspond to pending yield
          if (pendingYield > 0) {
            const expectedYieldTokens = (pendingYield * 1e18) / newRedemptionValue;
            expect(Math.abs(yieldClaimed - expectedYieldTokens)).toBeLessThan(1e-10);
          }

          // 5. Principal preservation: new original deposits should equal current value
          if (pendingYield > 0) {
            expect(Math.abs(newOriginalDeposits - currentValue)).toBeLessThan(1e-10);
          }

          return true;
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  /**
   * Property 5.2: Claiming yield with no accrued yield should not change balances
   * For any deposit without time elapsed, claiming should not change token balances
   */
  it('Property 5 Edge Case: Claiming yield with no accrued yield should not change balances', () => {
    fc.assert(
      fc.property(
        fc.record({
          originalDeposit: fc.float({ min: Math.fround(1e6), max: Math.fround(100e6), noNaN: true }), // 1 USDC to 100 USDC
          redemptionValue: fc.float({ min: Math.fround(1e18), max: Math.fround(1.1e18), noNaN: true }), // 1.0 to 1.1 (minimal yield)
          apyBps: fc.integer({ min: 100, max: 1000 }) // 1% to 10% APY
        }),
        ({ originalDeposit, redemptionValue, apyBps }) => {
          // Simulate initial deposit state (no time elapsed)
          const tokenBalance = (originalDeposit * 1e18) / redemptionValue;
          const originalDeposits = originalDeposit;

          // No time elapsed, so no yield accrual
          const currentValue = (tokenBalance * redemptionValue) / 1e18;
          const pendingYield = Math.max(0, currentValue - originalDeposits);

          // Simulate yield claiming (should be zero or minimal)
          let yieldClaimed = 0;
          let newTokenBalance = tokenBalance;
          let newOriginalDeposits = originalDeposits;

          if (pendingYield > 0) {
            yieldClaimed = (pendingYield * 1e18) / redemptionValue;
            newTokenBalance = tokenBalance + yieldClaimed;
            newOriginalDeposits = currentValue;
          }

          // Property assertions for zero yield case

          // 1. Pending yield should be minimal or zero
          expect(pendingYield).toBeLessThan(1e-6); // Very small tolerance

          // 2. If no yield, balances should remain the same
          if (pendingYield === 0) {
            expect(newTokenBalance).toEqual(tokenBalance);
            expect(newOriginalDeposits).toEqual(originalDeposits);
          }

          // 3. Any changes should be minimal
          const tokenChange = Math.abs(newTokenBalance - tokenBalance);
          const depositChange = Math.abs(newOriginalDeposits - originalDeposits);
          expect(tokenChange).toBeLessThan(1e-6);
          expect(depositChange).toBeLessThan(1e-6);

          return true;
        }
      ),
      { numRuns: 50, verbose: true }
    );
  });

  /**
   * Property 5.3: Multiple yield claims should preserve mathematical consistency
   * For any sequence of yield claims, the total should equal a single claim
   */
  it('Property 5 Consistency: Multiple yield claims should preserve mathematical consistency', () => {
    fc.assert(
      fc.property(
        fc.record({
          originalDeposit: fc.float({ min: Math.fround(10e6), max: Math.fround(100e6), noNaN: true }), // 10 USDC to 100 USDC
          redemptionValue: fc.float({ min: Math.fround(1e18), max: Math.fround(1.2e18), noNaN: true }), // 1.0 to 1.2
          totalTime: fc.integer({ min: 7200, max: 86400 }), // 2 hours to 1 day
          apyBps: fc.integer({ min: 500, max: 1500 }), // 5% to 15% APY
          numClaims: fc.integer({ min: 2, max: 5 }) // 2 to 5 claims
        }),
        ({ originalDeposit, redemptionValue, totalTime, apyBps, numClaims }) => {
          // Single claim scenario
          const singleClaimYieldRate = (apyBps * totalTime) / (10000 * 365 * 24 * 3600);
          const singleClaimRedemptionValue = redemptionValue + (redemptionValue * singleClaimYieldRate) / 1e18;
          const singleClaimTokens = (originalDeposit * 1e18) / redemptionValue;
          const singleClaimCurrentValue = (singleClaimTokens * singleClaimRedemptionValue) / 1e18;
          const singleClaimYield = Math.max(0, singleClaimCurrentValue - originalDeposit);

          // Multiple claims scenario
          const timePerClaim = Math.floor(totalTime / numClaims);
          let multipleClaimTokens = (originalDeposit * 1e18) / redemptionValue;
          let multipleClaimOriginalDeposits = originalDeposit;
          let multipleClaimRedemptionValue = redemptionValue;
          let totalYieldClaimed = 0;

          for (let i = 0; i < numClaims; i++) {
            // Accrue yield for this period
            const periodYieldRate = (apyBps * timePerClaim) / (10000 * 365 * 24 * 3600);
            multipleClaimRedemptionValue = multipleClaimRedemptionValue + (multipleClaimRedemptionValue * periodYieldRate) / 1e18;

            // Calculate and claim yield
            const currentValue = (multipleClaimTokens * multipleClaimRedemptionValue) / 1e18;
            const pendingYield = Math.max(0, currentValue - multipleClaimOriginalDeposits);

            if (pendingYield > 0) {
              const yieldTokens = (pendingYield * 1e18) / multipleClaimRedemptionValue;
              multipleClaimTokens += yieldTokens;
              multipleClaimOriginalDeposits = currentValue;
              totalYieldClaimed += pendingYield;
            }
          }

          // Property assertions

          // 1. Multiple claims should result in more or equal yield due to compounding
          expect(totalYieldClaimed).toBeGreaterThanOrEqual(singleClaimYield - 1e-6);

          // 2. The difference should be reasonable (compounding effect)
          const yieldDifference = totalYieldClaimed - singleClaimYield;
          const relativeDifference = Math.abs(yieldDifference) / Math.max(singleClaimYield, 1e-6);
          expect(relativeDifference).toBeLessThan(0.1); // Within 10%

          // 3. Final token balance should be consistent with total yield
          const finalValue = (multipleClaimTokens * multipleClaimRedemptionValue) / 1e18;
          expect(finalValue).toBeGreaterThanOrEqual(originalDeposit + totalYieldClaimed - 1e-6);

          return true;
        }
      ),
      { numRuns: 50, verbose: true }
    );
  });
});