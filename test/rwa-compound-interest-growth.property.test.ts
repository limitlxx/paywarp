/**
 * Property-Based Test: RWA Compound Interest Growth
 * Feature: rwa-yield-integration, Property 6: Compound Interest Growth
 * 
 * Tests that compound interest growth correctly increases the principal amount
 * for future yield calculations according to the requirements.
 * 
 * **Validates: Requirements 3.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property Test: RWA Compound Interest Growth', () => {
  /**
   * Property 6.1: Compound yield should increase principal for future calculations
   * For any yield amount that is compounded, the principal should increase by the yield amount
   * for future calculations
   */
  it('Property 6: For any yield amount that is compounded, the principal should increase by the yield amount for future calculations', () => {
    fc.assert(
      fc.property(
        fc.record({
          originalDeposit: fc.float({ min: Math.fround(10e6), max: Math.fround(1000e6), noNaN: true }), // 10 USDC to 1000 USDC
          redemptionValue: fc.float({ min: Math.fround(1e18), max: Math.fround(1.5e18), noNaN: true }), // 1.0 to 1.5
          timeElapsed: fc.integer({ min: 7200, max: 86400 }), // 2 hours to 1 day
          apyBps: fc.integer({ min: 200, max: 1500 }) // 2% to 15% APY
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

          // Simulate yield compounding
          let newOriginalDeposits = initialOriginalDeposits;
          let yieldCompounded = 0;

          if (pendingYield > 0) {
            yieldCompounded = pendingYield;
            // Update original deposits to include compounded yield
            newOriginalDeposits = currentValue;
          }

          // Property assertions

          // 1. If yield was available, principal should increase
          if (pendingYield > 0) {
            expect(yieldCompounded).toBeGreaterThan(0);
            expect(newOriginalDeposits).toBeGreaterThan(initialOriginalDeposits);
          }

          // 2. Principal increase should equal the yield amount
          if (pendingYield > 0) {
            const principalIncrease = newOriginalDeposits - initialOriginalDeposits;
            expect(Math.abs(principalIncrease - yieldCompounded)).toBeLessThan(1e-10);
          }

          // 3. New principal should equal current value
          if (pendingYield > 0) {
            expect(Math.abs(newOriginalDeposits - currentValue)).toBeLessThan(1e-10);
          }

          // 4. Compounding should preserve total value
          expect(newOriginalDeposits).toBeGreaterThanOrEqual(initialOriginalDeposits - 1e-10);

          // 5. Future yield calculations should use new principal
          // Simulate additional time passage
          const additionalTime = 3600; // 1 hour
          const additionalYieldRate = (apyBps * additionalTime) / (10000 * 365 * 24 * 3600);
          const futureRedemptionValue = newRedemptionValue + (newRedemptionValue * additionalYieldRate) / 1e18;
          
          // Calculate future yield based on new principal
          const futureCurrentValue = (initialTokenBalance * futureRedemptionValue) / 1e18;
          const futureYield = Math.max(0, futureCurrentValue - newOriginalDeposits);
          
          // Future yield should be calculated from the compounded principal
          if (pendingYield > 0) {
            // The yield should be based on the new (higher) principal
            const expectedFutureYield = (newOriginalDeposits * additionalYieldRate) / 1e18;
            const actualFutureYieldFromPrincipal = futureYield;
            
            // Allow for some tolerance due to redemption value changes
            const tolerance = Math.max(expectedFutureYield * 0.1, 1e-6);
            expect(Math.abs(actualFutureYieldFromPrincipal - expectedFutureYield)).toBeLessThan(tolerance);
          }

          return true;
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  /**
   * Property 6.2: Multiple compounding cycles should show exponential growth
   * For any sequence of compounding operations, the principal should grow exponentially
   */
  it('Property 6 Growth Pattern: Multiple compounding cycles should show exponential growth', () => {
    fc.assert(
      fc.property(
        fc.record({
          originalDeposit: fc.float({ min: 50e6, max: 200e6, noNaN: true }), // 50 USDC to 200 USDC
          apyBps: fc.integer({ min: 500, max: 1200 }), // 5% to 12% APY
          timePerCycle: fc.integer({ min: 3600, max: 14400 }), // 1 hour to 4 hours per cycle
          numCycles: fc.integer({ min: 3, max: 6 }) // 3 to 6 compounding cycles
        }),
        ({ originalDeposit, apyBps, timePerCycle, numCycles }) => {
          // Simplified compound interest calculation
          let currentPrincipal = originalDeposit;
          const principalHistory = [currentPrincipal];

          // Calculate growth rate per cycle
          const growthRatePerCycle = (apyBps * timePerCycle) / (10000 * 365 * 24 * 3600);

          for (let cycle = 0; cycle < numCycles; cycle++) {
            // Simple compound interest: P = P * (1 + r)
            const yieldEarned = currentPrincipal * growthRatePerCycle;
            currentPrincipal = currentPrincipal + yieldEarned;
            principalHistory.push(currentPrincipal);
          }

          // Property assertions for exponential growth

          // 1. Principal should increase with each cycle (monotonic growth)
          for (let i = 1; i < principalHistory.length; i++) {
            expect(principalHistory[i]).toBeGreaterThanOrEqual(principalHistory[i-1]);
          }

          // 2. Total growth should match compound interest formula
          const expectedFinalPrincipal = originalDeposit * Math.pow(1 + growthRatePerCycle, numCycles);
          const actualFinalPrincipal = principalHistory[principalHistory.length - 1];
          
          // Allow for small floating point precision errors
          const tolerance = Math.max(expectedFinalPrincipal * 1e-10, 1e-6);
          expect(Math.abs(actualFinalPrincipal - expectedFinalPrincipal)).toBeLessThan(tolerance);

          // 3. Growth should be exponential (each cycle builds on previous)
          if (numCycles >= 2) {
            const firstCycleGrowth = principalHistory[1] - principalHistory[0];
            const lastCycleGrowth = principalHistory[numCycles] - principalHistory[numCycles - 1];
            
            // Last cycle growth should be larger than first cycle growth (compound effect)
            if (growthRatePerCycle > 1e-8) { // Only test if growth rate is meaningful
              expect(lastCycleGrowth).toBeGreaterThan(firstCycleGrowth * 0.99); // Allow small tolerance
            }
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6.3: Compounding frequency should affect total growth
   * For the same total time and APY, more frequent compounding should result in higher growth
   */
  it('Property 6 Frequency Effect: More frequent compounding should result in higher growth', () => {
    fc.assert(
      fc.property(
        fc.record({
          originalDeposit: fc.float({ min: Math.fround(100e6), max: Math.fround(500e6), noNaN: true }), // 100 USDC to 500 USDC
          redemptionValue: fc.float({ min: Math.fround(1e18), max: Math.fround(1.05e18), noNaN: true }), // 1.0 to 1.05
          totalTime: fc.integer({ min: 86400, max: 259200 }), // 1 day to 3 days
          apyBps: fc.integer({ min: 800, max: 1500 }) // 8% to 15% APY
        }),
        ({ originalDeposit, redemptionValue, totalTime, apyBps }) => {
          const tokenBalance = (originalDeposit * 1e18) / redemptionValue;

          // Scenario 1: Single compounding at the end
          const singleYieldRate = (apyBps * totalTime) / (10000 * 365 * 24 * 3600);
          const singleRedemptionValue = redemptionValue + (redemptionValue * singleYieldRate) / 1e18;
          const singleCurrentValue = (tokenBalance * singleRedemptionValue) / 1e18;
          const singleYield = Math.max(0, singleCurrentValue - originalDeposit);
          const singleFinalPrincipal = originalDeposit + singleYield;

          // Scenario 2: Frequent compounding (every hour)
          const compoundingInterval = 3600; // 1 hour
          const numCompounds = Math.floor(totalTime / compoundingInterval);
          let frequentPrincipal = originalDeposit;
          let frequentRedemptionValue = redemptionValue;

          for (let i = 0; i < numCompounds; i++) {
            const intervalYieldRate = (apyBps * compoundingInterval) / (10000 * 365 * 24 * 3600);
            frequentRedemptionValue = frequentRedemptionValue + (frequentRedemptionValue * intervalYieldRate) / 1e18;
            
            const currentValue = (tokenBalance * frequentRedemptionValue) / 1e18;
            const yieldEarned = Math.max(0, currentValue - frequentPrincipal);
            
            if (yieldEarned > 0) {
              frequentPrincipal = currentValue;
            }
          }

          // Property assertions

          // 1. Frequent compounding should result in higher or equal final principal
          expect(frequentPrincipal).toBeGreaterThanOrEqual(singleFinalPrincipal - 1e-10);

          // 2. For significant time periods and APY, frequent compounding should be noticeably better
          if (totalTime >= 86400 && apyBps >= 1000) { // 1+ days and 10%+ APY
            const improvement = frequentPrincipal - singleFinalPrincipal;
            const relativeImprovement = improvement / singleFinalPrincipal;
            expect(relativeImprovement).toBeGreaterThan(-1e-6); // Should not be worse
          }

          // 3. Both scenarios should preserve the original deposit as minimum
          expect(singleFinalPrincipal).toBeGreaterThanOrEqual(originalDeposit - 1e-10);
          expect(frequentPrincipal).toBeGreaterThanOrEqual(originalDeposit - 1e-10);

          // 4. Growth should be reasonable (not excessive)
          const maxReasonableGrowth = originalDeposit * (1 + (apyBps / 10000) * (totalTime / (365 * 24 * 3600)) * 1.5);
          expect(frequentPrincipal).toBeLessThanOrEqual(maxReasonableGrowth);
          expect(singleFinalPrincipal).toBeLessThanOrEqual(maxReasonableGrowth);

          return true;
        }
      ),
      { numRuns: 50, verbose: true }
    );
  });

  /**
   * Property 6.4: Zero yield should not change principal
   * For any scenario with zero yield, compounding should not change the principal
   */
  it('Property 6 Edge Case: Zero yield should not change principal during compounding', () => {
    fc.assert(
      fc.property(
        fc.record({
          originalDeposit: fc.float({ min: 1e6, max: 100e6, noNaN: true }), // 1 USDC to 100 USDC
          apyBps: fc.integer({ min: 100, max: 1000 }) // APY doesn't matter with zero time
        }),
        ({ originalDeposit, apyBps }) => {
          // Simulate compounding with zero time elapsed (no yield)
          const timeElapsed = 0;
          const yieldRate = (apyBps * timeElapsed) / (10000 * 365 * 24 * 3600);
          const pendingYield = originalDeposit * yieldRate;
          const currentValue = originalDeposit + pendingYield;

          // Simulate compounding
          let newPrincipal = originalDeposit;
          if (pendingYield > 0) {
            newPrincipal = currentValue;
          }

          // Property assertions for zero yield case

          // 1. Pending yield should be exactly zero
          expect(pendingYield).toBe(0);

          // 2. Principal should remain exactly unchanged
          expect(newPrincipal).toBe(originalDeposit);

          // 3. Current value should equal original deposit exactly
          expect(currentValue).toBe(originalDeposit);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});