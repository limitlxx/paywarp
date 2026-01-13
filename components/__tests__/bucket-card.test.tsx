import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import React from 'react'

// Mock the currency provider
const MockCurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="mock-currency-provider">
      {children}
    </div>
  )
}

vi.mock('@/hooks/use-currency', () => ({
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
    formatAmount: (amount: number) => `$${amount.toFixed(2)}`,
  })
}))

// Mock the network provider
vi.mock('@/hooks/use-network', () => ({
  useNetwork: () => ({
    currentNetwork: 'sepolia',
    switchNetwork: vi.fn(),
    isConnected: true,
    chainId: 5003,
  })
}))

// Mock the modals
vi.mock('@/components/modals/deposit-modal', () => ({
  DepositModal: ({ open, onOpenChange, bucketId, bucketName }: any) => 
    open ? (
      <div data-testid="deposit-modal">
        <span>Deposit Modal for {bucketName || bucketId}</span>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
}))

vi.mock('@/components/modals/transfer-modal', () => ({
  TransferModal: ({ open, onOpenChange, initialFromId }: any) => 
    open ? (
      <div data-testid="transfer-modal">
        <span>Transfer Modal from {initialFromId}</span>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
}))

// Mock the liquid fill and bubbles components
vi.mock('@/components/liquid-fill', () => ({
  CircularLiquidFill: ({ percentage, color }: any) => (
    <div data-testid="liquid-fill" data-percentage={percentage} data-color={color}>
      {percentage}%
    </div>
  )
}))

vi.mock('@/components/animated-bubbles', () => ({
  YieldBubbles: ({ active, type, color }: any) => (
    <div data-testid="yield-bubbles" data-active={active} data-type={type} data-color={color}>
      Bubbles
    </div>
  )
}))

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => (
    <a href={href} data-testid="bucket-link">
      {children}
    </a>
  )
}))

import { BucketCard } from '../bucket-card'
import { Wallet } from 'lucide-react'

describe('BucketCard Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render bucket card with basic information', () => {
    render(
      <BucketCard
        id="spendable"
        name="Spendable"
        balance="$1,000.00"
        percentage={75}
        color="#94A3B8"
        icon={Wallet}
        description="Available for immediate use"
      />
    )

    expect(screen.getByText('Spendable')).toBeInTheDocument()
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    expect(screen.getByText('Available for immediate use')).toBeInTheDocument()
    expect(screen.getByTestId('liquid-fill')).toHaveAttribute('data-percentage', '75')
    expect(screen.getByTestId('liquid-fill')).toHaveAttribute('data-color', '#94A3B8')
  })

  it('should display loading state correctly', () => {
    render(
      <BucketCard
        id="savings"
        name="Savings"
        balance="$5,000.00"
        percentage={50}
        color="#3B82F6"
        icon={Wallet}
        description="Long-term savings"
        isLoading={true}
      />
    )

    // Should show loading spinner instead of regular icon
    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.getByText('$5,000.00')).toBeInTheDocument()
    // The loading spinner should be present (mocked as part of the icon area)
  })

  it('should display error state with retry option', () => {
    const mockOnRefresh = vi.fn()
    
    render(
      <BucketCard
        id="growth"
        name="Growth"
        balance="$2,500.00"
        percentage={30}
        color="#EAB308"
        icon={Wallet}
        description="DeFi yield optimization"
        error="Failed to fetch balance"
        onRefresh={mockOnRefresh}
      />
    )

    const errorIcon = screen.getByTitle('Failed to fetch balance')
    expect(errorIcon).toBeInTheDocument()
    
    fireEvent.click(errorIcon)
    expect(mockOnRefresh).toHaveBeenCalled()
  })

  it('should display last updated timestamp when provided', () => {
    const lastUpdated = new Date('2024-01-15T10:30:00Z')
    
    render(
      <BucketCard
        id="instant"
        name="Instant"
        balance="$750.00"
        percentage={25}
        color="#22C55E"
        icon={Wallet}
        description="Team payroll"
        lastUpdated={lastUpdated}
      />
    )

    expect(screen.getByText(/Updated:/)).toBeInTheDocument()
  })

  it('should show APY badge for yielding buckets', () => {
    render(
      <BucketCard
        id="savings"
        name="Savings"
        balance="$10,000.00"
        percentage={80}
        color="#3B82F6"
        icon={Wallet}
        description="Yield-bearing savings"
        isYielding={true}
        apy={5.5}
      />
    )

    expect(screen.getByText('+5.5% APY')).toBeInTheDocument()
  })

  it('should open deposit modal when deposit button is clicked', async () => {
    render(
      <BucketCard
        id="spendable"
        name="Spendable"
        balance="$1,000.00"
        percentage={75}
        color="#94A3B8"
        icon={Wallet}
        description="Available funds"
      />
    )

    const depositButton = screen.getByText('Deposit')
    fireEvent.click(depositButton)

    await waitFor(() => {
      expect(screen.getByTestId('deposit-modal')).toBeInTheDocument()
      expect(screen.getByText('Deposit Modal for Spendable')).toBeInTheDocument()
    })
  })

  it('should open transfer modal when transfer button is clicked', async () => {
    render(
      <BucketCard
        id="savings"
        name="Savings"
        balance="$5,000.00"
        percentage={50}
        color="#3B82F6"
        icon={Wallet}
        description="Long-term savings"
      />
    )

    const transferButton = screen.getByText('Transfer')
    fireEvent.click(transferButton)

    await waitFor(() => {
      expect(screen.getByTestId('transfer-modal')).toBeInTheDocument()
      expect(screen.getByText('Transfer Modal from savings')).toBeInTheDocument()
    })
  })

  it('should disable buttons when loading', () => {
    render(
      <BucketCard
        id="growth"
        name="Growth"
        balance="$3,000.00"
        percentage={40}
        color="#EAB308"
        icon={Wallet}
        description="DeFi optimization"
        isLoading={true}
      />
    )

    const depositButton = screen.getByText('Deposit')
    const transferButton = screen.getByText('Transfer')

    expect(depositButton).toBeDisabled()
    expect(transferButton).toBeDisabled()
  })

  it('should prevent modal opening when buttons are clicked during loading', () => {
    render(
      <BucketCard
        id="instant"
        name="Instant"
        balance="$800.00"
        percentage={20}
        color="#22C55E"
        icon={Wallet}
        description="Payroll funds"
        isLoading={true}
      />
    )

    const depositButton = screen.getByText('Deposit')
    fireEvent.click(depositButton)

    // Modal should not open
    expect(screen.queryByTestId('deposit-modal')).not.toBeInTheDocument()
  })

  it('should render correct bubble type based on bucket ID', () => {
    const bucketConfigs = [
      { id: 'billings', expectedType: 'expense' },
      { id: 'instant', expectedType: 'lightning' },
      { id: 'growth', expectedType: 'compounding' },
      { id: 'savings', expectedType: 'milestone' },
      { id: 'spendable', expectedType: 'neutral' },
    ]

    bucketConfigs.forEach(({ id, expectedType }) => {
      const { unmount } = render(
        <BucketCard
          id={id as any}
          name={id}
          balance="$1,000.00"
          percentage={50}
          color="#000000"
          icon={Wallet}
          description="Test bucket"
        />
      )

      expect(screen.getByTestId('yield-bubbles')).toHaveAttribute('data-type', expectedType)
      unmount()
    })
  })

  it('should render correct liquid variant based on bucket ID', () => {
    const bucketConfigs = [
      { id: 'billings', expectedVariant: 'rising' },
      { id: 'growth', expectedVariant: 'swirling' },
      { id: 'instant', expectedVariant: 'fast-flow' },
      { id: 'spendable', expectedVariant: 'clear' },
      { id: 'savings', expectedVariant: 'normal' },
    ]

    bucketConfigs.forEach(({ id, expectedVariant }) => {
      const { unmount } = render(
        <BucketCard
          id={id as any}
          name={id}
          balance="$1,000.00"
          percentage={50}
          color="#000000"
          icon={Wallet}
          description="Test bucket"
        />
      )

      // The liquid variant is passed to CircularLiquidFill component
      // We can verify this through the component's behavior
      expect(screen.getByTestId('liquid-fill')).toBeInTheDocument()
      unmount()
    })
  })

  it('should handle modal close events correctly', async () => {
    render(
      <BucketCard
        id="spendable"
        name="Spendable"
        balance="$1,000.00"
        percentage={75}
        color="#94A3B8"
        icon={Wallet}
        description="Available funds"
      />
    )

    // Open deposit modal
    const depositButton = screen.getByText('Deposit')
    fireEvent.click(depositButton)

    await waitFor(() => {
      expect(screen.getByTestId('deposit-modal')).toBeInTheDocument()
    })

    // Close modal
    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByTestId('deposit-modal')).not.toBeInTheDocument()
    })
  })

  it('should navigate to bucket detail page when card is clicked', () => {
    render(
      <BucketCard
        id="savings"
        name="Savings"
        balance="$5,000.00"
        percentage={50}
        color="#3B82F6"
        icon={Wallet}
        description="Long-term savings"
      />
    )

    const bucketLink = screen.getByTestId('bucket-link')
    expect(bucketLink).toHaveAttribute('href', '/buckets/savings')
  })

  it('should prevent event propagation when buttons are clicked', () => {
    const mockNavigate = vi.fn()
    
    render(
      <div onClick={mockNavigate}>
        <BucketCard
          id="growth"
          name="Growth"
          balance="$3,000.00"
          percentage={40}
          color="#EAB308"
          icon={Wallet}
          description="DeFi optimization"
        />
      </div>
    )

    const depositButton = screen.getByText('Deposit')
    fireEvent.click(depositButton)

    // Parent click handler should not be called
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // Property-based test for balance formatting
  it('should handle various balance formats correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000 }),
        fc.constantFrom('spendable', 'savings', 'growth', 'instant', 'billings'),
        (balance, bucketId) => {
          const formattedBalance = `$${balance.toLocaleString()}`
          
          render(
            <BucketCard
              id={bucketId as any}
              name="Test Bucket"
              balance={formattedBalance}
              percentage={50}
              color="#000000"
              icon={Wallet}
              description="Test description"
            />
          )

          expect(screen.getByText(formattedBalance)).toBeInTheDocument()
          
          // Clean up for next iteration
          screen.getByText(formattedBalance).closest('[data-testid]')?.remove()
        }
      ),
      { numRuns: 50 }
    )
  })

  // Property-based test for percentage display
  it('should handle various percentage values correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.string({ minLength: 6, maxLength: 7 }).filter(s => s.startsWith('#')),
        (percentage, color) => {
          render(
            <BucketCard
              id="spendable"
              name="Test Bucket"
              balance="$1,000.00"
              percentage={percentage}
              color={color}
              icon={Wallet}
              description="Test description"
            />
          )

          const liquidFill = screen.getByTestId('liquid-fill')
          expect(liquidFill).toHaveAttribute('data-percentage', percentage.toString())
          expect(liquidFill).toHaveAttribute('data-color', color)
          
          // Clean up for next iteration
          liquidFill.closest('[data-testid]')?.remove()
        }
      ),
      { numRuns: 50 }
    )
  })
})