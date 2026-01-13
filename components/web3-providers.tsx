'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { useTheme } from 'next-themes'
import { wagmiConfig } from '@/lib/wagmi'
import { ReactNode, useState } from 'react'
import { Web3ErrorBoundary, TransactionErrorBoundary } from '@/components/error-boundary'
import { useErrorHandler } from '@/hooks/use-error-handler'

// Import RainbowKit styles
import '@rainbow-me/rainbowkit/styles.css'

interface Web3ProvidersProps {
  children: ReactNode
}

function Web3ErrorProvider({ children }: { children: ReactNode }) {
  const { handleError } = useErrorHandler()

  // Create a stable QueryClient instance with error handling
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache blockchain data for 30 seconds by default
            staleTime: 30 * 1000,
            // Keep data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests 3 times with exponential backoff
            retry: (failureCount, error) => {
              // Don't retry certain types of errors
              if (error.message.includes('user rejected') || 
                  error.message.includes('insufficient funds')) {
                return false
              }
              return failureCount < 3
            },
            // Retry with exponential backoff
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Handle query errors
            onError: (error) => {
              handleError(error as Error, {
                component: 'QueryClient',
                action: 'query_error'
              })
            }
          },
          mutations: {
            // Handle mutation errors (transactions)
            onError: (error) => {
              handleError(error as Error, {
                component: 'QueryClient',
                action: 'mutation_error'
              })
            }
          }
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export function Web3Providers({ children }: Web3ProvidersProps) {
  const { theme } = useTheme()

  return (
    <Web3ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <Web3ErrorProvider>
          <RainbowKitProvider
            theme={theme === 'dark' ? darkTheme() : lightTheme()}
            showRecentTransactions={true}
            coolMode={true}
          >
            <TransactionErrorBoundary>
              {children}
            </TransactionErrorBoundary>
          </RainbowKitProvider>
        </Web3ErrorProvider>
      </WagmiProvider>
    </Web3ErrorBoundary>
  )
}