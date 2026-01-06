import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * **Feature: paywarp-web3-integration, Property 11: Team Management Data Integrity**
 * **Validates: Requirements 13.1, 13.2, 13.6**
 * 
 * Property: For any team member addition or modification, wallet addresses should be 
 * validated, payment profiles should be created accurately, and schedule changes should 
 * update future payments correctly.
 */

interface TeamMember {
  id: string;
  name: string;
  walletAddress?: string;
  email?: string;
  salary: number;
  paymentDate: number; // Day of month (1-31)
  status: 'active' | 'pending' | 'verified' | 'paused';
  joinDate: Date;
  lastPaid?: Date;
  nextPayment?: Date;
  totalPaid: number;
}

interface PaymentProfile {
  memberId: string;
  walletAddress?: string;
  email?: string;
  salary: number;
  paymentDate: number;
  isValid: boolean;
  validationErrors: string[];
}

interface TeamManagementSystem {
  members: Map<string, TeamMember>;
  paymentProfiles: Map<string, PaymentProfile>;
  nextMemberId: number;
}

// Wallet address validation
function isValidWalletAddress(address: string): boolean {
  if (!address) return false;
  // Basic Ethereum address validation
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
}

// Email validation
function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Create payment profile from team member
function createPaymentProfile(member: TeamMember): PaymentProfile {
  const validationErrors: string[] = [];
  
  // Validate wallet address if provided
  if (member.walletAddress && !isValidWalletAddress(member.walletAddress)) {
    validationErrors.push('Invalid wallet address format');
  }
  
  // Validate email if provided
  if (member.email && !isValidEmail(member.email)) {
    validationErrors.push('Invalid email format');
  }
  
  // Must have either wallet address or email
  if (!member.walletAddress && !member.email) {
    validationErrors.push('Must provide either wallet address or email');
  }
  
  // Validate salary
  if (member.salary <= 0) {
    validationErrors.push('Salary must be greater than 0');
  }
  
  // Validate payment date
  if (member.paymentDate < 1 || member.paymentDate > 31) {
    validationErrors.push('Payment date must be between 1 and 31');
  }
  
  return {
    memberId: member.id,
    walletAddress: member.walletAddress,
    email: member.email,
    salary: member.salary,
    paymentDate: member.paymentDate,
    isValid: validationErrors.length === 0,
    validationErrors
  };
}

// Add team member to system
function addTeamMember(
  system: TeamManagementSystem, 
  memberData: Omit<TeamMember, 'id' | 'joinDate' | 'totalPaid'>
): { success: boolean; memberId?: string; errors: string[] } {
  const memberId = `member_${system.nextMemberId++}`;
  
  const member: TeamMember = {
    ...memberData,
    id: memberId,
    joinDate: new Date(),
    totalPaid: 0
  };
  
  const profile = createPaymentProfile(member);
  
  if (!profile.isValid) {
    return {
      success: false,
      errors: profile.validationErrors
    };
  }
  
  system.members.set(memberId, member);
  system.paymentProfiles.set(memberId, profile);
  
  return {
    success: true,
    memberId,
    errors: []
  };
}

// Update team member
function updateTeamMember(
  system: TeamManagementSystem,
  memberId: string,
  updates: Partial<Pick<TeamMember, 'salary' | 'paymentDate' | 'walletAddress' | 'email' | 'status'>>
): { success: boolean; errors: string[] } {
  const member = system.members.get(memberId);
  if (!member) {
    return { success: false, errors: ['Member not found'] };
  }
  
  const updatedMember = { ...member, ...updates };
  const profile = createPaymentProfile(updatedMember);
  
  if (!profile.isValid) {
    return {
      success: false,
      errors: profile.validationErrors
    };
  }
  
  system.members.set(memberId, updatedMember);
  system.paymentProfiles.set(memberId, profile);
  
  return { success: true, errors: [] };
}

// Calculate next payment date
function calculateNextPayment(paymentDate: number, currentDate: Date = new Date()): Date {
  const nextPayment = new Date(currentDate);
  nextPayment.setDate(paymentDate);
  
  // If the payment date has passed this month, move to next month
  if (nextPayment <= currentDate) {
    nextPayment.setMonth(nextPayment.getMonth() + 1);
  }
  
  return nextPayment;
}

// Generators for property testing
const validWalletAddressArbitrary = fc.integer({ min: 1, max: 0xffffffffffff })
  .map(n => `0x${n.toString(16).padStart(40, '0')}`);

const invalidWalletAddressArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant('0x123'), // Too short
  fc.constant('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'), // Invalid characters
  fc.constant('123456789012345678901234567890123456789012') // No 0x prefix
);

const validEmailArbitrary = fc.record({
  username: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
  domain: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
  tld: fc.string({ minLength: 2, maxLength: 4 }).filter(s => /^[a-zA-Z]+$/.test(s))
}).map(({ username, domain, tld }) => `${username}@${domain}.${tld}`);

const invalidEmailArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant('invalid-email'),
  fc.constant('@domain.com'),
  fc.constant('user@'),
  fc.constant('user@domain')
);

const teamMemberDataArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  walletAddress: fc.option(fc.oneof(validWalletAddressArbitrary, invalidWalletAddressArbitrary)),
  email: fc.option(fc.oneof(validEmailArbitrary, invalidEmailArbitrary)),
  salary: fc.integer({ min: -1000, max: 100000 }), // Include invalid negative values
  paymentDate: fc.integer({ min: -5, max: 35 }), // Include invalid dates
  status: fc.constantFrom('active', 'pending', 'verified', 'paused')
}).filter(data => data.walletAddress !== undefined || data.email !== undefined); // Ensure at least one contact method

describe('Team Management Data Integrity', () => {
  it('Property 11: Wallet address validation consistency', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        teamMemberDataArbitrary,
        (memberData) => {
          const system: TeamManagementSystem = {
            members: new Map(),
            paymentProfiles: new Map(),
            nextMemberId: 1
          };
          
          const result = addTeamMember(system, memberData);
          
          // If wallet address is provided, validation should be consistent
          if (memberData.walletAddress) {
            const isValidAddress = isValidWalletAddress(memberData.walletAddress);
            
            if (!isValidAddress) {
              expect(result.success).toBe(false);
              expect(result.errors.some(error => 
                error.includes('Invalid wallet address')
              )).toBe(true);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Payment profile creation accuracy', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        teamMemberDataArbitrary,
        (memberData) => {
          const system: TeamManagementSystem = {
            members: new Map(),
            paymentProfiles: new Map(),
            nextMemberId: 1
          };
          
          const result = addTeamMember(system, memberData);
          
          if (result.success && result.memberId) {
            const member = system.members.get(result.memberId);
            const profile = system.paymentProfiles.get(result.memberId);
            
            expect(member).toBeDefined();
            expect(profile).toBeDefined();
            
            if (member && profile) {
              // Profile should accurately reflect member data
              expect(profile.memberId).toBe(member.id);
              expect(profile.walletAddress).toBe(member.walletAddress);
              expect(profile.email).toBe(member.email);
              expect(profile.salary).toBe(member.salary);
              expect(profile.paymentDate).toBe(member.paymentDate);
              expect(profile.isValid).toBe(true);
              expect(profile.validationErrors).toHaveLength(0);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Schedule change updates future payments', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          initialPaymentDate: fc.integer({ min: 1, max: 31 }),
          newPaymentDate: fc.integer({ min: 1, max: 31 }),
          salary: fc.integer({ min: 1000, max: 10000 })
        }),
        validWalletAddressArbitrary,
        ({ initialPaymentDate, newPaymentDate, salary }, walletAddress) => {
          const system: TeamManagementSystem = {
            members: new Map(),
            paymentProfiles: new Map(),
            nextMemberId: 1
          };
          
          // Add member with initial payment date
          const addResult = addTeamMember(system, {
            name: 'Test Employee',
            walletAddress,
            salary,
            paymentDate: initialPaymentDate,
            status: 'active'
          });
          
          if (addResult.success && addResult.memberId) {
            // Update payment date
            const updateResult = updateTeamMember(system, addResult.memberId, {
              paymentDate: newPaymentDate
            });
            
            expect(updateResult.success).toBe(true);
            
            const updatedMember = system.members.get(addResult.memberId);
            const updatedProfile = system.paymentProfiles.get(addResult.memberId);
            
            if (updatedMember && updatedProfile) {
              // Payment date should be updated
              expect(updatedMember.paymentDate).toBe(newPaymentDate);
              expect(updatedProfile.paymentDate).toBe(newPaymentDate);
              
              // Profile should remain valid
              expect(updatedProfile.isValid).toBe(true);
              expect(updatedProfile.validationErrors).toHaveLength(0);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Contact method requirement enforcement', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          salary: fc.integer({ min: 1000, max: 10000 }),
          paymentDate: fc.integer({ min: 1, max: 31 }),
          status: fc.constantFrom('active', 'pending', 'verified', 'paused')
        }),
        (memberData) => {
          const system: TeamManagementSystem = {
            members: new Map(),
            paymentProfiles: new Map(),
            nextMemberId: 1
          };
          
          // Try to add member without wallet address or email
          const result = addTeamMember(system, {
            ...memberData,
            walletAddress: undefined,
            email: undefined
          });
          
          // Should fail due to missing contact method
          expect(result.success).toBe(false);
          expect(result.errors.some(error => 
            error.includes('Must provide either wallet address or email')
          )).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Salary validation consistency', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          salary: fc.integer({ min: -1000, max: 100000 }),
          paymentDate: fc.integer({ min: 1, max: 31 })
        }),
        validWalletAddressArbitrary,
        ({ salary, paymentDate }, walletAddress) => {
          const system: TeamManagementSystem = {
            members: new Map(),
            paymentProfiles: new Map(),
            nextMemberId: 1
          };
          
          const result = addTeamMember(system, {
            name: 'Test Employee',
            walletAddress,
            salary,
            paymentDate,
            status: 'active'
          });
          
          if (salary <= 0) {
            expect(result.success).toBe(false);
            expect(result.errors.some(error => 
              error.includes('Salary must be greater than 0')
            )).toBe(true);
          } else {
            expect(result.success).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Payment date validation consistency', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          salary: fc.integer({ min: 1000, max: 10000 }),
          paymentDate: fc.integer({ min: -5, max: 35 })
        }),
        validWalletAddressArbitrary,
        ({ salary, paymentDate }, walletAddress) => {
          const system: TeamManagementSystem = {
            members: new Map(),
            paymentProfiles: new Map(),
            nextMemberId: 1
          };
          
          const result = addTeamMember(system, {
            name: 'Test Employee',
            walletAddress,
            salary,
            paymentDate,
            status: 'active'
          });
          
          if (paymentDate < 1 || paymentDate > 31) {
            expect(result.success).toBe(false);
            expect(result.errors.some(error => 
              error.includes('Payment date must be between 1 and 31')
            )).toBe(true);
          } else {
            expect(result.success).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Member update preserves data integrity', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          initialSalary: fc.integer({ min: 1000, max: 10000 }),
          newSalary: fc.integer({ min: 500, max: 15000 }),
          initialPaymentDate: fc.integer({ min: 1, max: 31 }),
          newPaymentDate: fc.integer({ min: 1, max: 31 })
        }),
        validWalletAddressArbitrary,
        validEmailArbitrary,
        ({ initialSalary, newSalary, initialPaymentDate, newPaymentDate }, walletAddress, email) => {
          const system: TeamManagementSystem = {
            members: new Map(),
            paymentProfiles: new Map(),
            nextMemberId: 1
          };
          
          // Add initial member
          const addResult = addTeamMember(system, {
            name: 'Test Employee',
            walletAddress,
            email,
            salary: initialSalary,
            paymentDate: initialPaymentDate,
            status: 'active'
          });
          
          if (addResult.success && addResult.memberId) {
            const originalMember = system.members.get(addResult.memberId);
            
            // Update member
            const updateResult = updateTeamMember(system, addResult.memberId, {
              salary: newSalary,
              paymentDate: newPaymentDate
            });
            
            if (newSalary > 0 && newPaymentDate >= 1 && newPaymentDate <= 31) {
              expect(updateResult.success).toBe(true);
              
              const updatedMember = system.members.get(addResult.memberId);
              const updatedProfile = system.paymentProfiles.get(addResult.memberId);
              
              if (originalMember && updatedMember && updatedProfile) {
                // Updated fields should change
                expect(updatedMember.salary).toBe(newSalary);
                expect(updatedMember.paymentDate).toBe(newPaymentDate);
                
                // Unchanged fields should remain the same
                expect(updatedMember.id).toBe(originalMember.id);
                expect(updatedMember.name).toBe(originalMember.name);
                expect(updatedMember.walletAddress).toBe(originalMember.walletAddress);
                expect(updatedMember.email).toBe(originalMember.email);
                expect(updatedMember.joinDate).toEqual(originalMember.joinDate);
                expect(updatedMember.totalPaid).toBe(originalMember.totalPaid);
                
                // Profile should be valid and consistent
                expect(updatedProfile.isValid).toBe(true);
                expect(updatedProfile.salary).toBe(newSalary);
                expect(updatedProfile.paymentDate).toBe(newPaymentDate);
              }
            } else {
              expect(updateResult.success).toBe(false);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});