"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface HeaderProps {
  title: string
  subtitle?: string
  showBackButton?: boolean
  backHref?: string
}

export function Header({ title, subtitle, showBackButton = false, backHref = "/" }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-16 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="BHEL Logo"
                width={64}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
              {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
            </div>
          </div>

          {showBackButton && (
            <Button variant="ghost" asChild>
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
