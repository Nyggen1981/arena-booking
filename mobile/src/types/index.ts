// User types
export interface User {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'user'
  phone: string | null
  organizationId: string
  organization?: Organization
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo: string | null
  tagline: string
  primaryColor: string
  secondaryColor: string
}

// Resource types
export interface ResourceCategory {
  id: string
  name: string
  color: string
  description?: string | null
  icon?: string | null
}

export interface ResourcePart {
  id: string
  name: string
  description?: string | null
  capacity?: number | null
  isActive: boolean
}

export interface Resource {
  id: string
  name: string
  description?: string | null
  location?: string | null
  image?: string | null
  color?: string | null
  isActive: boolean
  minBookingMinutes?: number | null
  maxBookingMinutes?: number | null
  requiresApproval: boolean
  categoryId?: string | null
  category?: ResourceCategory | null
  parts: ResourcePart[]
}

// Booking types
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Booking {
  id: string
  title: string
  description?: string | null
  startTime: string
  endTime: string
  status: BookingStatus
  statusNote?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  isRecurring: boolean
  recurringPattern?: string | null
  recurringEndDate?: string | null
  resourceId: string
  resource?: Resource
  resourcePartId?: string | null
  resourcePart?: ResourcePart | null
  userId: string
  user?: User
  createdAt: string
  approvedAt?: string | null
}

// API Response types
export interface ApiError {
  error: string
  details?: string
}

export interface LoginResponse {
  user: User
  token: string
}

export interface BookingsResponse {
  bookings: Booking[]
  count: number
}

// Form types
export interface BookingFormData {
  resourceId: string
  resourcePartId?: string | null
  title: string
  description?: string
  startTime: Date
  endTime: Date
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  isRecurring?: boolean
  recurringType?: 'weekly' | 'biweekly' | 'monthly'
  recurringEndDate?: Date
}

