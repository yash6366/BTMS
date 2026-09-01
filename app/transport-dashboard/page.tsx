"use client"

import dynamic from "next/dynamic"

// Dynamically load the client component (turns off SSR)
const TransportDashboardClient = dynamic(() => import("./components/TransportDashboardClient"), { ssr: false })

export default function TransportDashboard() {
  return <TransportDashboardClient />
}