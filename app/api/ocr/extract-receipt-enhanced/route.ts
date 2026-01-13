import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'  // Updated to modern SDK

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 100

  const record = rateLimitStore.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

function getExtractionPrompt(mode: string) {
  const basePrompt = `
    Analyze this receipt image and extract structured data as JSON only (no additional text or explanations).
    
    Return a JSON object with these fields (use null for missing data):
  `

  const comprehensiveFields = `
    {
      "merchant": "string - business name",
      "total": "number - total amount (numeric value only)",
      "subtotal": "number - subtotal if available",
      "tax": "number - tax amount if available", 
      "tip": "number - tip amount if available",
      "discount": "number - discount amount if available",
      "currency": "string - currency code (USD, NGN, EUR, etc.)",
      "date": "string - date in YYYY-MM-DD format",
      "paymentMethod": "string - payment method if visible",
      "location": {
        "address": "string - street address if available",
        "city": "string - city if available",
        "state": "string - state/province if available", 
        "zipCode": "string - postal code if available",
        "country": "string - country if available"
      },
      "contact": {
        "phone": "string - phone number if available",
        "email": "string - email if available",
        "website": "string - website if available"
      },
      "items": [
        {
          "name": "string - item name",
          "price": "number - item price",
          "quantity": "number - quantity if available"
        }
      ],
      "receiptNumber": "string - receipt/order number if available",
      "cashierName": "string - cashier/server name if available",
      "terminalId": "string - terminal ID if available"
    }
  `

  const basicFields = `
    {
      "merchant": "string - business name",
      "total": "number - total amount",
      "currency": "string - currency code",
      "date": "string - date in YYYY-MM-DD format"
    }
  `

  const fields = mode === 'comprehensive' ? comprehensiveFields : basicFields

  return basePrompt + fields + `
    
    Important rules:
    - Return ONLY valid JSON, no markdown or explanations
    - Use null for any field that cannot be determined
    - For amounts, extract only the numeric value (no currency symbols)
    - For dates, convert to YYYY-MM-DD format
    - If multiple amounts exist, 'total' should be the final amount paid
    - For items array, only include if individual items are clearly visible
    - Be conservative - if unsure about a value, use null rather than guessing
  `
}

function postProcessGeminiResponse(data: any) {
  // Ensure required fields exist
  const processed = {
    merchant: data.merchant || data.vendor || null,
    total: parseFloat(data.total) || 0,
    subtotal: data.subtotal ? parseFloat(data.subtotal) : null,
    tax: data.tax ? parseFloat(data.tax) : null,
    tip: data.tip ? parseFloat(data.tip) : null,
    discount: data.discount ? parseFloat(data.discount) : null,
    currency: data.currency || 'USD',
    date: data.date || new Date().toISOString().split('T')[0],
    paymentMethod: data.paymentMethod || null,
    location: data.location || null,
    contact: data.contact || null,
    items: Array.isArray(data.items) ? data.items.map((item: any) => ({
      name: item.name || '',
      price: parseFloat(item.price) || 0,
      quantity: item.quantity ? parseInt(item.quantity) : null
    })) : null,
    receiptNumber: data.receiptNumber || null,
    cashierName: data.cashierName || null,
    terminalId: data.terminalId || null
  }

  // Validate amounts
  if (processed.total <= 0) {
    processed.total = 0
  }

  // Validate date
  const dateObj = new Date(processed.date)
  if (isNaN(dateObj.getTime())) {
    processed.date = new Date().toISOString().split('T')[0]
  }

  // Clean up location object
  if (processed.location && Object.values(processed.location).every(v => !v)) {
    processed.location = null
  }

  // Clean up contact object  
  if (processed.contact && Object.values(processed.contact).every(v => !v)) {
    processed.contact = null
  }

  // Remove empty items
  if (processed.items && processed.items.length === 0) {
    processed.items = null
  }

  return processed
}

function calculateGeminiConfidence(data: any): number {
  let score = 0
  let maxScore = 0

  // Core fields (high weight)
  maxScore += 30
  if (data.merchant && data.merchant !== 'null') score += 10
  if (data.total > 0) score += 15
  if (data.date) score += 5

  // Extended fields (medium weight)
  maxScore += 20
  if (data.currency) score += 3
  if (data.subtotal) score += 3
  if (data.tax) score += 3
  if (data.paymentMethod) score += 3
  if (data.receiptNumber) score += 3
  if (data.items && data.items.length > 0) score += 5

  // Location/contact (low weight)
  maxScore += 10
  if (data.location) score += 5
  if (data.contact) score += 5

  // Validation checks
  maxScore += 40
  if (data.merchant && data.merchant.length > 2) score += 10
  if (data.total > 0 && data.total < 10000) score += 15 // Reasonable amount
  if (isValidDate(data.date)) score += 10
  if (data.items && data.items.length > 0 && data.items.every((item: any) => item.name && item.price > 0)) score += 5

  return Math.min(score / maxScore, 1.0)
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString)
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  return !isNaN(date.getTime()) && date >= oneYearAgo && date <= oneWeekFromNow
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting - NextRequest doesn't have ip property
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIp || 'unknown'
    
    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests from this IP, please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { imageBase64, mimeType = 'image/jpeg', extractionMode = 'comprehensive' } = body

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Initialize modern Gemini SDK
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    
    const prompt = getExtractionPrompt(extractionMode)

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',  // Stable model - best for price-performance and low-latency
      contents: [
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        {
          text: prompt,
        },
      ],
    })

    let jsonResponse = response.text || ''

    // Clean up response - remove markdown formatting if present
    jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Try to parse the JSON
    let parsed
    try {
      parsed = JSON.parse(jsonResponse)
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Invalid JSON response from Gemini')
      }
    }

    // Post-process and validate the response
    const processedData = postProcessGeminiResponse(parsed)

    return NextResponse.json({
      success: true,
      structuredData: processedData,
      confidence: calculateGeminiConfidence(processedData),
      extractionMode,
      processedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Gemini extraction error:', error)
    
    // Return structured error response
    return NextResponse.json(
      { 
        success: false,
        error: 'Extraction failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        fallbackSuggested: true
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  })
}