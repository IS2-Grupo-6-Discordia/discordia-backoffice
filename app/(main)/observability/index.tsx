import { useCallback, useEffect, useRef, useState } from "react"
import { FlatList, Pressable, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { ApiError } from "@/api/client"
import {
  ERROR_CODE_PATTERN,
  LEVELS,
  RANGES,
  SERVICES,
  formatDuration,
  formatTime,
  lookupErrorCode,
  observabilityError,
  searchLogs,
  searchTraces,
  serviceLabel,
  type LogLevel,
  type LogLine,
  type ObservedService,
  type TimeRange,
  type TraceSummary,
} from "@/api/observability"
import { useAuth } from "@/context/AuthContext"
import PressableScale from "@/components/PressableScale"
import { FilterChips, FilterRow, Loading, LogRow, Message, RefreshButton, ServiceDot } from "@/components/observability/ObservabilityParts"

type Tab = "traces" | "logs" | "code"

const TABS: { value: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { value: "traces", label: "Trazas", icon: "git-network-outline" },
  { value: "logs", label: "Logs", icon: "document-text-outline" },
  { value: "code", label: "Buscar por código", icon: "search-outline" },
]

const MIN_DURATIONS: { value: string; label: string }[] = [
  { value: "100", label: "> 100 ms" },
  { value: "500", label: "> 500 ms" },
  { value: "2000", label: "> 2 s" },
]

export default function ObservabilityScreen() {
  const router = useRouter()
  const { logout } = useAuth()
  const [tab, setTab] = useState<Tab>("traces")
  const [service, setService] = useState<ObservedService | null>(null)
  const [range, setRange] = useState<TimeRange>("1h")
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [minDuration, setMinDuration] = useState<string | null>(null)
  const [level, setLevel] = useState<LogLevel | null>(null)
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [code, setCode] = useState("")
  const [codeResult, setCodeResult] = useState<{ code: string; logs: LogLine[] } | null>(null)
  const requestId = useRef(0)

  const openTrace = useCallback((traceId: string) => router.push(`/(main)/observability/traza/${traceId}`), [router])

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) logout()
      else setError(observabilityError(err))
    },
    [logout],
  )

  // Sin autorefresco a propósito: cada consulta gasta cuota de Grafana Cloud (adr/0013).
  const load = useCallback(async () => {
    if (tab === "code") return
    const current = ++requestId.current
    setLoading(true)
    setError("")
    try {
      if (tab === "traces") {
        const data = await searchTraces({ service, errorsOnly, minDurationMs: minDuration ? Number(minDuration) : null, range })
        if (current === requestId.current) setTraces(data)
      } else {
        const data = await searchLogs({ service, level, range })
        if (current === requestId.current) setLogs(data)
      }
    } catch (err) {
      if (current === requestId.current) handleError(err)
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [tab, service, errorsOnly, minDuration, level, range, handleError])

  useEffect(() => {
    load()
  }, [load])

  const searchCode = async () => {
    const value = code.trim().toLowerCase()
    if (!ERROR_CODE_PATTERN.test(value)) {
      setError("El código son los 8 caracteres que aparecen en el error, por ejemplo a1b2c3d4.")
      return
    }
    setLoading(true)
    setError("")
    setCodeResult(null)
    try {
      const found = await lookupErrorCode(value)
      if (found.traceId) openTrace(found.traceId)
      else setCodeResult({ code: value, logs: found.logs })
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  const renderTrace = ({ item }: { item: TraceSummary }) => (
    <Pressable
      onPress={() => openTrace(item.traceId)}
      accessibilityRole="link"
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
        backgroundColor: hovered ? "rgba(255,255,255,0.03)" : "transparent",
      })}
    >
      <ServiceDot service={item.rootService} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "700" }} numberOfLines={1}>
          {item.rootName ?? "Traza sin nombre"}
        </Text>
        <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 1 }} numberOfLines={1}>
          {serviceLabel(item.rootService)} · {formatTime(item.startedAt)} · <Text style={{ fontFamily: "monospace" }}>{item.traceId.slice(0, 12)}…</Text>
        </Text>
      </View>
      <Text style={{ color: "#C9DADB", fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{formatDuration(item.durationMs)}</Text>
      <Ionicons name="chevron-forward" size={15} color="#5E7E82" />
    </Pressable>
  )

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>Observabilidad</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>
          Trazas y logs de los servicios, desde Grafana Cloud. No se actualiza solo: cada consulta gasta cuota del plan gratuito.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {TABS.map((t) => {
          const active = t.value === tab
          return (
            <Pressable
              key={t.value}
              onPress={() => {
                setTab(t.value)
                setError("")
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                backgroundColor: active ? "rgba(55,214,192,0.17)" : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: active ? "#37D6C0" : "transparent",
              }}
            >
              <Ionicons name={t.icon} size={14} color={active ? "#37D6C0" : "#8DA8AC"} />
              <Text style={{ color: active ? "#37D6C0" : "#8DA8AC", fontWeight: "700", fontSize: 12.5 }}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {tab === "code" ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <Text style={{ color: "#8DA8AC", fontSize: 12.5, lineHeight: 18 }}>
            Cuando un usuario ve un error inesperado, la app le muestra un código (por ejemplo, “Código: a1b2c3d4”). Pegalo acá para abrir la
            traza de ese request. Se busca en las últimas 24 horas.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, maxWidth: 460 }}>
            <TextInput
              value={code}
              onChangeText={setCode}
              onSubmitEditing={searchCode}
              placeholder="a1b2c3d4"
              placeholderTextColor="#5E7E82"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={36}
              accessibilityLabel="Código del error"
              style={{
                flex: 1,
                minWidth: 0,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
                color: "#E6F3F3",
                fontSize: 14,
                fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.22)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            />
            <PressableScale
              onPress={searchCode}
              disabled={loading || !code.trim()}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 16,
                borderRadius: 10,
                backgroundColor: "#37D6C0",
                opacity: loading || !code.trim() ? 0.5 : 1,
              }}
            >
              <Ionicons name="search" size={15} color="#04211D" />
              <Text style={{ color: "#04211D", fontWeight: "800", fontSize: 13 }}>Buscar</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
          <FilterRow label="Servicio">
            <FilterChips options={SERVICES} value={service} onChange={setService} allLabel="Todos" />
          </FilterRow>
          {tab === "traces" ? (
            <FilterRow label="Filtros">
              <FilterChips
                options={[{ value: "errors", label: "Solo con errores" }]}
                value={errorsOnly ? "errors" : null}
                onChange={(v) => setErrorsOnly(v === "errors")}
                allLabel="Todas"
              />
              <FilterChips options={MIN_DURATIONS} value={minDuration} onChange={setMinDuration} allLabel="Cualquier duración" />
            </FilterRow>
          ) : (
            <FilterRow label="Nivel">
              <FilterChips options={LEVELS} value={level} onChange={setLevel} allLabel="Todos" />
            </FilterRow>
          )}
          <FilterRow label="Rango">
            <FilterChips options={RANGES} value={range} onChange={(v) => setRange(v ?? "1h")} />
            <View style={{ marginLeft: "auto" }}>
              <RefreshButton onPress={load} busy={loading} />
            </View>
          </FilterRow>
        </View>
      )}

      <View style={{ flex: 1, marginTop: 6, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
        {loading ? (
          <Loading />
        ) : error ? (
          <Message icon="alert-circle-outline" tone="error" text={error} onRetry={tab === "code" ? undefined : load} />
        ) : tab === "traces" ? (
          traces.length === 0 ? (
            <Message icon="git-network-outline" text="No hay trazas con estos filtros en este rango." />
          ) : (
            <FlatList data={traces} keyExtractor={(t) => t.traceId} renderItem={renderTrace} contentContainerStyle={{ paddingBottom: 24 }} />
          )
        ) : tab === "logs" ? (
          logs.length === 0 ? (
            <Message icon="document-text-outline" text="No hay logs con estos filtros en este rango." />
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(l, i) => `${l.timestamp}-${i}`}
              renderItem={({ item }) => <LogRow line={item} onOpenTrace={openTrace} />}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )
        ) : codeResult ? (
          codeResult.logs.length === 0 ? (
            <Message icon="search-outline" text={`No encontramos nada con el código ${codeResult.code} en las últimas 24 horas.`} />
          ) : (
            <FlatList
              data={codeResult.logs}
              keyExtractor={(l, i) => `${l.timestamp}-${i}`}
              ListHeaderComponent={
                <Text style={{ color: "#8DA8AC", fontSize: 12.5, paddingHorizontal: 16, paddingVertical: 10 }}>
                  Encontramos logs de ese request, pero ninguno trae una traza.
                </Text>
              }
              renderItem={({ item }) => <LogRow line={item} />}
            />
          )
        ) : null}
      </View>
    </View>
  )
}
