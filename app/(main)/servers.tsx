import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Image, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getAdminServers, reactivateServer, suspendServer } from "@/api/admin"
import { ApiError, friendlyError } from "@/api/client"
import type { AdminServer } from "@/api/types"
import { useAuth } from "@/context/AuthContext"
import ModalShell from "@/components/ModalShell"
import PressableScale from "@/components/PressableScale"
import Tag from "@/components/Tag"

type PendingAction = { kind: "suspend" | "reactivate"; server: AdminServer }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function abbr(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export default function ServersScreen() {
  const { logout } = useAuth()
  const [servers, setServers] = useState<AdminServer[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const requestId = useRef(0)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState("")
  const compact = useWindowDimensions().width < 600

  const fetchServers = useCallback(
    async (query: string) => {
      const id = ++requestId.current
      setLoading(true)
      setError("")
      try {
        const data = await getAdminServers(query.trim() || undefined)
        if (id === requestId.current) setServers(data)
      } catch (err) {
        if (id !== requestId.current) return
        if (err instanceof ApiError && err.status === 401) logout()
        else setError(friendlyError(err))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [logout],
  )

  useEffect(() => {
    const timer = setTimeout(() => fetchServers(search), search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [search, fetchServers])

  const confirmAction = async () => {
    if (!pending) return
    setActing(true)
    setActionError("")
    try {
      const updated =
        pending.kind === "suspend" ? await suspendServer(pending.server.id) : await reactivateServer(pending.server.id)
      setServers((current) => current.map((s) => (s.id === updated.id ? updated : s)))
      setPending(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      else setActionError(friendlyError(err))
    } finally {
      setActing(false)
    }
  }

  const openAction = (kind: PendingAction["kind"], server: AdminServer) => {
    setActionError("")
    setPending({ kind, server })
  }

  const renderItem = ({ item }: { item: AdminServer }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.08)",
      }}
    >
      {item.iconUrl ? (
        <Image source={{ uri: item.iconUrl }} style={{ width: 40, height: 40, borderRadius: 12, marginRight: 12 }} />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: "rgba(55,214,192,0.15)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text style={{ color: "#37D6C0", fontWeight: "800", fontSize: 14 }}>{abbr(item.name)}</Text>
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text
          style={{ color: item.suspended && compact ? "#FF7F72" : "#8DA8AC", fontSize: 12, marginTop: 2 }}
          numberOfLines={1}
        >
          {item.suspended && item.suspendedAt
            ? `Suspendido el ${formatDate(item.suspendedAt)}`
            : `Creado el ${formatDate(item.createdAt)}`}
        </Text>
      </View>

      {compact ? null : (
        <View style={{ marginRight: 12 }}>
          <Tag type={item.suspended ? "sus" : "ok"}>{item.suspended ? "Suspendido" : "Activo"}</Tag>
        </View>
      )}

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
        accessibilityLabel={`${item.memberCount} miembros`}
      >
        <Ionicons name="people-outline" size={15} color="#8DA8AC" />
        <Text style={{ color: "#C9DADB", fontSize: 13, fontWeight: "700" }}>{item.memberCount}</Text>
        {compact ? null : (
          <Text style={{ color: "#8DA8AC", fontSize: 12 }}>{item.memberCount === 1 ? "miembro" : "miembros"}</Text>
        )}
      </View>

      <View style={{ width: compact ? 96 : 150, alignItems: "flex-end", marginLeft: compact ? 8 : 12 }}>
        {item.suspended ? (
          <PressableScale
            onPress={() => openAction("reactivate", item)}
            accessibilityLabel={`Levantar la suspensión de ${item.name}`}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, backgroundColor: "#37D6C0" }}
          >
            <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 12 }}>{compact ? "Reactivar" : "Levantar suspensión"}</Text>
          </PressableScale>
        ) : (
          <PressableScale
            onPress={() => openAction("suspend", item)}
            accessibilityLabel={`Suspender ${item.name}`}
            hoverStyle={{ backgroundColor: "rgba(255,127,114,0.12)" }}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, borderColor: "#FF7F72" }}
          >
            <Text style={{ color: "#FF7F72", fontWeight: "700", fontSize: 12 }}>Suspender</Text>
          </PressableScale>
        )}
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>Servidores</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>
          Todos los servidores de la plataforma. Suspendé uno para bloquearlo mientras investigás una denuncia.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.13)",
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Ionicons name="search-outline" size={16} color="#8DA8AC" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre..."
            placeholderTextColor="#5A7A80"
            accessibilityLabel="Buscar servidores"
            style={{
              flex: 1,
              marginLeft: 8,
              color: "#E6F3F3",
              fontSize: 14,
              ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
            }}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} accessibilityLabel="Limpiar búsqueda" hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#8DA8AC" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#37D6C0" size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 }}>
          <Ionicons name="alert-circle-outline" size={32} color="#FF7F72" />
          <Text style={{ color: "#FF7F72", fontSize: 14, textAlign: "center" }}>{error}</Text>
          <Pressable onPress={() => fetchServers(search)}>
            <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
          </Pressable>
        </View>
      ) : servers.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 }}>
          <Ionicons name="server-outline" size={32} color="#8DA8AC" />
          <Text style={{ color: "#8DA8AC", fontSize: 14, textAlign: "center" }}>
            {search ? "Ningún servidor coincide con la búsqueda." : "Todavía no hay servidores creados."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={servers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <ModalShell
        visible={!!pending}
        onClose={() => (acting ? undefined : setPending(null))}
        title={pending?.kind === "suspend" ? "Suspender servidor" : "Levantar suspensión"}
        subtitle={pending ? `${pending.server.name} · ${pending.server.memberCount} ${pending.server.memberCount === 1 ? "miembro" : "miembros"}` : undefined}
      >
        <Text style={{ color: "#C9DADB", fontSize: 13.5, lineHeight: 20 }}>
          {pending?.kind === "suspend"
            ? "Ningún miembro va a poder entrar al servidor ni a sus llamadas mientras dure la suspensión. No se borra nada: canales, roles, miembros y mensajes se conservan."
            : "Los miembros recuperan el acceso normal al servidor, con todo su contenido como estaba."}
        </Text>
        {actionError ? (
          <Text accessibilityRole="alert" style={{ color: "#FF7F72", fontSize: 12.5, marginTop: 10 }}>
            {actionError}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={() => setPending(null)}
            disabled={acting}
            style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" }}
          >
            <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 13 }}>Cancelar</Text>
          </Pressable>
          <PressableScale
            onPress={confirmAction}
            disabled={acting}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 10,
              backgroundColor: pending?.kind === "suspend" ? "#FF7F72" : "#37D6C0",
              opacity: acting ? 0.7 : 1,
            }}
          >
            {acting ? <ActivityIndicator size="small" color="#04211D" /> : null}
            <Text style={{ color: "#04211D", fontWeight: "800", fontSize: 13 }}>
              {pending?.kind === "suspend" ? "Suspender" : "Levantar suspensión"}
            </Text>
          </PressableScale>
        </View>
      </ModalShell>
    </View>
  )
}
