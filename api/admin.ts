import { api } from "./client"
import type { AdminUser, KPI, AuditEntry } from "./types"

const USE_MOCK = !process.env.EXPO_PUBLIC_API_URL

const MOCK_KPIS: KPI[] = [
  { label: "Usuarios activos · 7d", value: "1.284", delta: "+6,2%", warn: false, spark: [40, 55, 48, 66, 72, 64, 88] },
  { label: "Servidores", value: "212", delta: "+9 esta semana", warn: false, spark: [] },
  { label: "Mensajes · 24h", value: "48.930", delta: "−3,1%", warn: true, spark: [] },
  { label: "Estado plataforma", value: "Degradado", delta: "Voz: latencia alta", warn: true, spark: [] },
]

const MOCK_USERS: AdminUser[] = [
  { name: "Nadia Vega", email: "n.vega@mail.com", av: "NV", status: "Suspendida", tag: "sus", servers: 4, reports: 7, date: "12/03/2026" },
  { name: "Rodrigo Cano", email: "rcano@mail.com", av: "RC", status: "Suspendido", tag: "sus", servers: 1, reports: 3, date: "28/05/2026" },
  { name: "Mora Benítez", email: "mora.b@mail.com", av: "MB", status: "Activa", tag: "ok", servers: 9, reports: 0, date: "02/02/2026" },
  { name: "Tomás Souza", email: "tsouza@mail.com", av: "TS", status: "En revisión", tag: "warn", servers: 3, reports: 2, date: "19/06/2026" },
  { name: "Lucía Ramos", email: "l.ramos@mail.com", av: "LR", status: "Activa", tag: "ok", servers: 6, reports: 1, date: "07/04/2026" },
]

const MOCK_AUDIT: AuditEntry[] = [
  { id: "1", action: "Expulsión", actor: "Matías Fernández", target: "spam_user123", time: "hace 2h", reason: "Spam repetido en el canal" },
  { id: "2", action: "Rol asignado", actor: "Valentina Ríos", target: "Rodrigo Vega", time: "hace 4h", reason: "Rol: Miembros Premium" },
  { id: "3", action: "Canal creado", actor: "Valentina Ríos", target: "#arquitectura", time: "hace 1d", reason: "" },
  { id: "4", action: "Baneo", actor: "Matías Fernández", target: "troll_account", time: "hace 2d", reason: "Acoso a miembros" },
  { id: "5", action: "Silenciado", actor: "Matías Fernández", target: "offtopic_guy", time: "hace 3d", reason: "Flood de mensajes" },
]

export async function getKPIs(): Promise<KPI[]> {
  if (USE_MOCK) return MOCK_KPIS
  return api<KPI[]>("/admin/kpis")
}

export async function getUsers(filter?: string): Promise<AdminUser[]> {
  if (USE_MOCK) {
    if (filter === "Suspendidos") return MOCK_USERS.filter((u) => u.tag === "sus")
    if (filter === "Activos") return MOCK_USERS.filter((u) => u.tag === "ok")
    return MOCK_USERS
  }
  const params = filter ? `?filter=${encodeURIComponent(filter)}` : ""
  return api<AdminUser[]>(`/admin/users${params}`)
}

export async function getAuditLog(serverId: string): Promise<AuditEntry[]> {
  if (USE_MOCK) return MOCK_AUDIT
  return api<AuditEntry[]>(`/servers/${serverId}/audit`)
}

export async function suspendUser(userId: string, reason: string): Promise<void> {
  if (USE_MOCK) return
  await api(`/admin/users/${userId}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export async function banUser(serverId: string, userId: string, reason: string): Promise<void> {
  if (USE_MOCK) return
  await api(`/servers/${serverId}/members/${userId}/ban`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}
