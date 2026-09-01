import { redirect } from "next/navigation"

export default function ManagerDashboardPage() {
  // Redirect all users to the unified dashboard
  redirect("/dashboard")
}
