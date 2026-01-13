import { createWorker } from 'tesseract.js'
import { 
  OCRResult, 
  ExpenseData, 
  ExpenseCategory, 
  CorrectionSuggestions,
  BoundingBox 
} from './types'

export type OCRMode = 'gemini' | 'tesseract' | 'hybrid'

export interface GeminiOCRResult extends OCRResult {
  structuredData?: {
    merchant?: string
    total?: number
    subtotal?: number
    tax?: number
    date?: string
    items?: Array<{
      name: string
      price: number
      quantity?: number
    }>
    currency?: string
    paymentMethod?: string
    location?: string
    phone?: string
    email?: string
  }
}

export interface DynamicReceiptData {
  // Core fields (always extracted)
  vendor: string
  amount: number
  date: Date
  
  // Extended fields (dynamically extracted based on receipt type)
  subtotal?: number
  tax?: number
  tip?: number
  discount?: number
  currency: string
  paymentMethod?: string
  
  // Location data
  location?: {
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  
  // Contact info
  contact?: {
    phone?: string
    email?: string
    website?: string
  }
  
  // Items (for detailed receipts)
  items?: Array<{
    name: string
    price: number
    quantity?: number
    category?: string
    sku?: string
  }>
  
  // Receipt metadata
  receiptNumber?: string
  cashierName?: string
  terminalId?: string
  
  // Business classification
  businessType?: 'restaurant' | 'retail' | 'gas-station' | 'grocery' | 'pharmacy' | 'service' | 'other'
  
  // Confidence and validation
  confidence: number
  validationFlags: {
    amountMatches: boolean
    dateReasonable: boolean
    vendorIdentified: boolean
    structureValid: boolean
  }
}

export class EnhancedOCRProcessor {
  private tesseractWorker: Tesseract.Worker | null = null
  private isInitialized = false
  private apiBaseUrl: string

  constructor(apiBaseUrl: string = '/api/ocr') {
    this.apiBaseUrl = apiBaseUrl
  }

  /**
   * Process receipt with the specified OCR mode
   */
  async processReceipt(
    imageFile: File, 
    mode: OCRMode = 'hybrid'
  ): Promise<DynamicReceiptData> {
    switch (mode) {
      case 'gemini':
        return this.processWithGemini(imageFile)
      case 'tesseract':
        return this.processWithTesseract(imageFile)
      case 'hybrid':
        return this.processWithHybrid(imageFile)
      default:
        throw new Error(`Unsupported OCR mode: ${mode}`)
    }
  }

  /**
   * Process with Gemini API (server-side, high accuracy)
   */
  private async processWithGemini(imageFile: File): Promise<DynamicReceiptData> {
    try {
      const base64 = await this.fileToBase64(imageFile)
      const mimeType = imageFile.type || 'image/jpeg'

      const response = await fetch(`${this.apiBaseUrl}/extract-receipt-enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: base64.split(',')[1], 
          mimeType,
          extractionMode: 'comprehensive'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Gemini API error: ${response.statusText} - ${errorData.details || ''}`)
      }

      const geminiResult = await response.json()
      
      if (!geminiResult.success) {
        throw new Error(geminiResult.details || 'Gemini processing failed')
      }
      
      return this.normalizeGeminiResult(geminiResult)
    } catch (error) {
      console.error('Gemini processing failed:', error)
      // Fallback to Tesseract
      return this.processWithTesseract(imageFile)
    }
  }

  /**
   * Process with Tesseract.js (client-side, offline)
   */
  private async processWithTesseract(imageFile: File): Promise<DynamicReceiptData> {
    await this.initializeTesseract()
    
    if (!this.tesseractWorker) {
      throw new Error('Tesseract worker not initialized')
    }

    try {
      const { data } = await this.tesseractWorker.recognize(imageFile)
      
      const ocrResult: OCRResult = {
        extractedText: data.text,
        confidence: data.confidence,
        boundingBoxes: this.extractBoundingBoxes(data),
        processedAt: new Date(),
        imageHash: await this.generateImageHash(imageFile)
      }

      return this.extractDynamicData(ocrResult)
    } catch (error) {
      throw new Error(`Tesseract processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Hybrid approach: Try Gemini first, enhance with Tesseract if needed
   */
  private async processWithHybrid(imageFile: File): Promise<DynamicReceiptData> {
    try {
      // First, try Gemini for structured extraction
      const geminiResult = await this.processWithGemini(imageFile)
      
      // If confidence is low, enhance with Tesseract
      if (geminiResult.confidence < 0.8) {
        const tesseractResult = await this.processWithTesseract(imageFile)
        return this.mergeResults(geminiResult, tesseractResult)
      }
      
      return geminiResult
    } catch (error) {
      console.error('Hybrid processing failed, falling back to Tesseract:', error)
      return this.processWithTesseract(imageFile)
    }
  }

  /**
   * Extract dynamic data from OCR text using advanced patterns
   */
  private extractDynamicData(ocrResult: OCRResult): DynamicReceiptData {
    const text = ocrResult.extractedText
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Extract core data
    const vendor = this.extractVendorAdvanced(lines, ocrResult.boundingBoxes)
    const amount = this.extractAmountAdvanced(text, lines)
    const date = this.extractDateAdvanced(text, lines)
    
    // Extract extended data
    const subtotal = this.extractSubtotal(text, lines)
    const tax = this.extractTax(text, lines)
    const tip = this.extractTip(text, lines)
    const discount = this.extractDiscount(text, lines)
    const currency = this.extractCurrency(text)
    const paymentMethod = this.extractPaymentMethod(text, lines)
    
    // Extract location and contact info
    const location = this.extractLocation(lines)
    const contact = this.extractContact(lines)
    
    // Extract items (for detailed receipts)
    const items = this.extractItems(lines)
    
    // Extract receipt metadata
    const receiptNumber = this.extractReceiptNumber(text, lines)
    const cashierName = this.extractCashierName(lines)
    const terminalId = this.extractTerminalId(text, lines)
    
    // Classify business type
    const businessType = this.classifyBusinessType(vendor, text, items)
    
    // Validate extracted data
    const validationFlags = this.validateExtractedData({
      vendor, amount, date, subtotal, tax, items
    })
    
    // Calculate overall confidence
    const confidence = this.calculateDynamicConfidence(
      ocrResult, 
      { vendor, amount, date }, 
      validationFlags
    )

    return {
      vendor,
      amount,
      date,
      subtotal,
      tax,
      tip,
      discount,
      currency,
      paymentMethod,
      location,
      contact,
      items,
      receiptNumber,
      cashierName,
      terminalId,
      businessType,
      confidence,
      validationFlags
    }
  }

  /**
   * Advanced vendor extraction using multiple strategies
   */
  private extractVendorAdvanced(lines: string[], boundingBoxes: BoundingBox[]): string {
    // Strategy 1: Look at the top of the receipt
    const topLines = lines.slice(0, 5)
    for (const line of topLines) {
      const cleaned = this.cleanText(line)
      if (cleaned.length > 2 && cleaned.length < 50 && /^[A-Z]/.test(cleaned)) {
        // Check if it's not a common receipt header
        if (!this.isCommonReceiptHeader(cleaned)) {
          return cleaned
        }
      }
    }
    
    // Strategy 2: Look for business name patterns
    const businessPatterns = [
      /^([A-Z][A-Za-z\s&'.-]+(?:LLC|INC|CORP|LTD|CO\.?)?)$/i,
      /^([A-Z][A-Za-z\s]+(?:RESTAURANT|CAFE|STORE|SHOP|MARKET|PHARMACY))$/i,
      /^([A-Z][A-Za-z\s]+(?:GAS|STATION|FUEL))$/i
    ]
    
    for (const line of lines) {
      for (const pattern of businessPatterns) {
        const match = line.match(pattern)
        if (match) {
          return this.cleanText(match[1])
        }
      }
    }
    
    // Strategy 3: Use bounding box positions (top area)
    const topBoxes = boundingBoxes
      .filter(box => box.y < 150 && box.confidence > 70)
      .sort((a, b) => a.y - b.y)
    
    if (topBoxes.length > 0) {
      const topText = topBoxes.slice(0, 3).map(box => box.text).join(' ')
      const cleaned = this.cleanText(topText)
      if (cleaned.length > 2) {
        return cleaned
      }
    }
    
    return 'Unknown Vendor'
  }

  /**
   * Advanced amount extraction with multiple currency support
   */
  private extractAmountAdvanced(text: string, lines: string[]): number {
    const amountPatterns = [
      // Total patterns
      /total[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /amount[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /balance[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      
      // Currency-specific patterns
      /\$\s*(\d+[.,]\d{2})/g,
      /₦\s*(\d+[.,]\d{2})/g,
      /€\s*(\d+[.,]\d{2})/g,
      /£\s*(\d+[.,]\d{2})/g,
      
      // End-of-line patterns (common for totals)
      /(\d+[.,]\d{2})\s*$/gm,
      
      // Standalone large amounts
      /^[$₦€£¥]?\s*(\d+[.,]\d{2})$/gm
    ]

    const foundAmounts: number[] = []
    
    for (const pattern of amountPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        for (const match of matches) {
          const numMatch = match.match(/(\d+[.,]\d{2})/)
          if (numMatch) {
            const amount = parseFloat(numMatch[1].replace(',', '.'))
            if (amount > 0 && amount < 100000) { // Reasonable range
              foundAmounts.push(amount)
            }
          }
        }
      }
    }
    
    if (foundAmounts.length === 0) return 0
    
    // Return the largest amount (likely the total)
    return Math.max(...foundAmounts)
  }

  /**
   * Extract subtotal, tax, tip, discount
   */
  private extractSubtotal(text: string, lines: string[]): number | undefined {
    const patterns = [
      /subtotal[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /sub[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi
    ]
    return this.extractAmountByPatterns(text, patterns)
  }

  private extractTax(text: string, lines: string[]): number | undefined {
    const patterns = [
      /tax[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /vat[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /gst[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi
    ]
    return this.extractAmountByPatterns(text, patterns)
  }

  private extractTip(text: string, lines: string[]): number | undefined {
    const patterns = [
      /tip[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /gratuity[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /service[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi
    ]
    return this.extractAmountByPatterns(text, patterns)
  }

  private extractDiscount(text: string, lines: string[]): number | undefined {
    const patterns = [
      /discount[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /savings[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi,
      /off[:\s]*[$₦€£¥]?\s*(\d+[.,]\d{2})/gi
    ]
    return this.extractAmountByPatterns(text, patterns)
  }

  /**
   * Extract payment method from text
  

  /**
   * Extract payment method from text
   */
  private extractPaymentMethod(text: string, lines: string[]): string | undefined {
    const paymentPatterns = [
      /cash/gi,
      /credit\s*card/gi,
      /debit\s*card/gi,
      /visa/gi,
      /mastercard/gi,
      /amex/gi,
      /american\s*express/gi,
      /discover/gi,
      /paypal/gi,
      /apple\s*pay/gi,
      /google\s*pay/gi,
      /samsung\s*pay/gi,
      /contactless/gi,
      /chip/gi,
      /tap/gi
    ]

    for (const line of lines) {
      for (const pattern of paymentPatterns) {
        const match = line.match(pattern)
        if (match) {
          return match[0].toLowerCase().replace(/\s+/g, ' ').trim()
        }
      }
    }

    // Look for card number patterns (last 4 digits)
    const cardMatch = text.match(/\*{4,}\d{4}|\d{4}\s*\*{4,}|ending\s*in\s*\d{4}/gi)
    if (cardMatch) {
      return 'card'
    }

    return undefined
  }

  /**
   * Extract currency from text
   */
  private extractCurrency(text: string): string {
    const currencySymbols = {
      '$': 'USD',
      '₦': 'NGN',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY'
    }
    
    for (const [symbol, currency] of Object.entries(currencySymbols)) {
      if (text.includes(symbol)) {
        return currency
      }
    }
    
    // Look for currency codes
    const currencyMatch = text.match(/\b(USD|NGN|EUR|GBP|JPY|CAD|AUD)\b/i)
    if (currencyMatch) {
      return currencyMatch[1].toUpperCase()
    }
    
    return 'USD' // Default
  }

  /**
   * Extract items from receipt
   */
  private extractItems(lines: string[]): Array<{name: string, price: number, quantity?: number}> | undefined {
    const items: Array<{name: string, price: number, quantity?: number}> = []
    
    for (const line of lines) {
      // Pattern: Item name followed by price
      const itemMatch = line.match(/^(.+?)\s+[$₦€£¥]?\s*(\d+[.,]\d{2})$/i)
      if (itemMatch) {
        const name = this.cleanText(itemMatch[1])
        const price = parseFloat(itemMatch[2].replace(',', '.'))
        
        // Skip if it looks like a total/subtotal line
        if (!this.isAmountLine(name)) {
          // Check for quantity
          const qtyMatch = name.match(/^(\d+)\s*x?\s*(.+)$/i)
          if (qtyMatch) {
            items.push({
              name: this.cleanText(qtyMatch[2]),
              price,
              quantity: parseInt(qtyMatch[1])
            })
          } else {
            items.push({ name, price })
          }
        }
      }
    }
    
    return items.length > 0 ? items : undefined
  }

  /**
   * Classify business type based on vendor name and content
   */
  private classifyBusinessType(
    vendor: string, 
    text: string, 
    items?: Array<{name: string, price: number}>
  ): DynamicReceiptData['businessType'] {
    const content = `${vendor} ${text}`.toLowerCase()
    
    const classifications = {
      'restaurant': ['restaurant', 'cafe', 'bar', 'grill', 'bistro', 'diner', 'pizza', 'burger', 'food'],
      'retail': ['store', 'shop', 'retail', 'boutique', 'outlet', 'mall'],
      'gas-station': ['gas', 'fuel', 'station', 'shell', 'exxon', 'bp', 'chevron'],
      'grocery': ['grocery', 'market', 'supermarket', 'walmart', 'target', 'kroger'],
      'pharmacy': ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'drug', 'medical'],
      'service': ['service', 'repair', 'maintenance', 'cleaning', 'salon', 'spa']
    }
    
    for (const [type, keywords] of Object.entries(classifications)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return type as DynamicReceiptData['businessType']
      }
    }
    
    return 'other'
  }

  // Helper methods
  private async initializeTesseract(): Promise<void> {
    if (this.isInitialized && this.tesseractWorker) return

    this.tesseractWorker = await createWorker('eng')
    this.isInitialized = true
  }

  private extractBoundingBoxes(data: any): BoundingBox[] {
    const boundingBoxes: BoundingBox[] = []
    
    if (data.blocks) {
      data.blocks.forEach((block: any) => {
        if (block.paragraphs) {
          block.paragraphs.forEach((paragraph: any) => {
            if (paragraph.words) {
              paragraph.words.forEach((word: any) => {
                if (word.bbox) {
                  boundingBoxes.push({
                    x: word.bbox.x0,
                    y: word.bbox.y0,
                    width: word.bbox.x1 - word.bbox.x0,
                    height: word.bbox.y1 - word.bbox.y0,
                    text: word.text,
                    confidence: word.confidence
                  })
                }
              })
            }
          })
        }
      })
    }
    
    return boundingBoxes
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  private normalizeGeminiResult(geminiResult: any): DynamicReceiptData {
    // Convert Gemini's structured response to our format
    const data = geminiResult.structuredData || geminiResult
    
    return {
      vendor: data.merchant || data.vendor || 'Unknown Vendor',
      amount: data.total || data.total_amount || 0,
      date: data.date ? new Date(data.date) : new Date(),
      subtotal: data.subtotal,
      tax: data.tax,
      tip: data.tip,
      discount: data.discount,
      currency: data.currency || 'USD',
      paymentMethod: data.paymentMethod,
      location: data.location ? {
        address: data.location.address,
        city: data.location.city,
        state: data.location.state,
        zipCode: data.location.zipCode,
        country: data.location.country
      } : undefined,
      contact: data.contact ? {
        phone: data.contact.phone,
        email: data.contact.email,
        website: data.contact.website
      } : undefined,
      items: data.items,
      receiptNumber: data.receiptNumber,
      cashierName: data.cashierName,
      terminalId: data.terminalId,
      businessType: this.classifyBusinessType(
        data.merchant || data.vendor || '', 
        JSON.stringify(data), 
        data.items
      ),
      confidence: geminiResult.confidence || 0.9,
      validationFlags: {
        amountMatches: true,
        dateReasonable: true,
        vendorIdentified: !!(data.merchant || data.vendor),
        structureValid: true
      }
    }
  }

  private mergeResults(
    geminiResult: DynamicReceiptData, 
    tesseractResult: DynamicReceiptData
  ): DynamicReceiptData {
    // Merge results, preferring higher confidence values
    return {
      vendor: geminiResult.confidence > tesseractResult.confidence ? 
        geminiResult.vendor : tesseractResult.vendor,
      amount: geminiResult.amount || tesseractResult.amount,
      date: geminiResult.date,
      subtotal: geminiResult.subtotal || tesseractResult.subtotal,
      tax: geminiResult.tax || tesseractResult.tax,
      tip: geminiResult.tip || tesseractResult.tip,
      discount: geminiResult.discount || tesseractResult.discount,
      currency: geminiResult.currency,
      paymentMethod: geminiResult.paymentMethod || tesseractResult.paymentMethod,
      location: geminiResult.location,
      contact: geminiResult.contact,
      items: geminiResult.items || tesseractResult.items,
      receiptNumber: geminiResult.receiptNumber || tesseractResult.receiptNumber,
      cashierName: geminiResult.cashierName || tesseractResult.cashierName,
      terminalId: geminiResult.terminalId || tesseractResult.terminalId,
      businessType: geminiResult.businessType,
      confidence: Math.max(geminiResult.confidence, tesseractResult.confidence),
      validationFlags: {
        amountMatches: geminiResult.validationFlags.amountMatches && tesseractResult.validationFlags.amountMatches,
        dateReasonable: geminiResult.validationFlags.dateReasonable || tesseractResult.validationFlags.dateReasonable,
        vendorIdentified: geminiResult.validationFlags.vendorIdentified || tesseractResult.validationFlags.vendorIdentified,
        structureValid: geminiResult.validationFlags.structureValid || tesseractResult.validationFlags.structureValid
      }
    }
  }

  private extractAmountByPatterns(text: string, patterns: RegExp[]): number | undefined {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const numMatch = match[0].match(/(\d+[.,]\d{2})/)
        if (numMatch) {
          return parseFloat(numMatch[1].replace(',', '.'))
        }
      }
    }
    return undefined
  }

  private extractDateAdvanced(text: string, lines: string[]): Date {
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,
      /(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{2,4})/gi,
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})/gi
    ]

    for (const pattern of datePatterns) {
      const match = text.match(pattern)
      if (match) {
        const dateStr = match[0]
        const parsedDate = new Date(dateStr)
        if (!isNaN(parsedDate.getTime()) && this.isReasonableDate(parsedDate)) {
          return parsedDate
        }
      }
    }

    return new Date() // Default to current date
  }

  private extractLocation(lines: string[]): DynamicReceiptData['location'] | undefined {
    // Look for address patterns
    for (const line of lines) {
      // Address pattern: number + street name
      const addressMatch = line.match(/^\d+\s+[A-Za-z\s]+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court)/i)
      if (addressMatch) {
        return { address: line.trim() }
      }
      
      // City, State ZIP pattern
      const cityStateMatch = line.match(/^([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i)
      if (cityStateMatch) {
        return {
          city: cityStateMatch[1].trim(),
          state: cityStateMatch[2],
          zipCode: cityStateMatch[3]
        }
      }
    }
    
    return undefined
  }

  private extractContact(lines: string[]): DynamicReceiptData['contact'] | undefined {
    const contact: DynamicReceiptData['contact'] = {}
    
    for (const line of lines) {
      // Phone pattern
      const phoneMatch = line.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i)
      if (phoneMatch) {
        contact.phone = phoneMatch[1]
      }
      
      // Email pattern
      const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      if (emailMatch) {
        contact.email = emailMatch[1]
      }
      
      // Website pattern
      const websiteMatch = line.match(/(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9.-]+\.com)/i)
      if (websiteMatch) {
        contact.website = websiteMatch[1]
      }
    }
    
    return Object.keys(contact).length > 0 ? contact : undefined
  }

  private extractReceiptNumber(text: string, lines: string[]): string | undefined {
    const patterns = [
      /receipt[#:\s]*(\w+)/gi,
      /order[#:\s]*(\w+)/gi,
      /transaction[#:\s]*(\w+)/gi,
      /#(\w+)/g
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1]
      }
    }
    
    return undefined
  }

  private extractCashierName(lines: string[]): string | undefined {
    for (const line of lines) {
      const cashierMatch = line.match(/cashier[:\s]+([A-Za-z\s]+)/gi)
      if (cashierMatch) {
        return cashierMatch[1].trim()
      }
      
      const serverMatch = line.match(/server[:\s]+([A-Za-z\s]+)/gi)
      if (serverMatch) {
        return serverMatch[1].trim()
      }
    }
    
    return undefined
  }

  private extractTerminalId(text: string, lines: string[]): string | undefined {
    const terminalMatch = text.match(/terminal[#:\s]*(\w+)/gi)
    if (terminalMatch) {
      return terminalMatch[1]
    }
    
    return undefined
  }

  private validateExtractedData(data: any): DynamicReceiptData['validationFlags'] {
    return {
      amountMatches: data.amount > 0,
      dateReasonable: this.isReasonableDate(data.date),
      vendorIdentified: data.vendor !== 'Unknown Vendor',
      structureValid: !!(data.vendor && data.amount && data.date)
    }
  }

  private calculateDynamicConfidence(
    ocrResult: OCRResult, 
    extracted: any, 
    validationFlags: DynamicReceiptData['validationFlags']
  ): number {
    let confidence = ocrResult.confidence / 100
    
    // Adjust based on validation flags
    if (!validationFlags.vendorIdentified) confidence *= 0.7
    if (!validationFlags.amountMatches) confidence *= 0.5
    if (!validationFlags.dateReasonable) confidence *= 0.8
    if (!validationFlags.structureValid) confidence *= 0.6
    
    return Math.max(0, Math.min(1, confidence))
  }

  private cleanText(text: string): string {
    return text.trim().replace(/[^\w\s&'.-]/g, '').replace(/\s+/g, ' ')
  }

  private isCommonReceiptHeader(text: string): boolean {
    const headers = ['receipt', 'invoice', 'bill', 'order', 'transaction', 'copy', 'customer']
    return headers.some(header => text.toLowerCase().includes(header))
  }

  private isAmountLine(text: string): boolean {
    const amountKeywords = ['total', 'subtotal', 'tax', 'tip', 'discount', 'amount', 'balance']
    return amountKeywords.some(keyword => text.toLowerCase().includes(keyword))
  }

  private isReasonableDate(date: Date): boolean {
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    return date >= oneYearAgo && date <= oneWeekFromNow
  }

  private async generateImageHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async cleanup(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate()
      this.tesseractWorker = null
      this.isInitialized = false
    }
  }
}

// Export singleton instance
export const enhancedOCRProcessor = new EnhancedOCRProcessor()