"use client"

import React, { useState, useEffect } from 'react'
import { type Address, formatUnits, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Shield,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react'
import { useSettings, type TokenAllowance } from '@/hooks/use-settings'
import { useContracts } from '@/lib/contracts'
import { useTokenSpending, formatTokenAmount, type SpendingAllowance } from '@/lib/token-spending-service'
import { useToast } from '@/hooks/use-toast'

interface TokenAllowanceManagerProps {
  className?: string
}
 
import { useNetwork } from '@/hooks/use-network'

// Get network-specific tokens
function useNetworkTokens() {
  const { currentNetwork } = useNetwork()
  const { usdyTokenAddress, musdTokenAddress } = useContracts()
  
  // Base tokens available on Mantle
  const baseTokens = [
    { 
      address: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as Address, 
      symbol: 'USDC', 
      name: 'USD Coin', 
      decimals: 6 
    },
    { 
      address: '0x0000000000000000000000000000000000000000' as Address, // Native MNT
      symbol: 'MNT', 
      name: 'Mantle Token', 
      decimals: 18,
      isNative: true
    },
  ]
  
  // Add network-specific RWA tokens
  const networkTokens = []
  if (usdyTokenAddress && usdyTokenAddress !== '0x0000000000000000000000000000000000000000') {
    networkTokens.push({
      address: usdyTokenAddress,
      symbol: 'USDY',
      name: 'Ondo US Dollar Yield',
      decimals: 18
    })
  }
  
  if (musdTokenAddress && musdTokenAddress !== '0x0000000000000000000000000000000000000000') {
    networkTokens.push({
      address: musdTokenAddress,
      symbol: 'mUSD',
      name: 'Mountain USD',
      decimals: 18
    })
  }
  
  return [...baseTokens, ...networkTokens].filter(token => 
    token.address && (token.isNative || token.address !== '0x0000000000000000000000000000000000000000')
  )
}

export function TokenAllowanceManager({ className }: TokenAllowanceManagerProps) {
  const { address } = useAccount()
  const { 
    settings, 
    addTokenAllowance, 
    updateTokenAllowance, 
    removeTokenAllowance,
    clearTokenAllowances
  } = useSettings()
  
  const { bucketVaultAddress, payrollEngineAddress } = useContracts()
  const availableTokens = useNetworkTokens()
  const { toast } = useToast()
  
  const {
    approveTokenSpending,
    approveUnlimitedSpending,
    revokeTokenSpending,
    getAllowance,
    getAllSpendingAllowances,
    setupBucketAllowances,
    checkAutomationReadiness,
    isApproving
  } = useTokenSpending()
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState<string>('')
  const [selectedSpender, setSelectedSpender] = useState<Address | ''>('')
  const [allowanceAmount, setAllowanceAmount] = useState('')
  const [customTokenAddress, setCustomTokenAddress] = useState('')
  const [useCustomToken, setUseCustomToken] = useState(false)
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false)
  const [isLoadingAllowances, setIsLoadingAllowances] = useState(false)

  // Load existing allowances from blockchain on mount
  useEffect(() => {
    const loadExistingAllowances = async () => {
      if (!address || settings.tokenAllowances.length > 0) return // Don't load if already have allowances
      
      setIsLoadingAllowances(true)
      try {
        const allowances = await getAllSpendingAllowances()
        
        // Add any existing allowances that aren't already in settings
        allowances.forEach((allowance: SpendingAllowance) => {
          if (allowance.allowance > 0n) {
            addTokenAllowance({
              token: allowance.token,
              spender: allowance.spender,
              amount: allowance.allowance,
            })
          }
        })
      } catch (error) {
        console.error('Failed to load existing allowances:', error)
      } finally {
        setIsLoadingAllowances(false)
      }
    }

    loadExistingAllowances()
  }, [address, getAllSpendingAllowances, addTokenAllowance, settings.tokenAllowances.length])

  // Available spenders (contracts that can spend tokens)
  const availableSpenders = [
    { address: bucketVaultAddress, name: 'Bucket Vault', description: 'For bucket deposits and transfers' },
    { address: payrollEngineAddress, name: 'Payroll Engine', description: 'For payroll processing' },
  ].filter(spender => spender.address) as { address: Address; name: string; description: string }[]

  const handleAddAllowance = async () => {
    if (!selectedSpender || !allowanceAmount) return

    const tokenAddress = useCustomToken ? customTokenAddress as Address : selectedToken as Address
    const token = availableTokens.find(t => t.address === tokenAddress)
    const decimals = token?.decimals || 18

    // Check if this is a native token
    if (token?.isNative) {
      toast({
        title: "Native Token",
        description: "Native tokens (MNT) don't require approval - they can be spent directly by contracts.",
        variant: "destructive",
      })
      return
    }

    try {
      const amount = parseUnits(allowanceAmount, decimals)
      
      // Execute the approval transaction
      const result = await approveTokenSpending({
        tokenAddress,
        spenderAddress: selectedSpender,
        amount
      })
      
      if (result.success) {
        // Verify the allowance was actually set on-chain
        try {
          const actualAllowance = await getAllowance(tokenAddress, selectedSpender)
          
          if (actualAllowance >= amount) {
            // Check if this allowance already exists to prevent duplicates
            const existingIndex = settings.tokenAllowances.findIndex(
              existing => existing.token === tokenAddress && existing.spender === selectedSpender
            )
            
            if (existingIndex >= 0) {
              // Update existing allowance
              updateTokenAllowance(existingIndex, { amount: actualAllowance })
              toast({
                title: "Allowance Updated",
                description: `Successfully updated allowance to ${formatTokenAmount(actualAllowance, decimals)} ${token?.symbol || 'tokens'}.`,
              })
            } else {
              // Add new allowance
              addTokenAllowance({
                token: tokenAddress,
                spender: selectedSpender,
                amount: actualAllowance, // Use actual on-chain amount
              })
              toast({
                title: "Allowance Approved",
                description: `Successfully approved ${formatTokenAmount(actualAllowance, decimals)} ${token?.symbol || 'tokens'} for spending.`,
              })
            }

            // Reset form
            setSelectedToken('')
            setSelectedSpender('')
            setAllowanceAmount('')
            setCustomTokenAddress('')
            setUseCustomToken(false)
            setIsAddDialogOpen(false)
          } else {
            throw new Error('Allowance verification failed - transaction may not have been confirmed')
          }
        } catch (verifyError) {
          console.error('Error verifying allowance:', verifyError)
          toast({
            title: "Verification Failed",
            description: "Transaction completed but couldn't verify allowance. Please refresh and check manually.",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Approval Failed",
          description: result.error || "Failed to approve token spending.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error adding token allowance:', error)
      toast({
        title: "Approval Error",
        description: error instanceof Error ? error.message : "An error occurred during approval.",
        variant: "destructive",
      })
    }
  }

  // Quick setup for automation
  const handleQuickSetup = async () => {
    setIsCheckingReadiness(true)
    
    try {
      const usdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS as Address
      if (!usdcAddress) {
        toast({
          title: "Setup Error",
          description: "USDC token address not configured.",
          variant: "destructive",
        })
        return
      }

      // Only approve for bucket vault to avoid double approvals
      const result = await approveUnlimitedSpending(usdcAddress, bucketVaultAddress!)
      
      if (result.success) {
        // Verify the allowance was actually set
        try {
          const actualAllowance = await getAllowance(usdcAddress, bucketVaultAddress!)
          
          if (actualAllowance > 0n) {
            // Check if this allowance already exists to prevent duplicates
            const existingIndex = settings.tokenAllowances.findIndex(
              existing => existing.token === usdcAddress && existing.spender === bucketVaultAddress!
            )
            
            if (existingIndex >= 0) {
              // Update existing allowance
              updateTokenAllowance(existingIndex, { amount: actualAllowance })
            } else {
              // Add new allowance
              addTokenAllowance({
                token: usdcAddress,
                spender: bucketVaultAddress!,
                amount: actualAllowance,
              })
            }

            toast({
              title: "Quick Setup Complete",
              description: "Successfully set up USDC allowance for bucket operations.",
            })
          } else {
            throw new Error('Allowance verification failed')
          }
        } catch (verifyError) {
          console.error('Error verifying quick setup:', verifyError)
          toast({
            title: "Verification Failed",
            description: "Setup completed but couldn't verify allowance. Please refresh and check manually.",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Setup Failed",
          description: result.error || "Failed to set up token allowance.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Quick setup failed:', error)
      toast({
        title: "Setup Error",
        description: error instanceof Error ? error.message : "Quick setup failed.",
        variant: "destructive",
      })
    } finally {
      setIsCheckingReadiness(false)
    }
  }

  const handleToggleAllowance = (index: number, enabled: boolean) => {
    updateTokenAllowance(index, { enabled })
  }

  const handleUpdateAmount = async (index: number, newAmount: string) => {
    const allowance = settings.tokenAllowances[index]
    const token = availableTokens.find(t => t.address === allowance.token)
    const decimals = token?.decimals || 18

    try {
      const amount = parseUnits(newAmount, decimals)
      
      // Execute new approval transaction
      const result = await approveTokenSpending({
        tokenAddress: allowance.token,
        spenderAddress: allowance.spender,
        amount
      })
      
      if (result.success) {
        // Verify the new allowance
        const actualAllowance = await getAllowance(allowance.token, allowance.spender)
        updateTokenAllowance(index, { amount: actualAllowance })
        
        toast({
          title: "Allowance Updated",
          description: `Successfully updated allowance to ${formatTokenAmount(actualAllowance, decimals)} ${token?.symbol || 'tokens'}.`,
        })
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Failed to update allowance.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error updating allowance amount:', error)
      toast({
        title: "Update Error",
        description: error instanceof Error ? error.message : "Failed to update allowance.",
        variant: "destructive",
      })
    }
  }

  const getTokenInfo = (address: Address) => {
    return availableTokens.find(t => t.address === address) || {
      address,
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18
    }
  }

  const getSpenderInfo = (address: Address) => {
    return availableSpenders.find(s => s.address === address) || {
      address,
      name: 'Unknown Contract',
      description: 'Custom contract'
    }
  }

  const formatAllowanceAmount = (amount: bigint, decimals: number) => {
    // Use the same logic as formatTokenAmount for consistency
    return formatTokenAmount(amount, decimals, 2)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Token Spending Allowances
            </CardTitle>
            <CardDescription>
              Manage token approvals for automated contract interactions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                setIsLoadingAllowances(true)
                try {
                  const allowances = await getAllSpendingAllowances()
                  // Clear existing and reload from blockchain
                  clearTokenAllowances()
                  
                  allowances.forEach((allowance: SpendingAllowance) => {
                    if (allowance.allowance > 0n) {
                      addTokenAllowance({
                        token: allowance.token,
                        spender: allowance.spender,
                        amount: allowance.allowance,
                      })
                    }
                  })
                  
                  toast({
                    title: "Allowances Refreshed",
                    description: `Loaded ${allowances.filter((a: SpendingAllowance) => a.allowance > 0n).length} active allowances from blockchain.`,
                  })
                } catch (error) {
                  toast({
                    title: "Refresh Failed",
                    description: "Failed to refresh allowances from blockchain.",
                    variant: "destructive",
                  })
                } finally {
                  setIsLoadingAllowances(false)
                }
              }}
              disabled={isLoadingAllowances || !address}
            >
              {isLoadingAllowances ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickSetup}
              disabled={isCheckingReadiness || isApproving}
            >
              {isCheckingReadiness ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Quick Setup
                </>
              )}
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Allowance
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Token Allowance</DialogTitle>
                <DialogDescription>
                  Set spending limits for contracts to interact with your tokens
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Token Selection</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Switch
                      checked={useCustomToken}
                      onCheckedChange={setUseCustomToken}
                    />
                    <span className="text-sm">Use custom token address</span>
                  </div>
                  
                  {useCustomToken ? (
                    <Input
                      placeholder="0x..."
                      value={customTokenAddress}
                      onChange={(e) => setCustomTokenAddress(e.target.value)}
                    />
                  ) : (
                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a token" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTokens.map((token) => (
                          <SelectItem key={token.address} value={token.address}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{token.symbol}</span>
                              <span className="text-muted-foreground">{token.name}</span>
                              {token.isNative && (
                                <Badge variant="secondary" className="text-xs">
                                  Native - No Approval Needed
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="spender">Spender Contract</Label>
                  <Select value={selectedSpender} onValueChange={(value) => setSelectedSpender(value as Address)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a contract" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSpenders.map((spender) => (
                        <SelectItem key={spender.address} value={spender.address}>
                          <div>
                            <div className="font-medium">{spender.name}</div>
                            <div className="text-xs text-muted-foreground">{spender.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount">Allowance Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={allowanceAmount}
                    onChange={(e) => setAllowanceAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum amount the contract can spend
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddAllowance}
                    disabled={!selectedSpender || !allowanceAmount || (!selectedToken && !customTokenAddress) || isApproving}
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      'Add Allowance'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoadingAllowances ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading existing allowances...</p>
          </div>
        ) : settings.tokenAllowances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No token allowances configured</p>
            <p className="text-sm">Add allowances to enable automated token interactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {settings.tokenAllowances.map((allowance: TokenAllowance, index: number) => {
              const tokenInfo = getTokenInfo(allowance.token)
              const spenderInfo = getSpenderInfo(allowance.spender)
              const formattedAmount = formatAllowanceAmount(allowance.amount, tokenInfo.decimals)

              return (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">{tokenInfo.symbol}</Badge>
                            <Badge variant="outline">{spenderInfo.name}</Badge>
                            {allowance.enabled ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {spenderInfo.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={allowance.enabled}
                          onCheckedChange={(checked) => handleToggleAllowance(index, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTokenAllowance(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Current Allowance</Label>
                        <p className="font-mono text-lg">{formatTokenAmount(allowance.amount, tokenInfo.decimals)} {tokenInfo.symbol}</p>
                      </div>
                      <div>
                        <Label htmlFor={`amount-${index}`} className="text-xs text-muted-foreground">
                          Update Amount
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`amount-${index}`}
                            type="number"
                            placeholder="0.00"
                            className="h-8"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value) {
                                handleUpdateAmount(index, e.currentTarget.value)
                                e.currentTarget.value = ''
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={(e) => {
                              const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement
                              if (input?.value) {
                                handleUpdateAmount(index, input.value)
                                input.value = ''
                              }
                            }}
                            disabled={isApproving}
                          >
                            {isApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Update'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {!allowance.enabled && (
                      <Alert className="mt-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          This allowance is disabled. Enable it to allow the contract to spend your tokens.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {settings.tokenAllowances.length > 0 && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Token allowances enable contracts to spend your tokens up to the specified limits. 
              You can revoke or modify these at any time for security.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}