import { 
  TransactionSyncService, 
  BlockchainTransaction, 
  WrappedReport 
} from './transaction-sync'

export interface WrappedReportOptions {
  includeHistorical?: boolean
  minTransactionsForReport?: number
  maxYearsBack?: number
}

export class WrappedReportService {
  private static readonly DEFAULT_MIN_TRANSACTIONS = 1
  private static readonly DEFAULT_MAX_YEARS_BACK = 5

  /**
   * Generate wrapped reports for all years with sufficient activity
   */
  static async generateAllWrappedReports(
    transactions: BlockchainTransaction[],
    walletAddress: string,
    options: WrappedReportOptions = {}
  ): Promise<WrappedReport[]> {
    const {
      minTransactionsForReport = this.DEFAULT_MIN_TRANSACTIONS,
      maxYearsBack = this.DEFAULT_MAX_YEARS_BACK
    } = options

    // Get unique years from transactions
    const yearsWithActivity = new Set(
      transactions.map(tx => tx.timestamp.getFullYear())
    )

    // Filter years based on options
    const currentYear = new Date().getFullYear()
    const earliestYear = currentYear - maxYearsBack
    
    const validYears = Array.from(yearsWithActivity)
      .filter(year => year >= earliestYear)
      .sort((a, b) => b - a) // Most recent first

    const reports: WrappedReport[] = []

    for (const year of validYears) {
      const yearTransactions = transactions.filter(tx => 
        tx.timestamp.getFullYear() === year
      )

      // Only generate report if there are enough transactions
      if (yearTransactions.length >= minTransactionsForReport) {
        const report = TransactionSyncService.generateWrappedData(
          transactions,
          year,
          walletAddress
        )
        reports.push(report)
      }
    }

    return reports
  }

  /**
   * Generate wrapped report for a specific year
   */
  static generateYearlyReport(
    transactions: BlockchainTransaction[],
    year: number,
    walletAddress: string
  ): WrappedReport {
    return TransactionSyncService.generateWrappedData(
      transactions,
      year,
      walletAddress
    )
  }

  /**
   * Get available years for wrapped reports
   */
  static getAvailableYears(
    transactions: BlockchainTransaction[],
    minTransactionsForReport: number = this.DEFAULT_MIN_TRANSACTIONS
  ): number[] {
    const yearCounts = transactions.reduce((acc, tx) => {
      const year = tx.timestamp.getFullYear()
      acc[year] = (acc[year] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    return Object.entries(yearCounts)
      .filter(([, count]) => count >= minTransactionsForReport)
      .map(([year]) => parseInt(year))
      .sort((a, b) => b - a) // Most recent first
  }

  /**
   * Check if a wallet has sufficient activity for wrapped reports
   */
  static hasWrappedActivity(
    transactions: BlockchainTransaction[],
    minTransactionsForReport: number = this.DEFAULT_MIN_TRANSACTIONS
  ): boolean {
    return this.getAvailableYears(transactions, minTransactionsForReport).length > 0
  }

  /**
   * Get summary statistics across all years
   */
  static getOverallSummary(
    transactions: BlockchainTransaction[],
    walletAddress: string
  ): {
    totalYears: number
    totalTransactions: number
    totalVolume: number
    firstTransactionDate: Date | null
    mostActiveYear: number | null
    dominantArchetype: string
  } {
    if (transactions.length === 0) {
      return {
        totalYears: 0,
        totalTransactions: 0,
        totalVolume: 0,
        firstTransactionDate: null,
        mostActiveYear: null,
        dominantArchetype: 'New User'
      }
    }

    const years = new Set(transactions.map(tx => tx.timestamp.getFullYear()))
    const totalVolume = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0)
    const firstTransaction = transactions.reduce((earliest, tx) => 
      tx.timestamp < earliest.timestamp ? tx : earliest
    )

    // Find most active year
    const yearCounts = transactions.reduce((acc, tx) => {
      const year = tx.timestamp.getFullYear()
      acc[year] = (acc[year] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    const mostActiveYear = Object.entries(yearCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0]

    // Determine dominant archetype across all years
    const allReports = Array.from(years).map(year => 
      TransactionSyncService.generateWrappedData(transactions, year, walletAddress)
    )
    
    const archetypeCounts = allReports.reduce((acc, report) => {
      acc[report.userArchetype.type] = (acc[report.userArchetype.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const dominantArchetype = Object.entries(archetypeCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Balanced User'

    return {
      totalYears: years.size,
      totalTransactions: transactions.length,
      totalVolume,
      firstTransactionDate: firstTransaction.timestamp,
      mostActiveYear: mostActiveYear ? parseInt(mostActiveYear) : null,
      dominantArchetype
    }
  }

  /**
   * Format wrapped report data for UI display
   */
  static formatReportForDisplay(report: WrappedReport): {
    formattedVolume: string
    formattedTransactionCount: string
    topMonth: string
    consistencyLevel: string
    archetypeEmoji: string
    achievements: Array<{
      id: string
      name: string
      description: string
      emoji: string
    }>
  } {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    const formatVolume = (volume: number): string => {
      if (volume >= 1000000) {
        return `${(volume / 1000000).toFixed(1)}M`
      } else if (volume >= 1000) {
        return `${(volume / 1000).toFixed(1)}K`
      }
      return volume.toFixed(2)
    }

    const formatTransactionCount = (count: number): string => {
      if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K+`
      }
      return count.toString()
    }

    const getConsistencyLevel = (consistency: number): string => {
      if (consistency >= 80) return 'Very Consistent'
      if (consistency >= 60) return 'Consistent'
      if (consistency >= 40) return 'Moderate'
      if (consistency >= 20) return 'Variable'
      return 'Sporadic'
    }

    const getArchetypeEmoji = (archetype: string): string => {
      switch (archetype) {
        case 'Team Manager': return '👥'
        case 'Goal-Oriented Saver': return '🎯'
        case 'Automated Budgeter': return '🤖'
        case 'Balanced User': return '⚖️'
        default: return '🌟'
      }
    }

    const getAchievementEmoji = (id: string): string => {
      switch (id) {
        case 'first-transaction': return '🚀'
        case 'high-volume': return '💎'
        case 'consistent-user': return '🔥'
        default: return '🏆'
      }
    }

    return {
      formattedVolume: formatVolume(report.totalVolume),
      formattedTransactionCount: formatTransactionCount(report.totalTransactions),
      topMonth: monthNames[report.activityPattern.peakMonth - 1] || 'Unknown',
      consistencyLevel: getConsistencyLevel(report.activityPattern.consistency),
      archetypeEmoji: getArchetypeEmoji(report.userArchetype.type),
      achievements: report.achievements.map(achievement => ({
        ...achievement,
        emoji: getAchievementEmoji(achievement.id)
      }))
    }
  }
}