"use client"

import { useState } from "react"
import { useTeamManagement, type TeamMember } from "@/hooks/use-team-management"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, FileUp, Send, ShieldCheck, Plus, Edit, Trash2, Calendar, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface AddMemberDialogProps {
  onAddMember: (member: Omit<TeamMember, 'id' | 'joinDate' | 'totalPaid' | 'paymentHistory'>) => Promise<string>
  isLoading: boolean
}

function AddMemberDialog({ onAddMember, isLoading }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    walletAddress: '',
    email: '',
    salary: '',
    paymentDate: '15'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await onAddMember({
        name: formData.name,
        walletAddress: formData.walletAddress || undefined,
        email: formData.email || undefined,
        salary: parseFloat(formData.salary),
        paymentDate: parseInt(formData.paymentDate),
        status: 'pending'
      })
      
      setFormData({
        name: '',
        walletAddress: '',
        email: '',
        salary: '',
        paymentDate: '15'
      })
      setOpen(false)
      toast({
        title: "Team member added",
        description: "The team member has been successfully added to the payroll."
      })
    } catch (error) {
      toast({
        title: "Error adding team member",
        description: error instanceof Error ? error.message : "Failed to add team member",
        variant: "destructive"
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="glass border-purple-500/20 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="walletAddress">Wallet Address</Label>
            <Input
              id="walletAddress"
              value={formData.walletAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, walletAddress: e.target.value }))}
              placeholder="0x..."
            />
          </div>
          
          <div>
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="employee@company.com"
            />
          </div>
          
          <div>
            <Label htmlFor="salary">Monthly Salary (USD)</Label>
            <Input
              id="salary"
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value }))}
              required
              min="0"
              step="0.01"
            />
          </div>
          
          <div>
            <Label htmlFor="paymentDate">Payment Date (Day of Month)</Label>
            <Select value={formData.paymentDate} onValueChange={(value) => setFormData(prev => ({ ...prev, paymentDate: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface PayrollHistoryProps {
  payrollHistory: any[]
}

function PayrollHistory({ payrollHistory }: PayrollHistoryProps) {
  return (
    <div className="space-y-4">
      {payrollHistory.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No payroll history available
        </div>
      ) : (
        payrollHistory.map((batch) => (
          <Card key={batch.id} className="glass-card border-purple-500/20">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  {batch.scheduledDate.toLocaleDateString()}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    batch.status === "completed"
                      ? "border-green-500/20 text-green-400"
                      : "border-red-500/20 text-red-400"
                  }
                >
                  {batch.status === "completed" ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1" />
                  )}
                  {batch.status}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {batch.employeeCount} employees • ${batch.totalAmount.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {batch.payments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-purple-300">Payment Details</h4>
                  <div className="space-y-1">
                    {batch.payments.map((payment: any) => (
                      <div key={payment.id} className="flex justify-between items-center text-xs">
                        <span className="font-mono">
                          {payment.transactionHash.slice(0, 6)}...{payment.transactionHash.slice(-4)}
                        </span>
                        <span className="text-muted-foreground">
                          ${payment.amount.toLocaleString()}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            payment.status === "successful"
                              ? "border-green-500/20 text-green-400"
                              : "border-red-500/20 text-red-400"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

interface UpcomingPayrollsProps {
  upcomingPayrolls: any[]
  onSchedulePayroll: (date: Date) => Promise<string>
  isLoading: boolean
}

function UpcomingPayrolls({ upcomingPayrolls, onSchedulePayroll, isLoading }: UpcomingPayrollsProps) {
  const [scheduleDate, setScheduleDate] = useState('')

  const handleSchedule = async () => {
    if (!scheduleDate) return
    
    try {
      await onSchedulePayroll(new Date(scheduleDate))
      setScheduleDate('')
      toast({
        title: "Payroll scheduled",
        description: "The payroll batch has been scheduled successfully."
      })
    } catch (error) {
      toast({
        title: "Error scheduling payroll",
        description: error instanceof Error ? error.message : "Failed to schedule payroll",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card border-green-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-green-400">
            <ShieldCheck className="w-4 h-4" />
            Schedule New Payroll
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleSchedule} 
              disabled={!scheduleDate || isLoading}
              className="gradient-primary text-white"
            >
              Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {upcomingPayrolls.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No upcoming payrolls scheduled
        </div>
      ) : (
        upcomingPayrolls.map((batch) => (
          <Card key={batch.id} className="glass-card border-blue-500/20">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  {batch.scheduledDate.toLocaleDateString()}
                </CardTitle>
                <Badge variant="outline" className="border-blue-500/20 text-blue-400">
                  {batch.status}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {batch.employeeCount} employees • ${batch.totalAmount.toLocaleString()}
              </CardDescription>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  )
}

export function PayrollManager() {
  const {
    members,
    upcomingPayrolls,
    payrollHistory,
    isLoading,
    error,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    schedulePayroll
  } = useTeamManagement()

  return (
    <div className="space-y-6">
      {error && (
        <Card className="glass-card border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileUp className="w-4 h-4 text-purple-400" />
              CSV Upload
            </CardTitle>
            <CardDescription className="text-[10px]">Add teams via bulk CSV or invite</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full glass border-purple-500/30 hover:bg-purple-500/10 text-foreground h-12">
              Import Employee Data
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-400">
              <ShieldCheck className="w-4 h-4" />
              Team Stats
            </CardTitle>
            <CardDescription className="text-[10px]">
              {members.length} active members • Next payout: {upcomingPayrolls[0]?.scheduledDate.toLocaleDateString() || 'Not scheduled'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-400">{members.length}</div>
                <div className="text-xs text-muted-foreground">Active Members</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">
                  ${members.reduce((sum, m) => sum + m.salary, 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Monthly Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="team">Team Management</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Payrolls</TabsTrigger>
          <TabsTrigger value="history">Payroll History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="team" className="space-y-4">
          <Card className="glass-card border-purple-500/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Manage Team
                </CardTitle>
                <AddMemberDialog onAddMember={addTeamMember} isLoading={isLoading} />
              </div>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No team members added yet. Click "Add Member" to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-purple-500/10 hover:bg-transparent">
                      <TableHead className="text-purple-300">Name</TableHead>
                      <TableHead className="text-purple-300">Address</TableHead>
                      <TableHead className="text-purple-300">Status</TableHead>
                      <TableHead className="text-purple-300 text-right">Salary</TableHead>
                      <TableHead className="text-purple-300 text-right">Payment Date</TableHead>
                      <TableHead className="text-purple-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                        <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {member.walletAddress
                            ? `${member.walletAddress.slice(0, 6)}...${member.walletAddress.slice(-4)}`
                            : member.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              member.status === "verified"
                                ? "border-green-500/20 text-green-400"
                                : "border-yellow-500/20 text-yellow-400"
                            }
                          >
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground">
                          ${member.salary.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {member.paymentDate}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                              onClick={() => removeTeamMember(member.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upcoming">
          <UpcomingPayrolls 
            upcomingPayrolls={upcomingPayrolls}
            onSchedulePayroll={schedulePayroll}
            isLoading={isLoading}
          />
        </TabsContent>
        
        <TabsContent value="history">
          <PayrollHistory payrollHistory={payrollHistory} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
