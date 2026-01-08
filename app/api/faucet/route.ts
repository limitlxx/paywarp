import { NextRequest, NextResponse } from 'next/server'
import { serverFaucetService } from '@/lib/server-faucet-service'
import { getDepositService } from '@/lib/deposit-service'
import { isAddress } from 'viem'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenSymbol, recipientAddress, amount } = body

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

    // For USDC, use the deposit service which can mint tokens
    if (tokenSymbol === 'USDC') {
      try {
        const depositService = getDepositService()
        const result = await depositService.depositFromFaucet(recipientAddress, amount || 100)
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            transactionHash: result.transactionHash,
            amount: (amount || 100).toString()
          })
        } else {
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          )
        }
      } catch (error) {
        console.error('USDC faucet error:', error)
        return NextResponse.json(
          { error: 'USDC faucet service unavailable' },
          { status: 500 }
        )
      }
    }

    // For MNT, use the original faucet service
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