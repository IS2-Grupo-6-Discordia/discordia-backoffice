import { api } from "./client"

export type ReportStatus = "pending" | "reviewed" | "dismissed"
export type ReportStatusFilter = ReportStatus | "all"
export type ReportReason = "spam" | "harassment" | "inappropriate_content" | "impersonation" | "other"

export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Acoso",
  inappropriate_content: "Contenido inapropiado",
  impersonation: "Suplantación de identidad",
  other: "Otro motivo",
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pendiente",
  reviewed: "Revisado",
  dismissed: "Descartado",
}

export interface Report {
  id: string
  reporterId: string
  targetType: "user" | "server"
  targetUserId: string | null
  serverId: string
  serverName: string
  reason: string
  detail: string | null
  status: ReportStatus
  createdAt: string
  resolvedBy: string | null
  resolvedAt: string | null
}

export interface ModerationEntry {
  kind: "suspended" | "reactivated" | "deleted" | "banned"
  actorId: string
  actorName: string | null
  createdAt: string
  serverName?: string
  reason?: string | null
}

export interface UserDossier {
  account: {
    id: string
    name: string
    email: string
    role: string
    avatarUrl: string | null
    isActive: boolean
    createdAt: string
    lastActiveAt: string | null
    lastSeenAt: string | null
    hasPassword: boolean
  }
  sessions: {
    createdAt: string
    expiresAt: string
    revokedAt: string | null
  }[]
  memberships: {
    serverId: string
    serverName: string
    iconUrl: string | null
    role: string
    joinedAt: string
    suspended: boolean
  }[]
  reports: Report[]
  moderation: ModerationEntry[]
}

export interface ServerDossier {
  server: {
    id: string
    name: string
    iconUrl: string | null
    ownerId: string
    memberCount: number
    createdAt: string
    suspended: boolean
    suspendedAt: string | null
  }
  recentJoins: { userId: string; role: string; joinedAt: string }[]
  reports: Report[]
  moderation: ModerationEntry[]
  messagingAvailable: boolean
}

interface BackendReport {
  id: string
  reporter_id: string
  target_type: "user" | "server"
  target_user_id: string | null
  server_id: string
  server_name: string
  reason: string
  detail: string | null
  status: ReportStatus
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
}

interface BackendBan {
  server_id: string
  server_name: string | null
  user_id: string
  banned_by: string
  reason: string | null
  created_at: string
}

function toReport(r: BackendReport): Report {
  return {
    id: r.id,
    reporterId: r.reporter_id,
    targetType: r.target_type,
    targetUserId: r.target_user_id,
    serverId: r.server_id,
    serverName: r.server_name,
    reason: r.reason,
    detail: r.detail,
    status: r.status,
    createdAt: r.created_at,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
  }
}

function toBanEntry(b: BackendBan): ModerationEntry {
  return {
    kind: "banned",
    actorId: b.banned_by,
    actorName: null,
    createdAt: b.created_at,
    serverName: b.server_name ?? undefined,
    reason: b.reason,
  }
}

const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt)

export async function getUserNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean)
  const names = new Map<string, string>()
  for (let i = 0; i < unique.length; i += 100) {
    const res = await api<{ users: { id: string; name: string }[] }>("/auth/users/batch", {
      method: "POST",
      body: JSON.stringify({ user_ids: unique.slice(i, i + 100) }),
    })
    for (const u of res.users) names.set(u.id, u.name)
  }
  return names
}

export async function getUserDossier(userId: string): Promise<UserDossier> {
  const [auth, servers] = await Promise.all([
    api<{
      account: {
        id: string
        name: string
        email: string
        role: string
        avatar_url: string | null
        is_active: boolean
        created_at: string
        last_active_at: string | null
        last_seen_at: string | null
        has_password: boolean
      }
      recent_sessions: {
        created_at: string
        expires_at: string
        revoked_at: string | null
      }[]
      moderation_actions: {
        action: "suspended" | "reactivated"
        actor_id: string
        actor_name: string | null
        created_at: string
      }[]
    }>(`/auth/admin/users/${userId}/dossier`),
    api<{
      memberships: {
        server_id: string
        server_name: string
        icon_url: string | null
        role: string
        joined_at: string
        suspended: boolean
      }[]
      bans: BackendBan[]
      reports: BackendReport[]
    }>(`/admin/users/${userId}/dossier`),
  ])
  const a = auth.account
  return {
    account: {
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      avatarUrl: a.avatar_url,
      isActive: a.is_active,
      createdAt: a.created_at,
      lastActiveAt: a.last_active_at,
      lastSeenAt: a.last_seen_at,
      hasPassword: a.has_password,
    },
    sessions: auth.recent_sessions.map((s) => ({
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      revokedAt: s.revoked_at,
    })),
    memberships: servers.memberships.map((m) => ({
      serverId: m.server_id,
      serverName: m.server_name,
      iconUrl: m.icon_url,
      role: m.role,
      joinedAt: m.joined_at,
      suspended: m.suspended,
    })),
    reports: servers.reports.map(toReport),
    moderation: [
      ...auth.moderation_actions.map((m) => ({
        kind: m.action,
        actorId: m.actor_id,
        actorName: m.actor_name,
        createdAt: m.created_at,
      })),
      ...servers.bans.map(toBanEntry),
    ].sort(byNewest),
  }
}

export async function getServerDossier(serverId: string): Promise<ServerDossier> {
  const res = await api<{
    server: {
      id: string
      name: string
      icon_url: string | null
      owner_id: string
      member_count: number
      created_at: string
      suspended: boolean
      suspended_at: string | null
    }
    recent_joins: { user_id: string; role: string; joined_at: string }[]
    reports: BackendReport[]
    moderation_actions: {
      action: "suspended" | "reactivated" | "deleted"
      actor_id: string
      created_at: string
    }[]
    bans: BackendBan[]
    messaging_available: boolean
  }>(`/admin/servers/${serverId}/dossier`)
  const s = res.server
  return {
    server: {
      id: s.id,
      name: s.name,
      iconUrl: s.icon_url,
      ownerId: s.owner_id,
      memberCount: s.member_count,
      createdAt: s.created_at,
      suspended: s.suspended,
      suspendedAt: s.suspended_at,
    },
    recentJoins: res.recent_joins.map((j) => ({
      userId: j.user_id,
      role: j.role,
      joinedAt: j.joined_at,
    })),
    reports: res.reports.map(toReport),
    moderation: [
      ...res.moderation_actions.map((m) => ({
        kind: m.action,
        actorId: m.actor_id,
        actorName: null,
        createdAt: m.created_at,
      })),
      ...res.bans.map(toBanEntry),
    ].sort(byNewest),
    messagingAvailable: res.messaging_available,
  }
}

export async function getReports(status: ReportStatusFilter): Promise<Report[]> {
  const res = await api<BackendReport[]>(`/admin/reports?status=${status}`)
  return res.map(toReport)
}

export async function resolveReport(reportId: string, status: "reviewed" | "dismissed"): Promise<Report> {
  const res = await api<BackendReport>(`/admin/reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ status }),
  })
  return toReport(res)
}
