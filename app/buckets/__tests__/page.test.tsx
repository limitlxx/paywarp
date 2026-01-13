import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Mock the currency provider
vi.mock('@/hooks/use-currency', () => {
  const MockCurrencyProvider = ({ children }: { children: React.ReactNode }) => {
    return (
      <div data-testid="mock-currency-provider">
        {children}
      </div>
    )
  }
  
  return {
    CurrencyProvider: MockCurrencyProvider,
    useCurrency: () => ({
      currentCurrency: 'USD',
      rates: { USD: 1, NGN: 1600, MNT: 0.0005 },
      isLoading: false,
      isStale: false,
      lastError: null,
      setCurrency: vi.fn(),
      refreshRates: vi.fn(),
      convertAmount: (amount: number) => amount,
      formatAmount: (amount: number) => `${amount.toFixed(2)}`,
    })
  }
})

// Mock the network provider
vi.mock('@/hooks/use-network', () => ({
  useNetwork: () => ({
    currentNetwork: 'sepolia',
    switchNetwork: vi.fn(),
    isConnected: true,
    chainId: 5003,
  })
}))

// Mock the hooks with complete return types
vi.mock('@/hooks/use-blockchain-buckets', () => ({
  useBlockchainBuckets: vi.fn(() => ({
    buckets: [],
    splitConfig: null,
    pendingTransactions: [],
    isLoading: false,
    error: null,
    isConnected: false,
    refreshBalances: vi.fn(),
    clearError: vi.fn(),
    getBucket: vi.fn(),
    depositAndSplit: vi.fn(),
    transferBetweenBuckets: vi.fn(),
    withdrawFromBucket: vi.fn(),
  })),
}))

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: vi.fn(() => ({
    isConnected: false,
    address: null,
    chainId: null,
    currentNetwork: 'mainnet',
    switchNetwork: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    syncHistory: vi.fn(),
    transactions: [],
    wrappedReports: [],
    generateWrapped: vi.fn(),
    isLoading: false,
    error: null,
    balance: null,
    ensName: null,
    ensAvatar: null,
    isReconnecting: false,
  })),
}))

// Mock the components
vi.mock('@/components/bottom-nav', () => ({
  BottomNav: () => <div data-testid="bottom-nav">Bottom Navigation</div>
}))

vi.mock('@/components/simple-header', () => ({
  SimpleHeader: () => <div data-testid="simple-header">Simple Header</div>
}))

vi.mock('@/components/bucket-card', () => ({
  BucketCard: ({ id, name, balance, isLoading, error, onRefresh }: any) => (
    <div data-testid={`bucket-card-${id}`}>
      <span>{name}</span>
      <span>{balance}</span>
      {isLoading && <span data-testid="loading">Loading...</span>}
      {error && (
        <button data-testid="error-refresh" onClick={onRefresh}>
          {error}
        </button>
      )}
    </div>
  )
}))

vi.mock('@/components/modals/deposit-modal', () => ({
  DepositModal: ({ open, onOpenChange }: any) => 
    open ? (
      <div data-testid="deposit-modal">
        <button onClick={() => onOpenChange(false)}>Close Deposit</button>
      </div>
    ) : null
}))

vi.mock('@/components/modals/transfer-modal', () => ({
  TransferModal: ({ open, onOpenChange }: any) => 
    open ? (
      <div data-testid="transfer-modal">
        <button onClick={() => onOpenChange(false)}>Close Transfer</button>
      </div>
    ) : null
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className }: any) => (
    <div data-testid="alert" className={className}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  ),
}))

import BucketsPage from '../page'

describe('Buckets Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render page with basic layout when wallet is not connected', () => {
    render(<BucketsPage />)

    expect(screen.getByTestId('simple-header')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    expect(screen.getByText('Buckets')).toBeInTheDocument()
    expect(screen.getByText('Connect your wallet to view real bucket balances')).toBeInTheDocument()
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
  })

  it('should show connection alert when wallet is not connected', () => {
    render(<BucketsPage />)

    expect(screen.getByTestId('alert')).toBeInTheDocument()
    expect(screen.getByText(/Connect your wallet to view real-time bucket balances/)).toBeInTheDocument()
  })

  it('should handle wallet connection', async () => {
    const { useWallet } = await import('@/hooks/use-wallet')
    
    const mockConnect = vi.fn()
    vi.mocked(useWallet).mockReturnValue({
      isConnected: false,
      address: null,
      chainId: null,
      currentNetwork: 'mainnet',
      switchNetwork: vi.fn(),
      connect: mockConnect,
      disconnect: vi.fn(),
      syncHistory: vi.fn(),
      transactions: [],
      wrappedReports: [],
      generateWrapped: vi.fn(),
      isLoading: false,
      error: null,
      balance: null,
      ensName: null,
      ensAvatar: null,
      isReconnecting: false,
    })

    render(<BucketsPage />)

    const connectButton = screen.getByText('Connect Wallet')
    fireEvent.click(connectButton)
    
    expect(mockConnect).toHaveBeenCalled()
  })

  it('should render fallback bucket cards when no blockchain data is available', () => {
    render(<BucketsPage />)

    // Should render all 5 default bucket cards
    expect(screen.getByTestId('bucket-card-billings')).toBeInTheDocument()
    expect(screen.getByTestId('bucket-card-savings')).toBeInTheDocument()
    expect(screen.getByTestId('bucket-card-growth')).toBeInTheDocument()
    expect(screen.getByTestId('bucket-card-instant')).toBeInTheDocument()
    expect(screen.getByTestId('bucket-card-spendable')).toBeInTheDocument()
  })
})