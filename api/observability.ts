import { ApiError, api, friendlyError } from "./client"

// Trazas y logs de Grafana Cloud a través de autenticación (adr/0013 en documentacion). Todo es
// de solo lectura y sin autorefresco: cada consulta gasta cuota, así que la pantalla solo
// consulta cuando cambia un filtro o se toca "Actualizar".

export type ObservedService = "autenticacion" | "servidores" | "mensajes" | "voz"
export type TimeRange = "15m" | "1h" | "6h" | "24h"
export type LogLevel = "info" | "warn" | "error"

export const SERVICES: { value: ObservedService; label: string }[] = [
  { value: "autenticacion", label: "Autenticación" },
  { value: "servidores", label: "Servidores" },
  { value: "mensajes", label: "Mensajes" },
  { value: "voz", label: "Voz" },
]

export const RANGES: { value: TimeRange; label: string }[] = [
  { value: "15m", label: "15 min" },
  { value: "1h", label: "1 hora" },
  { value: "6h", label: "6 horas" },
  { value: "24h", label: "24 horas" },
]

export const LEVELS: { value: LogLevel; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
]

export const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/
// El código que muestran los clientes en un error son los primeros 8 caracteres del request_id.
export const ERROR_CODE_PATTERN = /^[0-9a-f][0-9a-f-]{7,35}$/

export interface TraceSummary {
  traceId: string
  rootService: string | null
  rootName: string | null
  startedAt: string | null
  durationMs: number | null
}

export interface Span {
  spanId: string
  parentSpanId: string | null
  service: string | null
  name: string
  offsetMs: number
  durationMs: number
  error: boolean
}

export interface LogLine {
  timestamp: string
  service: string | null
  level: string | null
  message: string
  traceId: string | null
  requestId: string | null
}

export interface TraceDetail {
  traceId: string
  startedAt: string | null
  durationMs: number
  spans: Span[]
  logs: LogLine[]
}

interface BackendTraceSummary {
  trace_id: string
  root_service: string | null
  root_name: string | null
  started_at: string | null
  duration_ms: number | null
}

interface BackendSpan {
  span_id: string
  parent_span_id: string | null
  service: string | null
  name: string
  offset_ms: number
  duration_ms: number
  error: boolean
}

interface BackendLogLine {
  timestamp: string
  service: string | null
  level: string | null
  message: string
  trace_id: string | null
  request_id: string | null
}

const BASE = "/auth/admin/observability"

function toLog(line: BackendLogLine): LogLine {
  return {
    timestamp: line.timestamp,
    service: line.service,
    level: line.level,
    message: line.message,
    traceId: line.trace_id,
    requestId: line.request_id,
  }
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "" && value !== false) qs.set(key, String(value))
  }
  const text = qs.toString()
  return text ? `?${text}` : ""
}

export async function searchTraces(filters: {
  service: ObservedService | null
  errorsOnly: boolean
  minDurationMs: number | null
  range: TimeRange
}): Promise<TraceSummary[]> {
  const res = await api<{ traces: BackendTraceSummary[] }>(
    `${BASE}/traces${query({
      service: filters.service,
      errors_only: filters.errorsOnly,
      min_duration_ms: filters.minDurationMs,
      range: filters.range,
    })}`,
  )
  return res.traces.map((t) => ({
    traceId: t.trace_id,
    rootService: t.root_service,
    rootName: t.root_name,
    startedAt: t.started_at,
    durationMs: t.duration_ms,
  }))
}

export async function getTrace(traceId: string): Promise<TraceDetail> {
  const res = await api<{
    trace_id: string
    started_at: string | null
    duration_ms: number
    spans: BackendSpan[]
    logs: BackendLogLine[]
  }>(`${BASE}/traces/${traceId}`)
  return {
    traceId: res.trace_id,
    startedAt: res.started_at,
    durationMs: res.duration_ms,
    spans: res.spans.map((s) => ({
      spanId: s.span_id,
      parentSpanId: s.parent_span_id,
      service: s.service,
      name: s.name,
      offsetMs: s.offset_ms,
      durationMs: s.duration_ms,
      error: s.error,
    })),
    logs: res.logs.map(toLog),
  }
}

export async function searchLogs(filters: {
  service: ObservedService | null
  level: LogLevel | null
  range: TimeRange
}): Promise<LogLine[]> {
  const res = await api<{ logs: BackendLogLine[] }>(
    `${BASE}/logs${query({ service: filters.service, level: filters.level, range: filters.range })}`,
  )
  return res.logs.map(toLog)
}

export async function lookupErrorCode(code: string): Promise<{ traceId: string | null; logs: LogLine[] }> {
  const res = await api<{ trace_id: string | null; logs: BackendLogLine[] }>(`${BASE}/codes/${encodeURIComponent(code)}`)
  return { traceId: res.trace_id, logs: res.logs.map(toLog) }
}

export function serviceLabel(service: string | null): string {
  return SERVICES.find((s) => s.value === service)?.label ?? service ?? "Desconocido"
}

// Un color fijo por servicio, el mismo en la lista y en la cascada.
export function serviceColor(service: string | null): string {
  switch (service) {
    case "autenticacion":
      return "#A093FF"
    case "servidores":
      return "#37D6C0"
    case "mensajes":
      return "#F0C24B"
    case "voz":
      return "#4FA3FF"
    default:
      return "#8DA8AC"
  }
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  if (ms < 1) return "<1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`
}

// Errores propios de la observabilidad: friendlyError esconde el detalle de los 5xx, y acá conviene
// decir qué pasó (función apagada, Grafana caído o demasiadas consultas).
export function observabilityError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return "La observabilidad no está configurada en este entorno. Faltan las variables OBSERVABILITY_* en autenticación."
    if (err.status === 502) return "No pudimos consultar Grafana. Probá de nuevo en un rato."
    if (err.status === 429) return "Hiciste muchas consultas seguidas. Esperá un minuto y actualizá."
  }
  return friendlyError(err)
}
