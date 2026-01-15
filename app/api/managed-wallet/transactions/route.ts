import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

const bucketVaultABI = [
  "event FundsSplit(address indexed user, uint256 amount, uint256 billings, uint256 savings, uint256 growth, uint256 instant, uint256 spendable)",
  "event BucketTransfer(address indexed user, string fromBucket, string toBucket, uint256 amount)",
  "event Withdrawal(address indexed user, string bucket, uint256 amount)",
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('address')
    const fromBlock = searchParams.get('fromBlock') || '0'
    
    if (!userAddress) {
      return NextResponse.json(
        { error: 'Address parameter required' },
        { status: 400 }
      )
    }

    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC)
    
    // Contract addresses
    const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA
    
    if (!bucketVaultAddress) {
      return NextResponse.json(
        { error: 'Contract address not configured' },
        { status: 500 }
      )
    }
    
    // Create contract instance
    const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, provider)
    
    // Get current block
    const currentBlock = await provider.getBlockNumber()
    const startBlock = Math.max(Number(fromBlock), currentBlock - 50000) // Limit to last 50k blocks
    
    console.log(`Fetching transactions for ${userAddress} from block ${startBlock} to ${currentBlock}`)
    
    // Fetch all events
    const transactions: any[] = []
    
    try {
      // Fetch FundsSplit events (deposits)
      const splitFilter = bucketVault.filters.FundsSplit(userAddress)
      const splitEvents = await bucketVault.queryFilter(splitFilter, startBlock, currentBlock)
      
      for (const event of splitEvents) {
        if ('args' in event) {
          const block = await event.getBlock()
          transactions.push({
            hash: event.transactionHash,
            blockNumber: event.blockNumber.toString(),
            timestamp: block.timestamp * 1000,
            type: 'deposit',
            amount: event.args?.amount?.toString() || '0',
            description: 'Deposit and split into buckets',
            status: 'completed',
          })
        }
      }
      
      // Fetch BucketTransfer events
      const transferFilter = bucketVault.filters.BucketTransfer(userAddress)
      const transferEvents = await bucketVault.queryFilter(transferFilter, startBlock, currentBlock)
      
      for (const event of transferEvents) {
        if ('args' in event) {
          const block = await event.getBlock()
          transactions.push({
            hash: event.transactionHash,
            blockNumber: event.blockNumber.toString(),
            timestamp: block.timestamp * 1000,
            type: 'transfer',
            amount: event.args?.amount?.toString() || '0',
            description: `Transfer from ${event.args?.fromBucket || 'unknown'} to ${event.args?.toBucket || 'unknown'}`,
            status: 'completed',
            fromBucket: event.args?.fromBucket,
            toBucket: event.args?.toBucket,
          })
        }
      }
      
      // Fetch Withdrawal events
      const withdrawalFilter = bucketVault.filters.Withdrawal(userAddress)
      const withdrawalEvents = await bucketVault.queryFilter(withdrawalFilter, startBlock, currentBlock)
      
      for (const event of withdrawalEvents) {
        if ('args' in event) {
          const block = await event.getBlock()
          transactions.push({
            hash: event.transactionHash,
            blockNumber: event.blockNumber.toString(),
            timestamp: block.timestamp * 1000,
            type: 'withdrawal',
            amount: event.args?.amount?.toString() || '0',
            description: `Withdrawal from ${event.args?.bucket || 'unknown'}`,
            status: 'completed',
            bucket: event.args?.bucket,
          })
        }
      }
      
    } catch (error) {
      console.error('Error fetching events:', error)
    }
    
    // Sort by block number descending
    transactions.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
    
    console.log(`Found ${transactions.length} transactions for ${userAddress}`)
    
    return NextResponse.json({
      success: true,
      data: {
        transactions,
        fromBlock: startBlock,
        toBlock: currentBlock,
        count: transactions.length,
      }
    })
    
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
