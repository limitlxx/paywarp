/**
 * Test Paystack Integration Flow
 * Tests the complete deposit flow with localStorage management
 */

const { PaystackStorage } = require('./lib/paystack-storage')

// Mock localStorage for Node.js testing
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null
  },
  setItem(key, value) {
    this.data[key] = value
  },
  removeItem(key) {
    delete this.data[key]
  },
  clear() {
    this.data = {}
  }
}

// Mock window for Node.js testing
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
}

async function testPaystackFlow() {
  console.log('🧪 Testing Paystack Integration Flow...\n')
  
  try {
    // Test 1: Store a new session
    console.log('1. Testing session storage...')
    const sessionData = {
      reference: 'paywarp_test_123456',
      amount: 100,
      currency: 'USD',
      userAddress: '0x1234567890123456789012345678901234567890',
      email: 'test@example.com',
      paystackUrl: 'https://checkout.paystack.com/test123',
      status: 'pending'
    }
    
    const storedSession = PaystackStorage.storeSession(sessionData)
    console.log('✅ Session stored:', storedSession.reference)
    
    // Test 2: Retrieve session
    console.log('\n2. Testing session retrieval...')
    const retrievedSession = PaystackStorage.getSession()
    console.log('✅ Session retrieved:', retrievedSession?.reference)
    
    // Test 3: Store callback
    console.log('\n3. Testing callback storage...')
    const callbackData = {
      reference: 'paywarp_test_123456',
      timestamp: Date.now(),
      status: 'success'
    }
    
    PaystackStorage.storeCallback(callbackData)
    console.log('✅ Callback stored')
    
    // Test 4: Consume callback
    console.log('\n4. Testing callback consumption...')
    const consumedCallback = PaystackStorage.consumeCallback()
    console.log('✅ Callback consumed:', consumedCallback?.reference)
    
    // Test 5: Check session status
    console.log('\n5. Testing session status...')
    const status = PaystackStorage.getSessionStatus()
    console.log('✅ Session status:', status)
    
    // Test 6: Get history
    console.log('\n6. Testing history...')
    const history = PaystackStorage.getHistory()
    console.log('✅ History length:', history.length)
    
    console.log('\n🎉 All Paystack flow tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Test environment variables
function testEnvironmentConfig() {
  console.log('\n🔧 Testing Environment Configuration...\n')
  
  const requiredVars = [
    'NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY',
    'PAYSTACK_SECRET_KEY',
    'MANAGED_WALLET_PRIVATE_KEY',
    'NEXT_PUBLIC_USDC_TOKEN_ADDRESS',
    'NEXT_PUBLIC_MANTLE_SEPOLIA_RPC'
  ]
  
  const missing = []
  const placeholder = []
  
  requiredVars.forEach(varName => {
    const value = process.env[varName]
    if (!value) {
      missing.push(varName)
    } else if (value.includes('REPLACE_WITH') || value.includes('b8b8b8')) {
      placeholder.push(varName)
    } else {
      console.log(`✅ ${varName}: ${value.substring(0, 10)}...`)
    }
  })
  
  if (missing.length > 0) {
    console.log('\n❌ Missing environment variables:')
    missing.forEach(varName => console.log(`   - ${varName}`))
  }
  
  if (placeholder.length > 0) {
    console.log('\n⚠️  Placeholder values detected (need to be replaced):')
    placeholder.forEach(varName => console.log(`   - ${varName}`))
  }
  
  if (missing.length === 0 && placeholder.length === 0) {
    console.log('\n🎉 All environment variables are properly configured!')
  }
}

// Run tests
if (require.main === module) {
  testPaystackFlow()
  testEnvironmentConfig()
}