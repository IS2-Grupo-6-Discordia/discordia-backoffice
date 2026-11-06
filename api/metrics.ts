import { api } from "./client"
import type { Granularity, MetricBuckets, MetricInterval, MetricKey, MetricPeriod } from "./types"

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

export function getMetric(key: MetricKey, period: MetricInterval): Promise<number> {
  const query = new URLSearchParams({ from: period.from, to: period.to }).toString()
  return METRIC_REQUESTS[key](query)
}

// The chart splits the period into buckets: hours for a single day, days up to a month, weeks
// up to four months, calendar months beyond that. At most 31 buckets.
export function periodBuckets(period: MetricPeriod): MetricBuckets {
  const from = new Date(period.from)
  const to = new Date(period.to)
  const days = (to.getTime() - from.getTime()) / 86_400_000
  const granularity: Granularity = days <= 1.05 ? "hour" : days <= 31 ? "day" : days <= 120 ? "week" : "month"
  const starts: Date[] = []
  for (let cursor = from; cursor < to; cursor = nextBucketStart(cursor, granularity)) starts.push(cursor)
  return {
    granularity,
    buckets: starts.map((start, i) => ({
      from: start.toISOString(),
      to: (i + 1 < starts.length ? starts[i + 1] : to).toISOString(),
    })),
  }
}

function nextBucketStart(date: Date, granularity: Granularity): Date {
  switch (granularity) {
    case "hour":
      return new Date(date.getTime() + 3_600_000)
    case "day":
      return addDays(date, 1)
    case "week":
      return addDays(date, 7)
    case "month":
      return new Date(date.getFullYear(), date.getMonth() + 1, 1)
  }
}

const two = (n: number) => String(n).padStart(2, "0")

// Short labels go on the axis, long ones in the tooltip and the table.
export function bucketLabel(bucket: MetricInterval, granularity: Granularity, long = false): string {
  const start = new Date(bucket.from)
  const day = `${two(start.getDate())}/${two(start.getMonth() + 1)}`
  switch (granularity) {
    case "hour":
      return long ? `De ${two(start.getHours())} a ${two((start.getHours() + 1) % 24)} h` : `${two(start.getHours())} h`
    case "day":
      return long ? `${day}/${start.getFullYear()}` : day
    case "week":
      return long ? `Semana del ${day}` : day
    case "month": {
      const month = start.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")
      return long ? `${month} ${start.getFullYear()}` : month
    }
  }
}

export const GRANULARITY_UNIT: Record<Granularity, string> = { hour: "hora", day: "día", week: "semana", month: "mes" }

// One request per bucket, a few at a time so a long period doesn't flood the gateway. Stops
// early when the period changed (isCurrent) or a bucket failed; null means "discard".
const SERIES_CONCURRENCY = 4

export async function getMetricSeries(key: MetricKey, buckets: MetricInterval[], isCurrent: () => boolean): Promise<number[] | null> {
  const values = new Array<number>(buckets.length).fill(0)
  let next = 0
  let failed = false
  const worker = async () => {
    while (next < buckets.length && !failed && isCurrent()) {
      const i = next++
      try {
        values[i] = await getMetric(key, buckets[i])
      } catch (err) {
        failed = true
        throw err
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(SERIES_CONCURRENCY, buckets.length) }, worker))
  return isCurrent() ? values : null
}
