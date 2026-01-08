"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@/hooks/use-wallet.tsx"
import { useUserRegistration } from "@/lib/user-registration"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = "/" }: AuthGuardProps) {
  const { isConnected, address } = useWallet()
  const { isRegistered } = useUserRegistration()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      // Wait a moment for wallet connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!isConnected || !address) {
        router.push(redirectTo)
        return
      }

      if (!isRegistered) {
        router.push(redirectTo)
        return
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [isConnected, address, isRegistered, router, redirectTo])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <p className="text-white/60">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  redirectTo?: string
) {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard redirectTo={redirectTo}>
        <Component {...props} />
      </AuthGuard>
    )
  }
}