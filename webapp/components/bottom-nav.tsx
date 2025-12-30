"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Layers, History, Settings, Scan } from "lucide-react"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Layers, label: "Buckets", href: "/buckets" },
  { icon: History, label: "History", href: "/history" },
  { icon: Scan, label: "Scan", href: "/scan" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-purple-500/20 pb-safe">
      <div className="flex items-center justify-around h-20 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl transition-all min-w-[64px]",
                isActive ? "text-purple-400" : "text-muted-foreground",
              )}
            >
              <item.icon
                className={cn("w-6 h-6 transition-all", isActive && "icon-glow scale-110")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn("text-xs font-medium", isActive && "text-purple-400")}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
