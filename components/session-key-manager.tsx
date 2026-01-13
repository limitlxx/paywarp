/**
 * Session Key Manager Component
 * 
 * Provides UI for creating, managing, and monitoring session keys
 * with automation controls and usage statistics.
 */

"use client"

import React, { useState } from 'react'
import { type Address } from 'viem'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  AlertTriangle, 
  Key, 
  Plus, 
  Trash2, 
  Clock, 
  DollarSign, 
  Activity,
  Shield,
  Zap
} from 'lucide-react'
import { useSessionKeys } from '@/hooks/use-session-keys'
import { type SessionConfigType, DEFAULT_SESSION_CONFIGS } from '@/lib/session-keys'
import { sessionKeyStorage } from '@/lib/session-key-storage'
import { formatEther } from 'viem'

// Interface for the actual state structure returned by the hook
interface HookSessionKeyState {
  id?: string
  isActive?: boolean
  expirationTime?: Date
  allowedContracts?: Address[]
  transactionLimits?: {
    maxTransactionValue: bigint
    maxDailyValue: bigint
    maxTransactionCount: number
  }
  usage?: any
  type?: string
  [key: string]: any // Allow additional properties
}

interface SessionKeyManagerProps {
  allowedContracts: Address[]
  className?: string
}

export function SessionKeyManager({ allowedContracts, className }: SessionKeyManagerProps) {
  const {
    activeSessionKeys,
    isAutomationEnabled,
    enableAutomation,
    disableAutomation,
    createStandardSessionKey,
    revokeSessionKey,
    checkTransactionLimits,
    getSessionStatistics,
    cleanupExpiredSessions,
    error,
    clearError,
    isCreatingSession
  } = useSessionKeys()
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedConfigType, setSelectedConfigType] = useState<SessionConfigType>('standard')
  const [expirationHours, setExpirationHours] = useState(24)
  const [selectedContracts, setSelectedContracts] = useState<Address[]>(allowedContracts)
  
  const handleCreateSessionKey = async () => {
    try {
      await createStandardSessionKey(selectedConfigType, expirationHours, selectedContracts)
      setIsCreateDialogOpen(false)
      clearError()
    } catch (err) {
      // Error is handled by the hook
    }
  }
  
  const handleRevokeSessionKey = (sessionId: string) => {
    revokeSessionKey(sessionId, 'Manually revoked by user')
  }
  
  const handleCleanupExpired = () => {
    const cleanedCount = cleanupExpiredSessions()
    if (cleanedCount > 0) {
      // Could show a toast notification here
      console.log(`Cleaned up ${cleanedCount} expired session keys`)
    }
  }
  
  const formatTimeRemaining = (expirationTime: Date): string => {
    const now = new Date()
    const remaining = expirationTime.getTime() - now.getTime()
    
    if (remaining <= 0) return 'Expired'
    
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }
  
  const getUsagePercentage = (sessionId: string, type: 'amount' | 'count'): number => {
    const sessionKey = activeSessionKeys.find(k => k.sessionId === sessionId)
    if (!sessionKey) return 0
    
    // Use a sample transaction to get current limits
    const limits = checkTransactionLimits(sessionId, 0n, allowedContracts[0] || '0x0', 'transfer')
    
    if (type === 'amount') {
      // Get max daily from stored session key via storage
      const storedKey = sessionKeyStorage.getSessionKey(sessionId)
      const maxDaily = storedKey?.transactionLimits?.maxDailyValue || 0n
      const used = limits.dailyAmountUsed
      return maxDaily > 0n ? Number((used * 100n) / maxDaily) : 0
    } else {
      // Get max count from stored session key via storage
      const storedKey = sessionKeyStorage.getSessionKey(sessionId)
      const maxCount = storedKey?.transactionLimits?.maxTransactionCount || 0
      const used = limits.transactionCountUsed
      return maxCount > 0 ? (used / maxCount) * 100 : 0
    }
  }
  
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Session Key Automation
              </CardTitle>
              <CardDescription>
                Manage automated transaction capabilities with configurable limits and security boundaries
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="automation-toggle">Automation</Label>
                <Switch
                  id="automation-toggle"
                  checked={isAutomationEnabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      enableAutomation()
                    } else {
                      disableAutomation()
                    }
                  }}
                />
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Session Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Session Key</DialogTitle>
                    <DialogDescription>
                      Configure automated transaction limits and permissions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="config-type">Configuration Type</Label>
                      <Select
                        value={selectedConfigType}
                        onValueChange={(value: SessionConfigType) => setSelectedConfigType(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="micro">
                            Micro - Small automated actions (1 token max)
                          </SelectItem>
                          <SelectItem value="standard">
                            Standard - Regular operations (100 tokens max)
                          </SelectItem>
                          <SelectItem value="highValue">
                            High Value - Payroll & large ops (10K tokens max)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="expiration">Expiration (hours)</Label>
                      <Input
                        id="expiration"
                        type="number"
                        min="1"
                        max="168"
                        value={expirationHours}
                        onChange={(e) => setExpirationHours(Number(e.target.value))}
                      />
                    </div>
                    
                    <div>
                      <Label>Configuration Preview</Label>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Max per transaction: {formatEther(DEFAULT_SESSION_CONFIGS[selectedConfigType].maxTransactionAmount)} tokens</div>
                        <div>Max daily amount: {formatEther(DEFAULT_SESSION_CONFIGS[selectedConfigType].maxDailyAmount)} tokens</div>
                        <div>Max daily transactions: {DEFAULT_SESSION_CONFIGS[selectedConfigType].maxTransactionCount}</div>
                        <div>Allowed methods: {DEFAULT_SESSION_CONFIGS[selectedConfigType].allowedMethods.join(', ')}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateSessionKey}
                        disabled={isCreatingSession}
                      >
                        {isCreatingSession ? 'Creating...' : 'Create Session Key'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="ml-2"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {!isAutomationEnabled && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Automation is disabled. Enable it to use session keys for automated transactions.
              </AlertDescription>
            </Alert>
          )}
          
          {activeSessionKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active session keys</p>
              <p className="text-sm">Create a session key to enable automated transactions</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Active Session Keys ({activeSessionKeys.length})</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCleanupExpired}
                >
                  Cleanup Expired
                </Button>
              </div>
              
              {activeSessionKeys.map(({ sessionId, state }) => {
                const hookState = state as HookSessionKeyState
                const stats = getSessionStatistics(sessionId)
                const amountUsagePercent = getUsagePercentage(sessionId, 'amount')
                const countUsagePercent = getUsagePercentage(sessionId, 'count')
                const isExpiringSoon = hookState.expirationTime && new Date(hookState.expirationTime).getTime() - Date.now() < 2 * 60 * 60 * 1000 // 2 hours
                
                return (
                  <Card key={sessionId} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">
                              {sessionId.split('_')[2]?.substring(0, 8)}...
                            </Badge>
                            {isExpiringSoon && (
                              <Badge variant="destructive">
                                <Clock className="h-3 w-3 mr-1" />
                                Expiring Soon
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Expires in {hookState.expirationTime ? formatTimeRemaining(hookState.expirationTime) : 'Unknown'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeSessionKey(sessionId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-sm font-medium">Daily Amount Usage</span>
                          </div>
                          <Progress value={amountUsagePercent} className="mb-1" />
                          <p className="text-xs text-muted-foreground">
                            {amountUsagePercent.toFixed(1)}% of daily limit
                          </p>
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Activity className="h-4 w-4" />
                            <span className="text-sm font-medium">Transaction Count</span>
                          </div>
                          <Progress value={countUsagePercent} className="mb-1" />
                          <p className="text-xs text-muted-foreground">
                            {countUsagePercent.toFixed(1)}% of daily limit
                          </p>
                        </div>
                      </div>
                      
                      <Separator className="my-3" />
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Max Transaction</p>
                          <p className="font-medium">
                            {(() => {
                              const storedKey = sessionKeyStorage.getSessionKey(sessionId)
                              return formatEther(storedKey?.transactionLimits?.maxTransactionValue || 0n)
                            })()} tokens
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Used</p>
                          <p className="font-medium">
                            {stats ? formatEther(stats.totalAmountSpent) : '0'} tokens
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Transactions</p>
                          <p className="font-medium">{stats?.totalTransactions || 0}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground">
                          Allowed contracts: {hookState.allowedContracts?.length || 0} contracts
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}