import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

const bucketVaultABI = [
  "function getBucketBalance(address user, string bucket) external view returns (tuple(uint256 balance, uint256 yieldBalance, bool isYielding, uint256 lastYieldUpdate))",
  "function getSplitConfig(address user) external view returns (tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent))",
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('address')
    
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
    
    // Fetch all bucket balances
    const buckets = ['billings', 'savings', 'growth', 'instant', 'spendable']
    const balances: Record<string, any> = {}
    
    for (const bucket of buckets) {
      try {
        const balance = await bucketVault.getBucketBalance(userAddress, bucket)
        balances[bucket] = {
          balance: balance.balance.toString(),
          yieldBalance: balance.yieldBalance.toString(),
          isYielding: balance.isYielding,
          lastYieldUpdate: balance.lastYieldUpdate.toString(),
        }
      } catch (error) {
        console.error(`Error fetching ${bucket} balance:`, error)
        balances[bucket] = {
          balance: '0',
          yieldBalance: '0',
          isYielding: false,
          lastYieldUpdate: '0',
        }
      }
    }
    
    // Fetch split config
    let splitConfig
    try {
      const config = await bucketVault.getSplitConfig(userAddress)
      splitConfig = {
        billingsPercent: config.billingsPercent.toString(),
        savingsPercent: config.savingsPercent.toString(),
        growthPercent: config.growthPercent.toString(),
        instantPercent: config.instantPercent.toString(),
        spendablePercent: config.spendablePercent.toString(),
      }
    } catch (error) {
      console.error('Error fetching split config:', error)
      splitConfig = {
        billingsPercent: '4500',
        savingsPercent: '2000',
        growthPercent: '2000',
        instantPercent: '1000',
        spendablePercent: '500',
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        balances,
        splitConfig,
        timestamp: Date.now(),
      }
    })
    
  } catch (error) {
    console.error('Error fetching bucket data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch bucket data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
