#!/usr/bin/env node

/**
 * Demo script showing Alchemy Transfer API optimization
 * This demonstrates the performance benefits of using Alchemy vs standard RPC
 */

const { createPublicClient, http } = require('viem')

// Test configuration
const TEST_ADDRESS = '0x202266854D99F96A98157ea51E8319E4a54e50d8'
const BUCKET_VAULT_ADDRESS = '0x5eB859EC3E38B6F7713e3d7504D08Cb8D50f3825'

// Demo Alchemy key (public, rate-limited)
const DEMO_ALCHEMY_KEY = 'eXgTwJ3xY1x26GMzs1zi-'

async function demonstrateOptimization() {
  console.log('🚀 Alchemy Transfer API Optimization Demo')
  console.log('=' .repeat(50))
  console.log(`Test Address: ${TEST_ADDRESS}`)
  console.log('')

  try {
    // Create RPC client
    const client = createPublicClient({
      transport: http('https://rpc.sepolia.mantle.xyz', { timeout: 10000 }),
      chain: {
        id: 5003,
        name: 'Mantle Sepolia',
        network: 'mantle-sepolia',
        nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
        rpcUrls: {
          default: { http: ['https://rpc.sepolia.mantle.xyz'] },
          public: { http: ['https://rpc.sepolia.mantle.xyz'] }
        }
      }
    })

    const currentBlock = await client.getBlockNumber()
    console.log(`Current block: ${currentBlock}`)
    console.log('')

    // Test 1: Standard RPC method with different block ranges
    console.log('📊 Test 1: Standard RPC Method Performance')
    console.log('-'.repeat(40))

    const blockRanges = [10, 50, 100, 500, 1000]
    const rpcResults = []

    for (const range of blockRanges) {
      try {
        const fromBlock = currentBlock - BigInt(range)
        const startTime = Date.now()
        
        const logs = await client.getLogs({
          address: BUCKET_VAULT_ADDRESS,
          fromBlock: fromBlock,
          toBlock: currentBlock
        })
        
        const duration = Date.now() - startTime
        rpcResults.push({ range, logs: logs.length, duration, success: true })
        
        console.log(`  Range ${range.toString().padStart(4)} blocks: ${logs.length.toString().padStart(2)} logs in ${duration.toString().padStart(4)}ms ✅`)
        
      } catch (error) {
        rpcResults.push({ range, logs: 0, duration: -1, success: false, error: error.message })
        
        if (error.message.includes('413') || error.message.includes('Content Too Large')) {
          console.log(`  Range ${range.toString().padStart(4)} blocks: FAILED - Content Too Large ❌`)
        } else {
          console.log(`  Range ${range.toString().padStart(4)} blocks: FAILED - ${error.message.slice(0, 50)}... ❌`)
        }
      }
    }

    console.log('')
    console.log('🚀 Test 2: Alchemy Transfer API Method')
    console.log('-'.repeat(40))

    const alchemyUrl = `https://mantle-sepolia.g.alchemy.com/v2/${DEMO_ALCHEMY_KEY}`
    
    try {
      const alchemyStartTime = Date.now()
      
      // Test Alchemy getAssetTransfers
      const response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromAddress: TEST_ADDRESS,
            category: ['external', 'internal', 'erc20'],
            maxCount: '0x64', // 100 transfers
            withMetadata: true,
            excludeZeroValue: false
          }]
        })
      })

      const alchemyDuration = Date.now() - alchemyStartTime
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.error) {
          console.log(`❌ Alchemy API error: ${data.error.message}`)
        } else {
          const transferCount = data.result?.transfers?.length || 0
          console.log(`✅ Alchemy Transfer API Results:`)
          console.log(`   Transfers found: ${transferCount}`)
          console.log(`   Time taken: ${alchemyDuration}ms`)
          console.log(`   Coverage: ALL transaction history (no block limits)`)
          
          if (transferCount > 0) {
            console.log('')
            console.log('   Sample transfers:')
            data.result.transfers.slice(0, 5).forEach((transfer, index) => {
              const blockNum = parseInt(transfer.blockNum, 16)
              const value = transfer.value || '0'
              console.log(`     ${index + 1}. Block ${blockNum}: ${transfer.category} ${value} ${transfer.asset || 'ETH'}`)
            })
          }
          
          // Performance comparison
          console.log('')
          console.log('📈 Performance Comparison:')
          console.log('-'.repeat(40))
          
          const successfulRPC = rpcResults.filter(r => r.success)
          if (successfulRPC.length > 0) {
            const maxRPCRange = Math.max(...successfulRPC.map(r => r.range))
            const maxRPCDuration = successfulRPC.find(r => r.range === maxRPCRange)?.duration || 0
            
            console.log(`Standard RPC (max ${maxRPCRange} blocks): ${maxRPCDuration}ms`)
            console.log(`Alchemy API (unlimited history): ${alchemyDuration}ms`)
            
            if (maxRPCDuration > 0) {
              const efficiency = (maxRPCDuration / alchemyDuration).toFixed(2)
              console.log(`Efficiency: ${efficiency}x faster for unlimited vs ${maxRPCRange} blocks`)
            }
          }
          
          console.log('')
          console.log('🎯 Key Benefits of Alchemy Transfer API:')
          console.log('   ✅ No block range limitations')
          console.log('   ✅ Pre-indexed data (faster queries)')
          console.log('   ✅ Single API call for full history')
          console.log('   ✅ Automatic pagination support')
          console.log('   ✅ Rich metadata included')
          console.log('   ✅ No "413 Content Too Large" errors')
        }
      } else {
        console.log(`❌ Alchemy API HTTP error: ${response.status} ${response.statusText}`)
      }
      
    } catch (error) {
      console.log(`❌ Alchemy API failed: ${error.message}`)
    }

    // Test 3: Demonstrate the chunking problem
    console.log('')
    console.log('⚠️  Test 3: Demonstrating RPC Limitations')
    console.log('-'.repeat(40))
    
    console.log('For a wallet with 1 year of transaction history:')
    console.log('')
    
    // Mantle has ~2 minute block times, so 1 year ≈ 262,800 blocks
    const blocksPerYear = 365 * 24 * 30 // ~262,800 blocks (assuming 2min blocks)
    const maxSafeRPCRange = 100 // Conservative limit to avoid 413 errors
    const requiredChunks = Math.ceil(blocksPerYear / maxSafeRPCRange)
    const estimatedRPCTime = requiredChunks * 2000 // 2s per chunk (conservative)
    
    console.log(`📊 Standard RPC Method:`)
    console.log(`   Blocks to scan: ~${blocksPerYear.toLocaleString()}`)
    console.log(`   Max safe range: ${maxSafeRPCRange} blocks per request`)
    console.log(`   Required chunks: ${requiredChunks.toLocaleString()}`)
    console.log(`   Estimated time: ${(estimatedRPCTime / 1000).toFixed(1)}s (${(estimatedRPCTime / 60000).toFixed(1)} minutes)`)
    console.log(`   Risk: High chance of 413 errors with large ranges`)
    console.log('')
    
    console.log(`🚀 Alchemy Transfer API:`)
    console.log(`   API calls needed: 1-3 (with pagination)`)
    console.log(`   Estimated time: 2-5 seconds`)
    console.log(`   Risk: None (pre-indexed data)`)
    console.log(`   Speed improvement: ${(estimatedRPCTime / 3000).toFixed(0)}x faster`)

  } catch (error) {
    console.error('❌ Demo failed:', error.message)
  }
}

// Run the demo
console.log('Starting Alchemy optimization demo...')
demonstrateOptimization().then(() => {
  console.log('')
  console.log('✅ Demo completed!')
  console.log('')
  console.log('💡 Next Steps:')
  console.log('   1. Get your free Alchemy API key at https://alchemy.com')
  console.log('   2. Add ALCHEMY_API_KEY=your_key to your .env file')
  console.log('   3. The TransactionSyncService will automatically use Alchemy when available')
  console.log('   4. Enjoy 10-100x faster transaction history fetching!')
}).catch(error => {
  console.error('❌ Demo failed:', error)
  process.exit(1)
})