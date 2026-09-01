"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Car, Users, Shield, Clock, MapPin, Star, ChevronDown, LogIn } from "lucide-react"

export default function WelcomePage() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const toggleDropdown = (menu: string) => {
    setActiveDropdown(activeDropdown === menu ? null : menu)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo Section */}
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">BHEL Transport Services</h1>
                <p className="text-sm text-gray-600">Electronics Division, Bengaluru</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {[
                { key: "about", label: "About" },
                { key: "services", label: "Services" },
                { key: "policies", label: "Policies" },
                { key: "contact", label: "Contact" },
              ].map((menu) => (
                <div key={menu.key} className="relative">
                  <button
                    onClick={() => toggleDropdown(menu.key)}
                    className="text-gray-700 hover:text-blue-600 font-medium py-2 px-3 rounded transition-colors flex items-center"
                  >
                    {menu.label}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  {activeDropdown === menu.key && (
                    <div className="absolute left-0 mt-2 w-80 bg-white border border-gray-200 shadow-lg rounded-lg p-6 z-10">
                      {menu.key === "about" && (
                        <div>
                          <h3 className="font-semibold text-blue-600 mb-3">About BHEL Transport</h3>
                          <p className="text-gray-700 text-sm leading-relaxed">
                            BHEL Transport Services provides reliable and secure transportation solutions for employees,
                            guests, and official purposes. Our modern fleet ensures comfortable and safe travel for all
                            users.
                          </p>
                        </div>
                      )}
                      {menu.key === "services" && (
                        <div>
                          <h3 className="font-semibold text-blue-600 mb-3">Our Services</h3>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-center">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                              Employee Daily Commute
                            </li>
                            <li className="flex items-center">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                              Airport & Railway Station Transfers
                            </li>
                            <li className="flex items-center">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                              Official Meetings & Events
                            </li>
                            <li className="flex items-center">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                              Guest Transportation
                            </li>
                            <li className="flex items-center">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                              Ride Pooling Services
                            </li>
                          </ul>
                        </div>
                      )}
                      {menu.key === "policies" && (
                        <div>
                          <h3 className="font-semibold text-blue-600 mb-3">Transport Policies</h3>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li>
                              <strong>Advance Booking:</strong> Minimum 30 minutes notice required
                            </li>
                            <li>
                              <strong>Working Hours:</strong> 7:00 AM to 7:00 PM (Standard)
                            </li>
                            <li>
                              <strong>After Hours:</strong> Manager approval required
                            </li>
                            <li>
                              <strong>Cancellation:</strong> 15 minutes prior notice
                            </li>
                          </ul>
                        </div>
                      )}
                      {menu.key === "contact" && (
                        <div>
                          <h3 className="font-semibold text-blue-600 mb-3">Contact Information</h3>
                          <div className="space-y-2 text-sm text-gray-700">
                            <p>
                              <strong>Phone:</strong> 080-26989206
                            </p>
                            <p>
                              <strong>Email:</strong> transport.edn@bhel.in
                            </p>
                            <p>
                              <strong>Address:</strong> Transport Department
                              <br />
                              BHEL Electronics Division
                              <br />
                              Mysore Road, Bangalore 560026
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-50 to-gray-50 py-20">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center justify-between">
            <div className="lg:w-1/2 space-y-8">
              <div>
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
                 Online Taxi Requisition System
                  
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Experience seamless, secure, and comfortable transportation services designed specifically for BHEL
                  employees and guests.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
                  <Link href="/login" prefetch={true}>
                    <LogIn className="mr-2 h-5 w-5" />
                    Login to Portal
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-blue-300 text-blue-900 hover:bg-blue-50 px-6 py-3">
                  <Link href="/signup">
                    New User Registration
                  </Link>
                </Button>
              </div>
              

            </div>

            <div className="lg:w-1/2 mt-12 lg:mt-0">
              <div className="relative">
                <Card className="max-w-md mx-auto">
                  {/* <CardContent className="p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto flex items-center justify-center">
                      <Car className="h-10 w-10 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Quick & Easy Booking</h3>
                      <p className="text-gray-600">
                        Book your rides in just a few clicks with our user-friendly portal
                      </p>
                    </div>
                  </CardContent> */}
                      <div className="mt-10 md:mt-0 flex flex-row space-y-6">
                        <Image
                          src="/taxilogo2.jpg"
                          alt="Taxi Booking"
                          width={400}
                          height={280}
                          className="rounded-lg shadow-lg w-full max-w-md mx-auto"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                        />
                      </div>

                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
        

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Secure & Safe",
                description: "All vehicles are regularly maintained and drivers are thoroughly verified",
                icon: Shield,
              },
              {
                title: "24/7 Support",
                description: "Round-the-clock assistance for all your transportation needs",
                icon: Clock,
              },
              {
                title: "Cost Effective",
                description: "Competitive rates with special discounts for regular users",
                icon: Star,
              },
              {
                title: "Easy Booking",
                description: "Simple online booking system with instant confirmations",
                icon: Car,
              },
              {
                title: "Ride Pooling",
                description: "Share rides with colleagues to save costs and reduce carbon footprint",
                icon: Users,
              },
              {
                title: "Fleet Variety",
                description: "Choose from sedans, SUVs, and buses based on your requirements",
                icon: MapPin,
              },
            ].map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <Icon className="h-12 w-12 text-blue-900 mx-auto mb-4" />
                    <h4 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h4>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Company Policies Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-gray-900 text-center mb-12">Transport Guidelines</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-blue-900">Booking Guidelines</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>Advance Notice:</strong> Book at least 30 minutes prior to departure
                      </span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>Working Hours:</strong> Standard service from 7:00 AM to 7:00 PM
                      </span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>After Hours:</strong> Requires manager approval for emergency cases
                      </span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>Cancellation:</strong> Cancel at least 15 minutes before pickup
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-blue-900">Service Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>Standard:</strong> Available for all employees during working hours
                      </span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>Executive:</strong> For senior staff or with proper authorization
                      </span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>Guest:</strong> For official visitors and dignitaries
                      </span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-blue-900 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>
                        <strong>Pool:</strong> Shared rides for cost-effective transportation
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
               
                <span className="text-xl font-bold">Transport Services</span>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Providing reliable and secure transportation solutions for the BHEL community with a commitment to
                safety and excellence.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <Link href="/login/employee" className="hover:text-white transition-colors">
                    Employee Portal
                  </Link>
                </li>
                <li>
                  <Link href="/login/transport" className="hover:text-white transition-colors">
                    Transport Portal
                  </Link>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Transport Guidelines
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Fleet Information
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Information</h4>
              <div className="space-y-2 text-gray-300">
                <p>
                  <strong>Phone:</strong> 080-26989206
                </p>
                <p>
                  <strong>Email:</strong> transport.edn@bhel.in
                </p>
                <p>
                  <strong>Address:</strong>
                  <br />
                  Transport Department
                  <br />
                  BHEL Electronics Division
                  <br />
                  Mysore Road, Bangalore 560026
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Bharat Heavy Electricals Limited. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
