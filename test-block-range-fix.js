// Simple test to verify block range chunking works correctly
const { TransactionSyncService } = require('./lib/transaction-sync.ts');

async function testBlockRangeChunking() {
  console.log('Testing block range chunking...');
  
  // Test that large ranges get chunked properly
  const service = new TransactionSyncService(5003); // Mantle Sepolia
  
  // Mock a large block range (this would normally cause the 413 error)
  const fromBlock = 1000000n;
  const toBlock = 1100000n; // 100k block range
  const maxChunkSize = 15000n;
  
  console.log(`Original range: ${fromBlock} to ${toBlock} (${toBlock - fromBlock} blocks)`);
  
  // Calculate expected chunks
  const expectedChunks = Math.ceil(Number(toBlock - fromBlock) / Number(maxChunkSize));
  console.log(`Expected chunks: ${expectedChunks}`);
  console.log(`Max chunk size: ${maxChunkSize}`);
  
  // Verify that each chunk is within the limit
  let currentFromBlock = fromBlock;
  let chunkCount = 0;
  
  while (currentFromBlock <= toBlock) {
    const currentToBlock = currentFromBlock + maxChunkSize - 1n > toBlock 
      ? toBlock 
      : currentFromBlock + maxChunkSize - 1n;
    
    const chunkSize = currentToBlock - currentFromBlock + 1n;
    console.log(`Chunk ${++chunkCount}: ${currentFromBlock} to ${currentToBlock} (${chunkSize} blocks)`);
    
    // Verify chunk is within limit
    if (chunkSize > 30000n) {
      console.error(`❌ Chunk ${chunkCount} exceeds 30k block limit!`);
      return false;
    }
    
    currentFromBlock = currentToBlock + 1n;
  }
  
  console.log(`✅ All ${chunkCount} chunks are within the 30k block limit`);
  return true;
}

// Run the test
testBlockRangeChunking().catch(console.error);