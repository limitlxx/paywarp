import { NextRequest, NextResponse } from 'next/server'

// Legacy endpoint for backward compatibility
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Redirect to enhanced endpoint with basic mode
    const enhancedRequest = new Request(
      new URL('/api/ocr/extract-receipt-enhanced', request.url),
      {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
          ...body,
          extractionMode: 'basic'
        })
      }
    )

    // Import the enhanced route handler
    const { POST: enhancedHandler } = await import('../extract-receipt-enhanced/route')
    return enhancedHandler(enhancedRequest as NextRequest)

  } catch (error) {
    console.error('Legacy OCR endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Processing failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Legacy OCR endpoint - use /api/ocr/extract-receipt-enhanced for full features',
    timestamp: new Date().toISOString()
  })
}