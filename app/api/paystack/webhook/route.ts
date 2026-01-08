/**
 * Paystack Webhook Handler
 * Processes payment confirmations and triggers auto-split
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPaystackService, type PaystackWebhookEvent } from '@/lib/paystack-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')
    
    if (!signature) {
      console.error('Missing Paystack signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('Missing webhook secret')
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
    }

    const hash = crypto
      .createHmac('sha512', webhookSecret)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Parse webhook event
    const event: PaystackWebhookEvent = JSON.parse(body)
    console.log('Received Paystack webhook:', event.event, event.data.reference)

    // Process the event
    const paystackService = getPaystackService()
    const depositRecord = await paystackService.processWebhookEvent(event)

    if (depositRecord) {
      console.log('Deposit record created:', depositRecord.id)
      
      // In a production system, you might want to:
      // 1. Store the deposit record in a database
      // 2. Send notifications to the user
      // 3. Update analytics/metrics
      
      return NextResponse.json({ 
        success: true, 
        depositId: depositRecord.id 
      })
    } else {
      console.log('No deposit record created for event:', event.event)
      return NextResponse.json({ success: true, message: 'Event processed' })
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' }, 
      { status: 500 }
    )
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json({ message: 'Paystack webhook endpoint' })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}