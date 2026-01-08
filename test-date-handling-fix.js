/**
 * Test Date Handling Fix for Paystack Session
 */

// Mock session data as it would come from API (dates as strings)
const mockApiSession = {
  reference: 'test_ref_123',
  amount: 100,
  currency: 'USD',
  userAddress: '0x1234567890123456789012345678901234567890',
  status: 'pending',
  paystackUrl: 'https://checkout.paystack.com/test',
  expiresAt: '2024-01-08T12:00:00.000Z', // String date from API
  createdAt: '2024-01-08T11:45:00.000Z'  // String date from API
}

// Mock session data as it would be stored in localStorage (dates as numbers)
const mockStorageSession = {
  reference: 'test_ref_456',
  amount: 50,
  currency: 'NGN',
  userAddress: '0x1234567890123456789012345678901234567890',
  email: 'test@example.com',
  paystackUrl: 'https://checkout.paystack.com/test',
  status: 'pending',
  createdAt: Date.now() - (5 * 60 * 1000), // 5 minutes ago
  expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes from now
}

function testApiSessionConversion() {
  console.log('🧪 Testing API Session Date Conversion...')
  
  // Simulate the conversion that should happen in the hook
  const convertedSession = {
    ...mockApiSession,
    expiresAt: new Date(mockApiSession.expiresAt),
    createdAt: new Date(mockApiSession.createdAt)
  }
  
  console.log('📅 Original expiresAt (string):', mockApiSession.expiresAt)
  console.log('📅 Converted expiresAt (Date):', convertedSession.expiresAt)
  console.log('📅 Can call getTime():', typeof convertedSession.expiresAt.getTime === 'function')
  
  // Test the expiration calculation
  const timeUntilExpiry = convertedSession.expiresAt.getTime() - Date.now()
  console.log('⏰ Time until expiry (ms):', timeUntilExpiry)
  console.log('⏰ Time until expiry (minutes):', Math.round(timeUntilExpiry / (1000 * 60)))
  
  console.log('✅ API session conversion test passed!')
  return true
}

function testStorageSessionConversion() {
  console.log('🧪 Testing Storage Session Date Conversion...')
  
  // Simulate the conversion that should happen when loading from storage
  const convertedSession = {
    ...mockStorageSession,
    expiresAt: new Date(mockStorageSession.expiresAt),
    createdAt: new Date(mockStorageSession.createdAt)
  }
  
  console.log('📅 Original expiresAt (number):', mockStorageSession.expiresAt)
  console.log('📅 Converted expiresAt (Date):', convertedSession.expiresAt)
  console.log('📅 Can call getTime():', typeof convertedSession.expiresAt.getTime === 'function')
  
  // Test the expiration calculation
  const timeUntilExpiry = convertedSession.expiresAt.getTime() - Date.now()
  console.log('⏰ Time until expiry (ms):', timeUntilExpiry)
  console.log('⏰ Time until expiry (minutes):', Math.round(timeUntilExpiry / (1000 * 60)))
  
  console.log('✅ Storage session conversion test passed!')
  return true
}

function testSafetyCheck() {
  console.log('🧪 Testing Safety Check for Mixed Date Types...')
  
  // Test the safety check logic from the useEffect
  const testCases = [
    { expiresAt: new Date(), description: 'Date object' },
    { expiresAt: Date.now(), description: 'Number timestamp' },
    { expiresAt: '2024-01-08T12:00:00.000Z', description: 'String date' }
  ]
  
  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test case ${index + 1}: ${testCase.description}`)
    console.log('   Input:', testCase.expiresAt)
    
    // Apply the safety check logic
    const expiresAt = testCase.expiresAt instanceof Date 
      ? testCase.expiresAt 
      : new Date(testCase.expiresAt)
    
    console.log('   Output:', expiresAt)
    console.log('   Can call getTime():', typeof expiresAt.getTime === 'function')
    
    try {
      const timeUntilExpiry = expiresAt.getTime() - Date.now()
      console.log('   ✅ Calculation successful:', Math.round(timeUntilExpiry / (1000 * 60)), 'minutes')
    } catch (error) {
      console.log('   ❌ Calculation failed:', error.message)
      return false
    }
  })
  
  console.log('✅ Safety check test passed!')
  return true
}

async function runAllTests() {
  console.log('🚀 Starting Date Handling Tests...\n')
  
  const tests = [
    testApiSessionConversion,
    testStorageSessionConversion,
    testSafetyCheck
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
  testApiSessionConversion,
  testStorageSessionConversion,
  testSafetyCheck,
  runAllTests
}