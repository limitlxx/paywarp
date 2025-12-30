"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, History, Gift, SlidersHorizontal, Zap, LogOut } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/hooks/use-wallet"
import { useRouter } from "next/navigation"

export function DashboardHeader() {
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD")
  const { isConnected, address, disconnect } = useWallet()
  const router = useRouter()

  const handleDisconnect = () => {
    disconnect()
    router.push("/")
  }

  return (
    <header className="h-16 glass-card border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-30 w-full">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">PayWarp</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="glass border-purple-500/20 h-9 flex items-center gap-2 text-foreground bg-transparent"
            >
              {currency} <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="glass border-purple-500/20">
            <DropdownMenuItem onClick={() => setCurrency("USD")} className="text-foreground hover:bg-purple-500/20">
              USD ($)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrency("NGN")} className="text-foreground hover:bg-purple-500/20">
              NGN (₦)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          className="glass border-purple-500/20 h-9 flex items-center gap-2 text-foreground bg-transparent"
        >
          <SlidersHorizontal className="w-4 h-4 text-purple-400" />
          <span>Configure Splits</span>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="glass border-purple-500/20 h-9 flex items-center gap-2 text-foreground hidden sm:flex bg-transparent"
          asChild
        >
          <Link href="/history">
            <History className="w-4 h-4 text-purple-400" />
            <span>Warp History</span>
          </Link>
        </Button>

        <Button className="gradient-primary text-white border-0 h-9 flex items-center gap-2" asChild>
          <Link href="/wrapped">
            <Gift className="w-4 h-4" />
            <span>2025 Wrapped</span>
          </Link>
        </Button>

        <div
          className="h-9 glass border-purple-500/30 rounded-lg px-3 flex items-center gap-2 cursor-pointer hover:bg-white/5 group"
          onClick={handleDisconnect}
        >
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
          <span className="text-sm font-mono text-muted-foreground group-hover:text-red-400 transition-colors">
            {address || "0x00...0000"}
          </span>
          <LogOut className="w-3 h-3 text-muted-foreground group-hover:text-red-400 ml-1 transition-colors" />
        </div>
      </div>
    </header>
  )
}
