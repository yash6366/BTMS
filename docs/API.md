# BHEL Transport Dashboard API Documentation

This document provides comprehensive API documentation for the BHEL Transport Management Dashboard.

> **Security Notice**: Demo credentials have been removed from all interfaces for enhanced security. Contact your system administrator for proper user account setup and access credentials.

## 📋 Table of Contents

- [Authentication](#authentication)
- [Endpoints Overview](#endpoints-overview)
- [Authentication Endpoints](#authentication-endpoints)
- [Booking Management](#booking-management)
- [Approval System](#approval-system)
- [User Management](#user-management)
- [Utilities](#utilities)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Security](#security)

## 🔐 Authentication

The API uses **cookie-based authentication** with JWT tokens. All protected endpoints require a valid authentication token.

### Authentication Flow

1. **Login**: POST to `/api/auth/login` with credentials
2. **Token Storage**: JWT token stored in HTTP-only cookie
3. **Request Authentication**: Token automatically sent with subsequent requests
4. **Token Validation**: Server validates token on each protected request

### Headers

```http
Content-Type: application/json
Cookie: auth-token=<jwt-token>
```

## 🔄 Endpoints Overview

| Category | Endpoint | Method | Authentication | Description |
|----------|----------|---------|----------------|-------------|
| Auth | `/api/auth/login` | POST | No | User authentication |
| Auth | `/api/auth/logout` | POST | Yes | End user session |
| Auth | `/api/auth/me` | GET | Yes | Get current user |
| Bookings | `/api/bookings/me` | GET | Yes | Get user bookings |
| Bookings | `/api/ride-submission` | POST | Yes | Create booking |
| Approvals | `/api/approvals/check` | GET | Yes | Check approver status |
| Approvals | `/api/approvals/pending` | GET | Manager | Get pending approvals |
| Approvals | `/api/approvals/approve` | POST | Manager | Approve/reject booking |
| Utils | `/api/db/test-connection` | GET | No | Database health check |

## 🔓 Authentication Endpoints

### Login User

**POST** `/api/auth/login`

Authenticate users for employee or manager portals.

#### Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john.doe",
  "password": "securepassword123",
  "userType": "employee"  // optional: "employee" | "manager"
}
```

#### Response - Success

```json
{
  "success": true,
  "user": {
    "username": "john.doe",
    "usergroup": "employees",
    "email": "john.doe@bhel.in",
    "permissions": {
      "build": false,
      "manage": false,
      "tools": true
    },
    "pageaccess": "dashboard,booking",
    "reportingto": "manager.name",
    "role": "employee"
  }
}
```

#### Response - Error

```json
{
  "error": "Invalid username or password, or account is inactive"
}
```

#### Response - Manager Access Denied

```json
{
  "error": "Access denied. Manager privileges required for this portal."
}
```

#### Status Codes

- `200` - Successful authentication
- `400` - Missing required fields
- `401` - Invalid credentials
- `403` - Insufficient permissions (manager portal)
- `500` - Server error

---

### Get Current User

**GET** `/api/auth/me`

Retrieve current user session information.

#### Request

```http
GET /api/auth/me
Cookie: auth-token=<jwt-token>
```

#### Response - Success

```json
{
  "user": {
    "username": "john.doe",
    "email": "john.doe@bhel.in",
    "usergroup": "employees",
    "role": "employee",
    "permissions": {
      "build": false,
      "manage": false,
      "tools": true
    }
  }
}
```

#### Response - Unauthorized

```json
{
  "error": "Unauthorized"
}
```

---

### Logout User

**POST** `/api/auth/logout`

Terminate the current user session.

#### Request

```http
POST /api/auth/logout
Cookie: auth-token=<jwt-token>
```

#### Response

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## 🚗 Booking Management

### Get User Bookings

**GET** `/api/bookings/me`

Retrieve booking history for the authenticated user.

#### Request

```http
GET /api/bookings/me
Cookie: auth-token=<jwt-token>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `pending`, `approved`, `rejected`, `completed` |
| `limit` | number | No | Number of results to return (default: 50) |
| `offset` | number | No | Number of results to skip (default: 0) |
| `date_from` | string | No | Start date filter (YYYY-MM-DD) |
| `date_to` | string | No | End date filter (YYYY-MM-DD) |

#### Response

```json
{
  "bookings": [
    {
      "id": "booking_12345",
      "employeeName": "John Doe",
      "employeeId": "EMP001",
      "department": "Engineering",
      "pickupLocation": "BHEL Main Gate",
      "dropLocation": "Bangalore Airport",
      "date": "2025-01-15",
      "time": "08:30",
      "purpose": "Official Travel to Client Meeting",
      "status": "approved",
      "priority": "high",
      "afterHours": false,
      "requestedAt": "2025-01-10T10:30:00.000Z",
      "approvedAt": "2025-01-10T14:20:00.000Z",
      "approvedBy": "manager.name",
      "vehicleAssigned": "TN01AB1234",
      "driverName": "Driver Name",
      "driverContact": "+91-9876543210"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "hasNext": false
  }
}
```

---

### Submit New Booking

**POST** `/api/ride-submission`

Create a new transport booking request.

#### Request

```http
POST /api/ride-submission
Content-Type: application/json
Cookie: auth-token=<jwt-token>

{
  "employeeName": "John Doe",
  "employeeId": "EMP001",
  "department": "Engineering",
  "pickupLocation": "BHEL Main Gate",
  "dropLocation": "Bangalore Airport",
  "date": "2025-01-15",
  "time": "08:30",
  "purpose": "Official Travel to Client Meeting",
  "priority": "high",
  "afterHours": false,
  "returnJourney": {
    "required": true,
    "date": "2025-01-15",
    "time": "18:00"
  },
  "passengerCount": 2,
  "specialRequirements": "AC vehicle required",
  "contactNumber": "+91-9876543210",
  "alternateContact": "+91-9876543211"
}
```

#### Response - Success

```json
{
  "success": true,
  "message": "Booking request submitted successfully",
  "booking": {
    "id": "booking_12346",
    "status": "pending",
    "estimatedApprovalTime": "2 hours",
    "referenceNumber": "BHEL-TRANS-2025-001"
  }
}
```

#### Response - Validation Error

```json
{
  "error": "Validation failed",
  "details": {
    "date": "Date must be in the future",
    "time": "Invalid time format"
  }
}
```

#### Validation Rules

- `date`: Must be today or future date
- `time`: Must be in HH:MM format
- `pickupLocation`: Required, max 200 characters
- `dropLocation`: Required, max 200 characters
- `purpose`: Required, max 500 characters
- `priority`: Must be one of: `low`, `medium`, `high`, `urgent`
- `employeeId`: Must match authenticated user's employee ID

## ✅ Approval System

### Check Approver Status

**GET** `/api/approvals/check`

Verify if the current user has approval permissions.

#### Request

```http
GET /api/approvals/check
Cookie: auth-token=<jwt-token>
```

#### Response

```json
{
  "isApprover": true,
  "approvalLevel": "L1",
  "canApprove": {
    "maxAmount": 50000,
    "afterHours": true,
    "urgentRequests": true
  },
  "reportingHierarchy": [
    "john.doe",
    "team.lead",
    "department.head"
  ]
}
```

---

### Get Pending Approvals

**GET** `/api/approvals/pending`

Retrieve all booking requests pending approval. **Requires manager permissions.**

#### Request

```http
GET /api/approvals/pending
Cookie: auth-token=<jwt-token>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `priority` | string | No | Filter by priority: `low`, `medium`, `high`, `urgent` |
| `department` | string | No | Filter by requesting department |
| `date_from` | string | No | Filter by travel date (YYYY-MM-DD) |
| `after_hours` | boolean | No | Filter after-hours requests |
| `limit` | number | No | Number of results (default: 50) |

#### Response

```json
{
  "approvals": [
    {
      "id": "booking_12347",
      "employeeName": "Jane Smith",
      "employeeId": "EMP002",
      "department": "Marketing",
      "pickupLocation": "BHEL Office Complex",
      "dropLocation": "Client Location",
      "travelDate": "2025-01-16",
      "travelTime": "09:00",
      "purpose": "Client Presentation",
      "priority": "high",
      "afterHours": false,
      "submittedAt": "2025-01-11T09:15:00.000Z",
      "submittedBy": "jane.smith",
      "estimatedCost": 2500,
      "currentApprovalLevel": "L1",
      "requiredApprovalLevel": "L1",
      "attachments": [
        {
          "type": "travel_authorization",
          "filename": "travel_auth_002.pdf",
          "url": "/api/files/travel_auth_002.pdf"
        }
      ]
    }
  ],
  "summary": {
    "total": 12,
    "byPriority": {
      "urgent": 2,
      "high": 4,
      "medium": 5,
      "low": 1
    },
    "byDepartment": {
      "Engineering": 8,
      "Marketing": 3,
      "HR": 1
    },
    "averageWaitTime": "1.5 hours"
  }
}
```

---

### Approve/Reject Booking

**POST** `/api/approvals/approve`

Approve or reject a pending booking request. **Requires manager permissions.**

#### Request

```http
POST /api/approvals/approve
Content-Type: application/json
Cookie: auth-token=<jwt-token>

{
  "bookingId": "booking_12347",
  "action": "approve",
  "comments": "Approved for official client meeting",
  "conditions": {
    "vehicleType": "AC Sedan",
    "maxCost": 3000,
    "returnRequired": true
  },
  "alternativeOptions": {
    "suggestedTime": "09:30",
    "suggestedVehicle": "Shared Transport"
  }
}
```

#### Request - Rejection

```http
POST /api/approvals/approve
Content-Type: application/json
Cookie: auth-token=<jwt-token>

{
  "bookingId": "booking_12347",
  "action": "reject",
  "reason": "insufficient_justification",
  "comments": "Please provide detailed business justification",
  "alternatives": [
    "Use public transport",
    "Reschedule to combine with other visits"
  ]
}
```

#### Response - Success

```json
{
  "success": true,
  "message": "Booking approved successfully",
  "booking": {
    "id": "booking_12347",
    "status": "approved",
    "approvedBy": "manager.name",
    "approvedAt": "2025-01-11T10:30:00.000Z",
    "vehicleAssigned": "TN01CD5678",
    "driverAssigned": {
      "name": "Driver Name",
      "contact": "+91-9876543210",
      "license": "TN0123456789"
    },
    "estimatedPickupTime": "08:55",
    "trackingUrl": "/track/booking_12347"
  }
}
```

#### Approval Actions

- `approve`: Approve the booking request
- `reject`: Reject the booking request
- `request_info`: Request additional information
- `modify`: Suggest modifications

#### Rejection Reasons

- `insufficient_justification`: Business case not clear
- `budget_exceeded`: Cost exceeds allocated budget
- `vehicle_unavailable`: No suitable vehicle available
- `policy_violation`: Violates transport policy
- `duplicate_request`: Similar request already approved

## 👤 User Management

### Get User Profile

**GET** `/api/profile`

Retrieve detailed profile information for the authenticated user.

#### Request

```http
GET /api/profile
Cookie: auth-token=<jwt-token>
```

#### Response

```json
{
  "profile": {
    "employeeId": "EMP001",
    "fullName": "John Doe",
    "email": "john.doe@bhel.in",
    "department": "Engineering",
    "designation": "Senior Engineer",
    "joiningDate": "2020-03-15",
    "reportingManager": "manager.name",
    "location": "Bangalore",
    "contactNumber": "+91-9876543210",
    "transportPrivileges": {
      "monthlyQuota": 10,
      "usedThisMonth": 3,
      "afterHoursAllowed": true,
      "emergencyTransport": true
    },
    "bookingHistory": {
      "totalBookings": 45,
      "approvedBookings": 42,
      "rejectedBookings": 2,
      "cancelledBookings": 1
    }
  }
}
```

---

### Update User Profile

**PUT** `/api/profile`

Update user profile information.

#### Request

```http
PUT /api/profile
Content-Type: application/json
Cookie: auth-token=<jwt-token>

{
  "contactNumber": "+91-9876543210",
  "alternateContact": "+91-9876543211",
  "emergencyContact": {
    "name": "Emergency Contact Name",
    "relationship": "Spouse",
    "phone": "+91-9876543212"
  },
  "preferences": {
    "vehicleType": "AC Sedan",
    "notificationMethod": "email",
    "defaultPickupLocation": "BHEL Main Gate"
  }
}
```

## 🔧 Utilities

### Database Health Check

**GET** `/api/db/test-connection`

Test database connectivity and system health.

#### Request

```http
GET /api/db/test-connection
```

#### Response

```json
{
  "connectionTest": "SUCCESS",
  "server": "10.2.13.102",
  "database": "digiseva",
  "axusersTable": {
    "exists": true,
    "totalUsers": 1250,
    "activeUsers": 1180,
    "structure": [
      {
        "COLUMN_NAME": "username",
        "DATA_TYPE": "varchar",
        "IS_NULLABLE": "NO",
        "CHARACTER_MAXIMUM_LENGTH": 50
      }
    ]
  },
  "performance": {
    "queryTime": "12ms",
    "connectionPool": {
      "total": 10,
      "active": 3,
      "idle": 7
    }
  },
  "timestamp": "2025-01-11T10:45:00.000Z"
}
```

---

### System Information

**GET** `/api/system/info`

Get system information and version details.

#### Request

```http
GET /api/system/info
```

#### Response

```json
{
  "application": {
    "name": "BHEL Transport Dashboard",
    "version": "1.0.0",
    "buildDate": "2025-01-01T00:00:00.000Z",
    "environment": "production"
  },
  "system": {
    "uptime": 157680,
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "memory": {
      "used": "245MB",
      "total": "2GB",
      "percentage": 12.25
    }
  },
  "database": {
    "status": "connected",
    "version": "Microsoft SQL Server 2019",
    "lastHealthCheck": "2025-01-11T10:40:00.000Z"
  }
}
```

## ❌ Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  },
  "timestamp": "2025-01-11T10:45:00.000Z",
  "path": "/api/endpoint"
}
```

### Common HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTH_REQUIRED` | Authentication needed | Login required |
| `INVALID_CREDENTIALS` | Wrong username/password | Check credentials |
| `INSUFFICIENT_PERMISSIONS` | Access denied | Contact administrator |
| `VALIDATION_ERROR` | Input validation failed | Check request data |
| `RESOURCE_NOT_FOUND` | Resource doesn't exist | Verify resource ID |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait before retrying |
| `DATABASE_ERROR` | Database connectivity issue | Contact support |

## 🚦 Rate Limiting

### Rate Limits

| Endpoint Category | Requests per Window | Window Duration |
|-------------------|-------------------|----------------|
| Authentication | 5 requests | 15 minutes |
| Booking Operations | 20 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| File Uploads | 10 requests | 15 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641901200
X-RateLimit-Window: 900
```

### Rate Limit Exceeded Response

```json
{
  "error": "Too many requests from this IP, please try again later",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 300,
  "limit": {
    "max": 100,
    "window": "15 minutes",
    "remaining": 0
  }
}
```

## 🔒 Security

### Request Security

- **HTTPS Only**: All production requests must use HTTPS
- **CORS Protection**: Configured for BHEL domains only
- **CSRF Protection**: Built-in with SameSite cookies
- **Input Validation**: All inputs validated and sanitized
- **SQL Injection Protection**: Parameterized queries only

### Authentication Security

- **JWT Tokens**: Signed with strong secret
- **HTTP-Only Cookies**: Prevents XSS attacks
- **Secure Cookies**: HTTPS-only in production
- **Token Expiration**: 7-day expiration with refresh
- **Session Management**: Automatic cleanup

### API Security Headers

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

## 📚 SDK Examples

### JavaScript/Node.js

```javascript
class BHELTransportAPI {
  constructor(baseURL = 'https://transport.bhel.in/api') {
    this.baseURL = baseURL
    this.token = null
  }

  async login(username, password, userType = 'employee') {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, userType })
    })
    
    if (!response.ok) {
      throw new Error('Login failed')
    }
    
    return response.json()
  }

  async getMyBookings() {
    const response = await fetch(`${this.baseURL}/bookings/me`, {
      credentials: 'include'
    })
    
    return response.json()
  }

  async createBooking(bookingData) {
    const response = await fetch(`${this.baseURL}/ride-submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(bookingData)
    })
    
    return response.json()
  }
}

// Usage
const api = new BHELTransportAPI()
await api.login('john.doe', 'password')
const bookings = await api.getMyBookings()
```

### Python

```python
import requests

class BHELTransportAPI:
    def __init__(self, base_url="https://transport.bhel.in/api"):
        self.base_url = base_url
        self.session = requests.Session()

    def login(self, username, password, user_type="employee"):
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={
                "username": username,
                "password": password,
                "userType": user_type
            }
        )
        response.raise_for_status()
        return response.json()

    def get_my_bookings(self):
        response = self.session.get(f"{self.base_url}/bookings/me")
        response.raise_for_status()
        return response.json()

    def create_booking(self, booking_data):
        response = self.session.post(
            f"{self.base_url}/ride-submission",
            json=booking_data
        )
        response.raise_for_status()
        return response.json()

# Usage
api = BHELTransportAPI()
api.login("john.doe", "password")
bookings = api.get_my_bookings()
```

---

## 📞 Support

For API support and questions:

- **Technical Support**: api-support@bhel.in
- **Documentation Issues**: docs@bhel.in
- **Security Concerns**: security@bhel.in

---

*Last Updated: January 2025*
*Version: 1.0.0*