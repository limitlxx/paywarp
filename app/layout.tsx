import type React from "react"
import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/error-boundary"
import { ReadOnlyBanner } from "@/components/read-only-banner"
import { FloatingPerformanceIndicator } from "@/components/performance-monitor"
import { WarpLoading } from "@/components/warp-loading"

const outfit = Outfit({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-outfit',
  fallback: ['system-ui', 'arial']
})

export const metadata: Metadata = {
  title: "PayWarp - DeFi Budgeting, Savings & Payroll on Mantle L2",
  description:
    "Earn yields on every dwposit. Unified buckets for budgeting, expenses, and DeFi payroll on Mantle.",

  icons: {
    icon: [
      {
        url: "/paywarp-logo.jpg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/paywarp-logo.jpg",
        media: "(prefers-color-scheme: dark)",
      }
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.className} font-sans antialiased bg-black text-white`}>
        <ErrorBoundary>
          <Providers>
            <ReadOnlyBanner />
            {children}
            <FloatingPerformanceIndicator />
          </Providers>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
