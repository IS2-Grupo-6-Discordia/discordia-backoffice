import { api } from "./client"
import type { MetricKey, MetricPeriod } from "./types"

export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "365d" | "custom"

export const MAX_PERIOD_DAYS = 366

const PRESET_DAYS: Record<Exclude<PeriodPreset, "custom">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

// Presets end "now" and start at local midnight, so "Últimos 7 días" means today plus the six
// days before it, not the last 168 hours.
export function presetPeriod(preset: Exclude<PeriodPreset, "custom">, now = new Date()): MetricPeriod {
  const first = addDays(startOfDay(now), -(PRESET_DAYS[preset] - 1))
  return {
    from: first.toISOString(),
    to: now.toISOString(),
    firstDay: first.toISOString(),
    lastDay: now.toISOString(),
  }
}

// Parses DD/MM/AAAA as a local calendar day. Rejects impossible dates like 31/02/2026.
export function parseDay(text: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

// Both days are inclusive: the interval ends at the midnight after `end`, or now if that is
// still in the future.
export function customPeriod(startText: string, endText: string, now = new Date()): { period: MetricPeriod } | { error: string } {
  const start = parseDay(startText)
  const end = parseDay(endText)
  if (!start || !end) return { error: "Usá el formato DD/MM/AAAA en las dos fechas." }
  if (start > end) return { error: "La fecha de inicio tiene que ser anterior o igual a la de fin." }
  if (start > now) return { error: "El período no puede empezar en el futuro." }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (days > MAX_PERIOD_DAYS) return { error: "El período puede abarcar hasta un año." }
  const endExclusive = addDays(end, 1)
  const to = endExclusive < now ? endExclusive : now
  return {
    period: {
      from: start.toISOString(),
      to: to.toISOString(),
      firstDay: start.toISOString(),
      lastDay: (end < now ? end : now).toISOString(),
    },
  }
}

// Each metric lives in the service that owns its data, so the backoffice asks each one on its
// own: a service that is down only hides its own number.
const METRIC_REQUESTS: Record<MetricKey, (query: string) => Promise<number>> = {
  activeUsers: async (query) => (await api<{ active_users: number }>(`/auth/admin/metrics?${query}`)).active_users,
  serversCreated: async (query) => (await api<{ servers_created: number }>(`/admin/metrics/servers?${query}`)).servers_created,
  messagesSent: async (query) => (await api<{ messages_sent: number }>(`/admin/metrics/messages?${query}`)).messages_sent,
}

export function getMetric(key: MetricKey, period: MetricPeriod): Promise<number> {
  const query = new URLSearchParams({ from: period.from, to: period.to }).toString()
  return METRIC_REQUESTS[key](query)
}
