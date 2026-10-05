import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Image, Platform, Pressable, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getAdminServers } from "@/api/admin"
import { ApiError, friendlyError } from "@/api/client"
import type { AdminServer } from "@/api/types"
import { useAuth } from "@/context/AuthContext"

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
        <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 2 }}>Creado el {formatDate(item.createdAt)}</Text>
      </View>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
        accessibilityLabel={`${item.memberCount} miembros`}
      >
        <Ionicons name="people-outline" size={15} color="#8DA8AC" />
        <Text style={{ color: "#C9DADB", fontSize: 13, fontWeight: "700" }}>{item.memberCount}</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 12 }}>{item.memberCount === 1 ? "miembro" : "miembros"}</Text>
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }}>Servidores</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>
          Todos los servidores de la plataforma, con su cantidad de miembros.
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
    </View>
  )
}
