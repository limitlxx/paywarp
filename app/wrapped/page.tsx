"use client"

import WrappedReportViewer from "@/components/wrapped-report-viewer"
import { AuthGuard } from "@/components/auth-guard"
import { useEffect } from "react"
import { useAccount } from "wagmi"

export default function WrappedExperience() {
  const { address } = useAccount()

  useEffect(() => {
    if (address) {
      console.log(`🎁 USER ACCESSING WRAPPED PAGE:`)
      console.log(`   User: ${address}`)
      console.log(`   Timestamp: ${new Date().toISOString()}`)
      console.log(`   Page: /wrapped`)
    }
  }, [address])

  return (
    <AuthGuard>
      <WrappedReportViewer />
    </AuthGuard>
  )
}
