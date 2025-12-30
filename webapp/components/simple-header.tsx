"use client"

import { useWallet } from "@/hooks/use-wallet"
import { Button } from "@/components/ui/button"
import { Zap, LogOut } from "lucide-react"
import Link from "next/link"

export function SimpleHeader() {
  const { isConnected, address, connect, disconnect } = useWallet()

  return (
    <header className="h-16 bg-black/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-30 w-full">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">PayWarp</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {isConnected ? (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-zinc-400">
              {address}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={disconnect}
              className="h-9 w-9 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={connect}
            variant="outline"
            className="bg-violet-600/10 border-violet-500/20 text-violet-400 hover:bg-violet-600 hover:text-white rounded-xl transition-all"
          >
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  )
}
