/**
 * Paystack webhook handler
 * Processes payment events and triggers wallet funding + auto-split
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPaystackService, type PaystackWebhookEvent } from '@/lib/paystack-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('PAYSTACK_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    const hash = crypto
      .createHmac('sha512', webhookSecret)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse webhook event
    const event: PaystackWebhookEvent = JSON.parse(body)
    
    console.log('Received Paystack webhook:', event.event, event.data.reference)

    // Process the event
    const depositRecord = await getPaystackService().processWebhookEvent(event)
    
    if (depositRecord) {
      console.log('Deposit record created:', depositRecord.id)
      
      // In a production app, you would:
      // 1. Save the deposit record to your database
      // 2. Emit an event to trigger auto-split in the frontend
      // 3. Send notifications to the user
      
      return NextResponse.json({
        success: true,
        depositId: depositRecord.id,
        message: 'Webhook processed successfully'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received but no action taken'
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}