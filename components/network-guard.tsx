"use client"

import { useNetwork } from "@/hooks/use-network"
import { useAccount } from "wagmi"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Network } from "lucide-react"
import { areContractsDeployed } from "@/lib/contracts"

interface NetworkGuardProps {
  children: React.ReactNode
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  const { currentNetwork, switchToTestnet, isNetworkSupported } = useNetwork()
  const { isConnected } = useAccount()

  // Only show warning if connected and contracts aren't deployed
  const contractsDeployed = areContractsDeployed(currentNetwork)
  const showWarning = isConnected && !contractsDeployed

  if (!showWarning) {
    return <>{children}</>
  }

  return (
    <div className="space-y-4">
      <Alert className="border-amber-500/20 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Contracts not available on {currentNetwork === 'mainnet' ? 'Mainnet' : 'current network'}</p>
              <p className="text-sm text-amber-300/80 mt-1">
                PayWarp contracts are currently deployed on Sepolia testnet only. Please switch networks to use the app.
              </p>
            </div>
            <Button 
              onClick={switchToTestnet}
              variant="outline" 
              size="sm"
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 ml-4"
            >
              <Network className="w-4 h-4 mr-2" />
              Switch to Sepolia
            </Button>
          </div>
        </AlertDescription>
      </Alert>
      {children}
    </div>
  )
}