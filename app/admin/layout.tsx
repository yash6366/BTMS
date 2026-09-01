import type React from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Portal | BHEL Transport Services",
  description: "Administrative control center for employee master, access management, and system auditing.",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
