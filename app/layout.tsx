import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/error-boundary"
import { ReadOnlyBanner } from "@/components/read-only-banner"
import { FloatingPerformanceIndicator } from "@/components/performance-monitor"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PayWarp - DeFi Budgeting & Payroll on Mantle L2",
  description:
    "Earn yields on your team's payroll. Unified buckets for budgeting, expenses, and DeFi payroll on Mantle.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
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
      <body className={`${inter.className} font-sans antialiased bg-black text-white`}>
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
