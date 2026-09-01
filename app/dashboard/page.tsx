"use client"

import dynamic from "next/dynamic"

// Dynamically load the client component (turns off SSR)
const DashboardClient = dynamic(() => import("./components/DashboardClient"), { ssr: false })

export default function Dashboard() {
  return <DashboardClient />
}
