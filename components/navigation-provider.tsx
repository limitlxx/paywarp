"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useLoadingStore } from "@/lib/loading-state-manager"

interface NavigationContextType {
  isNavigating: boolean
  navigate: (path: string) => void
  navigateWithWarp: (path: string, description?: string) => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const { startOperation, completeOperation } = useLoadingStore()

  const navigate = (path: string) => {
    router.push(path)
  }

  const navigateWithWarp = (path: string, description = "Navigating...") => {
    setIsNavigating(true)
    
    const operationId = startOperation({
      type: 'general',
      description,
      metadata: { critical: false, navigation: true }
    })

    // Simulate navigation loading time
    setTimeout(() => {
      router.push(path)
      
      // Complete operation after navigation
      setTimeout(() => {
        completeOperation(operationId, true)
        setIsNavigating(false)
      }, 300)
    }, 400)
  }

  // Reset navigation state when pathname changes
  useEffect(() => {
    setIsNavigating(false)
  }, [pathname])

  return (
    <NavigationContext.Provider value={{
      isNavigating,
      navigate,
      navigateWithWarp
    }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}