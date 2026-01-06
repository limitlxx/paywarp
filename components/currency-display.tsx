"use client"

import { useCurrency } from "@/hooks/use-currency"
import { cn } from "@/lib/utils"
import type { Currency } from "@/lib/types"

interface CurrencyDisplayProps {
  amount: number
  fromCurrency?: Currency
  toCurrency?: Currency
  precision?: number
  className?: string
  showOriginal?: boolean
  loading?: boolean
}

export function CurrencyDisplay({
  amount,
  fromCurrency = 'USD',
  toCurrency,
  precision = 2,
  className,
  showOriginal = false,
  loading = false
}: CurrencyDisplayProps) {
  const { currentCurrency, convertAmount, formatAmount, isLoading } = useCurrency()
  
  const targetCurrency = toCurrency || currentCurrency
  const isConverting = fromCurrency !== targetCurrency
  
  if (loading || isLoading) {
    return (
      <span className={cn("animate-pulse bg-muted rounded w-16 h-4 inline-block", className)} />
    )
  }
  
  const convertedAmount = isConverting ? convertAmount(amount, fromCurrency, targetCurrency) : amount
  const formattedAmount = formatAmount(convertedAmount, targetCurrency, precision)
  
  if (showOriginal && isConverting) {
    const originalFormatted = formatAmount(amount, fromCurrency, precision)
    return (
      <span className={cn("", className)}>
        <span className="font-medium">{formattedAmount}</span>
        <span className="text-muted-foreground text-sm ml-1">({originalFormatted})</span>
      </span>
    )
  }
  
  return (
    <span className={cn("font-medium", className)}>
      {formattedAmount}
    </span>
  )
}

interface MultiCurrencyDisplayProps {
  amount: number
  fromCurrency?: Currency
  precision?: number
  className?: string
  showAll?: boolean
}

export function MultiCurrencyDisplay({
  amount,
  fromCurrency = 'USD',
  precision = 2,
  className,
  showAll = false
}: MultiCurrencyDisplayProps) {
  const { currentCurrency, convertAmount, formatAmount, isLoading } = useCurrency()
  
  if (isLoading) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="animate-pulse bg-muted rounded w-20 h-4" />
        <div className="animate-pulse bg-muted rounded w-16 h-3" />
      </div>
    )
  }
  
  const currencies: Currency[] = showAll ? ['USD', 'NGN', 'MNT'] : [currentCurrency]
  
  return (
    <div className={cn("", className)}>
      {currencies.map((currency, index) => {
        const convertedAmount = convertAmount(amount, fromCurrency, currency)
        const formattedAmount = formatAmount(convertedAmount, currency, precision)
        const isPrimary = currency === currentCurrency
        
        return (
          <div
            key={currency}
            className={cn(
              "transition-all",
              isPrimary ? "text-foreground font-medium" : "text-muted-foreground text-sm",
              index > 0 && "mt-1"
            )}
          >
            {formattedAmount}
          </div>
        )
      })}
    </div>
  )
}

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  currency?: Currency
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CurrencyInput({
  value,
  onChange,
  currency,
  placeholder = "0.00",
  className,
  disabled = false
}: CurrencyInputProps) {
  const { currentCurrency, formatAmount } = useCurrency()
  
  const targetCurrency = currency || currentCurrency
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/[^0-9.]/g, '')
    const numericValue = parseFloat(inputValue) || 0
    onChange(numericValue)
  }
  
  const symbols = {
    USD: '$',
    NGN: '₦',
    MNT: 'MNT'
  }
  
  return (
    <div className={cn("relative", className)}>
      {targetCurrency !== 'MNT' && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {symbols[targetCurrency]}
        </span>
      )}
      <input
        type="text"
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full px-3 py-2 bg-background border border-input rounded-md",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          targetCurrency !== 'MNT' ? "pl-8" : "pr-12"
        )}
      />
      {targetCurrency === 'MNT' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {symbols[targetCurrency]}
        </span>
      )}
    </div>
  )
}