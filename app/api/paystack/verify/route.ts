/**
 * Paystack Payment Verification API Route
 * Verifies payment status and processes successful payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPaystackService } from '@/lib/paystack-service'

// In-memory cache to prevent duplicate processing
const processingCache = new Map<string, { processing: boolean; result?: any; timestamp: number }>()
const CACHE_DURATION = 60000 // 1 minute

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json()
    
    if (!reference) {
      return NextResponse.json(
        { success: false, error: 'Payment reference is required' },
        { status: 400 }
      )
    }

    // Check if already processing or recently processed
    const cached = processingCache.get(reference)
    if (cached) {
      const age = Date.now() - cached.timestamp
      
      if (cached.processing && age < CACHE_DURATION) {
        console.log(`⏳ Payment ${reference} is already being processed, waiting for result...`)
        // Wait for the processing to complete (up to 30 seconds)
        const maxWaitTime = 30000
        const checkInterval = 500
        let waited = 0
        
        while (waited < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval))
          waited += checkInterval
          
          const updated = processingCache.get(reference)
          if (updated?.result) {
            console.log(`✅ Processing completed, returning cached result for ${reference}`)
            return NextResponse.json(updated.result)
          }
          
          if (!updated?.processing) {
            // Processing finished but no result - break and retry
            break
          }
        }
        
        console.log(`⚠️ Waited ${waited}ms but no result yet, will retry processing`)
      }
      
      if (cached.result && age < CACHE_DURATION) {
        console.log(`✅ Returning cached result for ${reference} (${age}ms old)`)
        return NextResponse.json(cached.result)
      }
    }

    // Mark as processing
    processingCache.set(reference, { processing: true, timestamp: Date.now() })
    console.log(`🔄 Processing payment verification for ${reference}`)

    // Verify payment with Paystack
    const paystackService = getPaystackService()
    const verification = await paystackService.verifyPayment(reference)
    
    if (!verification.success) {
      const errorResult = { success: false, error: verification.error || 'Payment verification failed' }
      processingCache.set(reference, { processing: false, result: errorResult, timestamp: Date.now() })
      return NextResponse.json(errorResult, { status: 400 })
    }

    const paymentData = verification.data
    
    // Check if payment was successful
    if (paymentData.status !== 'success') {
      const errorResult = { success: false, error: 'Payment was not successful' }
      processingCache.set(reference, { processing: false, result: errorResult, timestamp: Date.now() })
      return NextResponse.json(errorResult, { status: 400 })
    }

    // Extract metadata
    const userAddress = paymentData.metadata?.userAddress
    const cryptoAmount = paymentData.metadata?.cryptoAmount
    
    if (!userAddress || !cryptoAmount) {
      const errorResult = { success: false, error: 'Missing payment metadata' }
      processingCache.set(reference, { processing: false, result: errorResult, timestamp: Date.now() })
      return NextResponse.json(errorResult, { status: 400 })
    }

    // Fund user wallet with USDC
    const fundingResult = await paystackService.fundUserWallet(
      userAddress,
      cryptoAmount,
      reference
    )
    
    if (!fundingResult.success) {
      const errorResult = { success: false, error: fundingResult.error || 'Failed to fund wallet' }
      processingCache.set(reference, { processing: false, result: errorResult, timestamp: Date.now() })
      return NextResponse.json(errorResult, { status: 500 })
    }

    const successResult = {
      success: true,
      data: {
        reference,
        amount: paymentData.amount / 100, // Convert from kobo/cents
        currency: paymentData.currency,
        cryptoAmount,
        txHash: fundingResult.txHash,
        userAddress
      }
    }

    // Cache the successful result
    processingCache.set(reference, { processing: false, result: successResult, timestamp: Date.now() })
    console.log(`✅ Payment ${reference} processed successfully, cached result`)

    return NextResponse.json(successResult)

  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of processingCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      processingCache.delete(key)
    }
  }
}, CACHE_DURATION)

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