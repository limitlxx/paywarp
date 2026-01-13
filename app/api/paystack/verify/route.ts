/**
 * Paystack Payment Verification API Route
 * Verifies payment status and processes successful payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPaystackService } from '@/lib/paystack-service'

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json()
    
    if (!reference) {
      return NextResponse.json(
        { success: false, error: 'Payment reference is required' },
        { status: 400 }
      )
    }

    // Verify payment with Paystack
    const paystackService = getPaystackService()
    const verification = await paystackService.verifyPayment(reference)
    
    if (!verification.success) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Payment verification failed' },
        { status: 400 }
      )
    }

    const paymentData = verification.data
    
    // Check if payment was successful
    if (paymentData.status !== 'success') {
      return NextResponse.json(
        { success: false, error: 'Payment was not successful' },
        { status: 400 }
      )
    }

    // Extract metadata
    const userAddress = paymentData.metadata?.userAddress
    const cryptoAmount = paymentData.metadata?.cryptoAmount
    
    if (!userAddress || !cryptoAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing payment metadata' },
        { status: 400 }
      )
    }

    // Fund user wallet with USDC
    const fundingResult = await paystackService.fundUserWallet(
      userAddress,
      cryptoAmount,
      reference
    )
    
    if (!fundingResult.success) {
      return NextResponse.json(
        { success: false, error: fundingResult.error || 'Failed to fund wallet' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        reference,
        amount: paymentData.amount / 100, // Convert from kobo/cents
        currency: paymentData.currency,
        cryptoAmount,
        txHash: fundingResult.txHash,
        userAddress
      }
    })

  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference')
  
  if (!reference) {
    return NextResponse.json(
      { success: false, error: 'Payment reference is required' },
      { status: 400 }
    )
  }

  try {
    // Simple verification check without processing
    const paystackService = getPaystackService()
    const verification = await paystackService.verifyPayment(reference)
    
    return NextResponse.json({
      success: verification.success,
      data: verification.data,
      error: verification.error
    })

  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}