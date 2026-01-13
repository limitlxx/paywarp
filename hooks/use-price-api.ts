import { useState, useEffect } from 'react'
import { useNetwork } from './use-network'

interface PriceApiResponse {
  data: {
    amount_fiat: string
    converted_amount: Record<string, string>
    conversion_rate: {
      source: {
        fiat: string
        crypto: string
      }
      fiat: string
      usd_rate: string
      token_rates: Record<string, string>
    }
    payment_currency: string
    final_amount: string
    network: string
  }
}

interface UsePriceApiOptions {
  token: 'mnt' | 'usdc' | 'usdy' | 'musd'
  fiat_amount: number
  fiat_currency: string
  enabled?: boolean
}

export function usePriceApi({
  token,
  fiat_amount,
  fiat_currency,
  enabled = true
}: UsePriceApiOptions) {
  const [data, setData] = useState<PriceApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentNetwork } = useNetwork()

  const fetchPrice = async () => {
    if (!enabled || fiat_amount <= 0) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        token,
        fiat_amount: fiat_amount.toString(),
        fiat_currency,
        network: currentNetwork || 'sepolia',
        chain: 'mantle'
      })

      const response = await fetch(`/api/price?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch price')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrice()
  }, [token, fiat_amount, fiat_currency, currentNetwork, enabled])

  return {
    data,
    loading,
    error,
    refetch: fetchPrice
  }
}