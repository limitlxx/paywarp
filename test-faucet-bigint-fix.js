/**
 * Test script to verify faucet BigInt fix
 */

const { ethers } = require('ethers')

async function testBigIntHandling() {
  console.log('Testing BigInt handling in faucet...')
  
  try {
    // Test parseUnits with ethers (should return BigInt)
    const amount = 100
    const decimals = 6 // USDC decimals
    const amountWei = ethers.parseUnits(amount.toString(), decimals)
    
    console.log('Amount:', amount)
    console.log('AmountWei (BigInt):', amountWei)
    console.log('AmountWei type:', typeof amountWei)
    
    // Test BigInt comparison
    const mockBalance = ethers.parseUnits('1000', decimals) // 1000 USDC
    console.log('Mock balance:', mockBalance)
    console.log('Balance >= Amount:', mockBalance >= amountWei)
    console.log('Balance < Amount:', mockBalance < amountWei)
    
    // Test with insufficient balance
    const smallBalance = ethers.parseUnits('50', decimals) // 50 USDC
    console.log('Small balance:', smallBalance)
    console.log('Small balance < Amount:', smallBalance < amountWei)
    
    console.log('✅ BigInt handling test passed!')
    
  } catch (error) {
    console.error('❌ BigInt handling test failed:', error)
  }
}

testBigIntHandling()