import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { ApiError, friendlyError } from "@/api/client"
import { REPORT_REASON_LABELS, getReports, getUserNames, resolveReport, type Report, type ReportStatusFilter } from "@/api/dossier"
import { useAuth } from "@/context/AuthContext"
import PressableScale from "@/components/PressableScale"
import { ReportStatusTag, formatDateTime } from "@/components/dossier/DossierParts"

const FILTERS: { value: ReportStatusFilter; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "reviewed", label: "Revisados" },
  { value: "dismissed", label: "Descartados" },
  { value: "all", label: "Todos" },
]

export default function ReportsScreen() {
  const router = useRouter()
  const { logout } = useAuth()
  const [status, setStatus] = useState<ReportStatusFilter>("pending")
  const [reports, setReports] = useState<Report[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(
    async (filter: ReportStatusFilter) => {
      const current = ++requestId.current
      setLoading(true)
      setError("")
      try {
        const data = await getReports(filter)
        if (current !== requestId.current) return
        setReports(data)
        const ids = data.flatMap((r) => [r.reporterId, r.targetUserId ?? ""])
        const found = await getUserNames(ids).catch(() => new Map<string, string>())
        if (current === requestId.current) setNames(found)
      } catch (err) {
        if (current !== requestId.current) return
        if (err instanceof ApiError && err.status === 401) logout()
        else setError(friendlyError(err))
      } finally {
        if (current === requestId.current) setLoading(false)
      }
    },
    [logout],
  )

  useEffect(() => {
    load(status)
  }, [status, load])

  const resolve = async (report: Report, next: "reviewed" | "dismissed") => {
    setBusy(report.id)
    try {
      const updated = await resolveReport(report.id, next)
      setReports((current) =>
        status === "all" ? current.map((r) => (r.id === updated.id ? updated : r)) : current.filter((r) => r.id !== updated.id),
      )
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      else setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  const openTarget = (report: Report) => {
    if (report.targetType === "user" && report.targetUserId) router.push(`/(main)/expediente/usuario/${report.targetUserId}`)
    else router.push(`/(main)/expediente/servidor/${report.serverId}`)
  }

  const renderItem = ({ item }: { item: Report }) => {
    const target = item.targetType === "user" ? (names.get(item.targetUserId ?? "") ?? "Usuario") : item.serverName
    return (
      <View
        style={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.08)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: item.targetType === "user" ? "rgba(160,147,255,0.15)" : "rgba(55,214,192,0.15)",
            }}
          >
            <Ionicons
              name={item.targetType === "user" ? "person-outline" : "server-outline"}
              size={16}
              color={item.targetType === "user" ? "#A093FF" : "#37D6C0"}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
              {REPORT_REASON_LABELS[item.reason] ?? item.reason} · {target}
            </Text>
            <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              {item.targetType === "user" ? `Usuario en ${item.serverName}` : "Servidor"} · por {names.get(item.reporterId) ?? "Usuario"} ·{" "}
              {formatDateTime(item.createdAt)}
            </Text>
          </View>
          <ReportStatusTag status={item.status} />
        </View>
        {item.detail ? (
          <Text
            style={{
              color: "#C9DADB",
              fontSize: 13,
              marginTop: 8,
              marginLeft: 44,
            }}
            numberOfLines={3}
          >
            “{item.detail}”
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 10,
            marginLeft: 44,
          }}
        >
          <PressableScale
            onPress={() => openTarget(item)}
            accessibilityLabel={`Ver expediente de ${target}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 9999,
              backgroundColor: "#37D6C0",
            }}
          >
            <Ionicons name="folder-open-outline" size={13} color="#04211D" />
            <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 12 }}>Ver expediente</Text>
          </PressableScale>
          {item.status === "pending" ? (
            <>
              <PressableScale
                onPress={() => resolve(item, "reviewed")}
                disabled={busy === item.id}
                accessibilityLabel="Marcar como revisado"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: "#4FD69C",
                  opacity: busy === item.id ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#4FD69C", fontWeight: "700", fontSize: 12 }}>Revisado</Text>
              </PressableScale>
              <PressableScale
                onPress={() => resolve(item, "dismissed")}
                disabled={busy === item.id}
                accessibilityLabel="Descartar reporte"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.2)",
                  opacity: busy === item.id ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 12 }}>Descartar</Text>
              </PressableScale>
            </>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>Reportes</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>
          Lo que reportan los usuarios. Abrí el expediente de lo reportado para decidir qué medida tomar.
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}
      >
        {FILTERS.map((f) => {
          const active = f.value === status
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatus(f.value)}
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
              <Text
                style={{
                  color: active ? "#37D6C0" : "#8DA8AC",
                  fontWeight: "700",
                  fontSize: 12.5,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#37D6C0" size="large" />
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
            gap: 10,
          }}
        >
          <Ionicons name="alert-circle-outline" size={32} color="#FF7F72" />
          <Text style={{ color: "#FF7F72", fontSize: 14, textAlign: "center" }}>{error}</Text>
          <Pressable onPress={() => load(status)}>
            <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
          </Pressable>
        </View>
      ) : reports.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
            gap: 8,
          }}
        >
          <Ionicons name="flag-outline" size={32} color="#8DA8AC" />
          <Text style={{ color: "#8DA8AC", fontSize: 14, textAlign: "center" }}>
            {status === "pending" ? "No hay reportes pendientes." : "No hay reportes en esta categoría."}
          </Text>
        </View>
      ) : (
        <FlatList data={reports} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 24 }} />
      )}
    </View>
  )
}
