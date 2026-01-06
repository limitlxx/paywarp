import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * **Feature: paywarp-web3-integration, Property 6: Payroll Execution Integrity**
 * **Validates: Requirements 5.1, 5.2, 5.3, 13.2**
 * 
 * Property: For any scheduled payroll batch, all employee payments should execute 
 * successfully with proper deduction from Instant bucket, or the entire batch should 
 * fail atomically with funds preserved.
 */

interface Employee {
  id: number;
  address: string;
  salary: number;
  active: boolean;
}

interface PayrollBatch {
  id: number;
  employees: Employee[];
  totalAmount: number;
  scheduledDate: number;
  processed: boolean;
  failed: boolean;
}

interface PayrollResult {
  batchId: number;
  successfulPayments: number;
  failedPayments: number;
  totalProcessed: number;
  fundsDeducted: number;
  allSuccessful: boolean;
}

// Simulate payroll processing logic
function processPayrollBatch(
  batch: PayrollBatch, 
  availableFunds: number,
  shouldSimulateFailure: boolean = false
): PayrollResult {
  let successfulPayments = 0;
  let failedPayments = 0;
  let totalProcessed = 0;
  let fundsDeducted = 0;

  const activeEmployees = batch.employees.filter(emp => emp.active);

  // Check if we have sufficient funds for the entire batch
  if (availableFunds < batch.totalAmount) {
    // Insufficient funds - entire batch fails atomically
    return {
      batchId: batch.id,
      successfulPayments: 0,
      failedPayments: activeEmployees.length,
      totalProcessed: 0,
      fundsDeducted: 0,
      allSuccessful: false
    };
  }

  // Process each active employee payment
  for (const employee of activeEmployees) {
    // Simulate payment execution
    const paymentSuccess = !shouldSimulateFailure && Math.random() > 0.1; // 90% success rate
    
    if (paymentSuccess) {
      successfulPayments++;
      totalProcessed += employee.salary;
      fundsDeducted += employee.salary;
    } else {
      failedPayments++;
    }
  }

  const allSuccessful = failedPayments === 0;

  // If any payment failed, revert all deductions (atomic behavior)
  if (!allSuccessful) {
    fundsDeducted = 0;
    totalProcessed = 0;
    successfulPayments = 0;
    failedPayments = activeEmployees.length;
  }

  return {
    batchId: batch.id,
    successfulPayments,
    failedPayments,
    totalProcessed,
    fundsDeducted,
    allSuccessful
  };
}

// Generator for employee data
const employeeArbitrary = fc.record({
  id: fc.integer({ min: 0, max: 1000 }),
  address: fc.integer({ min: 1, max: 999999 }).map(n => `0x${n.toString(16).padStart(40, '0')}`),
  salary: fc.integer({ min: 1000, max: 10000 }), // $10 to $100 in cents
  active: fc.boolean()
});

// Generator for payroll batches
const payrollBatchArbitrary = fc.record({
  id: fc.integer({ min: 0, max: 1000 }),
  employees: fc.array(employeeArbitrary, { minLength: 1, maxLength: 10 }),
  scheduledDate: fc.integer({ min: Date.now(), max: Date.now() + 86400000 }),
  processed: fc.constant(false),
  failed: fc.constant(false)
}).map(batch => ({
  ...batch,
  totalAmount: batch.employees
    .filter(emp => emp.active)
    .reduce((sum, emp) => sum + emp.salary, 0)
}));

// Generator for available funds
const availableFundsArbitrary = fc.integer({ min: 0, max: 100000 });

describe('PayrollEngine Execution Integrity', () => {
  it('Property 6: Payroll atomic execution - all or nothing', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        payrollBatchArbitrary,
        availableFundsArbitrary,
        (batch, availableFunds) => {
          const result = processPayrollBatch(batch, availableFunds);
          
          // Either all payments succeed or all fail (atomic behavior)
          const activeEmployees = batch.employees.filter(emp => emp.active).length;
          
          if (result.allSuccessful) {
            // All payments should succeed
            expect(result.successfulPayments).toBe(activeEmployees);
            expect(result.failedPayments).toBe(0);
            expect(result.fundsDeducted).toBe(batch.totalAmount);
          } else {
            // All payments should fail and no funds should be deducted
            expect(result.successfulPayments).toBe(0);
            expect(result.failedPayments).toBe(activeEmployees);
            expect(result.fundsDeducted).toBe(0);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6: Payroll insufficient funds handling', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        payrollBatchArbitrary,
        fc.integer({ min: 0, max: 1000 }), // Intentionally low funds
        (batch, availableFunds) => {
          const result = processPayrollBatch(batch, availableFunds);
          
          if (availableFunds < batch.totalAmount) {
            // Should fail entirely when insufficient funds
            expect(result.allSuccessful).toBe(false);
            expect(result.successfulPayments).toBe(0);
            expect(result.fundsDeducted).toBe(0);
            expect(result.totalProcessed).toBe(0);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6: Payroll funds conservation', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        payrollBatchArbitrary,
        availableFundsArbitrary,
        (batch, availableFunds) => {
          const result = processPayrollBatch(batch, availableFunds);
          
          // Funds deducted should never exceed available funds
          expect(result.fundsDeducted).toBeLessThanOrEqual(availableFunds);
          
          // Funds deducted should equal total processed
          expect(result.fundsDeducted).toBe(result.totalProcessed);
          
          // If successful, funds deducted should equal batch total
          if (result.allSuccessful && batch.totalAmount > 0) {
            expect(result.fundsDeducted).toBe(batch.totalAmount);
          }
          
          return result.fundsDeducted <= availableFunds &&
                 result.fundsDeducted === result.totalProcessed;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6: Payroll inactive employee handling', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        payrollBatchArbitrary,
        availableFundsArbitrary,
        (batch, availableFunds) => {
          const result = processPayrollBatch(batch, availableFunds);
          const activeEmployees = batch.employees.filter(emp => emp.active);
          const inactiveEmployees = batch.employees.filter(emp => !emp.active);
          
          // Only active employees should be processed
          if (result.allSuccessful) {
            expect(result.successfulPayments).toBe(activeEmployees.length);
          } else {
            expect(result.failedPayments).toBe(activeEmployees.length);
          }
          
          // Inactive employees should not affect the count
          const totalProcessedEmployees = result.successfulPayments + result.failedPayments;
          expect(totalProcessedEmployees).toBe(activeEmployees.length);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6: Payroll batch consistency', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        payrollBatchArbitrary,
        availableFundsArbitrary,
        (batch, availableFunds) => {
          const result = processPayrollBatch(batch, availableFunds);
          
          // Result should always reference the correct batch
          expect(result.batchId).toBe(batch.id);
          
          // Total payments should not exceed employee count
          const activeEmployees = batch.employees.filter(emp => emp.active).length;
          expect(result.successfulPayments + result.failedPayments).toBeLessThanOrEqual(activeEmployees);
          
          // Successful payments should be non-negative
          expect(result.successfulPayments).toBeGreaterThanOrEqual(0);
          expect(result.failedPayments).toBeGreaterThanOrEqual(0);
          expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
          expect(result.fundsDeducted).toBeGreaterThanOrEqual(0);
          
          return result.batchId === batch.id &&
                 result.successfulPayments >= 0 &&
                 result.failedPayments >= 0 &&
                 result.totalProcessed >= 0 &&
                 result.fundsDeducted >= 0;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6: Payroll deterministic failure simulation', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        payrollBatchArbitrary,
        availableFundsArbitrary,
        (batch, availableFunds) => {
          // Force failure simulation
          const result = processPayrollBatch(batch, availableFunds, true);
          
          if (availableFunds >= batch.totalAmount && batch.employees.some(emp => emp.active)) {
            // With sufficient funds but forced failure, should fail atomically
            expect(result.allSuccessful).toBe(false);
            expect(result.successfulPayments).toBe(0);
            expect(result.fundsDeducted).toBe(0);
            expect(result.totalProcessed).toBe(0);
          }
          
          return true;
        }
      ),
      { numRuns: 25 }
    );
  });
});