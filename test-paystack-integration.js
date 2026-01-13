#!/usr/bin/env node

/**
 * Test script for Paystack integration
 * Tests payment initialization and webhook processing
 */

const { getPaystackService } = require('./lib/paystack-service')

async function testPaystackIntegration() {
  console.log('🧪 Testing Paystack Integration\n')
  
  try {
    // Test 1: Service initialization
    console.log('🔧 Test 1: Service Initialization')
    
    const paystackService = getPaystackService()
    console.log('   ✅ Paystack service initialized successfully')
    
    // Test 2: Managed wallet info
    console.log('\n💰 Test 2: Managed Wallet Info')
    
    const walletInfo = await paystackService.getManagedWalletInfo()
    console.log(`   Address: ${walletInfo.address}`)
    console.log(`   USDC Balance: ${walletInfo.balance.toFixed(2)} USDC`)
    console.log(`   Transaction Count: ${walletInfo.transactionCount}`)
    console.log(`   Last Updated: ${walletInfo.lastUpdated.toISOString()}`)
    
    // Test 3: Payment initialization (mock)
    console.log('\n💳 Test 3: Payment Initialization')
    
    const testUserAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5e'
    const testEmail = 'test@example.com'
    const testAmount = 100 // $100 USD
    
    try {
      const paymentSession = await paystackService.initializePayment(
        testAmount,
        'USD',
        testUserAddress,
        testEmail
      )
      
      console.log(`   ✅ Payment session created`)
      console.log(`   Reference: ${paymentSession.reference}`)
      console.log(`   Amount: ${paymentSession.currency} ${paymentSession.amount}`)
      console.log(`   User: ${paymentSession.userAddress}`)
      console.log(`   Status: ${paymentSession.status}`)
      console.log(`   Expires: ${paymentSession.expiresAt.toISOString()}`)
      console.log(`   Paystack URL: ${paymentSession.paystackUrl}`)
      
      // Test 4: Payment verification (will fail since it's not a real payment)
      console.log('\n🔍 Test 4: Payment Verification')
      
      const verification = await paystackService.verifyPayment(paymentSession.reference)
      if (verification.success) {
        console.log('   ✅ Payment verification successful')
        console.log(`   Data: ${JSON.stringify(verification.data, null, 2)}`)
      } else {
        console.log('   ⚠️  Payment verification failed (expected for test)')
        console.log(`   Error: ${verification.error}`)
      }
      
    } catch (initError) {
      console.log('   ⚠️  Payment initialization failed (expected if no API keys)')
      console.log(`   Error: ${initError.message}`)
    }
    
    console.log('\n🎉 Paystack integration tests completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
}

// Run tests
testPaystackIntegration().catch(console.error)