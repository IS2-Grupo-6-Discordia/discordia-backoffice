import { api } from "./client"
import type { AccountStatusFilter, AdminServer, AdminUser, AdminUserPage } from "./types"

interface BackendAdminUser {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

interface BackendAdminServer {
  id: string
  name: string
  icon_url: string | null
  owner_id: string
  member_count: number
  created_at: string
}

function toAdminUser(user: BackendAdminUser): AdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatar_url,
    isActive: user.is_active,
    createdAt: user.created_at,
  }
}

function toAdminServer(server: BackendAdminServer): AdminServer {
  return {
    id: server.id,
    name: server.name,
    iconUrl: server.icon_url,
    ownerId: server.owner_id,
    memberCount: server.member_count,
    createdAt: server.created_at,
  }
}

export async function getUsers(params: {
  query?: string
  status?: AccountStatusFilter
  limit?: number
  offset?: number
}): Promise<AdminUserPage> {
  const search = new URLSearchParams()
  if (params.query) search.set("q", params.query)
  if (params.status && params.status !== "all") search.set("status", params.status)
  if (params.limit) search.set("limit", String(params.limit))
  if (params.offset) search.set("offset", String(params.offset))
  const qs = search.toString()
  const res = await api<{ users: BackendAdminUser[]; total: number }>(
    `/auth/admin/users${qs ? `?${qs}` : ""}`,
  )
  return { users: res.users.map(toAdminUser), total: res.total }
}

export async function suspendUser(userId: string): Promise<AdminUser> {
  const res = await api<BackendAdminUser>(`/auth/admin/users/${userId}/suspend`, { method: "POST" })
  return toAdminUser(res)
}

export async function reactivateUser(userId: string): Promise<AdminUser> {
  const res = await api<BackendAdminUser>(`/auth/admin/users/${userId}/reactivate`, {
    method: "POST",
  })
  return toAdminUser(res)
}

export async function getAdminServers(search?: string): Promise<AdminServer[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  const res = await api<BackendAdminServer[]>(`/admin/servers${qs}`)
  return res.map(toAdminServer)
}
