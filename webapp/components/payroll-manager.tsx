"use client"

import { usePayroll } from "@/hooks/use-buckets"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, FileUp, Send, ShieldCheck } from "lucide-react"

export function PayrollManager() {
  const { payrollEntries } = usePayroll()

  return (
    <div className="space-y-6">
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
              Chainlink Cron
            </CardTitle>
            <CardDescription className="text-[10px]">Auto-payouts scheduled for 15th</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full gradient-primary text-white h-12">Schedule Next Batch</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Manage Team
            </CardTitle>
            <Button size="sm" className="glass border-purple-500/20 text-xs">
              <Send className="w-3 h-3 mr-1" /> Send Invites
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-purple-500/10 hover:bg-transparent">
                <TableHead className="text-purple-300">Name</TableHead>
                <TableHead className="text-purple-300">Address/Email</TableHead>
                <TableHead className="text-purple-300">Status</TableHead>
                <TableHead className="text-purple-300 text-right">Salary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollEntries.map((entry) => (
                <TableRow key={entry.id} className="border-purple-500/5 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium text-foreground">{entry.employeeName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {entry.walletAddress
                      ? `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}`
                      : entry.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        entry.status === "verified"
                          ? "border-green-500/20 text-green-400"
                          : "border-yellow-500/20 text-yellow-400"
                      }
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground">
                    ${entry.salary.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
