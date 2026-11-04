export interface StaffUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
}

export type AccountStatusFilter = "all" | "active" | "suspended"

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
}

export interface AdminUserPage {
  users: AdminUser[]
  total: number
}

export interface AdminServer {
  id: string
  name: string
  iconUrl: string | null
  ownerId: string
  memberCount: number
  createdAt: string
  suspended: boolean
  suspendedAt: string | null
}

export type MetricKey = "activeUsers" | "serversCreated" | "messagesSent"

// Half-open interval [from, to) in UTC, built from local day boundaries.
// firstDay and lastDay are the calendar days shown to the staff.
export interface MetricPeriod {
  from: string
  to: string
  firstDay: string
  lastDay: string
}
