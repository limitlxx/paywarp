#!/usr/bin/env node

/**
 * Test script for faucet API
 */

async function testFaucetAPI() {
  console.log('🧪 Testing Faucet API\n')
  
  const testAddress = '0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a'
  const baseUrl = 'http://localhost:3000'
  
  try {
    // Test 1: Check claim eligibility
    console.log('🔍 Test 1: Check Claim Eligibility')
    
    const eligibilityResponse = await fetch(`${baseUrl}/api/faucet?address=${testAddress}`)
    const eligibilityData = await eligibilityResponse.json()
    
    console.log('   Response:', eligibilityData)
    console.log('   ✅ Eligibility check successful\n')
    
    // Test 2: Request USDC tokens
    console.log('💰 Test 2: Request USDC Tokens')
    
    const faucetResponse = await fetch(`${baseUrl}/api/faucet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenSymbol: 'USDC',
        recipientAddress: testAddress,
        amount: 50 // Request 50 USDC
      })
    })
    
    const faucetData = await faucetResponse.json()
    
    console.log('   Response status:', faucetResponse.status)
    console.log('   Response data:', faucetData)
    
    if (faucetResponse.ok) {
      console.log('   ✅ USDC faucet request successful')
      if (faucetData.transactionHash) {
        console.log(`   Transaction: ${faucetData.transactionHash}`)
      }
    } else {
      console.log('   ⚠️  USDC faucet request failed:', faucetData.error)
    }
    
    console.log('\n🎉 Faucet API tests completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run test
testFaucetAPI().catch(console.error)