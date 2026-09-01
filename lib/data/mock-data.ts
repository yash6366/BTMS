import type { RideBooking, PoolRide, DashboardStats } from "@/types"

export const mockDashboardStats: DashboardStats = {
  totalRides: 24,
  activePoolings: 3,
  upcomingBookings: 1,
  costSavings: "₹2,450",
}

export const mockRecentActivity = [
  {
    action: "Ride completed",
    location: "Airport to Office",
    time: "2 hours ago",
    status: "completed" as const,
  },
  {
    action: "Pool joined",
    location: "Home to Railway Station",
    time: "1 day ago",
    status: "active" as const,
  },
  {
    action: "Ride booked",
    location: "Office to Home",
    time: "2 days ago",
    status: "upcoming" as const,
  },
]

export const mockAvailablePools: PoolRide[] = [
  {
    id: 1,
    route: "BHEL Office → Railway Station",
    time: "08:30 AM",
    date: "Today",
    driver: "Rajesh Kumar",
    rating: 4.8,
    seatsAvailable: 2,
    totalSeats: 4,
    costPerSeat: "₹45",
    estimatedTime: "25 mins",
  },
  {
    id: 2,
    route: "Airport → BHEL Office",
    time: "02:15 PM",
    date: "Tomorrow",
    driver: "Priya Sharma",
    rating: 4.9,
    seatsAvailable: 1,
    totalSeats: 3,
    costPerSeat: "₹120",
    estimatedTime: "45 mins",
  },
  {
    id: 3,
    route: "Railway Station → Residential Area",
    time: "06:45 PM",
    date: "Today",
    driver: "Amit Singh",
    rating: 4.7,
    seatsAvailable: 3,
    totalSeats: 4,
    costPerSeat: "₹35",
    estimatedTime: "20 mins",
  },
]

export const mockPendingBookings: RideBooking[] = [
  {
    id: "BK001",
    employeeName: "Rajesh Kumar",
    employeeId: "BHEL001234",
    department: "Engineering",
    pickupLocation: "Airport",
    dropLocation: "BHEL Office",
    date: "2025-01-15",
    time: "14:30",
    purpose: "Client meeting at head office",
    requestedAt: "2025-01-14 10:30 AM",
    priority: "high",
    afterHours: true,
    status: "pending",
  },
  {
    id: "BK002",
    employeeName: "Priya Sharma",
    employeeId: "BHEL005678",
    department: "HR",
    pickupLocation: "Railway Station",
    dropLocation: "Residential Area",
    date: "2025-01-15",
    time: "18:45",
    purpose: "Personal emergency - family medical situation",
    requestedAt: "2025-01-14 16:15 PM",
    priority: "urgent",
    afterHours: true,
    status: "pending",
  },
]
