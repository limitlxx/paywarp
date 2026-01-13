import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useTransactionHistory } from './use-transaction-history'
import { WrappedReport, TransactionSyncService, BlockchainTransaction } from '@/lib/transaction-sync'
import { WrappedReportService } from '@/lib/wrapped-report-service'

export interface UseWrappedReportsReturn {
  // Reports data
  reports: WrappedReport[]
  currentReport: WrappedReport | null
  hasActivity: boolean
  isLoading: boolean
  error: string | null
  transactions: BlockchainTransaction[]
  
  // Year management
  availableYears: number[]
  selectedYear: number | null
  selectYear: (year: number) => void
  
  // Formatted data
  overallSummary: ReturnType<typeof WrappedReportService.getOverallSummary> | null
  formattedCurrentReport: ReturnType<typeof WrappedReportService.formatReportForDisplay> | null
  
  // Operations
  generateReports: () => Promise<void>
  generateReportForYear: (year: number) => Promise<WrappedReport>
  setCurrentYear: (year: number) => void
  
  // Utility
  getAvailableYears: () => number[]
}

export function useWrappedReports(): UseWrappedReportsReturn {
  const { address } = useAccount()
  const { transactions, isLoading: isTransactionLoading } = useTransactionHistory()
  
  const [reports, setReports] = useState<WrappedReport[]>([])
  const [currentReport, setCurrentReport] = useState<WrappedReport | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if user has any activity
  const hasActivity = transactions.length > 0

  // Get available years
  const availableYears = useMemo(() => {
    return reports.map(r => r.year).sort((a, b) => b - a)
  }, [reports])

  // Get overall summary
  const overallSummary = useMemo(() => {
    if (!address || transactions.length === 0) return null
    return WrappedReportService.getOverallSummary(transactions, address)
  }, [transactions, address])

  // Get formatted current report
  const formattedCurrentReport = useMemo(() => {
    if (!currentReport) return null
    return WrappedReportService.formatReportForDisplay(currentReport)
  }, [currentReport])

  // Select year function
  const selectYear = useCallback((year: number) => {
    setSelectedYear(year)
    const report = reports.find(r => r.year === year)
    if (report) {
      setCurrentReport(report)
    }
  }, [reports])

  // Generate reports for all years with activity
  const generateReports = useCallback(async () => {
    if (!address || transactions.length === 0) {
      setReports([])
      setCurrentReport(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get unique years from transactions
      const yearsWithActivity = new Set(
        transactions.map(tx => tx.timestamp.getFullYear())
      )

      const newReports: WrappedReport[] = []
      
      for (const year of yearsWithActivity) {
        const report = TransactionSyncService.generateWrappedData(
          transactions,
          year,
          address
        )
        newReports.push(report)
      }

      // Sort by year (most recent first)
      const sortedReports = newReports.sort((a, b) => b.year - a.year)
      setReports(sortedReports)
      
      // Set current report to most recent year
      if (sortedReports.length > 0) {
        setCurrentReport(sortedReports[0])
        setSelectedYear(sortedReports[0].year)
      }

      console.log(`Generated ${sortedReports.length} wrapped reports`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate wrapped reports'
      setError(errorMessage)
      console.error('Wrapped report generation error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address, transactions])

  // Generate report for specific year
  const generateReportForYear = useCallback(async (year: number): Promise<WrappedReport> => {
    if (!address) {
      throw new Error('Wallet not connected')
    }

    const report = TransactionSyncService.generateWrappedData(
      transactions,
      year,
      address
    )

    // Update reports state
    setReports(prev => {
      const filtered = prev.filter(r => r.year !== year)
      const updated = [...filtered, report].sort((a, b) => b.year - a.year)
      return updated
    })

    return report
  }, [address, transactions])

  // Set current report by year
  const setCurrentYear = useCallback((year: number) => {
    const report = reports.find(r => r.year === year)
    if (report) {
      setCurrentReport(report)
    }
  }, [reports])

  // Get available years (legacy function for compatibility)
  const getAvailableYears = useCallback(() => {
    return availableYears
  }, [availableYears])

  // Auto-generate reports when transactions change
  useEffect(() => {
    if (transactions.length > 0 && !isTransactionLoading) {
      generateReports()
    }
  }, [transactions, isTransactionLoading, generateReports])

  return {
    // Reports data
    reports,
    currentReport,
    hasActivity,
    isLoading: isLoading || isTransactionLoading,
    error,
    transactions,
    
    // Year management
    availableYears,
    selectedYear,
    selectYear,
    
    // Formatted data
    overallSummary,
    formattedCurrentReport,
    
    // Operations
    generateReports,
    generateReportForYear,
    setCurrentYear,
    
    // Utility
    getAvailableYears
  }
}