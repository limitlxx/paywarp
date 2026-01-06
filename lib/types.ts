// Bucket types and interfaces
export type BucketType = 'billings' | 'savings' | 'growth' | 'instant' | 'spendable'

export interface Bucket {
  id: BucketType
  name: string
  balance: number
  percentage: number
  color: string
  description: string
  isYielding?: boolean
  apy?: number
  rwaConnection?: RWAConnection
  features: BucketFeatures
  // RWA-specific fields
  usdyBalance?: number
  musdBalance?: number
  totalYieldEarned?: number
  currentRWAValue?: number
}

export interface RWAConnection {
  provider: 'Ondo' | 'Mantle' | 'Chainlink'
  type: 'receivables' | 't-bills' | 'equity-vaults' | 'payroll-yields' | 'native'
  enabled: boolean
}

export interface BucketFeatures {
  autoFill?: boolean
  overflowTarget?: BucketType
  minSplitPercent?: number
  autoCompound?: boolean
  directPayout?: boolean
  goalTracking?: boolean
  expenseTracking?: boolean
  payrollManagement?: boolean
}

// Transaction types
export interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'transfer' | 'expense' | 'payout' | 'yield'
  amount: number
  from?: string
  to?: string
  bucketId: BucketType
  timestamp: Date
  status: 'pending' | 'completed' | 'failed'
  description?: string
}

// OCR and Expense Processing types
export interface OCRResult {
  extractedText: string
  confidence: number
  boundingBoxes: BoundingBox[]
  processedAt: Date
  imageHash: string
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  text: string
  confidence: number
}

export interface ExpenseData {
  vendor: string
  amount: number
  date: Date
  category: ExpenseCategory
  confidence: number
  ocrSource: OCRResult
  manualCorrections?: Partial<ExpenseData>
}

export interface ExpenseCategory {
  name: string
  confidence: number
  suggestedAlternatives: string[]
  autoApproved: boolean
}

export interface CorrectionSuggestions {
  vendor?: string[]
  amount?: number[]
  date?: Date[]
  category?: string[]
}

// Expense tracking for Billings bucket
export interface Expense {
  id: string
  vendor: string
  amount: number
  category: string
  dueDate: Date
  status: 'pending' | 'paid' | 'overdue'
  recurring?: boolean
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  autoPayout?: boolean
  ocrData?: {
    confidence: number
    extractedAt: Date
    rawText?: string
    originalImage?: string
    expenseData?: ExpenseData
  }
}

// Goal tracking for Savings bucket
export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: Date
  progressPercent: number
  completed: boolean
  bonusApy?: number
}

// Payroll management for Instant bucket
export interface PayrollEntry {
  id: string
  employeeName: string
  walletAddress?: string
  email?: string
  salary: number
  paymentDate: number // day of month (e.g., 15)
  status: 'active' | 'pending' | 'verified' | 'paused'
  lastPaid?: Date
  nextPayment?: Date
}

export interface PayrollBatch {
  id: string
  scheduledDate: Date
  totalAmount: number
  entries: PayrollEntry[]
  status: 'scheduled' | 'processing' | 'completed' | 'failed'
  chainlinkJobId?: string
}

// Currency types
export type Currency = 'USD' | 'NGN' | 'MNT'
export type NetworkType = 'mainnet' | 'sepolia'

export interface CurrencyRates {
  MNT_USD: number
  USD_NGN: number
  lastUpdated: Date
  source: 'chainlink' | 'cached' | 'fallback' | 'mixed' | 'cmc'
}

export interface CurrencyDisplayOptions {
  currency: Currency
  showSymbol: boolean
  precision: number
}

export interface PriceFeedData {
  price: number
  timestamp: Date
  roundId: string
  source: string
}
