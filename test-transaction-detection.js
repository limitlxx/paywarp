const { createPublicClient, http } = require('viem');
const { mantleSepolia } = require('./lib/networks');

// Test if we can detect transactions for a specific address
async function testTransactionDetection() {
  console.log('🔍 Testing transaction detection...');
  
  // Create a public client
  const client = createPublicClient({
    chain: mantleSepolia,
    transport: http()
  });
  
  // Test address - replace with your actual address
  const testAddress = '0x742d35Cc6634C0532925a3b8D0C9e3e0C0e8b4C8'; // Replace with your address
  
  try {
    // Get latest block
    const latestBlock = await client.getBlockNumber();
    console.log('Latest block:', latestBlock.toString());
    
    // Check for FundsSplit events in recent blocks
    const fromBlock = latestBlock - BigInt(1000); // Last 1000 blocks
    
    console.log(`Checking blocks ${fromBlock} to ${latestBlock} for FundsSplit events...`);
    
    // Get BucketVault address from contracts
    const bucketVaultAddress = '0x742d35Cc6634C0532925a3b8D0C9e3e0C0e8b4C8'; // Replace with actual contract address
    
    const logs = await client.getLogs({
      address: bucketVaultAddress,
      event: {
        type: 'event',
        name: 'FundsSplit',
        inputs: [
          { name: 'user', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { 
            name: 'config', 
            type: 'tuple',
            components: [
              { name: 'billingsPercent', type: 'uint256' },
              { name: 'savingsPercent', type: 'uint256' },
              { name: 'growthPercent', type: 'uint256' },
              { name: 'instantPercent', type: 'uint256' },
              { name: 'spendablePercent', type: 'uint256' }
            ]
          },
          { name: 'nonce', type: 'uint256', indexed: false }
        ]
      },
      fromBlock,
      toBlock: latestBlock
    });
    
    console.log(`Found ${logs.length} FundsSplit events`);
    
    // Filter for the test address
    const userLogs = logs.filter(log => 
      log.args && log.args.user && log.args.user.toLowerCase() === testAddress.toLowerCase()
    );
    
    console.log(`Found ${userLogs.length} FundsSplit events for address ${testAddress}`);
    
    if (userLogs.length > 0) {
      console.log('Recent transactions:');
      userLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. Block: ${log.blockNumber}, Amount: ${log.args.amount}, Hash: ${log.transactionHash}`);
      });
    } else {
      console.log('No transactions found for this address');
      console.log('This could mean:');
      console.log('1. No deposits have been made');
      console.log('2. Wrong contract address');
      console.log('3. Wrong address being checked');
      console.log('4. Transactions are older than 1000 blocks');
    }
    
  } catch (error) {
    console.error('Error testing transaction detection:', error);
  }
}

testTransactionDetection();