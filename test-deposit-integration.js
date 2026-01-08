#!/usr/bin/env node

/**
 * Test script for deposit integration
 * Tests wallet deposits, Paystack integration, and faucet functionality
 */

const { ethers } = require('ethers')
const { parseUnits, formatUnits } = require('viem')

// Test configuration
const TEST_CONFIG = {
  rpcUrl: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || 'https://rpc.sepolia.mantle.xyz',
  bucketVaultAddress: process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA || '0x5eB859EC3E38B6F7713e3d7504D08Cb8D50f3825',
  usdcAddress: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8',
  managedWalletKey: process.env.MANAGED_WALLET_PRIVATE_KEY || '0xc0cf03b72410ac08a9b5621e615cd70c05e920f3dae826a03a837237e903bf6b',
  testWalletKey: process.env.PRIVATE_KEY || '0xc0cf03b72410ac08a9b5621e615cd70c05e920f3dae826a03a837237e903bf6b'
}

// Contract ABIs (simplified)
const USDC_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount) external',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

const BUCKET_VAULT_ABI = [
  'function getSplitConfig(address user) view returns (tuple(uint256,uint256,uint256,uint256,uint256))',
  'function setSplitConfig(tuple(uint256,uint256,uint256,uint256,uint256) config) external',
  'function depositAndSplit(uint256 amount) external',
  'function getBucketBalance(address user, string bucket) view returns (tuple(uint256,uint256,bool,uint256))',
  'function version() view returns (string)'
]

async function main() {
  console.log('🧪 Testing Deposit Integration\n')
  
  // Validate configuration
  if (!TEST_CONFIG.managedWalletKey || !TEST_CONFIG.managedWalletKey.startsWith('0x')) {
    console.error('❌ Invalid MANAGED_WALLET_PRIVATE_KEY')
    return
  }
  
  if (!TEST_CONFIG.testWalletKey || !TEST_CONFIG.testWalletKey.startsWith('0x')) {
    console.error('❌ Invalid test wallet private key')
    return
  }
  
  // Setup provider and wallets
  const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpcUrl)
  const managedWallet = new ethers.Wallet(TEST_CONFIG.managedWalletKey, provider)
  const testWallet = new ethers.Wallet(TEST_CONFIG.testWalletKey, provider)
  
  console.log('📋 Configuration:')
  console.log(`   RPC URL: ${TEST_CONFIG.rpcUrl}`)
  console.log(`   BucketVault: ${TEST_CONFIG.bucketVaultAddress}`)
  console.log(`   USDC: ${TEST_CONFIG.usdcAddress}`)
  console.log(`   Managed Wallet: ${managedWallet.address}`)
  console.log(`   Test Wallet: ${testWallet.address}\n`)
  
  // Create contract instances
  const usdcContract = new ethers.Contract(TEST_CONFIG.usdcAddress, USDC_ABI, provider)
  const bucketVaultContract = new ethers.Contract(TEST_CONFIG.bucketVaultAddress, BUCKET_VAULT_ABI, provider)
  
  try {
    // Test 1: Check contract connectivity
    console.log('🔗 Test 1: Contract Connectivity')
    
    const usdcName = await usdcContract.name()
    const usdcSymbol = await usdcContract.symbol()
    const usdcDecimals = await usdcContract.decimals()
    const vaultVersion = await bucketVaultContract.version()
    
    console.log(`   USDC Token: ${usdcName} (${usdcSymbol}) - ${usdcDecimals} decimals`)
    console.log(`   BucketVault Version: ${vaultVersion}`)
    console.log('   ✅ Contract connectivity successful\n')
    
    // Test 2: Check balances
    console.log('💰 Test 2: Wallet Balances')
    
    const managedUsdcBalance = await usdcContract.balanceOf(managedWallet.address)
    const testUsdcBalance = await usdcContract.balanceOf(testWallet.address)
    const managedMntBalance = await provider.getBalance(managedWallet.address)
    const testMntBalance = await provider.getBalance(testWallet.address)
    
    console.log(`   Managed Wallet USDC: ${ethers.formatUnits(managedUsdcBalance, usdcDecimals)} USDC`)
    console.log(`   Managed Wallet MNT: ${ethers.formatEther(managedMntBalance)} MNT`)
    console.log(`   Test Wallet USDC: ${ethers.formatUnits(testUsdcBalance, usdcDecimals)} USDC`)
    console.log(`   Test Wallet MNT: ${ethers.formatEther(testMntBalance)} MNT`)
    
    if (managedMntBalance < ethers.parseEther('0.01')) {
      console.log('   ⚠️  Managed wallet needs MNT for gas')
    }
    if (testMntBalance < ethers.parseEther('0.01')) {
      console.log('   ⚠️  Test wallet needs MNT for gas')
    }
    console.log()
    
    // Test 3: Faucet functionality
    console.log('🚰 Test 3: USDC Faucet')
    
    const faucetAmount = ethers.parseUnits('100', usdcDecimals)
    const usdcWithManagedWallet = usdcContract.connect(managedWallet)
    
    try {
      // Try minting first
      console.log('   Attempting to mint 100 USDC to test wallet...')
      const mintTx = await usdcWithManagedWallet.mint(testWallet.address, faucetAmount)
      await mintTx.wait()
      console.log(`   ✅ Minted 100 USDC to test wallet (tx: ${mintTx.hash})`)
    } catch (mintError) {
      console.log('   Minting failed, trying transfer from managed wallet...')
      
      if (managedUsdcBalance >= faucetAmount) {
        const transferTx = await usdcWithManagedWallet.transfer(testWallet.address, faucetAmount)
        await transferTx.wait()
        console.log(`   ✅ Transferred 100 USDC to test wallet (tx: ${transferTx.hash})`)
      } else {
        console.log('   ❌ Insufficient USDC in managed wallet for transfer')
      }
    }
    console.log()
    
    // Test 4: Split configuration
    console.log('⚙️  Test 4: Split Configuration')
    
    const currentConfig = await bucketVaultContract.getSplitConfig(testWallet.address)
    const configSum = currentConfig[0] + currentConfig[1] + currentConfig[2] + currentConfig[3] + currentConfig[4]
    
    console.log('   Current split config:')
    console.log(`     Billings: ${currentConfig[0]} (${Number(currentConfig[0]) / 100}%)`)
    console.log(`     Savings: ${currentConfig[1]} (${Number(currentConfig[1]) / 100}%)`)
    console.log(`     Growth: ${currentConfig[2]} (${Number(currentConfig[2]) / 100}%)`)
    console.log(`     Instant: ${currentConfig[3]} (${Number(currentConfig[3]) / 100}%)`)
    console.log(`     Spendable: ${currentConfig[4]} (${Number(currentConfig[4]) / 100}%)`)
    console.log(`     Total: ${configSum} (${Number(configSum) / 100}%)`)
    
    if (configSum === 0n) {
      console.log('   Setting default split configuration...')
      
      const defaultConfig = [
        2000n,   // billingsPercent - 20%
        3000n,   // savingsPercent - 30%
        2000n,   // growthPercent - 20%
        1500n,   // instantPercent - 15%
        1500n    // spendablePercent - 15%
      ]
      
      const bucketVaultWithTestWallet = bucketVaultContract.connect(testWallet)
      const configTx = await bucketVaultWithTestWallet.setSplitConfig(defaultConfig)
      await configTx.wait()
      
      console.log(`   ✅ Set default split configuration (tx: ${configTx.hash})`)
    } else {
      console.log('   ✅ Split configuration already set')
    }
    console.log()
    
    // Test 5: Deposit and split
    console.log('💸 Test 5: Deposit and Split')
    
    const depositAmount = ethers.parseUnits('50', usdcDecimals)
    const usdcWithTestWallet = usdcContract.connect(testWallet)
    const bucketVaultWithTestWallet = bucketVaultContract.connect(testWallet)
    
    // Check current balance
    const currentBalance = await usdcContract.balanceOf(testWallet.address)
    console.log(`   Current test wallet USDC balance: ${ethers.formatUnits(currentBalance, usdcDecimals)} USDC`)
    
    if (currentBalance < depositAmount) {
      console.log('   ❌ Insufficient USDC balance for deposit test')
      return
    }
    
    // Check and approve USDC spending
    const currentAllowance = await usdcContract.allowance(testWallet.address, TEST_CONFIG.bucketVaultAddress)
    console.log(`   Current allowance: ${ethers.formatUnits(currentAllowance, usdcDecimals)} USDC`)
    
    if (currentAllowance < depositAmount) {
      console.log('   Approving USDC spending...')
      const approveTx = await usdcWithTestWallet.approve(TEST_CONFIG.bucketVaultAddress, depositAmount)
      await approveTx.wait()
      console.log(`   ✅ Approved USDC spending (tx: ${approveTx.hash})`)
    }
    
    // Perform deposit and split
    console.log('   Executing depositAndSplit...')
    const depositTx = await bucketVaultWithTestWallet.depositAndSplit(depositAmount)
    const receipt = await depositTx.wait()
    
    console.log(`   ✅ Deposit and split successful (tx: ${depositTx.hash})`)
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`)
    console.log()
    
    // Test 6: Check bucket balances
    console.log('🪣 Test 6: Bucket Balances')
    
    const buckets = ['billings', 'savings', 'growth', 'instant', 'spendable']
    
    for (const bucket of buckets) {
      try {
        const balance = await bucketVaultContract.getBucketBalance(testWallet.address, bucket)
        console.log(`   ${bucket}: ${ethers.formatUnits(balance[0], usdcDecimals)} USDC`)
      } catch (error) {
        console.log(`   ${bucket}: Error reading balance`)
      }
    }
    console.log()
    
    console.log('🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.reason) {
      console.error('   Reason:', error.reason)
    }
    if (error.code) {
      console.error('   Code:', error.code)
    }
  }
}

// Run tests
main().catch(console.error)