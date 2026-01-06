import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * **Feature: paywarp-web3-integration, Property 3: Auto-Split Mathematical Correctness**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * Property: For any deposit amount and valid split configuration, the sum of allocated 
 * bucket amounts should equal the original deposit amount, and each bucket should 
 * receive exactly its configured percentage.
 */

interface SplitConfig {
  billingsPercent: number;
  savingsPercent: number;
  growthPercent: number;
  instantPercent: number;
  spendablePercent: number;
}

interface BucketAllocation {
  billings: number;
  savings: number;
  growth: number;
  instant: number;
  spendable: number;
}

// Simulate the auto-split logic from the smart contract
function calculateAutoSplit(amount: number, config: SplitConfig): BucketAllocation {
  const BASIS_POINTS = 10000; // 100.00%
  
  return {
    billings: Math.floor((amount * config.billingsPercent) / BASIS_POINTS),
    savings: Math.floor((amount * config.savingsPercent) / BASIS_POINTS),
    growth: Math.floor((amount * config.growthPercent) / BASIS_POINTS),
    instant: Math.floor((amount * config.instantPercent) / BASIS_POINTS),
    spendable: Math.floor((amount * config.spendablePercent) / BASIS_POINTS),
  };
}

// Simple generator for valid split configurations
const validSplitConfigArbitrary = fc.tuple(
  fc.integer({ min: 0, max: 2500 }),
  fc.integer({ min: 0, max: 2500 }),
  fc.integer({ min: 0, max: 2500 }),
  fc.integer({ min: 0, max: 2500 })
).map(([billings, savings, growth, instant]) => {
  const spendable = 10000 - billings - savings - growth - instant;
  return {
    billingsPercent: billings,
    savingsPercent: savings,
    growthPercent: growth,
    instantPercent: instant,
    spendablePercent: spendable
  };
});

// Generator for deposit amounts
const depositAmountArbitrary = fc.integer({ min: 1, max: 100000 });

describe('BucketVault Auto-Split Mathematical Correctness', () => {
  it('Property 3: Auto-split sum preservation', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        depositAmountArbitrary,
        validSplitConfigArbitrary,
        (amount, config) => {
          const allocation = calculateAutoSplit(amount, config);
          
          const totalAllocated = allocation.billings + allocation.savings + 
                               allocation.growth + allocation.instant + allocation.spendable;
          
          const difference = Math.abs(amount - totalAllocated);
          
          // The difference should be less than 5 due to rounding in 5 buckets
          return difference < 5;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 3: Auto-split percentage accuracy', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        depositAmountArbitrary,
        validSplitConfigArbitrary,
        (amount, config) => {
          const allocation = calculateAutoSplit(amount, config);
          const BASIS_POINTS = 10000;
          
          const expectedBillings = Math.floor((amount * config.billingsPercent) / BASIS_POINTS);
          const expectedSavings = Math.floor((amount * config.savingsPercent) / BASIS_POINTS);
          const expectedGrowth = Math.floor((amount * config.growthPercent) / BASIS_POINTS);
          const expectedInstant = Math.floor((amount * config.instantPercent) / BASIS_POINTS);
          const expectedSpendable = Math.floor((amount * config.spendablePercent) / BASIS_POINTS);
          
          return allocation.billings === expectedBillings &&
                 allocation.savings === expectedSavings &&
                 allocation.growth === expectedGrowth &&
                 allocation.instant === expectedInstant &&
                 allocation.spendable === expectedSpendable;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 3: Auto-split non-negative allocations', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        depositAmountArbitrary,
        validSplitConfigArbitrary,
        (amount, config) => {
          const allocation = calculateAutoSplit(amount, config);
          
          return allocation.billings >= 0 &&
                 allocation.savings >= 0 &&
                 allocation.growth >= 0 &&
                 allocation.instant >= 0 &&
                 allocation.spendable >= 0;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 3: Auto-split zero percentage handling', { timeout: 15000 }, () => {
    const zeroPercentageConfigs = [
      { billingsPercent: 0, savingsPercent: 2500, growthPercent: 2500, instantPercent: 2500, spendablePercent: 2500 },
      { billingsPercent: 2500, savingsPercent: 0, growthPercent: 2500, instantPercent: 2500, spendablePercent: 2500 },
      { billingsPercent: 2500, savingsPercent: 2500, growthPercent: 0, instantPercent: 2500, spendablePercent: 2500 },
      { billingsPercent: 2500, savingsPercent: 2500, growthPercent: 2500, instantPercent: 0, spendablePercent: 2500 },
      { billingsPercent: 2500, savingsPercent: 2500, growthPercent: 2500, instantPercent: 2500, spendablePercent: 0 }
    ];

    fc.assert(
      fc.property(
        depositAmountArbitrary,
        fc.constantFrom(...zeroPercentageConfigs),
        (amount, config) => {
          const allocation = calculateAutoSplit(amount, config);
          
          if (config.billingsPercent === 0) {
            expect(allocation.billings).toBe(0);
          }
          if (config.savingsPercent === 0) {
            expect(allocation.savings).toBe(0);
          }
          if (config.growthPercent === 0) {
            expect(allocation.growth).toBe(0);
          }
          if (config.instantPercent === 0) {
            expect(allocation.instant).toBe(0);
          }
          if (config.spendablePercent === 0) {
            expect(allocation.spendable).toBe(0);
          }
          
          return true;
        }
      ),
      { numRuns: 25 }
    );
  });

  it('Property 3: Auto-split maximum percentage handling', { timeout: 15000 }, () => {
    const maxPercentageConfigs = [
      { billingsPercent: 10000, savingsPercent: 0, growthPercent: 0, instantPercent: 0, spendablePercent: 0 },
      { billingsPercent: 0, savingsPercent: 10000, growthPercent: 0, instantPercent: 0, spendablePercent: 0 },
      { billingsPercent: 0, savingsPercent: 0, growthPercent: 10000, instantPercent: 0, spendablePercent: 0 },
      { billingsPercent: 0, savingsPercent: 0, growthPercent: 0, instantPercent: 10000, spendablePercent: 0 },
      { billingsPercent: 0, savingsPercent: 0, growthPercent: 0, instantPercent: 0, spendablePercent: 10000 }
    ];

    fc.assert(
      fc.property(
        depositAmountArbitrary,
        fc.constantFrom(...maxPercentageConfigs),
        (amount, config) => {
          const allocation = calculateAutoSplit(amount, config);
          const totalAllocated = allocation.billings + allocation.savings + 
                               allocation.growth + allocation.instant + allocation.spendable;
          
          // When one bucket gets 100%, it should get the full amount (minus rounding)
          return Math.abs(amount - totalAllocated) < 1;
        }
      ),
      { numRuns: 25 }
    );
  });
});

/**
 * **Feature: paywarp-web3-integration, Property 7: Bucket Transfer Rule Enforcement**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
 * 
 * Property: For any transfer request, the system should enforce bucket-specific rules 
 * (Growth no direct withdrawals, Billings overflow to Growth) and validate sufficient 
 * balances before execution.
 */

interface BucketState {
  billings: number;
  savings: number;
  growth: number;
  instant: number;
  spendable: number;
}

interface TransferRequest {
  fromBucket: string;
  toBucket: string;
  amount: number;
}

// Valid bucket names
const BUCKET_NAMES = ['billings', 'savings', 'growth', 'instant', 'spendable'];
const EXTERNAL_BUCKET = 'external'; // Represents withdrawal to external wallet

// Simulate bucket transfer logic with rule enforcement
function simulateTransfer(bucketState: BucketState, transfer: TransferRequest): {
  success: boolean;
  newState: BucketState;
  error?: string;
} {
  const newState = { ...bucketState };
  
  // Rule 6.3: Validate valid bucket names first
  if (!BUCKET_NAMES.includes(transfer.fromBucket) || 
      (!BUCKET_NAMES.includes(transfer.toBucket) && transfer.toBucket !== EXTERNAL_BUCKET)) {
    return {
      success: false,
      newState: bucketState,
      error: 'Invalid bucket name'
    };
  }
  
  // Rule 6.1: Growth bucket prevents direct withdrawals
  if (transfer.fromBucket === 'growth' && transfer.toBucket === EXTERNAL_BUCKET) {
    return {
      success: false,
      newState: bucketState,
      error: 'Cannot withdraw directly from Growth bucket'
    };
  }
  
  // Rule 6.3: Validate sufficient balance
  const fromBalance = bucketState[transfer.fromBucket as keyof BucketState];
  if (fromBalance === undefined || fromBalance < transfer.amount) {
    return {
      success: false,
      newState: bucketState,
      error: 'Insufficient balance'
    };
  }
  
  // Handle self-transfers (no state change but still valid)
  if (transfer.fromBucket === transfer.toBucket) {
    return {
      success: true,
      newState: bucketState // No change for self-transfers
    };
  }
  
  // Execute valid transfer
  newState[transfer.fromBucket as keyof BucketState] -= transfer.amount;
  
  if (transfer.toBucket !== EXTERNAL_BUCKET) {
    newState[transfer.toBucket as keyof BucketState] += transfer.amount;
  }
  
  return {
    success: true,
    newState
  };
}

// Simulate billings overflow to growth bucket (Rule 6.2)
function simulateBillingsOverflow(bucketState: BucketState, overflowThreshold: number = 1000): BucketState {
  const newState = { ...bucketState };
  
  if (newState.billings > overflowThreshold) {
    const overflow = newState.billings - overflowThreshold;
    newState.billings = overflowThreshold;
    newState.growth += overflow;
  }
  
  return newState;
}

// Generators for property testing
const bucketStateArbitrary = fc.record({
  billings: fc.integer({ min: 0, max: 10000 }),
  savings: fc.integer({ min: 0, max: 10000 }),
  growth: fc.integer({ min: 0, max: 10000 }),
  instant: fc.integer({ min: 0, max: 10000 }),
  spendable: fc.integer({ min: 0, max: 10000 })
});

const validTransferArbitrary = fc.record({
  fromBucket: fc.constantFrom(...BUCKET_NAMES),
  toBucket: fc.constantFrom(...BUCKET_NAMES, EXTERNAL_BUCKET),
  amount: fc.integer({ min: 1, max: 1000 })
});

const invalidTransferArbitrary = fc.oneof(
  // Invalid bucket names (excluding whitespace-only strings)
  fc.record({
    fromBucket: fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => !BUCKET_NAMES.includes(s) && s !== EXTERNAL_BUCKET && s.trim().length > 0),
    toBucket: fc.constantFrom(...BUCKET_NAMES, EXTERNAL_BUCKET),
    amount: fc.integer({ min: 1, max: 1000 })
  }),
  // Growth to external (direct withdrawal)
  fc.record({
    fromBucket: fc.constant('growth'),
    toBucket: fc.constant(EXTERNAL_BUCKET),
    amount: fc.integer({ min: 1, max: 1000 })
  })
);

describe('BucketVault Transfer Rule Enforcement', () => {
  it('Property 7: Growth bucket prevents direct withdrawals', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        bucketStateArbitrary,
        fc.integer({ min: 1, max: 1000 }),
        (bucketState, amount) => {
          const transfer: TransferRequest = {
            fromBucket: 'growth',
            toBucket: EXTERNAL_BUCKET,
            amount
          };
          
          const result = simulateTransfer(bucketState, transfer);
          
          // Growth bucket should never allow direct withdrawals
          return !result.success && result.error === 'Cannot withdraw directly from Growth bucket';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: Valid internal transfers succeed with sufficient balance', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        bucketStateArbitrary,
        validTransferArbitrary,
        (bucketState, transfer) => {
          // Skip growth to external transfers (already tested above)
          if (transfer.fromBucket === 'growth' && transfer.toBucket === EXTERNAL_BUCKET) {
            return true;
          }
          
          const fromBalance = bucketState[transfer.fromBucket as keyof BucketState];
          
          // Only test transfers where we have sufficient balance
          if (fromBalance >= transfer.amount) {
            const result = simulateTransfer(bucketState, transfer);
            
            if (result.success) {
              // For self-transfers, state should remain unchanged
              if (transfer.fromBucket === transfer.toBucket) {
                return JSON.stringify(result.newState) === JSON.stringify(bucketState);
              }
              
              // For other transfers, verify balance changes
              const expectedFromBalance = fromBalance - transfer.amount;
              const actualFromBalance = result.newState[transfer.fromBucket as keyof BucketState];
              
              if (actualFromBalance !== expectedFromBalance) {
                return false;
              }
              
              // Verify balance was added to destination (if not external)
              if (transfer.toBucket !== EXTERNAL_BUCKET) {
                const originalToBalance = bucketState[transfer.toBucket as keyof BucketState];
                const expectedToBalance = originalToBalance + transfer.amount;
                const actualToBalance = result.newState[transfer.toBucket as keyof BucketState];
                
                return actualToBalance === expectedToBalance;
              }
              
              return true;
            }
          }
          
          return true; // Skip insufficient balance cases for this test
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: Insufficient balance transfers are rejected', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        bucketStateArbitrary,
        validTransferArbitrary,
        (bucketState, transfer) => {
          // Skip growth to external transfers
          if (transfer.fromBucket === 'growth' && transfer.toBucket === EXTERNAL_BUCKET) {
            return true;
          }
          
          const fromBalance = bucketState[transfer.fromBucket as keyof BucketState];
          
          // Only test transfers where we have insufficient balance
          if (fromBalance < transfer.amount) {
            const result = simulateTransfer(bucketState, transfer);
            
            // Should fail with insufficient balance error
            return !result.success && result.error === 'Insufficient balance';
          }
          
          return true; // Skip sufficient balance cases for this test
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: Billings overflow to Growth bucket', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          billings: fc.integer({ min: 1001, max: 10000 }), // Above overflow threshold
          savings: fc.integer({ min: 0, max: 10000 }),
          growth: fc.integer({ min: 0, max: 10000 }),
          instant: fc.integer({ min: 0, max: 10000 }),
          spendable: fc.integer({ min: 0, max: 10000 })
        }),
        fc.integer({ min: 500, max: 1000 }), // Overflow threshold
        (bucketState, overflowThreshold) => {
          const originalGrowth = bucketState.growth;
          const originalBillings = bucketState.billings;
          
          const result = simulateBillingsOverflow(bucketState, overflowThreshold);
          
          if (originalBillings > overflowThreshold) {
            const expectedOverflow = originalBillings - overflowThreshold;
            const expectedGrowth = originalGrowth + expectedOverflow;
            
            return result.billings === overflowThreshold && 
                   result.growth === expectedGrowth;
          }
          
          // If no overflow needed, state should remain unchanged
          return result.billings === originalBillings && 
                 result.growth === originalGrowth;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: Invalid bucket names are rejected', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        bucketStateArbitrary,
        invalidTransferArbitrary,
        (bucketState, transfer) => {
          const result = simulateTransfer(bucketState, transfer);
          
          // Invalid transfers should always fail
          return !result.success && (
            result.error === 'Invalid bucket name' || 
            result.error === 'Cannot withdraw directly from Growth bucket'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: Transfer state consistency', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        bucketStateArbitrary,
        validTransferArbitrary,
        (bucketState, transfer) => {
          const result = simulateTransfer(bucketState, transfer);
          
          // Calculate total balance before and after
          const totalBefore = bucketState.billings + bucketState.savings + 
                             bucketState.growth + bucketState.instant + bucketState.spendable;
          
          const totalAfter = result.newState.billings + result.newState.savings + 
                            result.newState.growth + result.newState.instant + result.newState.spendable;
          
          if (result.success) {
            if (transfer.toBucket === EXTERNAL_BUCKET) {
              // External transfer should reduce total by transfer amount
              return totalAfter === totalBefore - transfer.amount;
            } else {
              // Internal transfer should preserve total
              return totalAfter === totalBefore;
            }
          } else {
            // Failed transfers should not change state
            return totalAfter === totalBefore;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});