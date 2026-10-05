import { Redirect, Slot, usePathname, useRouter } from "expo-router"
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import Avatar from "@/components/Avatar"
import SessionSplash from "@/components/SessionSplash"

type IoniconName = React.ComponentProps<typeof Ionicons>["name"]

const NAV_ITEMS: { href: "/(main)/users" | "/(main)/servers"; path: string; label: string; icon: IoniconName }[] = [
  { href: "/(main)/users", path: "/users", label: "Usuarios", icon: "people-outline" },
  { href: "/(main)/servers", path: "/servers", label: "Servidores", icon: "server-outline" },
]

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

export default function MainLayout() {
  const { user, isLoggedIn, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { width } = useWindowDimensions()
  const compact = width < 720

  if (isLoading) return <SessionSplash />
  if (!isLoggedIn || !user) return <Redirect href="/(auth)/login" />

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1620" }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: compact ? "wrap" : "nowrap",
          alignItems: "center",
          columnGap: 12,
          rowGap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.13)",
          backgroundColor: "rgba(255,255,255,0.055)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: "#37D6C0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#04211D", fontWeight: "900", fontSize: 13 }}>D</Text>
          </View>
          <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 14.5 }}>Backoffice</Text>
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
            <Text style={{ color: "#37D6C0", fontWeight: "800", fontSize: 10, letterSpacing: 0.6 }}>
              Staff
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 4, paddingHorizontal: compact ? 0 : 4 }}
          style={compact ? ({ order: 3, width: "100%", flexBasis: "100%" } as object) : { flexGrow: 1 }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.path)
            return (
              <Pressable
                key={item.path}
                onPress={() => router.replace(item.href)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 9999,
                  backgroundColor: active
                    ? "rgba(55,214,192,0.15)"
                    : hovered
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                })}
              >
                <Ionicons name={item.icon} size={15} color={active ? "#37D6C0" : "#8DA8AC"} />
                <Text
                  style={{
                    fontSize: 13,
                    color: active ? "#E6F3F3" : "#8DA8AC",
                    fontWeight: active ? "700" : "500",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <Avatar initials={initialsFor(user.name)} size={28} uri={user.avatarUrl} />
          {!compact ? (
            <Text style={{ color: "#E6F3F3", fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
              {user.name}
            </Text>
          ) : null}
          <Pressable
            onPress={logout}
            accessibilityLabel="Cerrar sesión"
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: hovered ? "rgba(255,138,128,0.12)" : "rgba(255,255,255,0.06)",
            })}
          >
            <Ionicons name="log-out-outline" size={15} color="#FF8A80" />
            {!compact ? (
              <Text style={{ color: "#FF8A80", fontSize: 12, fontWeight: "600" }}>Cerrar sesión</Text>
            ) : null}
          </Pressable>
        </View>
      </View>

      <Slot />
    </View>
  )
}
