/**
 * Test Session Key Automation Integration
 * 
 * Tests the complete session key automation flow including:
 * - Session key creation with different configurations
 * - Automated bucket operations
 * - Token allowance management
 * - Limit checking and enforcement
 */

// Mock session key configurations for testing
const DEFAULT_SESSION_CONFIGS = {
  micro: {
    maxTransactionAmount: BigInt('1000000000000000000'), // 1 token
    maxDailyAmount: BigInt('10000000000000000000'), // 10 tokens
    maxTransactionCount: 50,
    allowedMethods: ['transfer', 'approve'],
    requireUserConfirmation: false,
    emergencyRevocation: true
  },
  standard: {
    maxTransactionAmount: BigInt('100000000000000000000'), // 100 tokens
    maxDailyAmount: BigInt('1000000000000000000000'), // 1000 tokens
    maxTransactionCount: 20,
    allowedMethods: ['depositAndSplit', 'transferBetweenBuckets', 'withdraw'],
    requireUserConfirmation: false,
    emergencyRevocation: true
  },
  highValue: {
    maxTransactionAmount: BigInt('10000000000000000000000'), // 10,000 tokens
    maxDailyAmount: BigInt('100000000000000000000000'), // 100,000 tokens
    maxTransactionCount: 5,
    allowedMethods: ['processPayroll', 'batchTransfer'],
    requireUserConfirmation: true,
    emergencyRevocation: true
  }
}

// Mock SessionKeyManager for testing
class MockSessionKeyManager {
  constructor(chainId) {
    this.chainId = chainId
    this.sessionKeys = new Map()
  }
  
  createSessionKey(config) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.sessionKeys.set(sessionId, {
      config: { ...config, createdAt: new Date() },
      usage: [],
      isActive: true,
      isRevoked: false
    })
    return sessionId
  }
  
  checkSessionLimits(sessionId, amount, contractAddress, methodName) {
    const sessionKey = this.sessionKeys.get(sessionId)
    
    if (!sessionKey) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Session key not found'
      }
    }
    
    if (sessionKey.isRevoked) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Session key revoked'
      }
    }
    
    if (!sessionKey.config.allowedContracts.includes(contractAddress)) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Contract not allowed'
      }
    }
    
    if (!sessionKey.config.allowedMethods.includes(methodName)) {
      return {
        dailyAmountUsed: 0n,
        transactionCountUsed: 0,
        remainingDailyAmount: 0n,
        remainingTransactionCount: 0,
        canExecuteTransaction: false,
        limitReachedReason: 'Method not allowed'
      }
    }
    
    const dailyAmountUsed = sessionKey.usage.reduce((sum, u) => sum + u.amount, 0n)
    const transactionCountUsed = sessionKey.usage.length
    
    if (amount > sessionKey.config.maxTransactionAmount) {
      return {
        dailyAmountUsed,
        transactionCountUsed,
        remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
        remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
        canExecuteTransaction: false,
        limitReachedReason: 'Transaction amount exceeds limit'
      }
    }
    
    if (dailyAmountUsed + amount > sessionKey.config.maxDailyAmount) {
      return {
        dailyAmountUsed,
        transactionCountUsed,
        remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
        remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
        canExecuteTransaction: false,
        limitReachedReason: 'Daily amount limit exceeded'
      }
    }
    
    if (transactionCountUsed >= sessionKey.config.maxTransactionCount) {
      return {
        dailyAmountUsed,
        transactionCountUsed,
        remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
        remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
        canExecuteTransaction: false,
        limitReachedReason: 'Daily transaction count limit exceeded'
      }
    }
    
    return {
      dailyAmountUsed,
      transactionCountUsed,
      remainingDailyAmount: sessionKey.config.maxDailyAmount - dailyAmountUsed,
      remainingTransactionCount: sessionKey.config.maxTransactionCount - transactionCountUsed,
      canExecuteTransaction: true
    }
  }
  
  recordUsageForTesting(sessionId, amount, contractAddress, methodName) {
    const sessionKey = this.sessionKeys.get(sessionId)
    if (!sessionKey) return false
    
    sessionKey.usage.push({
      amount,
      timestamp: new Date(),
      contractAddress,
      methodName
    })
    return true
  }
  
  revokeSessionKey(sessionId, reason) {
    const sessionKey = this.sessionKeys.get(sessionId)
    if (!sessionKey) return false
    
    sessionKey.isRevoked = true
    sessionKey.isActive = false
    sessionKey.revokedReason = reason
    return true
  }
  
  getActiveSessionKeys() {
    const activeKeys = []
    for (const [sessionId, state] of this.sessionKeys.entries()) {
      if (state.isActive && !state.isRevoked) {
        activeKeys.push({ sessionId, state })
      }
    }
    return activeKeys
  }
  
  getUsageStatistics(sessionId) {
    const sessionKey = this.sessionKeys.get(sessionId)
    if (!sessionKey) return null
    
    const usage = sessionKey.usage
    const totalTransactions = usage.length
    const totalAmountSpent = usage.reduce((sum, u) => sum + u.amount, 0n)
    const averageTransactionAmount = totalTransactions > 0 ? totalAmountSpent / BigInt(totalTransactions) : 0n
    
    return {
      totalTransactions,
      totalAmountSpent,
      averageTransactionAmount,
      dailyUsage: []
    }
  }
}

async function testSessionKeyAutomation() {
  console.log('🔑 Testing Session Key Automation...\n')
  
  // Test 1: Session Key Creation
  console.log('1. Testing Session Key Creation')
  const sessionManager = new MockSessionKeyManager(5003) // Mantle Sepolia
  
  // Create different types of session keys
  const microSessionId = sessionManager.createSessionKey({
    ...DEFAULT_SESSION_CONFIGS.micro,
    expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    allowedContracts: ['0x1234567890123456789012345678901234567890'],
  })
  
  const standardSessionId = sessionManager.createSessionKey({
    ...DEFAULT_SESSION_CONFIGS.standard,
    expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    allowedContracts: ['0x1234567890123456789012345678901234567890'],
  })
  
  const highValueSessionId = sessionManager.createSessionKey({
    ...DEFAULT_SESSION_CONFIGS.highValue,
    expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    allowedContracts: ['0x1234567890123456789012345678901234567890'],
  })
  
  console.log(`✅ Created micro session key: ${microSessionId}`)
  console.log(`✅ Created standard session key: ${standardSessionId}`)
  console.log(`✅ Created high-value session key: ${highValueSessionId}`)
  
  // Test 2: Limit Checking
  console.log('\n2. Testing Transaction Limits')
  
  // Test micro session limits
  const microLimits = sessionManager.checkSessionLimits(
    microSessionId,
    BigInt('500000000000000000'), // 0.5 tokens
    '0x1234567890123456789012345678901234567890',
    'transfer'
  )
  
  console.log('Micro session limits:', {
    canExecute: microLimits.canExecuteTransaction,
    remainingAmount: microLimits.remainingDailyAmount.toString(),
    remainingCount: microLimits.remainingTransactionCount
  })
  
  // Test exceeding limits
  const exceedingLimits = sessionManager.checkSessionLimits(
    microSessionId,
    BigInt('2000000000000000000'), // 2 tokens (exceeds micro limit)
    '0x1234567890123456789012345678901234567890',
    'transfer'
  )
  
  console.log('Exceeding limits test:', {
    canExecute: exceedingLimits.canExecuteTransaction,
    reason: exceedingLimits.limitReachedReason
  })
  
  // Test 3: Daily Limit Accumulation
  console.log('\n3. Testing Daily Limit Accumulation')
  
  // Simulate multiple transactions to test daily limits
  for (let i = 0; i < 5; i++) {
    const success = sessionManager.recordUsageForTesting(
      standardSessionId,
      BigInt('50000000000000000000'), // 50 tokens each
      '0x1234567890123456789012345678901234567890',
      'depositAndSplit'
    )
    console.log(`Transaction ${i + 1}: ${success ? 'recorded' : 'failed'}`)
  }
  
  // Check limits after usage
  const afterUsageLimits = sessionManager.checkSessionLimits(
    standardSessionId,
    BigInt('100000000000000000000'), // 100 tokens
    '0x1234567890123456789012345678901234567890',
    'depositAndSplit'
  )
  
  console.log('After usage limits:', {
    dailyAmountUsed: afterUsageLimits.dailyAmountUsed.toString(),
    remainingAmount: afterUsageLimits.remainingDailyAmount.toString(),
    transactionCount: afterUsageLimits.transactionCountUsed,
    canExecute: afterUsageLimits.canExecuteTransaction
  })
  
  // Test 4: Session Key Revocation
  console.log('\n4. Testing Session Key Revocation')
  
  const revoked = sessionManager.revokeSessionKey(microSessionId, 'Test revocation')
  console.log(`Session key revoked: ${revoked}`)
  
  // Try to use revoked session key
  const revokedLimits = sessionManager.checkSessionLimits(
    microSessionId,
    BigInt('100000000000000000'), // 0.1 tokens
    '0x1234567890123456789012345678901234567890',
    'transfer'
  )
  
  console.log('Revoked session test:', {
    canExecute: revokedLimits.canExecuteTransaction,
    reason: revokedLimits.limitReachedReason
  })
  
  // Test 5: Active Session Keys
  console.log('\n5. Testing Active Session Keys')
  
  const activeKeys = sessionManager.getActiveSessionKeys()
  console.log(`Active session keys: ${activeKeys.length}`)
  
  activeKeys.forEach(({ sessionId, state }) => {
    console.log(`- ${sessionId}: ${state.isActive ? 'active' : 'inactive'}, expires: ${state.config.expirationTime.toISOString()}`)
  })
  
  // Test 6: Usage Statistics
  console.log('\n6. Testing Usage Statistics')
  
  const stats = sessionManager.getUsageStatistics(standardSessionId)
  if (stats) {
    console.log('Standard session statistics:', {
      totalTransactions: stats.totalTransactions,
      totalAmountSpent: stats.totalAmountSpent.toString(),
      averageAmount: stats.averageTransactionAmount.toString(),
      dailyUsage: stats.dailyUsage.length
    })
  }
  
  // Test 7: Contract and Method Restrictions
  console.log('\n7. Testing Contract and Method Restrictions')
  
  // Test unauthorized contract
  const unauthorizedContract = sessionManager.checkSessionLimits(
    standardSessionId,
    BigInt('10000000000000000000'), // 10 tokens
    '0x9999999999999999999999999999999999999999', // Different contract
    'depositAndSplit'
  )
  
  console.log('Unauthorized contract test:', {
    canExecute: unauthorizedContract.canExecuteTransaction,
    reason: unauthorizedContract.limitReachedReason
  })
  
  // Test unauthorized method
  const unauthorizedMethod = sessionManager.checkSessionLimits(
    standardSessionId,
    BigInt('10000000000000000000'), // 10 tokens
    '0x1234567890123456789012345678901234567890',
    'unauthorizedMethod'
  )
  
  console.log('Unauthorized method test:', {
    canExecute: unauthorizedMethod.canExecuteTransaction,
    reason: unauthorizedMethod.limitReachedReason
  })
  
  console.log('\n✅ Session Key Automation tests completed!')
}

// Test bucket allocation validation
function testBucketAllocationValidation() {
  console.log('\n🪣 Testing Bucket Allocation Validation...\n')
  
  // Test valid allocation (totals 100%)
  const validAllocations = [
    { id: 'billings', percentage: 30, enabled: true },
    { id: 'growth', percentage: 25, enabled: true },
    { id: 'savings', percentage: 25, enabled: true },
    { id: 'instant', percentage: 10, enabled: true },
    { id: 'spendable', percentage: 10, enabled: true },
  ]
  
  const validTotal = validAllocations
    .filter(a => a.enabled)
    .reduce((sum, a) => sum + a.percentage, 0)
  
  console.log(`Valid allocation total: ${validTotal}% - ${validTotal === 100 ? '✅ Valid' : '❌ Invalid'}`)
  
  // Test invalid allocation (totals 95%)
  const invalidAllocations = [
    { id: 'billings', percentage: 30, enabled: true },
    { id: 'growth', percentage: 25, enabled: true },
    { id: 'savings', percentage: 25, enabled: true },
    { id: 'instant', percentage: 10, enabled: true },
    { id: 'spendable', percentage: 5, enabled: true },
  ]
  
  const invalidTotal = invalidAllocations
    .filter(a => a.enabled)
    .reduce((sum, a) => sum + a.percentage, 0)
  
  console.log(`Invalid allocation total: ${invalidTotal}% - ${invalidTotal === 100 ? '✅ Valid' : '❌ Invalid'}`)
  
  // Test with disabled buckets
  const disabledBucketAllocations = [
    { id: 'billings', percentage: 40, enabled: true },
    { id: 'growth', percentage: 30, enabled: true },
    { id: 'savings', percentage: 30, enabled: true },
    { id: 'instant', percentage: 15, enabled: false }, // Disabled
    { id: 'spendable', percentage: 10, enabled: false }, // Disabled
  ]
  
  const disabledTotal = disabledBucketAllocations
    .filter(a => a.enabled)
    .reduce((sum, a) => sum + a.percentage, 0)
  
  console.log(`Disabled buckets total: ${disabledTotal}% - ${disabledTotal === 100 ? '✅ Valid' : '❌ Invalid'}`)
  
  console.log('\n✅ Bucket allocation validation tests completed!')
}

// Test token allowance scenarios
function testTokenAllowanceScenarios() {
  console.log('\n💰 Testing Token Allowance Scenarios...\n')
  
  const allowances = [
    {
      token: '0xA0b86a33E6441b8435b662f0E2d0B8A0E4B8B8B8', // USDC
      spender: '0x1234567890123456789012345678901234567890', // BucketVault
      amount: BigInt('1000000000'), // 1000 USDC (6 decimals)
      enabled: true
    },
    {
      token: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      spender: '0x1234567890123456789012345678901234567890', // BucketVault
      amount: BigInt('1000000000000000000000'), // 1000 DAI (18 decimals)
      enabled: true
    },
    {
      token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      spender: '0x9876543210987654321098765432109876543210', // PayrollEngine
      amount: BigInt('5000000000000000000'), // 5 WETH (18 decimals)
      enabled: false // Disabled
    }
  ]
  
  console.log('Token Allowances:')
  allowances.forEach((allowance, index) => {
    const tokenSymbol = allowance.token.includes('A0b86a') ? 'USDC' : 
                       allowance.token.includes('6B175') ? 'DAI' : 'WETH'
    const spenderName = allowance.spender.includes('1234') ? 'BucketVault' : 'PayrollEngine'
    const decimals = tokenSymbol === 'USDC' ? 6 : 18
    const amount = Number(allowance.amount) / Math.pow(10, decimals)
    
    console.log(`${index + 1}. ${tokenSymbol} → ${spenderName}: ${amount} tokens (${allowance.enabled ? 'enabled' : 'disabled'})`)
  })
  
  // Test allowance validation
  const activeAllowances = allowances.filter(a => a.enabled)
  console.log(`\nActive allowances: ${activeAllowances.length}/${allowances.length}`)
  
  // Test security considerations
  console.log('\nSecurity Considerations:')
  console.log('- All allowances should have reasonable limits')
  console.log('- Disabled allowances should not be processed')
  console.log('- Users should be able to revoke allowances at any time')
  console.log('- Auto-revocation after 24h should be configurable')
  
  console.log('\n✅ Token allowance scenario tests completed!')
}

// Run all tests
async function runAllTests() {
  try {
    await testSessionKeyAutomation()
    testBucketAllocationValidation()
    testTokenAllowanceScenarios()
    
    console.log('\n🎉 All automation tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
}

module.exports = {
  testSessionKeyAutomation,
  testBucketAllocationValidation,
  testTokenAllowanceScenarios,
  runAllTests
}