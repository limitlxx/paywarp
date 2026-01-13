import { NextRequest, NextResponse } from 'next/server'
import { getPaystackService } from '@/lib/paystack-service'

export async function POST(request: NextRequest) {
  try {
    const { amount, currency, userAddress, email } = await request.json()

    // Validate required fields
    if (!amount || !currency || !userAddress || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, currency, userAddress, email' },
        { status: 400 }
      )
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Validate currency
    if (!['NGN', 'USD'].includes(currency)) {
      return NextResponse.json(
        { error: 'Currency must be NGN or USD' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Initialize Paystack payment
    const paystackService = getPaystackService()
    const session = await paystackService.initializePayment(amount, currency, userAddress, email)

    return NextResponse.json({
      success: true,
      session
    })
  } catch (error) {
    console.error('Paystack initialization error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to initialize payment',
        success: false 
      },
      { status: 500 }
    )
  }
}