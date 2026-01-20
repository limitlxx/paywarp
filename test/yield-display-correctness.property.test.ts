/**
 * Property Test: Yield Display Correctness
 * Feature: rwa-yield-integration, Property 4: Yield Display Correctness
 * Validates: Requirements 2.1, 2.2, 2.3
 * 
 * Tests that the yield display system accurately shows APY rates, token holdings, 
 * and total yield earned for any RWA token balances and pending yields.
 */

import { describe, it, expect, vi } from 'vitest'
import fc from 'fast-check'
import { render } from '@testing-library/react'
import { BucketCard } from '@/components/bucket-card'
import { Droplet } from 'lucide-react'
import React from 'react'

// Mock Next.js router with proper app router context
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/test-path',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock the router context provider
const MockRouterProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement('div', { 'data-testid': 'mock-router-provider' }, children)
}

// Mock Wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
  }),
  useConfig: () => ({}),
  useBalance: () => ({
    data: { value: BigInt(0), decimals: 18, symbol: 'ETH' },
    isLoading: false,
  }),
}))

// Mock the yield polling service
vi.mock('@/lib/yield-polling-service', () => ({
  useYieldPolling: () => ({
    yields: {
      billings: { apy: 0, pending: 0, tokenBalance: 0 },
      savings: { apy: 0, pending: 0, tokenBalance: 0 },
      growth: { apy: 0, pending: 0, tokenBalance: 0 },
      instant: { apy: 0, pending: 0, tokenBalance: 0 },
    },
    isLoading: false,
    error: null,
  }),
}))

// Mock the mobile optimization hooks
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

// Mock the animation optimizer hooks
vi.mock('@/lib/animation-optimizer', () => ({
  useOptimizedLiquidFill: (percentage: number, color: string) => ({
    currentPercentage: percentage,
    shouldUseGPU: false
  }),
  useOptimizedBubbles: (active: boolean, type: string) => ({
    bubbleCount: active ? 5 : 0,
    animationSpeed: 1
  })
}))

// Mock the loading state manager
vi.mock('@/lib/loading-state-manager', () => ({
  useTransactionLoading: () => ({
    isTransactionLoading: () => false
  })
}))

// Mock the currency display component
vi.mock('@/components/currency-display', () => ({
  CurrencyDisplay: ({ amount, className }: { amount: number; className?: string }) => {
    return React.createElement('span', { className }, `$${amount.toFixed(2)}`)
  }
}))

// Mock the liquid fill and animated bubbles components
vi.mock('@/components/liquid-fill', () => ({
  CircularLiquidFill: ({ percentage }: { percentage: number }) => {
    return React.createElement('div', { 'data-testid': 'liquid-fill', 'data-percentage': percentage })
  }
}))

vi.mock('@/components/animated-bubbles', () => ({
  YieldBubbles: ({ active, type }: { active: boolean; type: string }) => {
    return React.createElement('div', { 'data-testid': 'yield-bubbles', 'data-active': active, 'data-type': type })
  }
}))

// Mock the modals
vi.mock('@/components/modals/deposit-modal', () => ({
  DepositModal: () => React.createElement('div', { 'data-testid': 'deposit-modal' })
}))

vi.mock('@/components/modals/transfer-modal', () => ({
  TransferModal: () => React.createElement('div', { 'data-testid': 'transfer-modal' })
}))

// Test wrapper component that provides all necessary contexts
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return MockRouterProvider({ children })
}

// Helper function to render components with proper context
const renderWithContext = (component: React.ReactElement) => {
  return render(React.createElement(TestWrapper, {}, component))
}

// Generators for test data
const yieldDataGenerator = fc.record({
  usdyBalance: fc.float({ min: 0, max: 100000, noNaN: true }),
  musdBalance: fc.float({ min: 0, max: 100000, noNaN: true }),
  totalYieldEarned: fc.float({ min: 0, max: 10000, noNaN: true }),
  currentRWAValue: fc.float({ min: 0, max: 200000, noNaN: true }),
  apy: fc.float({ min: 0, max: 50, noNaN: true }),
  balance: fc.float({ min: 0, max: 100000, noNaN: true }),
  percentage: fc.integer({ min: 0, max: 100 })
})

const bucketPropsGenerator = fc.record({
  name: fc.constantFrom('Billings', 'Savings', 'Growth', 'Instant'),
  id: fc.constantFrom('billings', 'savings', 'growth', 'instant'),
  color: fc.constantFrom('#EF4444', '#3B82F6', '#EAB308', '#22C55E'),
  description: fc.string({ minLength: 10, maxLength: 50 }),
  isYielding: fc.boolean()
})

describe('Property Test: Yield Display Correctness', () => {
  it('should accurately display APY rates for any yield configuration', () => {
    fc.assert(
      fc.property(yieldDataGenerator, bucketPropsGenerator, (yieldData, bucketProps) => {
        const bucketCardProps = {
          ...bucketProps,
          balance: yieldData.balance,
          percentage: yieldData.percentage,
          icon: Droplet,
          apy: yieldData.apy,
          usdyBalance: yieldData.usdyBalance,
          musdBalance: yieldData.musdBalance,
          totalYieldEarned: yieldData.totalYieldEarned,
          currentRWAValue: yieldData.currentRWAValue,
        }

        const { container } = renderWithContext(React.createElement(BucketCard, bucketCardProps))

        // If APY is provided and yielding, it should be displayed
        if (yieldData.apy > 0 && (bucketProps.isYielding || yieldData.apy)) {
          const apyElement = container.querySelector('[class*="text-green-400"]')
          expect(apyElement).toBeTruthy()
          
          if (apyElement) {
            const apyText = apyElement.textContent || ''
            // Should contain the APY value formatted correctly
            expect(apyText).toMatch(/\+\d+(\.\d+)?%\s*APY/)
            
            // Extract the displayed APY value
            const displayedAPY = parseFloat(apyText.match(/\+(\d+(?:\.\d+)?)%/)?.[1] || '0')
            
            // Should match the provided APY (within reasonable precision)
            expect(Math.abs(displayedAPY - yieldData.apy)).toBeLessThan(0.1)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should correctly display RWA token holdings when present', () => {
    fc.assert(
      fc.property(yieldDataGenerator, bucketPropsGenerator, (yieldData, bucketProps) => {
        const bucketCardProps = {
          ...bucketProps,
          balance: yieldData.balance,
          percentage: yieldData.percentage,
          icon: Droplet,
          usdyBalance: yieldData.usdyBalance,
          musdBalance: yieldData.musdBalance,
          totalYieldEarned: yieldData.totalYieldEarned,
          currentRWAValue: yieldData.currentRWAValue,
        }

        const { container } = renderWithContext(React.createElement(BucketCard, bucketCardProps))

        const hasRWAHoldings = yieldData.usdyBalance > 0 || yieldData.musdBalance > 0 || yieldData.totalYieldEarned > 0

        if (hasRWAHoldings) {
          // Should display RWA Holdings section
          const rwaSection = container.querySelector('[class*="bg-background/50"]')
          expect(rwaSection).toBeTruthy()

          // Should display "RWA Holdings" text
          expect(container.textContent).toContain('RWA Holdings')

          // If USDY balance exists, should display it
          if (yieldData.usdyBalance > 0) {
            expect(container.textContent).toContain('USDY:')
            expect(container.textContent).toContain(yieldData.usdyBalance.toFixed(4))
          }

          // If mUSD balance exists, should display it
          if (yieldData.musdBalance > 0) {
            expect(container.textContent).toContain('mUSD:')
            expect(container.textContent).toContain(yieldData.musdBalance.toFixed(4))
          }

          // Should display total yield earned if > 0
          if (yieldData.totalYieldEarned > 0) {
            const yieldText = container.textContent || ''
            expect(yieldText).toMatch(/\+\$\d+\.\d{2}/)
          }

          // Should display total RWA value if > 0
          if (yieldData.currentRWAValue > 0) {
            expect(container.textContent).toContain('Total RWA Value:')
            expect(container.textContent).toContain(`$${yieldData.currentRWAValue.toFixed(2)}`)
          }
        } else {
          // Should not display RWA Holdings section when no holdings
          expect(container.textContent).not.toContain('RWA Holdings')
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should display total yield earned accurately for any yield amount', () => {
    fc.assert(
      fc.property(yieldDataGenerator, bucketPropsGenerator, (yieldData, bucketProps) => {
        const bucketCardProps = {
          ...bucketProps,
          balance: yieldData.balance,
          percentage: yieldData.percentage,
          icon: Droplet,
          totalYieldEarned: yieldData.totalYieldEarned,
          usdyBalance: yieldData.usdyBalance,
          musdBalance: yieldData.musdBalance,
          currentRWAValue: yieldData.currentRWAValue,
        }

        const { container } = renderWithContext(React.createElement(BucketCard, bucketCardProps))

        const hasYieldEarned = yieldData.totalYieldEarned > 0
        const hasAnyRWAData = yieldData.usdyBalance > 0 || yieldData.musdBalance > 0 || yieldData.totalYieldEarned > 0

        if (hasYieldEarned && hasAnyRWAData) {
          // Should display yield earned with green color and + prefix
          const yieldElements = container.querySelectorAll('[class*="text-green-400"]')
          let foundYieldDisplay = false

          yieldElements.forEach(element => {
            const text = element.textContent || ''
            if (text.includes('+$') && text.includes(yieldData.totalYieldEarned.toFixed(2))) {
              foundYieldDisplay = true
            }
          })

          expect(foundYieldDisplay).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain consistent formatting across all yield values', () => {
    fc.assert(
      fc.property(yieldDataGenerator, bucketPropsGenerator, (yieldData, bucketProps) => {
        const bucketCardProps = {
          ...bucketProps,
          balance: yieldData.balance,
          percentage: yieldData.percentage,
          icon: Droplet,
          apy: yieldData.apy,
          usdyBalance: yieldData.usdyBalance,
          musdBalance: yieldData.musdBalance,
          totalYieldEarned: yieldData.totalYieldEarned,
          currentRWAValue: yieldData.currentRWAValue,
        }

        const { container } = renderWithContext(React.createElement(BucketCard, bucketCardProps))

        const text = container.textContent || ''

        // All currency values should be formatted with 2 decimal places
        const currencyMatches = text.match(/\$\d+\.\d{2}/g)
        if (currencyMatches) {
          currencyMatches.forEach(match => {
            // Should have exactly 2 decimal places
            expect(match).toMatch(/\$\d+\.\d{2}$/)
          })
        }

        // Token balances should be formatted with 4 decimal places
        if (yieldData.usdyBalance > 0) {
          expect(text).toContain(yieldData.usdyBalance.toFixed(4))
        }
        if (yieldData.musdBalance > 0) {
          expect(text).toContain(yieldData.musdBalance.toFixed(4))
        }

        // APY should be formatted as percentage with % symbol
        if (yieldData.apy > 0 && (bucketProps.isYielding || yieldData.apy)) {
          const apyMatches = text.match(/\+\d+(\.\d+)?%\s*APY/g)
          expect(apyMatches).toBeTruthy()
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should handle edge cases with zero or very small values correctly', () => {
    fc.assert(
      fc.property(bucketPropsGenerator, (bucketProps) => {
        // Test with all zero values
        const zeroProps = {
          ...bucketProps,
          balance: 0,
          percentage: 0,
          icon: Droplet,
          apy: 0,
          usdyBalance: 0,
          musdBalance: 0,
          totalYieldEarned: 0,
          currentRWAValue: 0,
        }

        const { container: zeroContainer } = renderWithContext(React.createElement(BucketCard, zeroProps))

        // Should not display RWA section with all zeros
        expect(zeroContainer.textContent).not.toContain('RWA Holdings')

        // Test with very small values
        const smallProps = {
          ...bucketProps,
          balance: 0.01,
          percentage: 1,
          icon: Droplet,
          apy: 0.01,
          usdyBalance: 0.0001,
          musdBalance: 0.0001,
          totalYieldEarned: 0.01,
          currentRWAValue: 0.02,
        }

        const { container: smallContainer } = renderWithContext(React.createElement(BucketCard, smallProps))

        // Should handle small values gracefully
        const smallText = smallContainer.textContent || ''
        expect(smallText).toContain('$0.01') // Balance
        expect(smallText).toContain('RWA Holdings') // Should show RWA section
        expect(smallText).toContain('0.0001') // Token balances
      }),
      { numRuns: 50 }
    )
  })
})