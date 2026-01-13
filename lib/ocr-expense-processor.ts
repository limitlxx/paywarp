import { createWorker } from 'tesseract.js'
import { 
  OCRResult, 
  ExpenseData, 
  ExpenseCategory, 
  CorrectionSuggestions,
  BoundingBox 
} from './types'

export class OCRExpenseProcessor {
  private worker: Tesseract.Worker | null = null
  private isInitialized = false

  /**
   * Initialize the OCR worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.isInitialized && this.worker) return

    this.worker = await createWorker('eng')
    this.isInitialized = true
  }

  /**
   * Process receipt image using OCR to extract text and bounding boxes
   */
  async processReceipt(imageFile: File): Promise<OCRResult> {
    await this.initializeWorker()
    
    if (!this.worker) {
      throw new Error('OCR worker not initialized')
    }

    try {
      const { data } = await this.worker.recognize(imageFile)
      
      // Extract bounding boxes from OCR data
      const boundingBoxes: BoundingBox[] = []
      
      // Tesseract.js provides word-level data in different structure
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

      // Generate image hash for storage reference
      const imageHash = await this.generateImageHash(imageFile)

      return {
        extractedText: data.text,
        confidence: data.confidence,
        boundingBoxes,
        processedAt: new Date(),
        imageHash
      }
    } catch (error) {
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract structured expense data from OCR text
   */
  async extractExpenseData(ocrResult: OCRResult): Promise<ExpenseData> {
    const text = ocrResult.extractedText.toLowerCase()
    
    // Extract vendor name (usually at the top of receipt)
    const vendor = this.extractVendor(ocrResult)
    
    // Extract amount (look for currency symbols and numbers)
    const amount = this.extractAmount(text, ocrResult.boundingBoxes)
    
    // Extract date (look for date patterns)
    const date = this.extractDate(text, ocrResult.boundingBoxes)
    
    // Categorize the expense
    const category = await this.categorizeExpense({ vendor, amount, date, text })

    return {
      vendor,
      amount,
      date,
      category,
      confidence: this.calculateOverallConfidence(ocrResult, { vendor, amount, date }),
      ocrSource: ocrResult
    }
  }

  /**
   * Categorize expense based on vendor and content
   */
  async categorizeExpense(data: { vendor: string; amount: number; date: Date; text: string }): Promise<ExpenseCategory> {
    const categories = {
      'office-supplies': ['office', 'supplies', 'staples', 'paper', 'pen', 'printer'],
      'software': ['software', 'subscription', 'saas', 'license', 'adobe', 'microsoft'],
      'travel': ['hotel', 'flight', 'uber', 'taxi', 'airbnb', 'booking'],
      'meals': ['restaurant', 'food', 'coffee', 'lunch', 'dinner', 'cafe'],
      'utilities': ['electric', 'gas', 'water', 'internet', 'phone', 'utility'],
      'marketing': ['advertising', 'marketing', 'facebook', 'google ads', 'promotion'],
      'professional-services': ['legal', 'accounting', 'consulting', 'professional'],
      'other': []
    }

    const text = `${data.vendor} ${data.text}`.toLowerCase()
    let bestMatch = 'other'
    let bestScore = 0
    const alternatives: string[] = []

    for (const [category, keywords] of Object.entries(categories)) {
      if (category === 'other') continue
      
      const score = keywords.reduce((acc, keyword) => {
        return acc + (text.includes(keyword) ? 1 : 0)
      }, 0)

      if (score > bestScore) {
        if (bestScore > 0) alternatives.push(bestMatch)
        bestMatch = category
        bestScore = score
      } else if (score > 0) {
        alternatives.push(category)
      }
    }

    const confidence = Math.min(bestScore / 3, 1) // Normalize confidence
    
    return {
      name: bestMatch,
      confidence,
      suggestedAlternatives: alternatives.slice(0, 3),
      autoApproved: confidence > 0.7
    }
  }

  /**
   * Suggest corrections for OCR results
   */
  async suggestCorrections(ocrResult: OCRResult): Promise<CorrectionSuggestions> {
    const expenseData = await this.extractExpenseData(ocrResult)
    
    return {
      vendor: this.suggestVendorCorrections(expenseData.vendor, ocrResult),
      amount: this.suggestAmountCorrections(expenseData.amount, ocrResult),
      date: this.suggestDateCorrections(expenseData.date, ocrResult),
      category: expenseData.category.suggestedAlternatives
    }
  }

  /**
   * Store receipt image and return storage path
   */
  async storeReceiptImage(imageFile: File, expenseId: string): Promise<string> {
    // In a real implementation, this would upload to cloud storage
    // For now, we'll simulate storage and return a path
    const timestamp = Date.now()
    const extension = imageFile.name.split('.').pop() || 'jpg'
    const storagePath = `/receipts/${expenseId}_${timestamp}.${extension}`
    
    // Simulate storage delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return storagePath
  }

  /**
   * Link processed expense to billing bucket tracking
   */
  async linkExpenseToBilling(expense: ExpenseData): Promise<void> {
    // This would integrate with the billing bucket system
    // For now, we'll just validate the expense data
    if (!expense.vendor || expense.amount <= 0 || !expense.date) {
      throw new Error('Invalid expense data for billing integration')
    }
    
    // In a real implementation, this would:
    // 1. Add expense to billing bucket tracking
    // 2. Update bucket balance if auto-pay is enabled
    // 3. Create transaction record
    // 4. Trigger UI updates
  }

  /**
   * Clean up OCR worker resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      this.isInitialized = false
    }
  }

  // Private helper methods

  private extractVendor(ocrResult: OCRResult): string {
    // Look for vendor name in the top portion of the receipt
    const topBoxes = ocrResult.boundingBoxes
      .filter(box => box.y < 100) // Top 100 pixels
      .sort((a, b) => a.y - b.y)
    
    if (topBoxes.length > 0) {
      // Take the first few words as potential vendor name
      const vendorWords = topBoxes.slice(0, 3).map(box => box.text).join(' ')
      const cleanedVendor = this.cleanText(vendorWords)
      if (cleanedVendor.length > 0) {
        return cleanedVendor
      }
    }
    
    // Fallback: look for any meaningful text in the OCR result
    const meaningfulText = this.cleanText(ocrResult.extractedText)
    if (meaningfulText.length > 0) {
      const words = meaningfulText.split(' ').filter(word => word.length > 2)
      if (words.length > 0) {
        return words[0]
      }
    }
    
    return 'Unknown Vendor'
  }

  private extractAmount(text: string, boundingBoxes: BoundingBox[]): number {
    // Look for currency patterns
    const currencyPatterns = [
      /\$\s*(\d+\.?\d*)/g,
      /(\d+\.?\d*)\s*usd/gi,
      /total[:\s]*\$?\s*(\d+\.?\d*)/gi,
      /amount[:\s]*\$?\s*(\d+\.?\d*)/gi
    ]

    for (const pattern of currencyPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        const amounts = matches.map(match => {
          const numMatch = match.match(/(\d+\.?\d*)/)
          return numMatch ? parseFloat(numMatch[1]) : 0
        }).filter(amount => amount > 0)
        
        if (amounts.length > 0) {
          // Return the largest amount found (likely the total)
          return Math.max(...amounts)
        }
      }
    }

    return 0
  }

  private extractDate(text: string, boundingBoxes: BoundingBox[]): Date {
    // Look for date patterns
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,
      /(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})[,\s]+(\d{2,4})/gi
    ]

    for (const pattern of datePatterns) {
      const match = text.match(pattern)
      if (match) {
        const dateStr = match[0]
        const parsedDate = new Date(dateStr)
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate
        }
      }
    }

    // Default to current date if no date found
    return new Date()
  }

  private calculateOverallConfidence(ocrResult: OCRResult, extracted: { vendor: string; amount: number; date: Date }): number {
    let confidence = ocrResult.confidence / 100 // Normalize to 0-1
    
    // Reduce confidence if key data is missing or suspicious
    if (extracted.vendor === 'Unknown Vendor') confidence *= 0.7
    if (extracted.amount === 0) confidence *= 0.5
    if (extracted.date.getTime() === new Date().setHours(0, 0, 0, 0)) confidence *= 0.8
    
    return Math.max(0, Math.min(1, confidence))
  }

  private suggestVendorCorrections(vendor: string, ocrResult: OCRResult): string[] {
    // Look for alternative vendor names in the OCR text
    const alternatives: string[] = []
    const words = ocrResult.extractedText.split(/\s+/)
    
    // Find capitalized words that might be vendor names
    const capitalizedWords = words.filter(word => 
      word.length > 2 && word[0] === word[0].toUpperCase()
    )
    
    alternatives.push(...capitalizedWords.slice(0, 3))
    return alternatives.filter(alt => alt !== vendor)
  }

  private suggestAmountCorrections(amount: number, ocrResult: OCRResult): number[] {
    const text = ocrResult.extractedText
    const alternatives: number[] = []
    
    // Find all numbers that could be amounts
    const numberMatches = text.match(/\d+\.?\d*/g)
    if (numberMatches) {
      const numbers = numberMatches
        .map(match => parseFloat(match))
        .filter(num => num > 0 && num !== amount && num < 10000) // Reasonable expense range
        .slice(0, 3)
      
      alternatives.push(...numbers)
    }
    
    return alternatives
  }

  private suggestDateCorrections(date: Date, ocrResult: OCRResult): Date[] {
    // For now, suggest dates within a reasonable range
    const alternatives: Date[] = []
    const today = new Date()
    
    // Suggest yesterday and day before
    alternatives.push(new Date(today.getTime() - 24 * 60 * 60 * 1000))
    alternatives.push(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000))
    
    return alternatives.filter(alt => alt.getTime() !== date.getTime())
  }

  private cleanText(text: string): string {
    return text.trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
  }

  private async generateImageHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

// Export singleton instance
export const ocrProcessor = new OCRExpenseProcessor()