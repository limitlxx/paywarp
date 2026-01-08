"use client"

import { useAccount } from "wagmi"
import { useUserRegistration } from "@/lib/user-registration"
import { useTransactionHistory } from "@/hooks/use-transaction-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, User, Database, AlertCircle } from "lucide-react"

export function DebugTransactionStatus() {
  const { address, isConnected } = useAccount()
  const { isRegistered, registerUser, isPending } = useUserRegistration()
  const { transactions, isLoading, error, fromCache, syncHistory } = useTransactionHistory()

  const handleSync = async () => {
    await syncHistory({ forceSync: true, maxBlocks: 500 })
  }

  return (
    <Card className="glass-card border-yellow-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-yellow-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Debug: Transaction Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">Wallet Status</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Connected:</span>
                <span className={isConnected ? "text-green-400" : "text-red-400"}>
                  {isConnected ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Address:</span>
                <span className="text-xs font-mono">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "None"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">Registration Status</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Registered:</span>
                <span className={isRegistered ? "text-green-400" : "text-red-400"}>
                  {isRegistered ? "Yes" : "No"}
                </span>
              </div>
              {!isRegistered && address && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => {
                    // This would need to be implemented with proper signature flow
                    console.log("Registration would happen here")
                  }}
                  disabled={isPending}
                >
                  <User className="w-3 h-3 mr-1" />
                  {isPending ? "Registering..." : "Register Wallet"}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-foreground">Transaction Data</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Loading:</span>
                <span className={isLoading ? "text-yellow-400" : "text-green-400"}>
                  {isLoading ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Count:</span>
                <span className="text-blue-400">{transactions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>From Cache:</span>
                <span className={fromCache ? "text-purple-400" : "text-green-400"}>
                  {fromCache ? "Yes" : "No"}
                </span>
              </div>
              {error && (
                <div className="text-red-400 text-xs mt-1">
                  Error: {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Force Sync
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              console.log("=== DEBUG INFO ===")
              console.log("Address:", address)
              console.log("Is Registered:", isRegistered)
              console.log("Transactions:", transactions)
              console.log("Error:", error)
              console.log("From Cache:", fromCache)
              console.log("==================")
            }}
            className="gap-2"
          >
            <Database className="w-3 h-3" />
            Log Debug Info
          </Button>
        </div>

        {transactions.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold text-foreground mb-2">Recent Transactions</h4>
            <div className="space-y-1 text-xs">
              {transactions.slice(0, 3).map((tx, index) => (
                <div key={tx.id} className="flex justify-between items-center p-2 bg-black/20 rounded">
                  <span>{tx.type}</span>
                  <span>{(Number(tx.amount) / 1e18).toFixed(4)} tokens</span>
                  <span className="font-mono">{tx.hash.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}