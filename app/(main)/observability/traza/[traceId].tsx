import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { ApiError } from "@/api/client"
import {
  TRACE_ID_PATTERN,
  formatDuration,
  formatTime,
  getTrace,
  observabilityError,
  serviceColor,
  serviceLabel,
  type Span,
  type TraceDetail,
} from "@/api/observability"
import { useAuth } from "@/context/AuthContext"
import { BackLink, Section } from "@/components/dossier/DossierParts"
import { Loading, LogRow, Message, RefreshButton } from "@/components/observability/ObservabilityParts"

// Ordena los spans como árbol (cada hijo debajo de su padre, por inicio) y calcula la
// profundidad, para dibujar la cascada con sangría. Un span cuyo padre no llegó (por ejemplo, el
// del cliente, que no se exporta) queda en la raíz.
function asTree(spans: Span[]): { span: Span; depth: number }[] {
  const ids = new Set(spans.map((s) => s.spanId))
  const children = new Map<string | null, Span[]>()
  for (const span of spans) {
    const parent = span.parentSpanId && ids.has(span.parentSpanId) ? span.parentSpanId : null
    children.set(parent, [...(children.get(parent) ?? []), span])
  }
  const out: { span: Span; depth: number }[] = []
  const visit = (parent: string | null, depth: number) => {
    for (const span of (children.get(parent) ?? []).sort((a, b) => a.offsetMs - b.offsetMs)) {
      out.push({ span, depth })
      visit(span.spanId, depth + 1)
    }
  }
  visit(null, 0)
  return out
}

function Waterfall({ detail }: { detail: TraceDetail }) {
  const rows = useMemo(() => asTree(detail.spans), [detail.spans])
  const total = Math.max(detail.durationMs, 0.001)
  const services = [...new Set(detail.spans.map((s) => s.service))]
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        {services.map((service) => (
          <View key={service ?? "?"} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: serviceColor(service) }} />
            <Text style={{ color: "#C9DADB", fontSize: 12 }}>{serviceLabel(service)}</Text>
          </View>
        ))}
      </View>
      {rows.map(({ span, depth }) => {
        const left = (span.offsetMs / total) * 100
        const width = Math.max((span.durationMs / total) * 100, 0.6)
        const color = span.error ? "#FF7F72" : serviceColor(span.service)
        return (
          <View key={span.spanId} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 26 }}>
            <View style={{ width: "38%", paddingLeft: Math.min(depth, 8) * 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: color }} />
              <Text style={{ color: span.error ? "#FF9E94" : "#E6F3F3", fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
                {span.name}
              </Text>
            </View>
            <View style={{ flex: 1, height: 14, justifyContent: "center" }}>
              <View style={{ position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
              <View
                style={{
                  position: "absolute",
                  left: `${Math.min(left, 99.4)}%`,
                  width: `${Math.min(width, 100 - Math.min(left, 99.4))}%`,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: `${color}CC`,
                }}
              />
            </View>
            <Text style={{ color: "#8DA8AC", fontSize: 11.5, width: 64, textAlign: "right", fontVariant: ["tabular-nums"] }}>
              {formatDuration(span.durationMs)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export default function TraceScreen() {
  const { traceId } = useLocalSearchParams<{ traceId: string }>()
  const router = useRouter()
  const { logout } = useAuth()
  const [detail, setDetail] = useState<TraceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const valid = TRACE_ID_PATTERN.test(traceId ?? "")

  const load = useCallback(async () => {
    if (!valid || !traceId) return
    setLoading(true)
    setError("")
    try {
      setDetail(await getTrace(traceId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      else if (err instanceof ApiError && err.status === 404)
        setError("No encontramos esa traza. Puede que todavía no haya llegado a Grafana (tarda unos segundos) o que tenga más de 14 días.")
      else setError(observabilityError(err))
    } finally {
      setLoading(false)
    }
  }, [traceId, valid, logout])

  useEffect(() => {
    load()
  }, [load])

  const errors = detail?.spans.filter((s) => s.error).length ?? 0

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <BackLink label="Observabilidad" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(main)/observability"))} />

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 6, marginBottom: 14 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>Traza</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginTop: 2, fontFamily: "monospace" }} selectable>
            {traceId}
          </Text>
        </View>
        {valid ? <RefreshButton onPress={load} busy={loading} /> : null}
      </View>

      {!valid ? (
        <Message icon="alert-circle-outline" tone="error" text="Ese id de traza no es válido: son 32 caracteres hexadecimales." />
      ) : loading ? (
        <Loading />
      ) : error ? (
        <Message icon="alert-circle-outline" tone="error" text={error} onRetry={load} />
      ) : detail ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, marginBottom: 14 }}>
            <Stat label="Inicio" value={formatTime(detail.startedAt)} />
            <Stat label="Duración" value={formatDuration(detail.durationMs)} />
            <Stat label="Tramos" value={String(detail.spans.length)} />
            <Stat label="Con error" value={String(errors)} tone={errors > 0 ? "error" : undefined} />
          </View>

          <Section icon="git-network-outline" title="Cascada" count={detail.spans.length}>
            <Waterfall detail={detail} />
          </Section>

          <Section icon="document-text-outline" title="Logs de la traza" count={detail.logs.length}>
            {detail.logs.length === 0 ? (
              <Text style={{ color: "#5E7E82", fontSize: 13, fontStyle: "italic" }}>Esta traza no tiene logs (o todavía no llegaron).</Text>
            ) : (
              <View style={{ marginHorizontal: -16 }}>
                {detail.logs.map((line, i) => (
                  <LogRow key={`${line.timestamp}-${i}`} line={line} />
                ))}
              </View>
            )}
          </Section>
        </>
      ) : null}
    </ScrollView>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  return (
    <View>
      <Text style={{ color: "#5E7E82", fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: tone === "error" ? "#FF7F72" : "#E6F3F3", fontSize: 15, fontWeight: "800", marginTop: 1 }}>{value}</Text>
    </View>
  )
}
