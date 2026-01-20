/**
 * Unit Test: BucketCard RWA Display Enhancement
 * Tests the enhanced RWA display features in BucketCard component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BucketCard } from '@/components/bucket-card'
import { Droplet } from 'lucide-react'
import React from 'react'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock wagmi
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x123',
  }),
}))

// Mock the yield polling service
vi.mock('@/lib/yield-polling-service', () => ({
  useYieldPolling: () => ({
    yields: {
      billings: {
        pending: 1.23,
        apy: 4.2,
        tokenBalance: 125.4,
        totalYieldEarned: 12.45,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        isYielding: true,
      },
      savings: {
        pending: 0,
        apy: 5.8,
        tokenBalance: 0,
        totalYieldEarned: 0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        isYielding: false,
      },
      growth: {
        pending: 0,
        apy: 0,
        tokenBalance: 0,
        totalYieldEarned: 0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        isYielding: false,
      },
      instant: {
        pending: 0,
        apy: 0,
        tokenBalance: 0,
        totalYieldEarned: 0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        isYielding: false,
      },
    },
    isLoading: false,
  }),
}))

// Mock other dependencies
vi.mock('@/lib/mobile-optimization', () => ({
  useMobileCapabilities: () => ({
    performanceLevel: 'high',
    screenSize: 'large',
    hasTouch: false,
    isMobile: false,
    connectionType: 'wifi'
  }),
  useOptimizedTouch: () => {},
}))

vi.mock('@/lib/animation-optimizer', () => ({
  useOptimizedLiquidFill: () => ({
    currentPercentage: 50,
    shouldUseGPU: false
  }),
  useOptimizedBubbles: () => ({
    bubbleCount: 5,
    animationSpeed: 1
  })
}))

vi.mock('@/lib/loading-state-manager', () => ({
  useTransactionLoading: () => ({
    isTransactionLoading: () => false
  })
}))

vi.mock('@/components/currency-display', () => ({
  CurrencyDisplay: ({ amount, className }: { amount: number; className?: string }) => (
    <span className={className}>${amount.toFixed(2)}</span>
  )
}))

vi.mock('@/components/liquid-fill', () => ({
  CircularLiquidFill: () => <div data-testid="liquid-fill" />
}))

vi.mock('@/components/animated-bubbles', () => ({
  YieldBubbles: ({ active }: { active: boolean }) => (
    <div data-testid="yield-bubbles" data-active={active} />
  )
}))

vi.mock('@/components/modals/deposit-modal', () => ({
  DepositModal: () => <div data-testid="deposit-modal" />
}))

vi.mock('@/components/modals/transfer-modal', () => ({
  TransferModal: () => <div data-testid="transfer-modal" />
}))

describe('BucketCard RWA Display Enhancement', () => {
  const defaultProps = {
    id: 'billings' as const,
    name: 'Billings',
    balance: 12450,
    percentage: 45,
    color: '#EF4444',
    icon: Droplet,
    description: 'Automated expenses & bills',
  }

  it('should display real-time APY from yield polling service', () => {
    render(
      <BucketCard
        {...defaultProps}
        enableRealTimeYields={true}
      />
    )

    // Should show the real-time APY from the mock (4.2%)
    expect(screen.getByText('+4.2% APY')).toBeInTheDocument()
  })

  it('should show pending yield when available', () => {
    render(
      <BucketCard
        {...defaultProps}
        enableRealTimeYields={true}
      />
    )

    // Should show pending yield from the mock
    expect(screen.getByText('+$1.23 pending')).toBeInTheDocument()
  })

  it('should display RWA holdings section with token balances', () => {
    render(
      <BucketCard
        {...defaultProps}
        usdyBalance={125.4}
        totalYieldEarned={12.45}
        currentRWAValue={131.73}
        enableRealTimeYields={true}
      />
    )

    // Should show RWA Holdings section
    expect(screen.getByText('RWA Holdings')).toBeInTheDocument()
    
    // Should show USDY balance
    expect(screen.getByText('USDY:')).toBeInTheDocument()
    expect(screen.getByText('125.4000')).toBeInTheDocument()
    
    // Should show total yield earned
    expect(screen.getByText('+$12.45')).toBeInTheDocument()
    
    // Should show total RWA value
    expect(screen.getByText('Total RWA Value:')).toBeInTheDocument()
    expect(screen.getByText('$131.73')).toBeInTheDocument()
  })

  it('should show different token types based on bucket type', () => {
    const { rerender } = render(
      <BucketCard
        {...defaultProps}
        id="growth"
        totalYieldEarned={10}
        enableRealTimeYields={true}
      />
    )

    // Growth bucket should show USDe
    expect(screen.getByText('USDe:')).toBeInTheDocument()

    rerender(
      <BucketCard
        {...defaultProps}
        id="instant"
        totalYieldEarned={10}
        enableRealTimeYields={true}
      />
    )

    // Instant bucket should show mETH
    expect(screen.getByText('mETH:')).toBeInTheDocument()
  })

  it('should calculate and display 24h yield estimate', () => {
    render(
      <BucketCard
        {...defaultProps}
        balance={10000}
        apy={4.2}
        totalYieldEarned={10}
        enableRealTimeYields={true}
      />
    )

    // Should show 24h yield calculation: (10000 * 4.2 / 100) / 365 ≈ $1.15
    expect(screen.getByText('24h Yield:')).toBeInTheDocument()
    expect(screen.getByText('+$1.15')).toBeInTheDocument()
  })

  it('should show last updated timestamp from yield polling', () => {
    render(
      <BucketCard
        {...defaultProps}
        enableRealTimeYields={true}
        totalYieldEarned={10}
      />
    )

    // Should show the last updated time from the mock
    expect(screen.getByText(/Updated:/)).toBeInTheDocument()
  })

  it('should not show RWA section when no RWA data is available', () => {
    render(
      <BucketCard
        {...defaultProps}
        id="savings" // This bucket has no RWA data in the mock
        enableRealTimeYields={true}
      />
    )

    // Should not show RWA Holdings section
    expect(screen.queryByText('RWA Holdings')).not.toBeInTheDocument()
  })

  it('should fall back to props when real-time yields are disabled', () => {
    render(
      <BucketCard
        {...defaultProps}
        apy={8.5}
        enableRealTimeYields={false}
      />
    )

    // Should use the prop APY instead of real-time data
    expect(screen.getByText('+8.5% APY')).toBeInTheDocument()
  })

  it('should show loading indicator when yield data is being fetched', () => {
    // Mock loading state
    vi.mocked(require('@/lib/yield-polling-service').useYieldPolling).mockReturnValue({
      yields: {},
      isLoading: true,
    })

    render(
      <BucketCard
        {...defaultProps}
        totalYieldEarned={10}
        enableRealTimeYields={true}
      />
    )

    // Should show loading spinner in RWA section
    const loadingSpinner = document.querySelector('.animate-spin')
    expect(loadingSpinner).toBeInTheDocument()
  })
})