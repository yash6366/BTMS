export type User = {
  username: string
  email?: string
  usergroup?: string
  EMP_ID?: string
  EMP_EMAIL_ID?: string
  EMP_DESIGNATION?: string
  firstName?: string
  lastName?: string
  middleName?: string
  fullName?: string
  role: "employee" | "manager" | "transport"
  usertype?: "regular" | "transport"
  permissions?: {
    build: boolean
    manage: boolean
    tools: boolean
  }
  pageaccess?: string
  reportingto?: string
  active?: string
}


export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message: string
  user?: User
  token?: string
}

export interface RideBooking {
  id: string
  employeeName: string
  employeeId: string
  department: string
  pickupLocation: string
  dropLocation: string
  date: string
  time: string
  purpose: string
  status: "pending" | "approved" | "rejected" | "completed"
  requestedAt: string
  priority: "low" | "medium" | "high" | "urgent"
  afterHours: boolean
}

export interface PoolRide {
  id: number
  route: string
  time: string
  date: string
  driver: string
  rating: number
  seatsAvailable: number
  totalSeats: number
  costPerSeat: string
  estimatedTime: string
}

export interface DashboardStats {
  totalRides: number
  activePoolings: number
  upcomingBookings: number
  costSavings: string
}

export interface EmpProfile {
  EMP_ID: string
  EMP_FNAME?: string
  EMP_MNAME?: string
  EMP_LNAME?: string
  EMP_DESIGNATION?: string
  EMP_EMAIL_ID?: string
  fullName?: string
}
