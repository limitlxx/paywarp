'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePriceApi } from '@/hooks/use-price-api'
import { getCurrencyManager } from '@/lib/currency-manager'
import { useNetwork } from '@/hooks/use-network'

export function PriceTest() {
  const [amount, setAmount] = useState(1000)
  const [currency, setCurrency] = useState('NGN')
  const [token, setToken] = useState<'mnt' | 'usdc' | 'usdy' | 'musd'>('mnt')
  const { currentNetwork } = useNetwork()

  const { data, loading, error, refetch } = usePriceApi({
    token,
    fiat_amount: amount,
    fiat_currency: currency,
    enabled: amount > 0
  })

  const handleRefreshRates = async () => {
    try {
      const manager = getCurrencyManager(currentNetwork)
      await manager.refreshRates()
      refetch()
    } catch (err) {
      console.error('Failed to refresh rates:', err)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Price API Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Enter amount"
          />
        </div>

        <div>
          <Label htmlFor="currency">Fiat Currency</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="NGN">NGN (Nigerian Naira)</option>
            <option value="USD">USD (US Dollar)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="GBP">GBP (British Pound)</option>
          </select>
        </div>

        <div>
          <Label htmlFor="token">Token</Label>
          <select
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value as any)}
            className="w-full p-2 border rounded"
          >
            <option value="mnt">MNT (Mantle)</option>
            <option value="usdc">USDC</option>
            <option value="usdy">USDY</option>
            <option value="musd">MUSD</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button onClick={refetch} disabled={loading}>
            {loading ? 'Loading...' : 'Get Price'}
          </Button>
          <Button onClick={handleRefreshRates} variant="outline">
            Refresh Rates
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
            Error: {error}
          </div>
        )}

        {data && (
          <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded">
            <div className="font-semibold">
              {data.data.amount_fiat} {data.data.conversion_rate.fiat} = {data.data.final_amount} {data.data.payment_currency}
            </div>
            <div className="text-sm text-gray-600">
              <div>Network: {data.data.network}</div>
              <div>Source: {data.data.conversion_rate.source.crypto}</div>
              <div>USD Rate: {data.data.conversion_rate.usd_rate}</div>
              <div>Token Rates:</div>
              <ul className="ml-4">
                {Object.entries(data.data.conversion_rate.token_rates).map(([pair, rate]) => (
                  <li key={pair}>{pair}: ${rate}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}