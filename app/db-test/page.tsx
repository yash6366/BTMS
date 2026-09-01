import DatabaseStatus from "@/components/DatabaseStatus"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function DatabaseTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Database Connection Test</h1>
          <p className="text-gray-600">Check your Neon PostgreSQL database connectivity and schema.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Live Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <DatabaseStatus />
          </CardContent>
        </Card>

       

      
      </div>
    </div>
  )
}
