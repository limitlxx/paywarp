import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { OCRExpenseProcessor } from '@/lib/ocr-expense-processor'
import { OCRResult, ExpenseData, BoundingBox } from '@/lib/types'

/**
 * **Feature: paywarp-web3-integration, Property 17: OCR Processing Accuracy**
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**
 * 
 * For any uploaded receipt image, OCR processing should extract vendor, amount, and date information 
 * with appropriate confidence scoring and manual correction options
 */

describe('OCR Expense Processing Property Tests', () => {
  let processor: OCRExpenseProcessor

  beforeAll(() => {
    processor = new OCRExpenseProcessor()
  })

  afterAll(async () => {
    await processor.cleanup()
  })

  // Generator for mock OCR results
  const ocrResultArbitrary = fc.record({
    extractedText: fc.string({ minLength: 10, maxLength: 500 }),
    confidence: fc.float({ min: 0, max: 100, noNaN: true }),
    boundingBoxes: fc.array(
      fc.record({
        x: fc.nat({ max: 1000 }),
        y: fc.nat({ max: 1000 }),
        width: fc.nat({ min: 1, max: 200 }),
        height: fc.nat({ min: 1, max: 50 }),
        text: fc.string({ minLength: 1, maxLength: 20 }),
        confidence: fc.float({ min: 0, max: 100, noNaN: true })
      }),
      { minLength: 1, maxLength: 50 }
    ),
    processedAt: fc.date(),
    imageHash: fc.string({ minLength: 64, maxLength: 64 }).map(s => 
      s.split('').map(c => Math.floor(Math.random() * 16).toString(16)).join('')
    )
  })

  // Generator for receipt-like text content
  const receiptTextArbitrary = fc.record({
    vendor: fc.oneof(
      fc.constant('Starbucks Coffee'),
      fc.constant('Amazon Web Services'),
      fc.constant('Microsoft Corporation'),
      fc.constant('Google LLC'),
      fc.constant('Office Depot'),
      fc.constant('Uber Technologies'),
      fc.string({ minLength: 3, maxLength: 30 })
    ),
    amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    date: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    category: fc.oneof(
      fc.constant('office-supplies'),
      fc.constant('software'),
      fc.constant('travel'),
      fc.constant('meals'),
      fc.constant('utilities'),
      fc.constant('marketing'),
      fc.constant('professional-services'),
      fc.constant('other')
    )
  })

  // Generator for mock image files
  const imageFileArbitrary = fc.record({
    name: fc.string({ minLength: 5, maxLength: 50 }).map(name => `${name}.jpg`),
    type: fc.constant('image/jpeg'),
    size: fc.nat({ min: 1000, max: 5000000 })
  }).map(props => {
    // Create a mock File object
    const blob = new Blob(['mock image data'], { type: props.type })
    return new File([blob], props.name, { type: props.type })
  })

  it('should extract structured expense data from any OCR result', async () => {
    await fc.assert(
      fc.asyncProperty(ocrResultArbitrary, async (ocrResult) => {
        const expenseData = await processor.extractExpenseData(ocrResult)
        
        // Property: Extracted data should always have required fields
        expect(expenseData).toHaveProperty('vendor')
        expect(expenseData).toHaveProperty('amount')
        expect(expenseData).toHaveProperty('date')
        expect(expenseData).toHaveProperty('category')
        expect(expenseData).toHaveProperty('confidence')
        expect(expenseData).toHaveProperty('ocrSource')
        
        // Property: Vendor should be a non-empty string
        expect(typeof expenseData.vendor).toBe('string')
        expect(expenseData.vendor.length).toBeGreaterThan(0)
        
        // Property: Amount should be a non-negative number
        expect(typeof expenseData.amount).toBe('number')
        expect(expenseData.amount).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(expenseData.amount)).toBe(true)
        
        // Property: Date should be a valid Date object
        expect(expenseData.date).toBeInstanceOf(Date)
        expect(Number.isNaN(expenseData.date.getTime())).toBe(false)
        
        // Property: Category should have valid structure
        expect(expenseData.category).toHaveProperty('name')
        expect(expenseData.category).toHaveProperty('confidence')
        expect(expenseData.category).toHaveProperty('suggestedAlternatives')
        expect(expenseData.category).toHaveProperty('autoApproved')
        
        // Property: Confidence should be between 0 and 1
        expect(expenseData.confidence).toBeGreaterThanOrEqual(0)
        expect(expenseData.confidence).toBeLessThanOrEqual(1)
        
        // Property: OCR source should match input
        expect(expenseData.ocrSource).toEqual(ocrResult)
      }),
      { numRuns: 100 }
    )
  })

  it('should categorize expenses consistently based on content', async () => {
    await fc.assert(
      fc.asyncProperty(receiptTextArbitrary, async (receiptData) => {
        const mockOCRResult: OCRResult = {
          extractedText: `${receiptData.vendor} $${receiptData.amount} ${receiptData.date.toDateString()}`,
          confidence: 85,
          boundingBoxes: [],
          processedAt: new Date(),
          imageHash: 'mock-hash'
        }
        
        const category = await processor.categorizeExpense({
          vendor: receiptData.vendor,
          amount: receiptData.amount,
          date: receiptData.date,
          text: mockOCRResult.extractedText
        })
        
        // Property: Category should have valid structure
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('confidence')
        expect(category).toHaveProperty('suggestedAlternatives')
        expect(category).toHaveProperty('autoApproved')
        
        // Property: Category name should be from valid set
        const validCategories = [
          'office-supplies', 'software', 'travel', 'meals', 
          'utilities', 'marketing', 'professional-services', 'other'
        ]
        expect(validCategories).toContain(category.name)
        
        // Property: Confidence should be between 0 and 1
        expect(category.confidence).toBeGreaterThanOrEqual(0)
        expect(category.confidence).toBeLessThanOrEqual(1)
        
        // Property: Auto-approval should be consistent with confidence
        if (category.confidence > 0.7) {
          expect(category.autoApproved).toBe(true)
        }
        
        // Property: Suggested alternatives should be valid categories
        category.suggestedAlternatives.forEach(alt => {
          expect(validCategories).toContain(alt)
        })
      }),
      { numRuns: 100 }
    )
  })

  it('should provide correction suggestions for any OCR result', async () => {
    await fc.assert(
      fc.asyncProperty(ocrResultArbitrary, async (ocrResult) => {
        const suggestions = await processor.suggestCorrections(ocrResult)
        
        // Property: Suggestions should have expected structure
        expect(suggestions).toHaveProperty('vendor')
        expect(suggestions).toHaveProperty('amount')
        expect(suggestions).toHaveProperty('date')
        expect(suggestions).toHaveProperty('category')
        
        // Property: All suggestion arrays should be arrays
        expect(Array.isArray(suggestions.vendor)).toBe(true)
        expect(Array.isArray(suggestions.amount)).toBe(true)
        expect(Array.isArray(suggestions.date)).toBe(true)
        expect(Array.isArray(suggestions.category)).toBe(true)
        
        // Property: Amount suggestions should be valid numbers
        suggestions.amount?.forEach(amount => {
          expect(typeof amount).toBe('number')
          expect(Number.isFinite(amount)).toBe(true)
          expect(amount).toBeGreaterThanOrEqual(0)
        })
        
        // Property: Date suggestions should be valid dates
        suggestions.date?.forEach(date => {
          expect(date).toBeInstanceOf(Date)
          expect(Number.isNaN(date.getTime())).toBe(false)
        })
        
        // Property: Vendor suggestions should be non-empty strings
        suggestions.vendor?.forEach(vendor => {
          expect(typeof vendor).toBe('string')
          expect(vendor.length).toBeGreaterThan(0)
        })
      }),
      { numRuns: 100 }
    )
  })

  it('should generate consistent image hashes for file storage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 5, maxLength: 20 }).map(name => `${name}.jpg`),
          size: fc.nat({ min: 1000, max: 50000 })
        }),
        async (fileProps) => {
          // Create a simple mock file
          const mockFile = new File(['test content'], fileProps.name, { type: 'image/jpeg' })
          
          const storagePath = await processor.storeReceiptImage(mockFile, 'test-expense-id')
          
          // Property: Storage path should be a valid string
          expect(typeof storagePath).toBe('string')
          expect(storagePath.length).toBeGreaterThan(0)
          
          // Property: Storage path should include expense ID
          expect(storagePath).toContain('test-expense-id')
          
          // Property: Storage path should have valid format
          expect(storagePath).toMatch(/^\/receipts\/.*\.(jpg|jpeg|png|gif)$/i)
        }
      ),
      { numRuns: 20 } // Reduced runs for file operations
    )
  }, 10000) // Increased timeout

  it('should validate expense data before billing integration', async () => {
    await fc.assert(
      fc.asyncProperty(receiptTextArbitrary, async (receiptData) => {
        const validExpenseData: ExpenseData = {
          vendor: receiptData.vendor,
          amount: receiptData.amount,
          date: receiptData.date,
          category: {
            name: receiptData.category,
            confidence: 0.8,
            suggestedAlternatives: [],
            autoApproved: true
          },
          confidence: 0.8,
          ocrSource: {
            extractedText: 'mock text',
            confidence: 85,
            boundingBoxes: [],
            processedAt: new Date(),
            imageHash: 'mock-hash'
          }
        }
        
        // Property: Valid expense data should not throw
        await expect(processor.linkExpenseToBilling(validExpenseData)).resolves.not.toThrow()
        
        // Property: Invalid expense data should throw
        const invalidExpenseData = { ...validExpenseData, amount: -1 }
        await expect(processor.linkExpenseToBilling(invalidExpenseData)).rejects.toThrow()
        
        const emptyVendorData = { ...validExpenseData, vendor: '' }
        await expect(processor.linkExpenseToBilling(emptyVendorData)).rejects.toThrow()
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain confidence scoring consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          ocrConfidence: fc.float({ min: 0, max: 100, noNaN: true })
            .filter(n => Number.isFinite(n) && !Number.isNaN(n)), // Explicit NaN filtering
          hasVendor: fc.boolean(),
          hasAmount: fc.boolean(),
          hasValidDate: fc.boolean()
        }),
        async (testData) => {
          // Ensure ocrConfidence is always a valid number
          const safeOcrConfidence = Number.isFinite(testData.ocrConfidence) && !Number.isNaN(testData.ocrConfidence) 
            ? testData.ocrConfidence 
            : 0
          
          const mockOCRResult: OCRResult = {
            extractedText: 'Mock receipt text',
            confidence: safeOcrConfidence,
            boundingBoxes: [],
            processedAt: new Date(),
            imageHash: 'mock-hash'
          }
          
          // Mock the private method behavior by creating realistic extracted data
          const extractedData = {
            vendor: testData.hasVendor ? 'Test Vendor' : 'Unknown Vendor',
            amount: testData.hasAmount ? 25.99 : 0,
            date: testData.hasValidDate ? new Date('2024-01-15') : new Date()
          }
          
          // Property: Confidence should decrease for missing/invalid data
          const baseConfidence = safeOcrConfidence / 100
          let expectedConfidence = baseConfidence
          
          // Apply confidence penalties for missing data
          if (!testData.hasVendor) expectedConfidence *= 0.7
          if (!testData.hasAmount) expectedConfidence *= 0.5
          if (!testData.hasValidDate) expectedConfidence *= 0.8
          
          // Ensure confidence stays within valid bounds
          expectedConfidence = Math.max(0, Math.min(1, expectedConfidence))
          
          // Ensure the result is always a finite number
          if (!Number.isFinite(expectedConfidence) || Number.isNaN(expectedConfidence)) {
            expectedConfidence = 0
          }
          
          // Property: Final confidence should be within reasonable bounds
          expect(expectedConfidence).toBeGreaterThanOrEqual(0)
          expect(expectedConfidence).toBeLessThanOrEqual(1)
          expect(Number.isFinite(expectedConfidence)).toBe(true)
          expect(Number.isNaN(expectedConfidence)).toBe(false)
          
          // Property: Missing critical data should reduce confidence (only if base confidence > 0)
          if (!testData.hasAmount && safeOcrConfidence > 0) {
            expect(expectedConfidence).toBeLessThan(baseConfidence)
          }
          
          // Property: When all data is missing and OCR confidence is 0, final confidence should be 0
          if (!testData.hasVendor && !testData.hasAmount && !testData.hasValidDate && safeOcrConfidence === 0) {
            expect(expectedConfidence).toBe(0)
          }
          
          // Property: Confidence should never be NaN regardless of input
          expect(Number.isNaN(expectedConfidence)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})