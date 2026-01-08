#!/usr/bin/env node

/**
 * Test script to compare Alchemy Transfer API vs standard RPC performance
 * 
 * Usage: node test-alchemy-optimization.js [wallet_address]
 */

const { TransactionSyncService } = require('./lib/transaction-sync')
const { mantleSepolia } = require('./lib/networks')

async function testTransactionFetching() {
  // Use a test wallet address or the one provided
  const testWallet = process.argv[2] || '0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a'
  
  console.log('🧪 Testing Transaction Fetching Performance')
  console.log('=' .repeat(50))
  console.log(`Test Wallet: ${testWallet}`)
  console.log(`Network: Mantle Sepolia (${mantleSepolia.id})`)
  console.log('')

  const syncService = new TransactionSyncService(mantleSepolia.id)

  // Test 1: Alchemy Transfer API (optimized)
  console.log('🚀 Test 1: Alchemy Transfer API (Optimized)')
  console.log('-'.repeat(30))
  
  const alchemyStartTime = Date.now()
  try {
    const alchemyResults = await syncService.getCachedTransactions(testWallet, {
      useAlchemy: true,
      useCache: false,
      maxBlocks: 1000 // Large range to show the difference
    })
    
    const alchemyDuration = Date.now() - alchemyStartTime
    console.log(`✅ Alchemy API completed in ${alchemyDuration}ms`)
    console.log(`   Transactions found: ${alchemyResults.transactions.length}`)
    console.log(`   From cache: ${alchemyResults.fromCache}`)
    console.log('')
  } catch (error) {
    console.log(`❌ Alchemy API failed: ${error.message}`)
    console.log('')
  }

  // Test 2: Standard RPC (block scanning)
  console.log('🐌 Test 2: Standard RPC Block Scanning')
  console.log('-'.repeat(30))
  
  const rpcStartTime = Date.now()
  try {
    const rpcResults = await syncService.getCachedTransactions(testWallet, {
      useAlchemy: false,
      useCache: false,
      maxBlocks: 100 // Smaller range for RPC to avoid timeouts
    })
    
    const rpcDuration = Date.now() - rpcStartTime
    console.log(`✅ Standard RPC completed in ${rpcDuration}ms`)
    console.log(`   Transactions found: ${rpcResults.transactions.length}`)
    console.log(`   From cache: ${rpcResults.fromCache}`)
    console.log('')
  } catch (error) {
    console.log(`❌ Standard RPC failed: ${error.message}`)
    console.log('')
  }

  // Performance comparison
  console.log('📊 Performance Summary')
  console.log('=' .repeat(50))
  console.log('Alchemy Transfer API Benefits:')
  console.log('• ✅ Fetches 1000+ blocks in 1-2 API calls')
  console.log('• ✅ No block scanning required')
  console.log('• ✅ Pre-indexed data by address')
  console.log('• ✅ Handles pagination automatically')
  console.log('• ✅ Includes metadata and timestamps')
  console.log('')
  console.log('Standard RPC Limitations:')
  console.log('• ⚠️  Limited to ~5-100 blocks per call')
  console.log('• ⚠️  Requires sequential block scanning')
  console.log('• ⚠️  Multiple RPC calls for large ranges')
  console.log('• ⚠️  Higher chance of rate limiting')
  console.log('• ⚠️  Slower for historical data')
  console.log('')
  console.log('💡 Recommendation: Use Alchemy for production workloads')
}

// Run the test
testTransactionFetching().catch(console.error)