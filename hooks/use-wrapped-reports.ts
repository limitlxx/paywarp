import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from './use-wallet'
import { useTransactionHistory } from './use-transaction-history'
import { WrappedReportService, WrappedReportOptions } from '@/lib/wrapped-report-service'
import { WrappedReport } from '@/lib/transaction-sync'

export interface UseWrappedReportsReturn {
  // Report data
  reports: WrappedReport[]
  currentReport: WrappedReport | null
  availableYears: number[]
  
  // Loading states
  isLoading: boolean
  isGenerating: boolean
  error: string | null
  
  // Actions
  generateReports: (options?: WrappedReportOptions) => Promise<void>
  selectYear: (year: number) => void
  generateYearReport: (year: number) => Promise<WrappedReport>
  
  // Summary data
  overallSummary: {
    totalYears: number
    totalTransactions: number
    totalVolume: number
    firstTransactionDate: Date | null
    mostActiveYear: number | null
    dominantArchetype: string
  }
  
  // UI helpers
  hasActivity: boolean
  selectedYear: number | null
  formattedCurrentReport: ReturnType<typeof WrappedReportService.formatReportForDisplay> | null
}

export function useWrappedReports(): UseWrappedReportsReturn {
  const { address, isConnected } = useWallet()
  const { transactions, isLoading: isTransactionLoading } = useTransactionHistory()
  
  // State management
  const [reports, setReports] = useState<WrappedReport[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Computed values
  const availableYears = useMemo(() => {
    return WrappedReportService.getAvailableYears(transactions)
  }, [transactions])

  const hasActivity = useMemo(() => {
    return WrappedReportService.hasWrappedActivity(transactions)
  }, [transactions])

  const overallSummary = useMemo(() => {
    if (!address) {
      return {
        totalYears: 0,
        totalTransactions: 0,
        totalVolume: 0,
        firstTransactionDate: null,
        mostActiveYear: null,
        dominantArchetype: 'New User'
      }
    }
    return WrappedReportService.getOverallSummary(transactions, address)
  }, [transactions, address])

  const currentReport = useMemo(() => {
    if (!selectedYear) return null
    return reports.find(report => report.year === selectedYear) || null
  }, [reports, selectedYear])

  const formattedCurrentReport = useMemo(() => {
    if (!currentReport) return null
    return WrappedReportService.formatReportForDisplay(currentReport)
  }, [currentReport])

  // Generate all wrapped reports
  const generateReports = useCallback(async (options: WrappedReportOptions = {}) => {
    if (!address || !isConnected) {
      setError('Wallet not connected')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const generatedReports = await WrappedReportService.generateAllWrappedReports(
        transactions,
        address,
        options
      )

      setReports(generatedReports)
      
      // Auto-select the most recent year if no year is selected
      if (!selectedYear && generatedReports.length > 0) {
        setSelectedYear(generatedReports[0].year)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate wrapped reports'
      setError(errorMessage)
      console.error('Wrapped report generation error:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [address, isConnected, transactions, selectedYear])

  // Generate report for specific year
  const generateYearReport = useCallback(async (year: number): Promise<WrappedReport> => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    const report = WrappedReportService.generateYearlyReport(transactions, year, address)
    
    // Update reports state
    setReports(prev => {
      const filtered = prev.filter(r => r.year !== year)
      return [...filtered, report].sort((a, b) => b.year - a.year)
    })

    return report
  }, [address, transactions])

  // Select year for viewing
  const selectYear = useCallback((year: number) => {
    setSelectedYear(year)
  }, [])

  // Auto-generate reports when transactions are available
  useEffect(() => {
    if (address && transactions.length > 0 && !isGenerating && reports.length === 0) {
      generateReports()
    }
  }, [address, transactions.length, isGenerating, reports.length, generateReports])

  // Auto-select current year if available
  useEffect(() => {
    if (reports.length > 0 && !selectedYear) {
      const currentYear = new Date().getFullYear()
      const hasCurrentYear = reports.some(report => report.year === currentYear)
      
      if (hasCurrentYear) {
        setSelectedYear(currentYear)
      } else {
        setSelectedYear(reports[0].year) // Most recent year
      }
    }
  }, [reports, selectedYear])

  // Clear data when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setReports([])
      setSelectedYear(null)
      setError(null)
    }
  }, [isConnected])

  return {
    // Report data
    reports,
    currentReport,
    availableYears,
    
    // Loading states
    isLoading: isTransactionLoading || isGenerating,
    isGenerating,
    error,
    
    // Actions
    generateReports,
    selectYear,
    generateYearReport,
    
    // Summary data
    overallSummary,
    
    // UI helpers
    hasActivity,
    selectedYear,
    formattedCurrentReport
  }
}