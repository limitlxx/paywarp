"use client"

import { forwardRef } from "react"
import Link, { LinkProps } from "next/link"
import { useNavigation } from "./navigation-provider"

interface WarpLinkProps extends Omit<LinkProps, 'href'> {
  href: string
  children: React.ReactNode
  className?: string
  warpDescription?: string
  useWarp?: boolean
}

export const WarpLink = forwardRef<HTMLAnchorElement, WarpLinkProps>(
  ({ href, children, className, warpDescription, useWarp = true, ...props }, ref) => {
    const { navigateWithWarp } = useNavigation()

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (useWarp) {
        e.preventDefault()
        navigateWithWarp(href, warpDescription || `Navigating to ${href}`)
      }
    }

    return (
      <Link
        ref={ref}
        href={href}
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Link>
    )
  }
)

WarpLink.displayName = "WarpLink"