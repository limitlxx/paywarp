"use client"

import { useBucketBalances } from "@/hooks/use-bucket-balances"
import { useWallet } from "@/hooks/use-wallet"
import { useNetwork } from "@/hooks/use-network"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function PayrollDebug() {
  const { buckets, isLoading: bucketsLoading, error: bucketsError } = useBucketBalances()
  const { isConnected, address } = useWallet()
  const { currentNetwork } = useNetwork()

  return (
    <Card className="glass-card border-yellow-500/20">
      <CardHeader>
        <CardTitle className="text-sm text-yellow-400">Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <strong>Wallet:</strong> {isConnected ? '✅ Connected' : '❌ Not Connected'}
        </div>
        <div>
          <strong>Address:</strong> {address || 'None'}
        </div>
        <div>
          <strong>Network:</strong> {currentNetwork}
        </div>
        <div>
          <strong>Buckets Loading:</strong> {bucketsLoading ? '⏳ Loading' : '✅ Loaded'}
        </div>
        <div>
          <strong>Buckets Count:</strong> {buckets.length}
        </div>
        <div>
          <strong>Buckets Error:</strong> {bucketsError || 'None'}
        </div>
        <div>
          <strong>Instant Bucket:</strong> {buckets.find(b => b.name === 'instant')?.formattedBalance || 'Not found'}
        </div>
        <div>
          <strong>Available Buckets:</strong>
          <ul className="ml-2">
            {buckets.map(b => (
              <li key={b.name}>{b.name}: ${b.formattedBalance}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}