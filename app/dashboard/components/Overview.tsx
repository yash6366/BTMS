import dynamic from "next/dynamic"

// Dynamically load the client component (turns off SSR)
const MyBookings = dynamic(() => import("./MyBookings.client"), { ssr: false })

export default function Overview() {
  return <div data-testid="overview"><MyBookings /></div>
}
