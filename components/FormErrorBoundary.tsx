"use client"

import React from "react"
import ErrorBoundary from "./ErrorBoundary"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface FormErrorBoundaryProps {
  children: React.ReactNode
  onReset?: () => void
}

const FormErrorFallback: React.FC<{ onReset?: () => void }> = ({ onReset }) => (
  <Alert variant="destructive" className="my-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Form Error</AlertTitle>
    <AlertDescription className="mt-2">
      Something went wrong while processing the form. Please try again or refresh the page.
      <div className="mt-3">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReset || (() => window.location.reload())}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </AlertDescription>
  </Alert>
)

export default function FormErrorBoundary({ children, onReset }: FormErrorBoundaryProps) {
  return (
    <ErrorBoundary 
      fallback={<FormErrorFallback onReset={onReset} />}
      onError={(error, errorInfo) => {
        console.error("Form Error:", { error, errorInfo })
        // Log form-specific errors
      }}
    >
      {children}
    </ErrorBoundary>
  )
}