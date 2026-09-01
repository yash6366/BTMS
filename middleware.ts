import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/manager-dashboard", "/transport-dashboard", "/admin"]
// Routes that authenticated users should not access (login and registration pages)
const publicRoutes = ["/login", "/login/employee", "/login/manager", "/login/transport", "/signup"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Get authentication token from cookies
  const token = request.cookies.get("auth-token")?.value

  // If trying to access protected route without token, redirect to login
  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If user has token but trying to access login page, redirect based on user role
  if (isPublicRoute && token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-key-change-in-production")
      const { payload } = await jwtVerify(token, secret)
      
      // Redirect based on user role
      const userRole = (payload as any).role
      if (userRole === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url))
      } else if (userRole === "transport") {
        return NextResponse.redirect(new URL("/transport-dashboard", request.url))
      } else {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
    } catch (error) {
      // If token is invalid, clear it and continue to login
      const response = NextResponse.next()
      response.cookies.delete("auth-token")
      return response
    }
  }

  // If trying to access the old manager-dashboard route, redirect to unified dashboard
  if (pathname.startsWith("/manager-dashboard")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Role-based access control for protected routes
  if (isProtectedRoute && token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-key-change-in-production")
      const { payload } = await jwtVerify(token, secret)
      const userRole = (payload as any).role
      
      // Admin dashboard should only be accessible to admin users
      if (pathname.startsWith("/admin") && userRole !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }

      // Transport dashboard should only be accessible to transport users (or admin)
      if (pathname.startsWith("/transport-dashboard") && userRole !== "transport" && userRole !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
      
      // Regular dashboard should not be accessible to pure transport users
      if (pathname === "/dashboard" && userRole === "transport") {
        return NextResponse.redirect(new URL("/transport-dashboard", request.url))
      }
    } catch (error) {
      // If token is invalid, redirect to login
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png|taxilogo2.jpg|.*\\..*$).*)",
  ],
}