"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { LogOut } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface MenuItem {
  label: string
  value: string
  icon: LucideIcon
}

interface SidebarProps {
  title: string
  subtitle: string
  user: {
    name: string
    email: string
    role: string
  }
  menuItems: MenuItem[]
  activeMenu: string
  onMenuChange: (menu: string) => void
  onLogout: () => void
}

export function Sidebar({ title, subtitle, user, menuItems, activeMenu, onMenuChange, onLogout }: SidebarProps) {
  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo and App Name */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="BHEL Logo"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-6 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{user.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-600 capitalize">{user.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.value}
                variant={activeMenu === item.value ? "default" : "ghost"}
                className={`w-full justify-start h-11 ${
                  activeMenu === item.value
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => onMenuChange(item.value)}
              >
                <Icon className="mr-3 h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
        </div>
      </nav>

      <Separator />

      {/* Logout */}
      <div className="p-4">
        <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={onLogout}>
          <LogOut className="mr-3 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  )
}
