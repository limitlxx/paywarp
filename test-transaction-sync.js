#!/usr/bin/env node

/**
 * Test script for transaction sync optimization
 * Tests both standard RPC and Alchemy API methods
 */

const { TransactionSyncService } = require('./lib/transaction-sync.ts')
const { mantleSepolia } = require('./lib/networks')

// Test configuration
const TEST_ADDRESS = '0x202266854D99F96A98157ea51E8319E4a54e50d8'
const CHAIN_ID = mantleSepolia.id // 5003 for Mantle Sepolia

async function testTransactionSync() {
  console.log('🧪 Testing Transaction Sync Optimization')
  console.log('=' .repeat(50))
  console.log(`Test Address: ${TEST_ADDRESS}`)
  console.log(`Chain ID: ${CHAIN_ID}`)
  console.log('')

  try {
    // Initialize the service
    const syncService = new TransactionSyncService(CHAIN_ID)
    
    console.log('📊 Test 1: Standard RPC Method (Current Implementation)')
    console.log('-'.repeat(30))
    
    const startTimeRPC = Date.now()
    
    const rpcResults = await syncService.getCachedTransactions(TEST_ADDRESS, {
      maxBlocks: 100, // Conservative limit
      useAlchemy: false, // Force standard RPC
      useCache: false, // Don't use cache for fair comparison
      includePayroll: true
    })
    
    const rpcDuration = Date.now() - startTimeRPC
    
    console.log(`✅ RPC Method Results:`)
    console.log(`   Transactions found: ${rpcResults.transactions.length}`)
    console.log(`   Time taken: ${rpcDuration}ms`)
    console.log(`   From cache: ${rpcResults.fromCache}`)
    
    if (rpcResults.transactions.length > 0) {
      console.log(`   Sample transaction types:`)
      const types = [...new Set(rpcResults.transactions.map(tx => tx.type))]
      types.slice(0, 5).forEach(type => {
        const count = rpcResults.transactions.filter(tx => tx.type === type).length
        console.log(`     - ${type}: ${count} transactions`)
      })
    }
    
    console.log('')
    
    // Test Alchemy method if API key is configured
    if (process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_API_KEY !== 'your_alchemy_api_key_here') {
      console.log('🚀 Test 2: Alchemy Transfer API Method (Optimized)')
      console.log('-'.repeat(30))
      
      const startTimeAlchemy = Date.now()
      
      const alchemyResults = await syncService.getCachedTransactions(TEST_ADDRESS, {
        maxBlocks: 1000, // Can handle much larger ranges
        useAlchemy: true, // Use Alchemy API
        useCache: false, // Don't use cache for fair comparison
        includePayroll: true
      })
      
      const alchemyDuration = Date.now() - startTimeAlchemy
      
      console.log(`✅ Alchemy Method Results:`)
      console.log(`   Transactions found: ${alchemyResults.transactions.length}`)
      console.log(`   Time taken: ${alchemyDuration}ms`)
      console.log(`   From cache: ${alchemyResults.fromCache}`)
      
      if (alchemyResults.transactions.length > 0) {
        console.log(`   Sample transaction types:`)
        const types = [...new Set(alchemyResults.transactions.map(tx => tx.type))]
        types.slice(0, 5).forEach(type => {
          const count = alchemyResults.transactions.filter(tx => tx.type === type).length
          console.log(`     - ${type}: ${count} transactions`)
        })
      }
      
      console.log('')
      console.log('📈 Performance Comparison:')
      console.log('-'.repeat(30))
      console.log(`RPC Method: ${rpcDuration}ms for ${rpcResults.transactions.length} transactions`)
      console.log(`Alchemy Method: ${alchemyDuration}ms for ${alchemyResults.transactions.length} transactions`)
      
      if (alchemyDuration > 0 && rpcDuration > 0) {
        const speedup = (rpcDuration / alchemyDuration).toFixed(2)
        console.log(`Speed improvement: ${speedup}x faster with Alchemy`)
      }
      
      const coverageImprovement = alchemyResults.transactions.length - rpcResults.transactions.length
      if (coverageImprovement > 0) {
        console.log(`Coverage improvement: +${coverageImprovement} additional transactions found`)
      }
      
    } else {
      console.log('⚠️  Alchemy API key not configured')
      console.log('   Add your Alchemy API key to .env file as ALCHEMY_API_KEY=your_key')
      console.log('   Get a free key at: https://alchemy.com')
    }
    
    console.log('')
    console.log('🧪 Test 3: Cache Performance')
    console.log('-'.repeat(30))
    
    // Test cache performance
    const startTimeCache = Date.now()
    
    const cachedResults = await syncService.getCachedTransactions(TEST_ADDRESS, {
      useCache: true, // Use cache if available
      maxBlocks: 0 // Don't sync if no cache
    })
    
    const cacheDuration = Date.now() - startTimeCache
    
    console.log(`✅ Cache Results:`)
    console.log(`   Transactions from cache: ${cachedResults.transactions.length}`)
    console.log(`   Time taken: ${cacheDuration}ms`)
    console.log(`   From cache: ${cachedResults.fromCache}`)
    
    if (cachedResults.fromCache) {
      console.log(`   Cache hit! Extremely fast retrieval.`)
    } else {
      console.log(`   No cache available for this address.`)
    }
    
    console.log('')
    console.log('📋 Test 4: Cache Information')
    console.log('-'.repeat(30))
    
    const cacheInfo = await syncService.getCacheInfo(TEST_ADDRESS)
    console.log(`Cache exists: ${cacheInfo.hasCache}`)
    console.log(`Cache stats:`, cacheInfo.stats)
    if (cacheInfo.metadata) {
      console.log(`Last synced: ${new Date(cacheInfo.metadata.lastSyncedTimestamp)}`)
      console.log(`Last synced block: ${cacheInfo.metadata.lastSyncedBlock}`)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    
    if (error.message.includes('Under the Free tier plan')) {
      console.log('')
      console.log('💡 Tip: You\'re hitting Alchemy free tier limits.')
      console.log('   The optimization will automatically use smaller chunks.')
      console.log('   Consider upgrading to Alchemy Growth plan for better limits.')
    }
    
    if (error.message.includes('413') || error.message.includes('Content Too Large')) {
      console.log('')
      console.log('💡 Tip: RPC provider is limiting request size.')
      console.log('   The system will automatically reduce chunk sizes.')
    }
  }
}

// Run the test
console.log('Starting transaction sync test...')
testTransactionSync().then(() => {
  console.log('')
  console.log('✅ Test completed!')
}).catch(error => {
  console.error('❌ Test suite failed:', error)
  process.exit(1)
})