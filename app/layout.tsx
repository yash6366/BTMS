import type React from "react"
import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import ErrorBoundary from "@/components/ErrorBoundary"
// import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration"
import ResourcePrefetch from "@/components/ResourcePrefetch"
import "./globals.css"

export const metadata: Metadata = {
  title: "BHEL Transport System",
  description: "Transport Management System for BHEL Electronics Division",
  generator: 'v0.dev',
  robots: 'noindex, nofollow', // Internal application
  keywords: ['BHEL', 'Transport', 'Booking', 'Dashboard', 'Taxi'],
  authors: [{ name: 'BHEL IT Team' }],
  category: 'Business Application',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// Loading component for Suspense
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="text-gray-600 text-sm">Loading...</p>
    </div>
  </div>
)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="theme-color" content="#2563eb" />
        

      </head>
      <body className="font-sans">
        {/* <ServiceWorkerRegistration /> */}
        <ResourcePrefetch />
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </body>
    </html>
  )
}
