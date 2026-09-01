export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading BHEL Transport</h2>
          <p className="text-gray-600">Please wait while we prepare your dashboard...</p>
        </div>
      </div>
    </div>
  )
}