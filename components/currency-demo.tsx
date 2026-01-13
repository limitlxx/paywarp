"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CurrencyDisplay, MultiCurrencyDisplay, CurrencyInput } from "@/components/currency-display"
import { useCurrency } from "@/hooks/use-currency"
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react"
import type { Currency } from "@/lib/types"

export function CurrencyDemo() {
  const { 
    currentCurrency, 
    setCurrency, 
    rates, 
    isLoading, 
    isStale, 
    lastError, 
    refreshRates,
    convertAmount,
    formatAmount 
  } = useCurrency()
  
  const [testAmount, setTestAmount] = useState(1000)

  const handleRefresh = async () => {
    await refreshRates()
  }

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
    if (lastError) return <AlertTriangle className="w-4 h-4 text-red-500" />
    if (isStale) return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Currency System Demo
            {getStatusIcon()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Currency Selection */}
          <div>
            <h3 className="text-sm font-medium mb-2">Current Currency</h3>
            <div className="flex gap-2">
              {(['USD', 'NGN', 'MNT'] as Currency[]).map((currency) => (
                <Button
                  key={currency}
                  variant={currentCurrency === currency ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrency(currency)}
                  className="glass border-purple-500/20"
                >
                  {currency}
                </Button>
              ))}
            </div>
          </div>

          {/* Rate Information */}
          {rates && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Exchange Rates</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="h-6 px-2"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">MNT/USD:</span>
                  <span className="ml-2 font-mono">{rates.MNT_USD.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">USD/NGN:</span>
                  <span className="ml-2 font-mono">{rates.USD_NGN.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Source: {rates.source} • Updated: {rates.lastUpdated.toLocaleTimeString()}
                {isStale && <span className="text-yellow-500 ml-2">(Stale)</span>}
              </div>
            </div>
          )}

          {/* Currency Input Demo */}
          <div>
            <h3 className="text-sm font-medium mb-2">Test Amount</h3>
            <CurrencyInput
              value={testAmount}
              onChange={setTestAmount}
              currency="USD"
              className="max-w-xs"
            />
          </div>

          {/* Single Currency Display */}
          <div>
            <h3 className="text-sm font-medium mb-2">Current Currency Display</h3>
            <CurrencyDisplay
              amount={testAmount}
              fromCurrency="USD"
              className="text-2xl font-bold"
            />
          </div>

          {/* Multi-Currency Display */}
          <div>
            <h3 className="text-sm font-medium mb-2">All Currencies</h3>
            <MultiCurrencyDisplay
              amount={testAmount}
              fromCurrency="USD"
              showAll={true}
            />
          </div>

          {/* Conversion Examples */}
          <div>
            <h3 className="text-sm font-medium mb-2">Conversion Examples</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>$100 USD →</span>
                <span className="font-mono">{formatAmount(convertAmount(100, 'USD', 'NGN'), 'NGN')}</span>
              </div>
              <div className="flex justify-between">
                <span>1000 MNT →</span>
                <span className="font-mono">{formatAmount(convertAmount(1000, 'MNT', 'USD'), 'USD')}</span>
              </div>
              <div className="flex justify-between">
                <span>₦50,000 →</span>
                <span className="font-mono">{formatAmount(convertAmount(50000, 'NGN', 'USD'), 'USD')}</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {lastError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {lastError}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}