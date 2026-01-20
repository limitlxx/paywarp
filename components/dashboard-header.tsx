"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ChevronDown, History, Gift, SlidersHorizontal, Zap, LogOut, RefreshCw, AlertTriangle, Menu, X } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/hooks/use-wallet"
import { useCurrency } from "@/hooks/use-currency"
import { useRouter } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import type { Currency } from "@/lib/types"

export function DashboardHeader() {
  const { isConnected, address, disconnect } = useWallet()
  const { currentCurrency, setCurrency, isLoading, isStale, refreshRates, lastError } = useCurrency()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleDisconnect = () => {
    disconnect()
    router.push("/")
  }

  const handleCurrencyChange = (currency: Currency) => {
    setCurrency(currency)
  }

  const handleRefreshRates = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await refreshRates()
  }

  const getCurrencyLabel = (currency: Currency) => {
    const labels = {
      USD: 'USD ($)',
      NGN: 'NGN (₦)',
      MNT: 'MNT'
    }
    return labels[currency]
  }

  const getCurrencyIcon = () => {
    if (isLoading) {
      return <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />
    }
    if (lastError || isStale) {
      return <AlertTriangle className="w-3 h-3 text-yellow-500" />
    }
    return null
  }

  return (
    <header className="h-16 glass-card border-b border-white/5 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 w-full">
      {/* Logo */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-base sm:text-lg font-bold text-white tracking-tight">PayWarp</span>
        </Link>
        
        {/* Desktop Currency Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="hidden md:flex glass border-purple-500/20 h-9 items-center gap-2 text-foreground bg-transparent"
              disabled={isLoading}
            >
              <span className="text-sm">{getCurrencyLabel(currentCurrency)}</span>
              {getCurrencyIcon()}
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="glass border-purple-500/20">
            <DropdownMenuItem 
              onClick={() => handleCurrencyChange("USD")} 
              className="text-foreground hover:bg-purple-500/20"
            >
              USD ($)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleCurrencyChange("NGN")} 
              className="text-foreground hover:bg-purple-500/20"
            >
              NGN (₦)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleCurrencyChange("MNT")} 
              className="text-foreground hover:bg-purple-500/20"
            >
              MNT
            </DropdownMenuItem>
            {(isStale || lastError) && (
              <>
                <div className="border-t border-purple-500/20 my-1" />
                <DropdownMenuItem 
                  onClick={handleRefreshRates}
                  className="text-foreground hover:bg-purple-500/20 flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh Rates
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Desktop Configure Splits Button */}
        {/* <Button
          variant="outline"
          className="hidden lg:flex glass border-purple-500/20 h-9 items-center gap-2 text-foreground bg-transparent"
        >
          <Link href="/history">
          <SlidersHorizontal className="w-4 h-4 text-purple-400" />
          <span className="text-sm">Configure Splits</span>
          </Link>
        </Button> */}
      </div>

      {/* Desktop Actions */}
      <div className="hidden md:flex items-center gap-2 lg:gap-3">
        <Button
          variant="outline"
          className="glass border-purple-500/20 h-9 flex items-center gap-2 text-foreground bg-transparent"
          asChild
        >
          <Link href="/history">
            <History className="w-4 h-4 text-purple-400" />
            <span className="hidden lg:inline text-sm">Warp History</span>
          </Link>
        </Button>

        <Button className="gradient-primary text-white border-0 h-9 flex items-center gap-2" asChild>
          <Link href="/wrapped">
            <Gift className="w-4 h-4" />
            <span className="text-sm">{new Date().getFullYear()} Wrapped</span>
          </Link>
        </Button>

        {/* Custom RainbowKit Button */}
        <div className="custom-rainbowkit">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== 'loading'
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus ||
                  authenticationStatus === 'authenticated')

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <Button
                          onClick={openConnectModal}
                          className="gradient-primary text-white border-0 h-9 px-4"
                        >
                          Connect Wallet
                        </Button>
                      )
                    }

                    if (chain.unsupported) {
                      return (
                        <Button
                          onClick={openChainModal}
                          className="bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 h-9"
                        >
                          Wrong network
                        </Button>
                      )
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={openChainModal}
                          variant="outline"
                          className="glass border-purple-500/30 h-9 px-3 hidden lg:flex items-center gap-2"
                        >
                          {chain.hasIcon && (
                            <div
                              style={{
                                background: chain.iconBackground,
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                overflow: 'hidden',
                              }}
                            >
                              {chain.iconUrl && (
                                <img
                                  alt={chain.name ?? 'Chain icon'}
                                  src={chain.iconUrl}
                                  style={{ width: 16, height: 16 }}
                                />
                              )}
                            </div>
                          )}
                          <span className="text-sm">{chain.name}</span>
                        </Button>

                        <div
                          className="h-9 glass border-purple-500/30 rounded-lg px-3 flex items-center gap-2 cursor-pointer hover:bg-white/5 group"
                          onClick={openAccountModal}
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-sm font-mono text-muted-foreground group-hover:text-purple-400 transition-colors">
                            {account.displayName}
                          </span>
                          <LogOut className="w-3 h-3 text-muted-foreground group-hover:text-purple-400 ml-1 transition-colors" />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className="flex md:hidden items-center gap-2">
        {/* Mobile RainbowKit Button */}
        <div className="custom-rainbowkit-mobile">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              authenticationStatus,
              mounted,
            }) => {
              const ready = mounted && authenticationStatus !== 'loading'
              const connected =
                ready &&
                account &&
                chain &&
                (!authenticationStatus ||
                  authenticationStatus === 'authenticated')

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <Button
                          onClick={openConnectModal}
                          size="sm"
                          className="gradient-primary text-white border-0 h-8 px-3 text-xs"
                        >
                          Connect
                        </Button>
                      )
                    }

                    if (chain.unsupported) {
                      return (
                        <Button
                          onClick={openChainModal}
                          size="sm"
                          className="bg-red-500/20 border border-red-500/30 text-red-400 h-8 px-3 text-xs"
                        >
                          Wrong network
                        </Button>
                      )
                    }

                    return (
                      <div
                        className="h-8 glass border-purple-500/30 rounded-lg px-2 flex items-center gap-1.5 cursor-pointer hover:bg-white/5"
                        onClick={openAccountModal}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-mono text-muted-foreground">
                          {account.displayName}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )
            }}
          </ConnectButton.Custom>
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-purple-400"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="glass border-purple-500/20 w-[280px] sm:w-[320px]">
            <div className="flex flex-col gap-4 mt-8">
              {/* Currency Selector */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Currency</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full glass border-purple-500/20 h-10 flex items-center justify-between text-foreground bg-transparent"
                      disabled={isLoading}
                    >
                      <span>{getCurrencyLabel(currentCurrency)}</span>
                      <div className="flex items-center gap-2">
                        {getCurrencyIcon()}
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass border-purple-500/20 w-[240px]">
                    <DropdownMenuItem 
                      onClick={() => handleCurrencyChange("USD")} 
                      className="text-foreground hover:bg-purple-500/20"
                    >
                      USD ($)
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleCurrencyChange("NGN")} 
                      className="text-foreground hover:bg-purple-500/20"
                    >
                      NGN (₦)
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleCurrencyChange("MNT")} 
                      className="text-foreground hover:bg-purple-500/20"
                    >
                      MNT
                    </DropdownMenuItem>
                    {(isStale || lastError) && (
                      <>
                        <div className="border-t border-purple-500/20 my-1" />
                        <DropdownMenuItem 
                          onClick={handleRefreshRates}
                          className="text-foreground hover:bg-purple-500/20 flex items-center gap-2"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Refresh Rates
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Navigation Links */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Quick Actions</p>
                <Button
                  variant="outline"
                  className="w-full glass border-purple-500/20 h-10 flex items-center justify-start gap-3 text-foreground bg-transparent"
                  asChild
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/history">
                    <History className="w-4 h-4 text-purple-400" />
                    <span>Warp History</span>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="w-full glass border-purple-500/20 h-10 flex items-center justify-start gap-3 text-foreground bg-transparent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                  <span>Configure Splits</span>
                </Button>

                <Button
                  className="w-full gradient-primary text-white border-0 h-10 flex items-center justify-start gap-3"
                  asChild
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/wrapped">
                    <Gift className="w-4 h-4" />
                    <span>{new Date().getFullYear()} Wrapped</span>
                  </Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
