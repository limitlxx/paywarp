"use client"

import { BottomNav } from "@/components/bottom-nav"
import { SimpleHeader } from "@/components/simple-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { ShieldCheck, Percent, Bell } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="min-h-screen gradient-bg pb-24">
      <SimpleHeader />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Configure your DeFi permissions and allocations</p>
          </div>

          {/* Security & Approvals */}
          <Card className="glass-card border-purple-500/20">
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
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Revoke Approvals</Label>
                  <p className="text-xs text-muted-foreground">Revoke token allowances after 24h</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Allocation Percentages */}
          <Card className="glass-card border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Percent className="w-5 h-5 text-indigo-400" />
                Bucket Allocations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Billings Bucket */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <Label>Billings Bucket</Label>
                    <p className="text-xs text-muted-foreground">Fixed expenses and recurring payments</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-blue-400">30%</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <Slider defaultValue={[30]} max={100} step={1} className="[&_[role=slider]]:bg-blue-500" />
              </div>

              {/* Growth Bucket */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <Label>Growth Bucket</Label>
                    <p className="text-xs text-muted-foreground">Yield-bearing DeFi investments</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-indigo-400">20%</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <Slider defaultValue={[20]} max={100} step={1} className="[&_[role=slider]]:bg-indigo-500" />
              </div>

              {/* Savings Bucket */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <Label>Savings Bucket</Label>
                    <p className="text-xs text-muted-foreground">Long-term stablecoin preservation</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-purple-400">20%</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <Slider defaultValue={[20]} max={100} step={1} className="[&_[role=slider]]:bg-purple-500" />
              </div>

              {/* Instant Bucket */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <Label>Instant Bucket</Label>
                    <p className="text-xs text-muted-foreground">Emergency funds and quick access</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-orange-400">15%</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <Slider defaultValue={[15]} max={100} step={1} className="[&_[role=slider]]:bg-orange-500" />
              </div>

              {/* Spendables Bucket */}
              <div className="space-y-4 border-t border-white/5 pt-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <Label>Spendables Bucket</Label>
                    <p className="text-xs text-muted-foreground">Daily transactions and discretionary spending</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-emerald-400">15%</span>
                    <Switch defaultChecked />
                  </div>
                </div>
                <Slider defaultValue={[15]} max={100} step={1} className="[&_[role=slider]]:bg-emerald-500" />
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
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>Payroll Confirmations</Label>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
