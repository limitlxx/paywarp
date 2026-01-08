"use client"

import type * as React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Web3Providers } from "@/components/web3-providers"
import { NetworkProvider } from "@/hooks/use-network"
import { WalletProvider } from "@/hooks/use-wallet"
import { CurrencyProvider } from "@/hooks/use-currency"
import { NavigationProvider } from "@/components/navigation-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <Web3Providers>
        <NetworkProvider>
          <WalletProvider>
            <CurrencyProvider>
              <NavigationProvider>{children}</NavigationProvider>
            </CurrencyProvider>
          </WalletProvider>
        </NetworkProvider>
      </Web3Providers>
    </ThemeProvider>
  )
}
