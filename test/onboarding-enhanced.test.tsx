import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OnboardingFlow } from '@/components/onboarding-flow'
import { useWallet } from '@/hooks/use-wallet.tsx'
import { useWrappedReports } from '@/hooks/use-wrapped-reports'
import { useRouter } from 'next/navigation'

// Mock dependencies
vi.mock('@/hooks/use-wallet')
vi.mock('@/hooks/use-wrapped-reports')
vi.mock('next/navigation')
vi.mock('@/components/user-registration', () => ({
  CommunityStats: () => <div data-testid="community-stats">Community Stats</div>,
  RegistrationStatusChecker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))
vi.mock('@/components/wrapped-report-viewer', () => ({
  default: ({ onComplete, isOnboarding }: any) => (
    <div data-testid="wrapped-viewer">
      <button onClick={onComplete} data-testid="wrapped-complete">
        Complete Wrapped {isOnboarding ? '(Onboarding)' : ''}
      </button>
    </div>
  )
}))

const mockUseWallet = vi.mocked(useWallet)
const mockUseWrappedReports = vi.mocked(useWrappedReports)
const mockUseRouter = vi.mocked(useRouter)

describe('Enhanced Onboarding Flow', () => {
  const mockPush = vi.fn()
  const mockConnect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      },
      writable: true
    })
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn()
    } as any)

    // Default wallet state - disconnected
    mockUseWallet.mockReturnValue({
      isConnected: false,
      connect: mockConnect,
      address: null,
      chainId: null,
      currentNetwork: 'testnet',
      switchNetwork: vi.fn(),
      disconnect: vi.fn(),
      syncHistory: vi.fn(),
      transactions: [],
      isHistoryLoading: false,
      historyError: null,
      wrappedReports: [],
      generateWrapped: vi.fn(),
      isWatchingTransactions: false,
      startTransactionWatching: vi.fn(),
      stopTransactionWatching: vi.fn(),
      isConnecting: false,
      connectionError: null
    })

    // Default wrapped reports state
    mockUseWrappedReports.mockReturnValue({
      reports: [],
      currentReport: null,
      availableYears: [],
      isLoading: false,
      isGenerating: false,
      error: null,
      generateReports: vi.fn(),
      selectYear: vi.fn(),
      generateYearReport: vi.fn(),
      overallSummary: {
        totalYears: 0,
        totalTransactions: 0,
        totalVolume: 0,
        firstTransactionDate: null,
        mostActiveYear: null,
        dominantArchetype: 'New User'
      },
      hasActivity: false,
      selectedYear: null,
      formattedCurrentReport: null
    })
  })

  it('should show landing page initially', () => {
    render(<OnboardingFlow />)
    
    expect(screen.getByText('PayWarp')).toBeInTheDocument()
    expect(screen.getByText('Get Started →')).toBeInTheDocument()
    expect(screen.getByTestId('community-stats')).toBeInTheDocument()
  })

  it('should show syncing state after wallet connection', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      connect: mockConnect,
      address: '0x1234567890123456789012345678901234567890',
      chainId: 5003,
      currentNetwork: 'testnet',
      switchNetwork: vi.fn(),
      disconnect: vi.fn(),
      syncHistory: vi.fn(),
      transactions: [],
      isHistoryLoading: true,
      historyError: null,
      wrappedReports: [],
      generateWrapped: vi.fn(),
      isWatchingTransactions: false,
      startTransactionWatching: vi.fn(),
      stopTransactionWatching: vi.fn(),
      isConnecting: false,
      connectionError: null
    })

    render(<OnboardingFlow />)
    
    await waitFor(() => {
      expect(screen.getByText('Initialising Sync')).toBeInTheDocument()
    })
  })

  it('should show wrapped step when user has activity', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      connect: mockConnect,
      address: '0x1234567890123456789012345678901234567890',
      chainId: 5003,
      currentNetwork: 'testnet',
      switchNetwork: vi.fn(),
      disconnect: vi.fn(),
      syncHistory: vi.fn(),
      transactions: [],
      isHistoryLoading: false,
      historyError: null,
      wrappedReports: [{ year: 2024 } as any],
      generateWrapped: vi.fn(),
      isWatchingTransactions: false,
      startTransactionWatching: vi.fn(),
      stopTransactionWatching: vi.fn(),
      isConnecting: false,
      connectionError: null
    })

    mockUseWrappedReports.mockReturnValue({
      reports: [{ year: 2024 } as any],
      currentReport: { year: 2024 } as any,
      availableYears: [2024],
      isLoading: false,
      isGenerating: false,
      error: null,
      generateReports: vi.fn(),
      selectYear: vi.fn(),
      generateYearReport: vi.fn(),
      overallSummary: {
        totalYears: 1,
        totalTransactions: 50,
        totalVolume: 1000,
        firstTransactionDate: new Date(),
        mostActiveYear: 2024,
        dominantArchetype: 'Balanced User'
      },
      hasActivity: true,
      selectedYear: 2024,
      formattedCurrentReport: null
    })

    render(<OnboardingFlow />)
    
    await waitFor(() => {
      expect(screen.getByText('Your Blockchain Story')).toBeInTheDocument()
      expect(screen.getByText('View My Wrapped')).toBeInTheDocument()
      expect(screen.getByText('Skip for Now')).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it('should open wrapped viewer when View My Wrapped is clicked', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      connect: mockConnect,
      address: '0x1234567890123456789012345678901234567890',
      chainId: 5003,
      currentNetwork: 'testnet',
      switchNetwork: vi.fn(),
      disconnect: vi.fn(),
      syncHistory: vi.fn(),
      transactions: [],
      isHistoryLoading: false,
      historyError: null,
      wrappedReports: [{ year: 2024 } as any],
      generateWrapped: vi.fn(),
      isWatchingTransactions: false,
      startTransactionWatching: vi.fn(),
      stopTransactionWatching: vi.fn(),
      isConnecting: false,
      connectionError: null
    })

    mockUseWrappedReports.mockReturnValue({
      reports: [{ year: 2024 } as any],
      currentReport: { year: 2024 } as any,
      availableYears: [2024],
      isLoading: false,
      isGenerating: false,
      error: null,
      generateReports: vi.fn(),
      selectYear: vi.fn(),
      generateYearReport: vi.fn(),
      overallSummary: {
        totalYears: 1,
        totalTransactions: 50,
        totalVolume: 1000,
        firstTransactionDate: new Date(),
        mostActiveYear: 2024,
        dominantArchetype: 'Balanced User'
      },
      hasActivity: true,
      selectedYear: 2024,
      formattedCurrentReport: null
    })

    render(<OnboardingFlow />)
    
    await waitFor(() => {
      expect(screen.getByText('View My Wrapped')).toBeInTheDocument()
    }, { timeout: 10000 })

    fireEvent.click(screen.getByText('View My Wrapped'))

    await waitFor(() => {
      expect(screen.getByTestId('wrapped-viewer')).toBeInTheDocument()
      expect(screen.getByText('Complete Wrapped (Onboarding)')).toBeInTheDocument()
    })
  })

  it('should navigate to dashboard when skip is clicked', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      connect: mockConnect,
      address: '0x1234567890123456789012345678901234567890',
      chainId: 5003,
      currentNetwork: 'testnet',
      switchNetwork: vi.fn(),
      disconnect: vi.fn(),
      syncHistory: vi.fn(),
      transactions: [],
      isHistoryLoading: false,
      historyError: null,
      wrappedReports: [{ year: 2024 } as any],
      generateWrapped: vi.fn(),
      isWatchingTransactions: false,
      startTransactionWatching: vi.fn(),
      stopTransactionWatching: vi.fn(),
      isConnecting: false,
      connectionError: null
    })

    mockUseWrappedReports.mockReturnValue({
      reports: [{ year: 2024 } as any],
      currentReport: { year: 2024 } as any,
      availableYears: [2024],
      isLoading: false,
      isGenerating: false,
      error: null,
      generateReports: vi.fn(),
      selectYear: vi.fn(),
      generateYearReport: vi.fn(),
      overallSummary: {
        totalYears: 1,
        totalTransactions: 50,
        totalVolume: 1000,
        firstTransactionDate: new Date(),
        mostActiveYear: 2024,
        dominantArchetype: 'Balanced User'
      },
      hasActivity: true,
      selectedYear: 2024,
      formattedCurrentReport: null
    })

    render(<OnboardingFlow />)
    
    await waitFor(() => {
      expect(screen.getByText('Skip for Now')).toBeInTheDocument()
    }, { timeout: 10000 })

    fireEvent.click(screen.getByText('Skip for Now'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 5000 })
  })

  it('should skip wrapped for users with no activity', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      connect: mockConnect,
      address: '0x1234567890123456789012345678901234567890',
      chainId: 5003,
      currentNetwork: 'testnet',
      switchNetwork: vi.fn(),
      disconnect: vi.fn(),
      syncHistory: vi.fn(),
      transactions: [],
      isHistoryLoading: false,
      historyError: null,
      wrappedReports: [],
      generateWrapped: vi.fn(),
      isWatchingTransactions: false,
      startTransactionWatching: vi.fn(),
      stopTransactionWatching: vi.fn(),
      isConnecting: false,
      connectionError: null
    })

    mockUseWrappedReports.mockReturnValue({
      reports: [],
      currentReport: null,
      availableYears: [],
      isLoading: false,
      isGenerating: false,
      error: null,
      generateReports: vi.fn(),
      selectYear: vi.fn(),
      generateYearReport: vi.fn(),
      overallSummary: {
        totalYears: 0,
        totalTransactions: 0,
        totalVolume: 0,
        firstTransactionDate: null,
        mostActiveYear: null,
        dominantArchetype: 'New User'
      },
      hasActivity: false,
      selectedYear: null,
      formattedCurrentReport: null
    })

    render(<OnboardingFlow />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 10000 })
  })
})