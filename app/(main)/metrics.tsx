import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react"
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ApiError, friendlyError } from "@/api/client"
import { customPeriod, getMetric, presetPeriod, type PeriodPreset } from "@/api/metrics"
import type { MetricKey, MetricPeriod } from "@/api/types"
import { useAuth } from "@/context/AuthContext"
import PressableScale from "@/components/PressableScale"
import { formatDate } from "@/components/dossier/DossierParts"

type IconName = ComponentProps<typeof Ionicons>["name"]

type MetricState = { status: "loading" } | { status: "ok"; value: number } | { status: "error"; message: string }

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "365d", label: "12 meses" },
  { value: "custom", label: "Elegir fechas" },
]

const METRICS: { key: MetricKey; label: string; hint: string; icon: IconName; color: string; bg: string }[] = [
  {
    key: "activeUsers",
    label: "Usuarios activos",
    hint: "Cuentas que usaron Discordia en el período.",
    icon: "people-outline",
    color: "#37D6C0",
    bg: "rgba(55,214,192,0.15)",
  },
  {
    key: "serversCreated",
    label: "Servidores creados",
    hint: "Servidores nuevos en toda la plataforma.",
    icon: "server-outline",
    color: "#A093FF",
    bg: "rgba(160,147,255,0.15)",
  },
  {
    key: "messagesSent",
    label: "Mensajes enviados",
    hint: "Mensajes en los canales de todos los servidores.",
    icon: "chatbubbles-outline",
    color: "#F0C24B",
    bg: "rgba(240,194,75,0.15)",
  },
]

const ALL_LOADING: Record<MetricKey, MetricState> = {
  activeUsers: { status: "loading" },
  serversCreated: { status: "loading" },
  messagesSent: { status: "loading" },
}

// A 404 here means the gateway or the service still lacks the route, not that a resource is missing.
function metricError(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) return "Este dato todavía no está disponible."
  return friendlyError(err)
}

function todayText(): string {
  return formatDate(new Date().toISOString())
}

export default function MetricsScreen() {
  const { logout } = useAuth()
  const [preset, setPreset] = useState<PeriodPreset>("30d")
  const [period, setPeriod] = useState<MetricPeriod>(() => presetPeriod("30d"))
  const [metrics, setMetrics] = useState<Record<MetricKey, MetricState>>(ALL_LOADING)
  const [startText, setStartText] = useState("")
  const [endText, setEndText] = useState(todayText)
  const [customError, setCustomError] = useState("")
  const requestIds = useRef<Record<MetricKey, number>>({ activeUsers: 0, serversCreated: 0, messagesSent: 0 })

  const loadMetric = useCallback(
    async (key: MetricKey, target: MetricPeriod) => {
      const current = ++requestIds.current[key]
      setMetrics((prev) => ({ ...prev, [key]: { status: "loading" } }))
      try {
        const value = await getMetric(key, target)
        if (current !== requestIds.current[key]) return
        setMetrics((prev) => ({ ...prev, [key]: { status: "ok", value } }))
      } catch (err) {
        if (current !== requestIds.current[key]) return
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        setMetrics((prev) => ({ ...prev, [key]: { status: "error", message: metricError(err) } }))
      }
    },
    [logout],
  )

  const loadAll = useCallback(
    (target: MetricPeriod) => {
      METRICS.forEach((m) => loadMetric(m.key, target))
    },
    [loadMetric],
  )

  useEffect(() => {
    loadAll(period)
  }, [period, loadAll])

  const choosePreset = (value: PeriodPreset) => {
    setPreset(value)
    setCustomError("")
    if (value !== "custom") setPeriod(presetPeriod(value))
  }

  const applyCustom = () => {
    const result = customPeriod(startText, endText)
    if ("error" in result) {
      setCustomError(result.error)
      return
    }
    setCustomError("")
    setPeriod(result.period)
  }

  // Presets end "now", so refreshing one moves its end forward instead of repeating the same query.
  const refresh = () => {
    if (preset === "custom") loadAll(period)
    else setPeriod(presetPeriod(preset))
  }

  const states = METRICS.map((m) => metrics[m.key])
  // Only while all three load, i.e. right after a click: a slow service must not lock the other
  // two. Restarting mid-load is safe, because each card drops answers to older requests.
  const allLoading = states.every((s) => s.status === "loading")
  const allFailed = states.every((s) => s.status === "error")
  const noActivity = states.every((s) => s.status === "ok" && s.value === 0)

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>Métricas</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>
          Uso de toda la plataforma en el período que elijas, sumando todos los servidores.
        </Text>
      </View>

      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}
      >
        {PRESETS.map((p) => {
          const active = p.value === preset
          return (
            <Pressable
              key={p.value}
              onPress={() => choosePreset(p.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                backgroundColor: active ? "rgba(55,214,192,0.17)" : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: active ? "#37D6C0" : "transparent",
              }}
            >
              <Text style={{ color: active ? "#37D6C0" : "#8DA8AC", fontWeight: "700", fontSize: 12.5 }}>{p.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {preset === "custom" ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
            <DayField label="Desde" value={startText} onChange={setStartText} onSubmit={applyCustom} />
            <DayField label="Hasta" value={endText} onChange={setEndText} onSubmit={applyCustom} />
            <PressableScale
              onPress={applyCustom}
              accessibilityLabel="Ver métricas de esas fechas"
              style={{
                paddingHorizontal: 14,
                height: 40,
                justifyContent: "center",
                borderRadius: 10,
                backgroundColor: "#37D6C0",
              }}
            >
              <Text style={{ color: "#04211D", fontWeight: "800", fontSize: 13 }}>Ver métricas</Text>
            </PressableScale>
          </View>
          {customError ? (
            <Text accessibilityRole="alert" style={{ color: "#FF7F72", fontSize: 12.5, marginTop: 8 }}>
              {customError}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <Text style={{ color: "#C9DADB", fontSize: 13, flexShrink: 1 }}>
          {formatDate(period.firstDay) === formatDate(period.lastDay)
            ? `Datos del ${formatDate(period.firstDay)}`
            : `Datos del ${formatDate(period.firstDay)} al ${formatDate(period.lastDay)}`}
        </Text>
        <Pressable
          onPress={refresh}
          disabled={allLoading}
          accessibilityLabel="Actualizar métricas"
          style={{ flexDirection: "row", alignItems: "center", gap: 5, opacity: allLoading ? 0.45 : 1 }}
        >
          <Ionicons name="refresh-outline" size={15} color="#37D6C0" />
          <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Actualizar</Text>
        </Pressable>
      </View>

      {allFailed ? (
        <View style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 48, gap: 10 }}>
          <Ionicons name="alert-circle-outline" size={32} color="#FF7F72" />
          <Text style={{ color: "#FF7F72", fontSize: 14, textAlign: "center" }}>
            {(states[0] as { message: string }).message}
          </Text>
          <Pressable onPress={() => loadAll(period)}>
            <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 }}>
            {METRICS.map((m) => (
              <MetricCard key={m.key} metric={m} state={metrics[m.key]} onRetry={() => loadMetric(m.key, period)} />
            ))}
          </View>
          {noActivity ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginHorizontal: 16,
                marginTop: 12,
                padding: 14,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.045)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
              }}
            >
              <Ionicons name="moon-outline" size={18} color="#8DA8AC" />
              <Text style={{ color: "#C9DADB", fontSize: 13, flex: 1 }}>
                No hubo actividad en la plataforma en este período. Probá con un período más largo.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  )
}

function DayField({
  label,
  value,
  onChange,
  onSubmit,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <View>
      <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder="DD/MM/AAAA"
        placeholderTextColor="#5A7A80"
        inputMode="numeric"
        maxLength={10}
        accessibilityLabel={`Fecha ${label.toLowerCase()}`}
        style={{
          width: 130,
          height: 40,
          paddingHorizontal: 12,
          color: "#E6F3F3",
          fontSize: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.13)",
          backgroundColor: "rgba(255,255,255,0.06)",
          ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
        }}
      />
    </View>
  )
}

function MetricCard({
  metric,
  state,
  onRetry,
}: {
  metric: (typeof METRICS)[number]
  state: MetricState
  onRetry: () => void
}) {
  return (
    <View
      accessibilityLabel={state.status === "ok" ? `${metric.label}: ${state.value}` : metric.label}
      style={{
        flexGrow: 1,
        flexBasis: 220,
        minHeight: 132,
        borderRadius: 14,
        padding: 16,
        backgroundColor: "rgba(255,255,255,0.045)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: metric.bg,
          }}
        >
          <Ionicons name={metric.icon} size={16} color={metric.color} />
        </View>
        <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 14 }}>{metric.label}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: "center", marginTop: 10 }}>
        {state.status === "loading" ? (
          <ActivityIndicator color="#37D6C0" style={{ alignSelf: "flex-start" }} />
        ) : state.status === "error" ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: "#FF7F72", fontSize: 13 }}>{state.message}</Text>
            <Pressable onPress={onRetry} accessibilityLabel={`Reintentar ${metric.label.toLowerCase()}`} style={{ alignSelf: "flex-start" }}>
              <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ color: "#E6F3F3", fontSize: 30, fontWeight: "800" }}>{state.value.toLocaleString("es-AR")}</Text>
        )}
      </View>

      <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 6 }}>{metric.hint}</Text>
    </View>
  )
}
