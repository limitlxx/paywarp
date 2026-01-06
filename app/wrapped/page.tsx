"use client"

import WrappedReportViewer from "@/components/wrapped-report-viewer"
import { AuthGuard } from "@/components/auth-guard"

export default function WrappedExperience() {
  return (
    <AuthGuard>
      <WrappedReportViewer />
    </AuthGuard>
  )
}
