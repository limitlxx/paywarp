import { NextRequest, NextResponse } from 'next/server'
import { serverFaucetService } from '@/lib/server-faucet-service'
import { isAddress } from 'viem'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenSymbol, recipientAddress } = body

    // Validate input
    if (!tokenSymbol || !['MNT', 'USDC'].includes(tokenSymbol)) {
      return NextResponse.json(
        { error: 'Invalid token symbol' },
        { status: 400 }
      )
    }

    if (!recipientAddress || !isAddress(recipientAddress)) {
      return NextResponse.json(
        { error: 'Invalid recipient address' },
        { status: 400 }
      )
    }

    // Process faucet request
    const result = await serverFaucetService.requestTokens({
      tokenSymbol,
      recipientAddress: recipientAddress as `0x${string}`
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        transactionHash: result.transactionHash,
        amount: result.amount
      })
    } else {
      return NextResponse.json(
        { 
          error: result.error,
          nextClaimTime: result.nextClaimTime
        },
        { status: 429 } // Too Many Requests for rate limiting
      )
    }
  } catch (error) {
    console.error('Faucet API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const tokenSymbol = searchParams.get('token') as 'MNT' | 'USDC'

    if (address && isAddress(address)) {
      // Check rate limiting for specific address
      const { canClaim, nextClaimTime } = serverFaucetService.canClaim(address)
      return NextResponse.json({
        canClaim,
        nextClaimTime
      })
    }

    if (tokenSymbol && ['MNT', 'USDC'].includes(tokenSymbol)) {
      // Get faucet balance
      const balance = await serverFaucetService.getFaucetBalance(tokenSymbol)
      return NextResponse.json({
        balance
      })
    }

    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Faucet API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}