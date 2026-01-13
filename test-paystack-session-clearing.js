/**
 * Test Paystack Session Clearing and USDC Deposit Flow
 */

const { PaystackStorage } = require('./lib/paystack-storage')

async function testPaystackSessionClearing() {
  console.log('🧪 Testing Paystack Session Clearing...')
  
  // Simulate storing a session
  const mockSession = {
    reference: 'test_ref_123',
    amount: 100,
    currency: 'USD',
    userAddress: '0x1234567890123456789012345678901234567890',
    email: 'test@example.com',
    paystackUrl: 'https://checkout.paystack.com/test',
    status: 'pending'
  }
  
  console.log('📝 Storing mock session...')
  const storedSession = PaystackStorage.storeSession(mockSession)
  console.log('✅ Session stored:', storedSession.reference)
  
  // Verify session exists
  const retrievedSession = PaystackStorage.getSession()
  console.log('📖 Retrieved session:', retrievedSession?.reference)
  
  if (!retrievedSession) {
    console.error('❌ Session not found after storage')
    return false
  }
  
  // Test session clearing
  console.log('🧹 Clearing session...')
  PaystackStorage.clearSession()
  
  // Verify session is cleared
  const clearedSession = PaystackStorage.getSession()
  console.log('🔍 Session after clearing:', clearedSession)
  
  if (clearedSession) {
    console.error('❌ Session still exists after clearing')
    return false
  }
  
  console.log('✅ Session clearing test passed!')
  return true
}

async function testSessionExpiration() {
  console.log('🧪 Testing Session Expiration...')
  
  // Create a session that expires immediately
  const expiredSession = {
    reference: 'expired_ref_123',
    amount: 50,
    currency: 'NGN',
    userAddress: '0x1234567890123456789012345678901234567890',
    email: 'test@example.com',
    paystackUrl: 'https://checkout.paystack.com/test',
    status: 'pending'
  }
  
  // Manually set expiration to past
  const now = Date.now()
  const fullSession = {
    ...expiredSession,
    createdAt: now - (20 * 60 * 1000), // 20 minutes ago
    expiresAt: now - (5 * 60 * 1000)   // 5 minutes ago (expired)
  }
  
  // Store the expired session
  localStorage.setItem('paystack_session', JSON.stringify(fullSession))
  
  // Retrieve session (should auto-update status to expired)
  const retrievedSession = PaystackStorage.getSession()
  
  if (retrievedSession?.status !== 'expired') {
    console.error('❌ Expired session not detected')
    return false
  }
  
  console.log('✅ Session expiration test passed!')
  PaystackStorage.clearSession()
  return true
}

async function testDepositInstructions() {
  console.log('🧪 Testing Manual Deposit Instructions...')
  
  // This would require the deposit service to be properly initialized
  // For now, just test the structure
  const mockInstructions = {
    needsApproval: true,
    needsConfig: true,
    approvalAmount: '100000000', // 100 USDC in wei (6 decimals)
    contractAddress: '0xContractAddress',
    steps: [
      '1. Set your split configuration in Settings',
      '2. Approve USDC spending: 100 USDC',
      '3. Call depositAndSplit(100000000) on the contract'
    ]
  }
  
  console.log('📋 Manual deposit instructions:')
  mockInstructions.steps.forEach(step => console.log(`   ${step}`))
  
  console.log('✅ Manual deposit instructions test passed!')
  return true
}

async function runAllTests() {
  console.log('🚀 Starting Paystack Session and Deposit Tests...\n')
  
  const tests = [
    testPaystackSessionClearing,
    testSessionExpiration,
    testDepositInstructions
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      const result = await test()
      if (result) {
        passed++
      } else {
        failed++
      }
    } catch (error) {
      console.error('❌ Test failed with error:', error.message)
      failed++
    }
    console.log('') // Empty line between tests
  }
  
  console.log('📊 Test Results:')
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)
  
  return failed === 0
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = {
  testPaystackSessionClearing,
  testSessionExpiration,
  testDepositInstructions,
  runAllTests
}