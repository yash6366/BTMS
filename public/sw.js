// Service Worker for BHEL Transport Dashboard
const CACHE_NAME = 'bhel-transport-v1'
const API_CACHE_NAME = 'bhel-api-v1'

// Static assets to cache
const STATIC_CACHE_URLS = [
  '/',
  '/login',
  '/dashboard',
  '/logo.png',
  '/taxilogo2.jpg',
  '/manifest.json'
]

// API endpoints to cache (with short TTL)
const API_CACHE_URLS = [
  '/api/auth/me',
  '/api/profile'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_CACHE_URLS)
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error)
      })
  )
  self.skipWaiting()
})

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
  )
  self.clients.claim()
})

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    if (API_CACHE_URLS.some(endpoint => url.pathname.startsWith(endpoint))) {
      event.respondWith(handleApiRequest(request))
    } else {
      // For other API requests, always go to network
      event.respondWith(fetch(request))
    }
    return
  }

  // Handle static assets
  if (request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.match(request)
            .then((response) => {
              if (response) {
                console.log('[SW] Serving from cache:', request.url)
                return response
              }

              return fetch(request)
                .then((networkResponse) => {
                  // Cache successful responses
                  if (networkResponse.status === 200) {
                    cache.put(request, networkResponse.clone())
                  }
                  return networkResponse
                })
                .catch(() => {
                  // Return offline fallback if available
                  if (request.mode === 'navigate') {
                    return cache.match('/')
                  }
                  return new Response('Offline', { status: 503 })
                })
            })
        })
    )
  }
})

// Handle API requests with caching strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME)
  const cachedResponse = await cache.match(request)

  // Check if cache is still valid (5 minutes for auth endpoints)
  if (cachedResponse) {
    const cacheTime = cachedResponse.headers.get('sw-cache-time')
    if (cacheTime) {
      const age = Date.now() - parseInt(cacheTime)
      if (age < 300000) { // 5 minutes
        console.log('[SW] Serving API from cache:', request.url)
        return cachedResponse
      }
    }
  }

  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Clone and add cache timestamp
      const responseToCache = networkResponse.clone()
      const headers = new Headers(responseToCache.headers)
      headers.set('sw-cache-time', Date.now().toString())
      
      const cachedResponseWithTime = new Response(
        await responseToCache.blob(),
        {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        }
      )
      
      cache.put(request, cachedResponseWithTime)
      console.log('[SW] Cached API response:', request.url)
    }
    
    return networkResponse
  } catch (error) {
    // Return cached version if network fails
    if (cachedResponse) {
      console.log('[SW] Network failed, serving stale cache:', request.url)
      return cachedResponse
    }
    throw error
  }
}

// Handle background sync for offline submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'booking-submission') {
    event.waitUntil(handleOfflineBookings())
  }
})

async function handleOfflineBookings() {
  // Handle offline booking submissions when connection is restored
  const pendingBookings = await getStoredBookings()
  
  for (const booking of pendingBookings) {
    try {
      await fetch('/api/ride-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking.data)
      })
      
      // Remove successful submission from storage
      await removeStoredBooking(booking.id)
      console.log('[SW] Offline booking submitted successfully')
      
    } catch (error) {
      console.error('[SW] Failed to submit offline booking:', error)
    }
  }
}

async function getStoredBookings() {
  // This would integrate with IndexedDB in a real implementation
  return []
}

async function removeStoredBooking(id) {
  // This would remove from IndexedDB in a real implementation
  return true
}