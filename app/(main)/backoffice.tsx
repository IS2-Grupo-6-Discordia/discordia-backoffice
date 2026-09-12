import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, ScrollView, FlatList } from "react-native"
import { getKPIs, getUsers } from "@/api"
import type { KPI, AdminUser } from "@/api/types"
import Tag from "@/components/Tag"

const NAV_ITEMS = ["Usuarios", "Servidores", "Reportes", "Incidentes", "Métricas"]

export default function BackofficeScreen() {
  const [activeNav, setActiveNav] = useState("Usuarios")
  const [filter, setFilter] = useState("Todos")
  const [kpis, setKpis] = useState<KPI[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])

  useEffect(() => {
    getKPIs().then(setKpis)
  }, [])

  useEffect(() => {
    getUsers(filter === "Todos" ? undefined : filter).then(setUsers)
  }, [filter])

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1620" }}>
      {/* Top bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.13)",
          backgroundColor: "rgba(255,255,255,0.055)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 24, height: 24, borderRadius: 9999, backgroundColor: "#37D6C0", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#04211D", fontWeight: "900", fontSize: 12 }}>D</Text>
          </View>
          <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 13.5 }}>Backoffice</Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 9999,
            backgroundColor: "rgba(55,214,192,0.17)",
            borderWidth: 1,
            borderColor: "#37D6C0",
          }}
        >
          <Text style={{ color: "#37D6C0", fontWeight: "800", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 1 }}>
            Staff
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 2 }}
          style={{ marginLeft: "auto" }}
        >
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setActiveNav(item)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                backgroundColor: activeNav === item ? "rgba(55,214,192,0.15)" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  color: activeNav === item ? "#E6F3F3" : "#8DA8AC",
                  fontWeight: activeNav === item ? "700" : "400",
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* KPIs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, gap: 12 }}
      >
        {kpis.map((kpi) => (
          <View
            key={kpi.label}
            style={{
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 12,
              width: 170,
              backgroundColor: "rgba(255,255,255,0.055)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
            }}
          >
            <Text style={{ color: "#8DA8AC", fontWeight: "700", textTransform: "uppercase", fontSize: 9.5, letterSpacing: 1 }}>
              {kpi.label}
            </Text>
            <Text
              style={{ color: "#E6F3F3", fontWeight: "800", marginTop: 4, fontSize: kpi.value === "Degradado" ? 16 : 23 }}
            >
              {kpi.value}
            </Text>
            <Text
              style={{ fontWeight: "700", fontSize: 10.5, color: kpi.warn ? "#F0C24B" : "#4FD69C" }}
            >
              {kpi.delta}
            </Text>
            {kpi.spark.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, marginTop: 6, height: 20 }}>
                {kpi.spark.map((h, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      borderRadius: 2,
                      backgroundColor: "#37D6C0",
                      height: `${h}%`,
                      opacity: i === kpi.spark.length - 1 ? 1 : 0.35,
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Filters */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.13)",
          }}
        >
          <Text style={{ color: "#8DA8AC", fontSize: 11.5 }}>
            Buscar por nombre o correo…
          </Text>
        </View>
        <View
          style={{ flexDirection: "row", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }}
        >
          {["Todos", "Activos", "Suspendidos"].map((seg) => (
            <TouchableOpacity
              key={seg}
              onPress={() => setFilter(seg)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: filter === seg ? "#37D6C0" : "rgba(255,255,255,0.10)",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: filter === seg ? "700" : "600",
                  color: filter === seg ? "#04211D" : "#8DA8AC",
                }}
              >
                {seg}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* User list */}
      <FlatList
        data={users}
        keyExtractor={(u) => u.name}
        contentContainerStyle={{ paddingHorizontal: 4 }}
        renderItem={({ item: user }) => (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.13)" }}
          >
            {/* Avatar + info */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 9999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.13)",
                }}
              >
                <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 9 }}>{user.av}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: "#E6F3F3", fontWeight: "600", fontSize: 12 }} numberOfLines={1}>
                  {user.name}
                </Text>
                <Text style={{ color: "#8DA8AC", fontSize: 10 }} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>

            {/* Status tag */}
            <Tag type={user.tag}>{user.status}</Tag>

            {/* Stats */}
            <Text style={{ color: "#8DA8AC", fontSize: 11, width: 20, textAlign: "center" }}>
              {user.servers}
            </Text>
            <Text style={{ color: "#8DA8AC", fontSize: 11, width: 20, textAlign: "center" }}>
              {user.reports}
            </Text>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.13)",
                  backgroundColor: "rgba(255,255,255,0.10)",
                }}
              >
                <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 10.5 }}>Expediente</Text>
              </TouchableOpacity>
              {user.tag === "sus" ? (
                <TouchableOpacity style={{ backgroundColor: "#37D6C0", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                  <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 10.5 }}>Reactivar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, borderColor: "#FF7F72" }}
                >
                  <Text style={{ color: "#FF7F72", fontWeight: "700", fontSize: 10.5 }}>Suspender</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Footer */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.13)",
          backgroundColor: "rgba(255,255,255,0.055)",
        }}
      >
        <Text style={{ color: "#8DA8AC", fontSize: 10.5 }}>
          {users.filter((u) => u.tag === "sus").length} de {users.length} usuarios · filtro: {filter.toLowerCase()}
        </Text>
        <View style={{ marginLeft: "auto" }}>
          <Tag type="warn">Suspender invalida las sesiones activas</Tag>
        </View>
      </View>
    </View>
  )
}
