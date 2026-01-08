#!/usr/bin/env node

/**
 * Simple test script for transaction sync
 * Tests the current RPC implementation with fallbacks
 */

const { createPublicClient, http, fallback } = require('viem')

// Test configuration
const TEST_ADDRESS = '0x202266854D99F96A98157ea51E8319E4a54e50d8'
const BUCKET_VAULT_ADDRESS = '0x5eB859EC3E38B6F7713e3d7504D08Cb8D50f3825'

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  'https://rpc.sepolia.mantle.xyz',
  'https://mantle-sepolia.g.alchemy.com/v2/eXgTwJ3xY1x26GMzs1zi-'
]

async function testBasicRPC() {
  console.log('🧪 Testing Basic RPC Transaction Fetching')
  console.log('=' .repeat(50))
  console.log(`Test Address: ${TEST_ADDRESS}`)
  console.log(`Contract: ${BUCKET_VAULT_ADDRESS}`)
  console.log('')

  try {
    // Create a robust client with fallbacks
    const transports = RPC_ENDPOINTS.map(url => 
      http(url, {
        timeout: 10000,
        retryCount: 2,
        retryDelay: 1000
      })
    )

    const client = createPublicClient({
      transport: fallback(transports),
      chain: {
        id: 5003,
        name: 'Mantle Sepolia',
        network: 'mantle-sepolia',
        nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
        rpcUrls: {
          default: { http: RPC_ENDPOINTS },
          public: { http: RPC_ENDPOINTS }
        }
      }
    })

    console.log('📡 Testing RPC connectivity...')
    
    // Test each endpoint individually first
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      const endpoint = RPC_ENDPOINTS[i]
      console.log(`Testing endpoint ${i + 1}: ${endpoint}`)
      
      try {
        const testClient = createPublicClient({
          transport: http(endpoint, { timeout: 5000 }),
          chain: {
            id: 5003,
            name: 'Mantle Sepolia',
            network: 'mantle-sepolia',
            nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
            rpcUrls: {
              default: { http: [endpoint] },
              public: { http: [endpoint] }
            }
          }
        })
        
        const startTime = Date.now()
        const blockNumber = await testClient.getBlockNumber()
        const latency = Date.now() - startTime
        
        console.log(`  ✅ Success - Block: ${blockNumber}, Latency: ${latency}ms`)
      } catch (error) {
        console.log(`  ❌ Failed - ${error.message}`)
      }
    }

    console.log('')
    console.log('📡 Getting current block number with fallback client...')
    const currentBlock = await client.getBlockNumber()
    console.log(`Current block: ${currentBlock}`)

    // Test with progressively smaller ranges to find the limit
    console.log('')
    console.log('🔍 Testing different block ranges...')
    
    const testRanges = [1000, 500, 100, 50, 20, 10, 5]
    
    for (const range of testRanges) {
      try {
        const fromBlock = currentBlock - BigInt(range)
        const toBlock = currentBlock
        
        console.log(`Testing range: ${range} blocks (${fromBlock} to ${toBlock})`)
        
        const startTime = Date.now()
        
        const logs = await client.getLogs({
          address: BUCKET_VAULT_ADDRESS,
          fromBlock: fromBlock,
          toBlock: toBlock
        })
        
        const duration = Date.now() - startTime
        console.log(`  ✅ Success - ${logs.length} logs in ${duration}ms`)
        
        // If we found logs, show some details
        if (logs.length > 0) {
          console.log(`     Sample: Block ${logs[0].blockNumber}, TX: ${logs[0].transactionHash.slice(0, 10)}...`)
        }
        
        break // Stop at first successful range
        
      } catch (error) {
        console.log(`  ❌ Failed - ${error.message}`)
        
        if (error.message.includes('413') || error.message.includes('Content Too Large')) {
          console.log(`     This is the "413 Content Too Large" error we're optimizing for!`)
        }
      }
    }

    // Test user-specific event filtering
    console.log('')
    console.log('🎯 Testing user-specific event filtering...')
    
    try {
      // Try to get FundsSplit events for the user
      const userLogs = await client.getLogs({
        address: BUCKET_VAULT_ADDRESS,
        fromBlock: currentBlock - BigInt(50),
        toBlock: currentBlock,
        topics: [
          null, // Event signature (any event)
          `0x000000000000000000000000${TEST_ADDRESS.slice(2).toLowerCase()}` // User address as topic
        ]
      })
      
      console.log(`User-specific logs found: ${userLogs.length}`)
      
    } catch (error) {
      console.log(`User filtering failed: ${error.message}`)
    }

    // Test Alchemy Transfer API if key is available
    if (process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_API_KEY !== 'your_alchemy_api_key_here') {
      console.log('')
      console.log('🚀 Testing Alchemy Transfer API...')
      
      const alchemyUrl = `https://mantle-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      
      try {
        const alchemyStartTime = Date.now()
        
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
              maxCount: '0x32', // 50 transfers
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
            console.log(`✅ Alchemy API Results:`)
            console.log(`   Transfers found: ${data.result?.transfers?.length || 0}`)
            console.log(`   Time taken: ${alchemyDuration}ms`)
            
            if (data.result?.transfers?.length > 0) {
              console.log('   Sample transfers:')
              data.result.transfers.slice(0, 3).forEach((transfer, index) => {
                console.log(`     ${index + 1}. ${transfer.category} - ${transfer.value || '0'} ${transfer.asset || 'ETH'}`)
                console.log(`        Block: ${parseInt(transfer.blockNum, 16)}, Hash: ${transfer.hash.slice(0, 10)}...`)
              })
            }
          }
        } else {
          console.log(`❌ Alchemy API HTTP error: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        console.log(`❌ Alchemy API failed: ${error.message}`)
      }
    } else {
      console.log('')
      console.log('⚠️  Alchemy API key not configured')
      console.log('   Set ALCHEMY_API_KEY in your .env file to test the optimized method')
      console.log('   Get a free key at: https://alchemy.com')
    }

    console.log('')
    console.log('📊 Summary:')
    console.log('   Current RPC method works but has limitations:')
    console.log('   - Limited to small block ranges (5-100 blocks)')
    console.log('   - Sequential requests needed for large history')
    console.log('   - Prone to 413 "Content Too Large" errors')
    console.log('')
    console.log('   Alchemy Transfer API benefits:')
    console.log('   - Can fetch full transaction history in 1-2 calls')
    console.log('   - No block range limitations')
    console.log('   - Pre-indexed data for faster responses')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    
    if (error.message.includes('fetch failed')) {
      console.log('')
      console.log('💡 Network connectivity issue detected.')
      console.log('   This could be due to:')
      console.log('   - Firewall blocking requests')
      console.log('   - RPC endpoint temporarily down')
      console.log('   - Network connectivity issues')
    }
  }
}

// Run the test
console.log('Starting RPC connectivity test...')
testBasicRPC().then(() => {
  console.log('')
  console.log('✅ Test completed!')
}).catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})