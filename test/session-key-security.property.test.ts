import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SessionKeyManager, type SessionKeyConfig, DEFAULT_SESSION_CONFIGS } from '@/lib/session-keys';
import { type Address } from 'viem';

/**
 * **Feature: paywarp-web3-integration, Property 8: Session Key Security Boundaries**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 * 
 * Property: For any session key usage, automated transactions should only execute 
 * within configured limits and time boundaries, with immediate revocation capability.
 */

describe('Session Key Security Boundaries', () => {
  let sessionManager: SessionKeyManager;
  
  beforeEach(() => {
    sessionManager = new SessionKeyManager(5003); // Mantle Sepolia testnet
  });
  
  // Generators for property testing
  const addressArbitrary = fc.integer({ min: 1, max: 0xffffffffffff })
    .map(n => `0x${n.toString(16).padStart(40, '0')}` as Address);
  
  const amountArbitrary = fc.bigInt({ min: 0n, max: BigInt('1000000000000000000000') }); // 0 to 1000 tokens
  
  const sessionConfigArbitrary = fc.record({
    maxTransactionAmount: fc.bigInt({ min: 1n, max: BigInt('100000000000000000000') }), // 1 to 100 tokens
    maxDailyAmount: fc.bigInt({ min: 1n, max: BigInt('1000000000000000000000') }), // 1 to 1000 tokens
    maxTransactionCount: fc.integer({ min: 1, max: 100 }),
    expirationTime: fc.date({ 
      min: new Date(Date.now() + 5000), // At least 5 seconds in the future
      max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    }), // Up to 7 days
    allowedContracts: fc.array(addressArbitrary, { minLength: 1, maxLength: 5 }),
    allowedMethods: fc.array(
      fc.constantFrom('transfer', 'approve', 'depositAndSplit', 'transferBetweenBuckets', 'withdraw', 'processPayroll'),
      { minLength: 1, maxLength: 4 }
    ),
    requireUserConfirmation: fc.boolean(),
    emergencyRevocation: fc.boolean()
  });
  
  const methodNameArbitrary = fc.constantFrom(
    'transfer', 'approve', 'depositAndSplit', 'transferBetweenBuckets', 
    'withdraw', 'processPayroll', 'unauthorizedMethod'
  );
  
  it('Property 8.1: Transaction amount limits are enforced', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        sessionConfigArbitrary,
        amountArbitrary,
        addressArbitrary,
        methodNameArbitrary,
        (config, transactionAmount, contractAddress, methodName) => {
          // Create session key
          const sessionId = sessionManager.createSessionKey(config);
          
          // Check if contract and method are allowed
          const isContractAllowed = config.allowedContracts.includes(contractAddress);
          const isMethodAllowed = config.allowedMethods.includes(methodName);
          
          // Check transaction limits
          const limits = sessionManager.checkSessionLimits(sessionId, transactionAmount, contractAddress, methodName);
          
          if (!isContractAllowed) {
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Contract not allowed');
          } else if (!isMethodAllowed) {
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Method not allowed');
          } else if (transactionAmount > config.maxTransactionAmount) {
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Transaction amount exceeds limit');
          } else if (transactionAmount > config.maxDailyAmount) {
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Daily amount limit exceeded');
          } else {
            // Transaction should be allowed if within all limits
            expect(limits.canExecuteTransaction).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 8.2: Daily limits accumulate correctly', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          maxTransactionAmount: fc.bigInt({ min: BigInt('1000000000000000000'), max: BigInt('10000000000000000000') }), // 1-10 tokens
          maxDailyAmount: fc.bigInt({ min: BigInt('50000000000000000000'), max: BigInt('100000000000000000000') }), // 50-100 tokens
          maxTransactionCount: fc.integer({ min: 10, max: 50 }),
          transactionAmounts: fc.array(
            fc.bigInt({ min: BigInt('1000000000000000000'), max: BigInt('5000000000000000000') }), // 1-5 tokens each
            { minLength: 2, maxLength: 10 }
          )
        }),
        addressArbitrary,
        ({ maxTransactionAmount, maxDailyAmount, maxTransactionCount, transactionAmounts }, contractAddress) => {
          const config: Omit<SessionKeyConfig, 'createdAt'> = {
            maxTransactionAmount,
            maxDailyAmount,
            maxTransactionCount,
            expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            allowedContracts: [contractAddress],
            allowedMethods: ['transfer'],
            requireUserConfirmation: false,
            emergencyRevocation: true
          };
          
          const sessionId = sessionManager.createSessionKey(config);
          let totalAmountUsed = 0n;
          let transactionCount = 0;
          
          for (const amount of transactionAmounts) {
            const limits = sessionManager.checkSessionLimits(sessionId, amount, contractAddress, 'transfer');
            
            // Check that daily usage tracking is accurate
            expect(limits.dailyAmountUsed).toBe(totalAmountUsed);
            expect(limits.transactionCountUsed).toBe(transactionCount);
            
            const wouldExceedDailyAmount = totalAmountUsed + amount > maxDailyAmount;
            const wouldExceedTransactionCount = transactionCount >= maxTransactionCount;
            const exceedsTransactionLimit = amount > maxTransactionAmount;
            
            if (wouldExceedDailyAmount) {
              expect(limits.canExecuteTransaction).toBe(false);
              expect(limits.limitReachedReason).toBe('Daily amount limit exceeded');
              break; // Stop processing more transactions
            } else if (wouldExceedTransactionCount) {
              expect(limits.canExecuteTransaction).toBe(false);
              expect(limits.limitReachedReason).toBe('Daily transaction count limit exceeded');
              break; // Stop processing more transactions
            } else if (exceedsTransactionLimit) {
              expect(limits.canExecuteTransaction).toBe(false);
              expect(limits.limitReachedReason).toBe('Transaction amount exceeds limit');
              // Continue to next transaction (this one doesn't count toward usage)
            } else {
              expect(limits.canExecuteTransaction).toBe(true);
              
              // Record the transaction usage for testing
              sessionManager.recordUsageForTesting(sessionId, amount, contractAddress, 'transfer');
              
              // Update our tracking
              totalAmountUsed += amount;
              transactionCount += 1;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 8.3: Session expiration is enforced', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          expirationOffsetMs: fc.integer({ min: -24 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 }), // -24h to +24h
          amount: fc.bigInt({ min: 1n, max: BigInt('1000000000000000000') }) // 1 token max
        }),
        addressArbitrary,
        ({ expirationOffsetMs, amount }, contractAddress) => {
          const expirationTime = new Date(Date.now() + expirationOffsetMs);
          const isExpired = expirationTime <= new Date();
          
          const config: Omit<SessionKeyConfig, 'createdAt'> = {
            maxTransactionAmount: BigInt('10000000000000000000'), // 10 tokens
            maxDailyAmount: BigInt('100000000000000000000'), // 100 tokens
            maxTransactionCount: 50,
            expirationTime,
            allowedContracts: [contractAddress],
            allowedMethods: ['transfer'],
            requireUserConfirmation: false,
            emergencyRevocation: true
          };
          
          const sessionId = sessionManager.createSessionKey(config);
          const limits = sessionManager.checkSessionLimits(sessionId, amount, contractAddress, 'transfer');
          
          if (isExpired) {
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Session key expired');
            
            // Verify session key is marked as inactive
            const sessionKey = sessionManager.getSessionKey(sessionId);
            expect(sessionKey?.isActive).toBe(false);
          } else {
            // If not expired and within limits, should be allowed
            expect(limits.canExecuteTransaction).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 8.4: Session revocation is immediate and permanent', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        sessionConfigArbitrary,
        addressArbitrary,
        fc.string({ minLength: 1, maxLength: 100 }),
        (config, contractAddress, revocationReason) => {
          // Ensure config allows the test transaction
          const testConfig = {
            ...config,
            allowedContracts: [contractAddress],
            allowedMethods: ['transfer'],
            maxTransactionAmount: BigInt('1000000000000000000'), // 1 token
            maxDailyAmount: BigInt('10000000000000000000'), // 10 tokens
            expirationTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
          };
          
          const sessionId = sessionManager.createSessionKey(testConfig);
          const testAmount = BigInt('500000000000000000'); // 0.5 tokens
          
          // Verify session works before revocation
          const limitsBeforeRevocation = sessionManager.checkSessionLimits(sessionId, testAmount, contractAddress, 'transfer');
          expect(limitsBeforeRevocation.canExecuteTransaction).toBe(true);
          
          // Revoke the session
          const revocationSuccess = sessionManager.revokeSessionKey(sessionId, revocationReason);
          expect(revocationSuccess).toBe(true);
          
          // Verify session is immediately disabled
          const limitsAfterRevocation = sessionManager.checkSessionLimits(sessionId, testAmount, contractAddress, 'transfer');
          expect(limitsAfterRevocation.canExecuteTransaction).toBe(false);
          expect(limitsAfterRevocation.limitReachedReason).toBe('Session key revoked');
          
          // Verify session state is updated
          const sessionKey = sessionManager.getSessionKey(sessionId);
          expect(sessionKey?.isRevoked).toBe(true);
          expect(sessionKey?.isActive).toBe(false);
          expect(sessionKey?.revokedReason).toBe(revocationReason);
          expect(sessionKey?.revokedAt).toBeInstanceOf(Date);
          
          // Verify revocation is permanent (multiple checks should all fail)
          for (let i = 0; i < 3; i++) {
            const limits = sessionManager.checkSessionLimits(sessionId, testAmount, contractAddress, 'transfer');
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Session key revoked');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 8.5: Contract and method allowlists are strictly enforced', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          allowedContracts: fc.array(addressArbitrary, { minLength: 1, maxLength: 3 }),
          allowedMethods: fc.array(
            fc.constantFrom('transfer', 'approve', 'depositAndSplit'),
            { minLength: 1, maxLength: 3 }
          ),
          testContract: addressArbitrary,
          testMethod: fc.constantFrom('transfer', 'approve', 'depositAndSplit', 'unauthorizedMethod')
        }),
        ({ allowedContracts, allowedMethods, testContract, testMethod }) => {
          const config: Omit<SessionKeyConfig, 'createdAt'> = {
            maxTransactionAmount: BigInt('1000000000000000000'), // 1 token
            maxDailyAmount: BigInt('10000000000000000000'), // 10 tokens
            maxTransactionCount: 10,
            expirationTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            allowedContracts,
            allowedMethods,
            requireUserConfirmation: false,
            emergencyRevocation: true
          };
          
          const sessionId = sessionManager.createSessionKey(config);
          const testAmount = BigInt('500000000000000000'); // 0.5 tokens
          
          const limits = sessionManager.checkSessionLimits(sessionId, testAmount, testContract, testMethod);
          
          const isContractAllowed = allowedContracts.includes(testContract);
          const isMethodAllowed = allowedMethods.includes(testMethod);
          
          if (!isContractAllowed) {
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Contract not allowed');
          } else if (!isMethodAllowed) {
            expect(limits.canExecuteTransaction).toBe(false);
            expect(limits.limitReachedReason).toBe('Method not allowed');
          } else {
            // Both contract and method are allowed, and amount is within limits
            expect(limits.canExecuteTransaction).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 8.6: Default session configurations maintain security boundaries', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom('micro', 'standard', 'highValue'),
        addressArbitrary,
        fc.array(addressArbitrary, { minLength: 1, maxLength: 3 }),
        (configType, testContract, allowedContracts) => {
          const baseConfig = DEFAULT_SESSION_CONFIGS[configType];
          
          const config: Omit<SessionKeyConfig, 'createdAt'> = {
            ...baseConfig,
            expirationTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            allowedContracts
          };
          
          const sessionId = sessionManager.createSessionKey(config);
          
          // Test with maximum allowed transaction amount
          const maxAmount = baseConfig.maxTransactionAmount;
          const limits = sessionManager.checkSessionLimits(sessionId, maxAmount, allowedContracts[0], baseConfig.allowedMethods[0]);
          
          // Should be allowed if contract is in allowlist
          expect(limits.canExecuteTransaction).toBe(true);
          
          // Test with amount exceeding limit
          const excessiveAmount = maxAmount + 1n;
          const excessiveLimits = sessionManager.checkSessionLimits(sessionId, excessiveAmount, allowedContracts[0], baseConfig.allowedMethods[0]);
          
          expect(excessiveLimits.canExecuteTransaction).toBe(false);
          expect(excessiveLimits.limitReachedReason).toBe('Transaction amount exceeds limit');
          
          // Verify configuration-specific constraints
          switch (configType) {
            case 'micro':
              expect(baseConfig.maxTransactionAmount).toBe(BigInt('1000000000000000000')); // 1 token
              expect(baseConfig.maxTransactionCount).toBe(50);
              break;
            case 'standard':
              expect(baseConfig.maxTransactionAmount).toBe(BigInt('100000000000000000000')); // 100 tokens
              expect(baseConfig.maxTransactionCount).toBe(20);
              break;
            case 'highValue':
              expect(baseConfig.maxTransactionAmount).toBe(BigInt('10000000000000000000000')); // 10,000 tokens
              expect(baseConfig.maxTransactionCount).toBe(5);
              expect(baseConfig.requireUserConfirmation).toBe(true);
              break;
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 8.7: Session key cleanup removes expired keys', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            // Use two separate generators to ensure clear separation between expired and non-expired
            isExpired: fc.boolean(),
            offsetMagnitude: fc.integer({ min: 10000, max: 60 * 60 * 1000 }) // 10 seconds to 1 hour
          }),
          { minLength: 1, maxLength: 10 }
        ),
        addressArbitrary,
        (sessionConfigs, contractAddress) => {
          // Create a fresh session manager to avoid interference from previous tests
          const freshSessionManager = new SessionKeyManager(5003);
          
          const sessionIds: string[] = [];
          let expectedExpiredCount = 0;
          const currentTime = Date.now();
          
          // Create multiple session keys with different expiration times
          for (const { isExpired, offsetMagnitude } of sessionConfigs) {
            // Create clear separation: expired keys are at least 10 seconds in the past,
            // non-expired keys are at least 10 seconds in the future
            const expirationOffsetMs = isExpired ? -offsetMagnitude : offsetMagnitude;
            const expirationTime = new Date(currentTime + expirationOffsetMs);
            
            if (isExpired) {
              expectedExpiredCount++;
            }
            
            const config: Omit<SessionKeyConfig, 'createdAt'> = {
              maxTransactionAmount: BigInt('1000000000000000000'), // 1 token
              maxDailyAmount: BigInt('10000000000000000000'), // 10 tokens
              maxTransactionCount: 10,
              expirationTime,
              allowedContracts: [contractAddress],
              allowedMethods: ['transfer'],
              requireUserConfirmation: false,
              emergencyRevocation: true
            };
            
            const sessionId = freshSessionManager.createSessionKey(config);
            sessionIds.push(sessionId);
          }
          
          // Count total session keys created (both expired and non-expired)
          const totalKeysCreated = sessionIds.length;
          
          // Perform cleanup - this should mark expired keys as inactive
          const cleanedCount = freshSessionManager.cleanupExpiredKeys();
          
          // Get active keys after cleanup - this filters out expired/inactive keys
          const activeKeysAfter = freshSessionManager.getActiveSessionKeys();
          
          // Verify that the cleanup count matches expected expired count
          expect(cleanedCount).toBe(expectedExpiredCount);
          
          // Verify that the number of active keys equals total created minus expired
          const expectedActiveCount = totalKeysCreated - expectedExpiredCount;
          expect(activeKeysAfter.length).toBe(expectedActiveCount);
          
          // Verify that all remaining keys are not expired and are active
          const cleanupTime = Date.now();
          for (const { state } of activeKeysAfter) {
            expect(state.config.expirationTime.getTime()).toBeGreaterThan(cleanupTime);
            expect(state.isActive).toBe(true);
            expect(state.isRevoked).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});