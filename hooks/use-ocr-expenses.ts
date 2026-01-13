import { useState, useCallback } from 'react'
import { ocrProcessor } from '@/lib/ocr-expense-processor'
import { ExpenseData, OCRResult, Expense } from '@/lib/types'

export interface OCRExpenseState {
  isProcessing: boolean
  ocrResult: OCRResult | null
  extractedExpense: ExpenseData | null
  error: string | null
  progress: number
}

export function useOCRExpenses() {
  const [state, setState] = useState<OCRExpenseState>({
    isProcessing: false,
    ocrResult: null,
    extractedExpense: null,
    error: null,
    progress: 0
  })

  const processReceipt = useCallback(async (file: File) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      progress: 0
    }))

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }))
      }, 200)

      // Process the receipt
      const ocrResult = await ocrProcessor.processReceipt(file)
      
      // Extract expense data
      const expenseData = await ocrProcessor.extractExpenseData(ocrResult)

      clearInterval(progressInterval)
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        ocrResult,
        extractedExpense: expenseData,
        progress: 100
      }))

      return { ocrResult, expenseData }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'OCR processing failed',
        progress: 0
      }))
      throw error
    }
  }, [])

  const updateExpenseField = useCallback((field: keyof ExpenseData, value: any) => {
    setState(prev => {
      if (!prev.extractedExpense) return prev
      
      return {
        ...prev,
        extractedExpense: {
          ...prev.extractedExpense,
          [field]: value,
          manualCorrections: {
            ...prev.extractedExpense.manualCorrections,
            [field]: value
          }
        }
      }
    })
  }, [])

  const saveExpense = useCallback(async (imageFile: File): Promise<Expense> => {
    if (!state.extractedExpense || !state.ocrResult) {
      throw new Error('No expense data to save')
    }

    try {
      // Generate expense ID
      const expenseId = `exp_${Date.now()}`
      
      // Store receipt image
      const storagePath = await ocrProcessor.storeReceiptImage(imageFile, expenseId)
      
      // Create expense object
      const expense: Expense = {
        id: expenseId,
        vendor: state.extractedExpense.vendor,
        amount: state.extractedExpense.amount,
        category: state.extractedExpense.category.name,
        dueDate: state.extractedExpense.date,
        status: 'pending',
        ocrData: {
          confidence: state.extractedExpense.confidence,
          extractedAt: state.ocrResult.processedAt,
          rawText: state.ocrResult.extractedText,
          originalImage: storagePath,
          expenseData: state.extractedExpense
        }
      }

      // Link to billing system
      await ocrProcessor.linkExpenseToBilling(state.extractedExpense)

      return expense
    } catch (error) {
      throw new Error(`Failed to save expense: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [state.extractedExpense, state.ocrResult])

  const getSuggestions = useCallback(async () => {
    if (!state.ocrResult) return null
    
    try {
      return await ocrProcessor.suggestCorrections(state.ocrResult)
    } catch (error) {
      console.error('Failed to get suggestions:', error)
      return null
    }
  }, [state.ocrResult])

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      ocrResult: null,
      extractedExpense: null,
      error: null,
      progress: 0
    })
  }, [])

  const cleanup = useCallback(async () => {
    try {
      await ocrProcessor.cleanup()
    } catch (error) {
      console.error('Failed to cleanup OCR processor:', error)
    }
  }, [])

  return {
    ...state,
    processReceipt,
    updateExpenseField,
    saveExpense,
    getSuggestions,
    reset,
    cleanup
  }
}