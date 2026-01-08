#!/usr/bin/env node

/**
 * Test script for faucet BigInt fix
 */

const { ethers } = require('ethers')

// Test configuration
const TEST_CONFIG = {
  rpcUrl: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || 'https://rpc.sepolia.mantle.xyz',
  usdcAddress: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8',
  managedWalletKey: process.env.MANAGED_WALLET_PRIVATE_KEY || '0xc0cf03b72410ac08a9b5621e615cd70c05e920f3dae826a03a837237e903bf6b',
  testAddress: '0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a' // Use managed wallet address for testing
}

const USDC_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount) external',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

async function testFaucetFix() {
  console.log('🧪 Testing Faucet BigInt Fix\n')
  
  try {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpcUrl)
    const managedWallet = new ethers.Wallet(TEST_CONFIG.managedWalletKey, provider)
    
    console.log('📋 Configuration:')
    console.log(`   RPC URL: ${TEST_CONFIG.rpcUrl}`)
    console.log(`   USDC: ${TEST_CONFIG.usdcAddress}`)
    console.log(`   Managed Wallet: ${managedWallet.address}`)
    console.log(`   Test Address: ${TEST_CONFIG.testAddress}\n`)
    
    // Create USDC contract instance
    const usdcContract = new ethers.Contract(TEST_CONFIG.usdcAddress, USDC_ABI, provider)
    const usdcWithManagedWallet = usdcContract.connect(managedWallet)
    
    // Test 1: Get USDC info
    console.log('🔗 Test 1: USDC Contract Info')
    
    const name = await usdcContract.name()
    const symbol = await usdcContract.symbol()
    const decimals = await usdcContract.decimals()
    
    console.log(`   Token: ${name} (${symbol})`)
    console.log(`   Decimals: ${decimals}`)
    console.log('   ✅ Contract info retrieved successfully\n')
    
    // Test 2: Check balances (this is where BigInt conversion might fail)
    console.log('💰 Test 2: Balance Checking')
    
    const managedBalance = await usdcContract.balanceOf(managedWallet.address)
    const testBalance = await usdcContract.balanceOf(TEST_CONFIG.testAddress)
    
    console.log(`   Managed wallet balance (raw): ${managedBalance.toString()}`)
    console.log(`   Test address balance (raw): ${testBalance.toString()}`)
    
    // Test the conversion that was causing issues
    const managedBalanceFormatted = ethers.formatUnits(managedBalance, decimals)
    const testBalanceFormatted = ethers.formatUnits(testBalance, decimals)
    
    console.log(`   Managed wallet balance: ${managedBalanceFormatted} USDC`)
    console.log(`   Test address balance: ${testBalanceFormatted} USDC`)
    console.log('   ✅ Balance conversion successful\n')
    
    // Test 3: Simulate faucet mint (if possible)
    console.log('🚰 Test 3: Faucet Mint Simulation')
    
    const mintAmount = ethers.parseUnits('100', decimals)
    console.log(`   Mint amount (raw): ${mintAmount.toString()}`)
    console.log(`   Mint amount (formatted): ${ethers.formatUnits(mintAmount, decimals)} USDC`)
    
    try {
      // Try to mint (this might fail if not owner, but that's expected)
      const mintTx = await usdcWithManagedWallet.mint(TEST_CONFIG.testAddress, mintAmount)
      await mintTx.wait()
      console.log(`   ✅ Mint successful (tx: ${mintTx.hash})`)
    } catch (mintError) {
      console.log('   ⚠️  Mint failed (expected if not owner):', mintError.message)
      
      // Try transfer instead
      if (managedBalance >= mintAmount) {
        console.log('   Trying transfer instead...')
        const transferTx = await usdcWithManagedWallet.transfer(TEST_CONFIG.testAddress, mintAmount)
        await transferTx.wait()
        console.log(`   ✅ Transfer successful (tx: ${transferTx.hash})`)
      } else {
        console.log('   ⚠️  Insufficient balance for transfer')
      }
    }
    
    console.log('\n🎉 All BigInt conversion tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
}

// Run test
testFaucetFix().catch(console.error)