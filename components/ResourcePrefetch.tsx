"use client"

import { useEffect } from 'react'

export default function ResourcePrefetch() {
  useEffect(() => {
    // Prefetch critical routes after page load
    const prefetchRoutes = ['/login', '/dashboard', '/api/auth/me']
    
    const prefetcher = requestIdleCallback || setTimeout
    
    prefetcher(() => {
      prefetchRoutes.forEach(route => {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = route
        document.head.appendChild(link)
      })
    })

    // Preload critical CSS fonts
    const preloadFont = () => {
      const linkElement = document.createElement('link')
      linkElement.rel = 'preload'
      linkElement.href = 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2'
      linkElement.as = 'font'
      linkElement.type = 'font/woff2'
      linkElement.crossOrigin = 'anonymous'
      document.head.appendChild(linkElement)
    }

    if (document.readyState === 'complete') {
      preloadFont()
    } else {
      window.addEventListener('load', preloadFont)
      return () => window.removeEventListener('load', preloadFont)
    }
  }, [])

  return null
}