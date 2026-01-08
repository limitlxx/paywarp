"use client"

import { useState } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { SimpleHeader } from "@/components/simple-header"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { CurrencyDemo } from "@/components/currency-demo"
import { SessionKeyManager } from "@/components/session-key-manager"
import { TokenAllowanceManager } from "@/components/token-allowance-manager"
import { ShieldCheck, Percent, Bell, DollarSign, Key, Save, AlertTriangle, CheckCircle, Loader2, Lightbulb, TrendingUp } from "lucide-react"
import { useContracts } from "@/lib/contracts"
import { useSettings, type BucketAllocation } from "@/hooks/use-settings"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { bucketVaultAddress, payrollEngineAddress } = useContracts()
  const { toast } = useToast()
  
  // Settings hook for managing all settings state
  const {
    settings,
    isSaving,
    updateBucketAllocation,
    updateSecuritySettings,
    updateNotificationSettings,
    saveSettings,
    validateBucketAllocations,
    autoBalanceAllocations,
    createSessionKey,
    isCreatingSession,
    applySuggestion,
    getBucketSuggestions,
  } = useSettings()

  // Local state for UI interactions
  const [autoBalance, setAutoBalance] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  // Get bucket suggestions
  const bucketSuggestions = getBucketSuggestions()
  
  // Allowed contracts for session keys
  const allowedContracts = [bucketVaultAddress, payrollEngineAddress].filter(Boolean)

  // Handle bucket percentage change
  const handleBucketPercentageChange = (bucketId: string, newPercentage: number) => {
    updateBucketAllocation(bucketId, { percentage: newPercentage })
    
    if (autoBalance) {
      autoBalanceAllocations(bucketId, newPercentage)
    }
  }

  // Handle bucket toggle
  const handleBucketToggle = (bucketId: string, enabled: boolean) => {
    if (enabled) {
      // When enabling a bucket, just enable it with current percentage
      updateBucketAllocation(bucketId, { enabled })
    } else {
      // When disabling a bucket, the updateBucketAllocation will handle redistribution
      updateBucketAllocation(bucketId, { enabled: false })
    }
  }

  // Handle save settings
  const handleSaveSettings = async () => {
    const success = await saveSettings()
    if (success) {
      toast({
        title: "Settings Saved",
        description: "Your bucket allocations and settings have been saved to the smart contract.",
      })
    }
  }

  // Create session key for automated operations
  const handleCreateSessionKey = async () => {
    try {
      await createSessionKey('standard', 24, allowedContracts)
      
      toast({
        title: "Session Key Created",
        description: "Automated operations are now enabled for 24 hours.",
      })
    } catch (error) {
      toast({
        title: "Session Key Failed",
        description: error instanceof Error ? error.message : "Failed to create session key.",
        variant: "destructive",
      })
    }
  }

  // Validation results
  const validation = validateBucketAllocations()
  const totalPercentage = settings.bucketAllocations
    .filter((b: BucketAllocation) => b.enabled)
    .reduce((sum: number, b: BucketAllocation) => sum + b.percentage, 0)

  return (
    <AuthGuard>
      <div className="min-h-screen gradient-bg pb-24">
        <SimpleHeader />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Configure your DeFi permissions and allocations</p>
          </div>

          {/* Currency System Demo */}
          <CurrencyDemo />

          {/* Session Key Management */}
          <SessionKeyManager 
            allowedContracts={allowedContracts}
            className="glass-card border-purple-500/20"
          />

          {/* Token Allowance Management */}
          <TokenAllowanceManager className="glass-card border-purple-500/20" />

          {/* Security & Approvals */}
          {/* <Card className="glass-card border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Security & Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Multi-sig Approval</Label>
                  <p className="text-xs text-muted-foreground">Require 2/3 confirmations for payroll</p>
                </div>
                <Switch
                  checked={settings.securitySettings.multiSigApproval}
                  onCheckedChange={(checked) => updateSecuritySettings({ multiSigApproval: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Revoke Approvals</Label>
                  <p className="text-xs text-muted-foreground">Revoke token allowances after 24h</p>
                </div>
                <Switch
                  checked={settings.securitySettings.autoRevokeApprovals}
                  onCheckedChange={(checked) => updateSecuritySettings({ autoRevokeApprovals: checked })}
                />
              </div>
            </CardContent>
          </Card> */}

          {/* Allocation Percentages */}
          <Card className="glass-card border-purple-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Percent className="w-5 h-5 text-indigo-400" />
                  Bucket Allocations
                </CardTitle>
                <div className="flex items-center gap-4">
                  <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Suggestions
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Bucket Allocation Suggestions</DialogTitle>
                        <DialogDescription>
                          Choose a preset allocation strategy that matches your financial goals
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 max-h-96 overflow-y-auto">
                        {bucketSuggestions.map((suggestion: any) => (
                          <Card key={suggestion.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold flex items-center gap-2">
                                    {suggestion.name}
                                    {suggestion.id === 'aggressive' && <TrendingUp className="w-4 h-4 text-green-500" />}
                                  </h4>
                                  <p className="text-sm text-muted-foreground mb-1">{suggestion.description}</p>
                                  <p className="text-xs text-muted-foreground italic">{suggestion.targetUser}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    applySuggestion(suggestion.id)
                                    setShowSuggestions(false)
                                    toast({
                                      title: "Allocation Applied",
                                      description: `${suggestion.name} allocation has been applied.`,
                                    })
                                  }}
                                >
                                  Apply
                                </Button>
                              </div>
                              <div className="grid grid-cols-5 gap-2">
                                {suggestion.allocations.map((allocation: any) => (
                                  <div key={allocation.id} className="text-center">
                                    <div 
                                      className="w-full h-2 rounded mb-1"
                                      style={{ backgroundColor: allocation.color }}
                                    />
                                    <p className="text-xs font-medium">{allocation.percentage}%</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {allocation.name.replace(' Bucket', '')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-balance">Auto Balance</Label>
                    <Switch
                      id="auto-balance"
                      checked={autoBalance}
                      onCheckedChange={setAutoBalance}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Validation Alert */}
              {!validation.isValid && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{validation.error}</AlertDescription>
                </Alert>
              )}

              {/* Total Percentage Display */}
              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                <span className="text-sm font-medium">Total Allocation</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-mono ${totalPercentage === 100 ? 'text-green-400' : 'text-orange-400'}`}>
                    {totalPercentage}%
                  </span>
                  {totalPercentage === 100 && <CheckCircle className="h-4 w-4 text-green-400" />}
                </div>
              </div>

              {/* Dynamic Bucket Allocations */}
              {settings.bucketAllocations.map((bucket: BucketAllocation, index: number) => (
                <div key={bucket.id} className={`space-y-4 ${index > 0 ? 'border-t border-white/5 pt-6' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <Label>{bucket.name}</Label>
                      <p className="text-xs text-muted-foreground">
                        {bucket.id === 'billings' && 'Fixed expenses and recurring payments'}
                        {bucket.id === 'growth' && 'Yield-bearing DeFi investments'}
                        {bucket.id === 'savings' && 'Long-term stablecoin preservation'}
                        {bucket.id === 'instant' && 'Emergency funds and quick access'}
                        {bucket.id === 'spendable' && 'Daily transactions and discretionary spending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span 
                        className="text-sm font-mono"
                        style={{ color: bucket.color }}
                      >
                        {bucket.percentage}%
                      </span>
                      <Switch
                        checked={bucket.enabled}
                        onCheckedChange={(checked) => handleBucketToggle(bucket.id, checked)}
                      />
                    </div>
                  </div>
                  {bucket.enabled && (
                    <Slider
                      value={[bucket.percentage]}
                      onValueChange={([value]) => handleBucketPercentageChange(bucket.id, value)}
                      max={100}
                      step={1}
                      className={`[&_[role=slider]]:bg-[${bucket.color}]`}
                    />
                  )}
                </div>
              ))}

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSaving || !validation.isValid || !settings.hasUnsavedChanges}
                  className="min-w-[120px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="glass-card border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5 text-purple-400" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Yield Alerts</Label>
                <Switch
                  checked={settings.notificationSettings.yieldAlerts}
                  onCheckedChange={(checked) => updateNotificationSettings({ yieldAlerts: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Payroll Confirmations</Label>
                <Switch
                  checked={settings.notificationSettings.payrollConfirmations}
                  onCheckedChange={(checked) => updateNotificationSettings({ payrollConfirmations: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Transaction Alerts</Label>
                <Switch
                  checked={settings.notificationSettings.transactionAlerts}
                  onCheckedChange={(checked) => updateNotificationSettings({ transactionAlerts: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Security Alerts</Label>
                <Switch
                  checked={settings.notificationSettings.securityAlerts}
                  onCheckedChange={(checked) => updateNotificationSettings({ securityAlerts: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  </AuthGuard>
  )
}
