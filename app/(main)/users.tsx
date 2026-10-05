import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getUsers, reactivateUser, suspendUser } from "@/api/admin"
import { ApiError, friendlyError } from "@/api/client"
import type { AccountStatusFilter, AdminUser } from "@/api/types"
import { useAuth } from "@/context/AuthContext"
import Avatar from "@/components/Avatar"
import ModalShell from "@/components/ModalShell"
import PressableScale from "@/components/PressableScale"
import Tag from "@/components/Tag"

const PAGE_SIZE = 50

const FILTERS: { value: AccountStatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "suspended", label: "Suspendidos" },
]

type PendingAction = { kind: "suspend" | "reactivate"; user: AdminUser }

function initialsFor(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function UsersScreen() {
  const { user: me, logout } = useAuth()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<AccountStatusFilter>("all")
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState("")
  const requestId = useRef(0)
  const compact = useWindowDimensions().width < 720

  const handleError = useCallback(
    (err: unknown, set: (message: string) => void) => {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      set(friendlyError(err))
    },
    [logout],
  )

  const load = useCallback(
    async (offset: number) => {
      const id = ++requestId.current
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)
      setError("")
      try {
        const page = await getUsers({ query: query.trim(), status, limit: PAGE_SIZE, offset })
        if (id !== requestId.current) return
        setUsers((current) => (offset === 0 ? page.users : [...current, ...page.users]))
        setTotal(page.total)
      } catch (err) {
        if (id === requestId.current) handleError(err, setError)
      } finally {
        if (id === requestId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [query, status, handleError],
  )

  useEffect(() => {
    const timer = setTimeout(() => load(0), query ? 350 : 0)
    return () => clearTimeout(timer)
  }, [load, query])

  const confirmAction = async () => {
    if (!pending) return
    setActing(true)
    setActionError("")
    try {
      const updated =
        pending.kind === "suspend" ? await suspendUser(pending.user.id) : await reactivateUser(pending.user.id)
      const stillMatches =
        status === "all" || (status === "active" ? updated.isActive : !updated.isActive)
      setUsers((current) =>
        stillMatches
          ? current.map((u) => (u.id === updated.id ? updated : u))
          : current.filter((u) => u.id !== updated.id),
      )
      if (!stillMatches) setTotal((t) => Math.max(0, t - 1))
      setPending(null)
    } catch (err) {
      handleError(err, setActionError)
    } finally {
      setActing(false)
    }
  }

  const suspendedShown = users.filter((u) => !u.isActive).length

  const renderUser = ({ item }: { item: AdminUser }) => {
    const isMe = item.id === me?.id
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.08)",
          opacity: item.isActive ? 1 : 0.85,
        }}
      >
        <Avatar initials={initialsFor(item.name)} size={34} uri={item.avatarUrl} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14, flexShrink: 1 }} numberOfLines={1}>
              {item.name}
            </Text>
            {item.role === "staff" ? (
              <Text style={{ color: "#37D6C0", fontSize: 10.5, fontWeight: "800" }}>STAFF</Text>
            ) : null}
            {isMe ? <Text style={{ color: "#8DA8AC", fontSize: 11 }}>(vos)</Text> : null}
          </View>
          <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {compact ? item.email : `${item.email} · Alta ${formatDate(item.createdAt)}`}
          </Text>
        </View>

        <Tag type={item.isActive ? "ok" : "sus"}>{item.isActive ? "Activo" : "Suspendido"}</Tag>

        <View style={{ width: compact ? 92 : 104, alignItems: "flex-end" }}>
          {isMe ? null : item.isActive ? (
            <PressableScale
              onPress={() => {
                setActionError("")
                setPending({ kind: "suspend", user: item })
              }}
              accessibilityLabel={`Suspender a ${item.name}`}
              hoverStyle={{ backgroundColor: "rgba(255,127,114,0.12)" }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: "#FF7F72",
              }}
            >
              <Text style={{ color: "#FF7F72", fontWeight: "700", fontSize: 12 }}>Suspender</Text>
            </PressableScale>
          ) : (
            <PressableScale
              onPress={() => {
                setActionError("")
                setPending({ kind: "reactivate", user: item })
              }}
              accessibilityLabel={`Reactivar a ${item.name}`}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, backgroundColor: "#37D6C0" }}
            >
              <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 12 }}>Reactivar</Text>
            </PressableScale>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>Usuarios</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>
          Buscá cuentas por nombre o email y suspendelas o reactivalas.
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 10,
        }}
      >
        <View
          style={{
            flexGrow: 1,
            flexBasis: 260,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 40,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.13)",
          }}
        >
          <Ionicons name="search-outline" size={16} color="#8DA8AC" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre o email..."
            placeholderTextColor="#5A7A80"
            accessibilityLabel="Buscar usuarios"
            autoCapitalize="none"
            style={{
              flex: 1,
              marginLeft: 8,
              color: "#E6F3F3",
              fontSize: 14,
              ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
            }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} accessibilityLabel="Limpiar búsqueda" hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#8DA8AC" />
            </Pressable>
          ) : null}
        </View>

        <View
          accessibilityRole="radiogroup"
          style={{
            flexDirection: "row",
            borderRadius: 10,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.13)",
          }}
        >
          {FILTERS.map((filter) => {
            const selected = status === filter.value
            return (
              <Pressable
                key={filter.value}
                onPress={() => setStatus(filter.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={{
                  paddingHorizontal: 14,
                  height: 38,
                  justifyContent: "center",
                  backgroundColor: selected ? "#37D6C0" : "rgba(255,255,255,0.06)",
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: selected ? "#04211D" : "#8DA8AC" }}>
                  {filter.label}
                </Text>
              </Pressable>
            )
          })}
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
          <Pressable onPress={() => load(0)}>
            <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
          </Pressable>
        </View>
      ) : users.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 }}>
          <Ionicons name="person-outline" size={32} color="#8DA8AC" />
          <Text style={{ color: "#8DA8AC", fontSize: 14, textAlign: "center" }}>
            {query || status !== "all"
              ? "Ningún usuario coincide con la búsqueda o el filtro."
              : "Todavía no hay usuarios registrados."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListFooterComponent={
            users.length < total ? (
              <Pressable
                onPress={() => load(users.length)}
                disabled={loadingMore}
                style={{ alignSelf: "center", marginTop: 14, flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                {loadingMore ? <ActivityIndicator size="small" color="#37D6C0" /> : null}
                <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>
                  {loadingMore ? "Cargando..." : "Cargar más"}
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.13)",
          backgroundColor: "rgba(255,255,255,0.055)",
        }}
      >
        <Text style={{ color: "#8DA8AC", fontSize: 12 }}>
          Mostrando {users.length} de {total} · {suspendedShown} suspendidos en la lista
        </Text>
        <View style={{ marginLeft: "auto" }}>
          <Tag type="warn">Suspender cierra las sesiones activas</Tag>
        </View>
      </View>

      <ModalShell
        visible={!!pending}
        onClose={() => (acting ? undefined : setPending(null))}
        title={pending?.kind === "suspend" ? "Suspender cuenta" : "Reactivar cuenta"}
        subtitle={pending ? `${pending.user.name} · ${pending.user.email}` : undefined}
      >
        <Text style={{ color: "#C9DADB", fontSize: 13.5, lineHeight: 20 }}>
          {pending?.kind === "suspend"
            ? "No va a poder iniciar sesión, se cierran sus sesiones activas y su perfil deja de estar disponible para el resto."
            : "Va a poder volver a iniciar sesión y su perfil vuelve a estar disponible para el resto."}
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
              {pending?.kind === "suspend" ? "Suspender" : "Reactivar"}
            </Text>
          </PressableScale>
        </View>
      </ModalShell>
    </View>
  )
}
