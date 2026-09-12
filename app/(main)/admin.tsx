import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native"
import { getAuditLog, banUser } from "@/api"
import type { AuditEntry } from "@/api/types"
import Toggle from "@/components/Toggle"

type Section = "overview" | "invites" | "roles" | "moderation" | "audit"

const SECTIONS = [
  { id: "overview" as const, label: "Información general", icon: "⚙" },
  { id: "invites" as const, label: "Invitaciones", icon: "🔗" },
  { id: "roles" as const, label: "Roles", icon: "🛡" },
  { id: "moderation" as const, label: "Moderación", icon: "🔨" },
  { id: "audit" as const, label: "Registro de auditoría", icon: "📋" },
]

const ROLES = [
  { id: "1", name: "Admin", color: "#FF7F72", members: 1 },
  { id: "2", name: "Moderadores", color: "#F0C24B", members: 2 },
  { id: "3", name: "Miembros Premium", color: "#A093FF", members: 8 },
  { id: "4", name: "Miembros", color: "#8DA8AC", members: 42 },
  { id: "5", name: "@everyone", color: "#5E7E82", members: 53 },
]

const PERM_GROUPS = [
  {
    name: "General",
    perms: [
      { name: "Ver canales", enabled: true },
      { name: "Gestionar canales", enabled: false },
      { name: "Gestionar roles", enabled: false },
    ],
  },
  {
    name: "Mensajes",
    perms: [
      { name: "Enviar mensajes", enabled: true },
      { name: "Incrustar enlaces", enabled: true },
      { name: "Adjuntar archivos", enabled: true },
      { name: "Gestionar mensajes", enabled: false },
    ],
  },
  {
    name: "Moderación",
    perms: [
      { name: "Expulsar miembros", enabled: false },
      { name: "Banear miembros", enabled: false },
      { name: "Silenciar miembros", enabled: false },
    ],
  },
]

const MEMBERS_MED = ["Lucía Pereyra", "spam_user123", "offtopic_guy"]

function ActionBadge({ action }: { action: string }) {
  const destructive = action === "Baneo" || action === "Expulsión" || action === "Silenciado"
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 9999,
        backgroundColor: destructive ? "rgba(255,127,114,0.15)" : "rgba(55,214,192,0.17)",
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "800",
          color: destructive ? "#FF7F72" : "#37D6C0",
        }}
      >
        {action}
      </Text>
    </View>
  )
}

export default function AdminScreen() {
  const [section, setSection] = useState<Section>("roles")
  const [selectedRole, setSelectedRole] = useState("2")
  const [perms, setPerms] = useState(
    PERM_GROUPS.map((g) => ({ ...g, perms: g.perms.map((p) => ({ ...p })) }))
  )
  const [showBan, setShowBan] = useState(false)
  const [banTarget, setBanTarget] = useState("")
  const [banReason, setBanReason] = useState("")
  const [banLoading, setBanLoading] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  useEffect(() => {
    if (section === "audit") {
      getAuditLog("1").then(setAuditLog)
    }
  }, [section])

  const togglePerm = (gi: number, pi: number) => {
    setPerms((prev) =>
      prev.map((g, gIdx) =>
        gIdx !== gi
          ? g
          : {
              ...g,
              perms: g.perms.map((p, pIdx) =>
                pIdx !== pi ? p : { ...p, enabled: !p.enabled }
              ),
            }
      )
    )
  }

  const handleBan = async () => {
    setBanLoading(true)
    try {
      await banUser("1", banTarget, banReason)
      setShowBan(false)
      setBanReason("")
    } finally {
      setBanLoading(false)
    }
  }

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {/* Sidebar */}
      <View
        style={{
          width: 200,
          backgroundColor: "rgba(255,255,255,0.055)",
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.13)",
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
          <Text style={{ color: "#8DA8AC", fontWeight: "800", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.7 }}>
            FIUBA · IS2
          </Text>
          <Text style={{ color: "#5E7E82", fontSize: 11 }}>Configuración del servidor</Text>
        </View>

        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => setSection(s.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginHorizontal: 4,
              marginVertical: 1,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: section === s.id ? "rgba(55,214,192,0.15)" : "transparent",
              borderLeftWidth: 2,
              borderLeftColor: section === s.id ? "#37D6C0" : "transparent",
            }}
          >
            <Text style={{ fontSize: 14 }}>{s.icon}</Text>
            <Text
              style={{
                fontSize: 13,
                color: section === s.id ? "#E6F3F3" : "#8DA8AC",
                fontWeight: section === s.id ? "600" : "400",
              }}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
        {/* OVERVIEW */}
        {section === "overview" && (
          <View style={{ maxWidth: 540 }}>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 24 }}>Información general</Text>

            <Text style={{ color: "#8DA8AC", fontWeight: "600", textTransform: "uppercase", marginBottom: 6, fontSize: 10, letterSpacing: 0.9 }}>
              Nombre del servidor
            </Text>
            <TextInput
              defaultValue="FIUBA · IS2"
              style={{ width: "100%", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: "#E6F3F3", fontSize: 14, marginBottom: 16, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }}
            />

            <Text style={{ color: "#8DA8AC", fontWeight: "600", textTransform: "uppercase", marginBottom: 6, fontSize: 10, letterSpacing: 0.9 }}>
              Descripción
            </Text>
            <TextInput
              defaultValue="Servidor de la materia Ingeniería de Software II. Comunicación del equipo, checkpoints y recursos."
              multiline
              numberOfLines={3}
              style={{
                width: "100%",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: "#E6F3F3",
                fontSize: 14,
                marginBottom: 16,
                backgroundColor: "rgba(255,255,255,0.10)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
                textAlignVertical: "top",
                minHeight: 80,
              }}
            />

            <TouchableOpacity style={{ backgroundColor: "#37D6C0", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, alignSelf: "flex-start" }}>
              <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Guardar cambios</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* INVITES */}
        {section === "invites" && (
          <View style={{ maxWidth: 640 }}>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 20 }}>Invitaciones</Text>

            <View
              style={{
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                backgroundColor: "rgba(255,255,255,0.055)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
              }}
            >
              <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14, marginBottom: 16 }}>Nueva invitación</Text>
              <TouchableOpacity style={{ backgroundColor: "#37D6C0", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16, alignSelf: "flex-start" }}>
                <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 12 }}>Generar link</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 14, marginBottom: 10 }}>Invitaciones activas</Text>
            {[
              { code: "mxyz-7Kp2", uses: "12/25", expires: "en 6 días" },
              { code: "abc-9Qw4", uses: "0/∞", expires: "sin vencimiento" },
              { code: "qrs-3Mn8", uses: "1/1", expires: "en 2 horas" },
            ].map((inv) => (
              <View
                key={inv.code}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  marginBottom: 4,
                  backgroundColor: "rgba(255,255,255,0.055)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.13)",
                }}
              >
                <Text style={{ color: "#37D6C0", flex: 1, fontFamily: "monospace", fontSize: 12 }}>
                  discordia.app/invite/{inv.code}
                </Text>
                <Text style={{ color: "#8DA8AC", fontSize: 12 }}>{inv.uses}</Text>
                <Text style={{ color: "#5E7E82", fontSize: 12 }}>{inv.expires}</Text>
                <TouchableOpacity>
                  <Text style={{ color: "#FF7F72", fontWeight: "600", fontSize: 12 }}>Revocar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ROLES */}
        {section === "roles" && (
          <View style={{ flexDirection: "row", gap: 28 }}>
            <View style={{ width: 250 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 18 }}>Roles</Text>
                <TouchableOpacity style={{ backgroundColor: "#37D6C0", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 12 }}>+ Nuevo</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: "#5E7E82", marginBottom: 10, fontSize: 11 }}>En orden de jerarquía</Text>

              {ROLES.map((r, i) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setSelectedRole(r.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    marginBottom: 4,
                    backgroundColor: selectedRole === r.id ? "rgba(55,214,192,0.17)" : "rgba(255,255,255,0.055)",
                    borderWidth: 1,
                    borderColor: selectedRole === r.id ? "#37D6C0" : "rgba(255,255,255,0.13)",
                  }}
                >
                  <Text style={{ color: "#5E7E82", fontFamily: "monospace", fontSize: 12, width: 16 }}>{i + 1}</Text>
                  <View style={{ width: 12, height: 12, borderRadius: 9999, backgroundColor: r.color }} />
                  <Text style={{ color: "#E6F3F3", flex: 1, fontSize: 13, fontWeight: "500" }}>{r.name}</Text>
                  <Text style={{ color: "#8DA8AC", fontFamily: "monospace", fontSize: 12 }}>{r.members}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <View
                  style={{ width: 14, height: 14, borderRadius: 9999, backgroundColor: ROLES.find((r) => r.id === selectedRole)?.color }}
                />
                <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 15 }}>
                  Permisos: {ROLES.find((r) => r.id === selectedRole)?.name}
                </Text>
              </View>

              {perms.map((group, gi) => (
                <View key={group.name} style={{ marginBottom: 20 }}>
                  <Text style={{ color: "#8DA8AC", fontWeight: "600", textTransform: "uppercase", marginBottom: 8, fontSize: 10, letterSpacing: 0.9 }}>
                    {group.name}
                  </Text>
                  {group.perms.map((perm, pi) => (
                    <View
                      key={perm.name}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 12,
                        marginBottom: 4,
                        backgroundColor: "rgba(255,255,255,0.055)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.13)",
                      }}
                    >
                      <Text style={{ color: "#E6F3F3", fontSize: 13 }}>{perm.name}</Text>
                      <Toggle on={perm.enabled} onToggle={() => togglePerm(gi, pi)} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* MODERATION */}
        {section === "moderation" && (
          <View style={{ maxWidth: 620 }}>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 4 }}>Moderación</Text>
            <Text style={{ color: "#8DA8AC", fontSize: 12, marginBottom: 24 }}>
              Gestioná las acciones sobre los miembros del servidor.
            </Text>

            <Text style={{ color: "#8DA8AC", fontWeight: "600", textTransform: "uppercase", marginBottom: 10, fontSize: 10, letterSpacing: 0.9 }}>
              Miembros recientes
            </Text>

            {MEMBERS_MED.map((name) => (
              <View
                key={name}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 12,
                  marginBottom: 4,
                  backgroundColor: "rgba(255,255,255,0.055)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.13)",
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.13)",
                  }}
                >
                  <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 13 }}>{name[0]}</Text>
                </View>
                <Text style={{ color: "#E6F3F3", flex: 1, fontSize: 13, fontWeight: "500" }}>{name}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setBanTarget(name)
                      setShowBan(true)
                    }}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(255,127,114,0.15)", borderWidth: 1, borderColor: "#FF7F72" }}
                  >
                    <Text style={{ color: "#FF7F72", fontWeight: "700", fontSize: 11 }}>Banear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }}
                  >
                    <Text style={{ color: "#8DA8AC", fontSize: 11 }}>Silenciar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }}
                  >
                    <Text style={{ color: "#8DA8AC", fontSize: 11 }}>Expulsar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* AUDIT */}
        {section === "audit" && (
          <View style={{ maxWidth: 700 }}>
            <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 20, marginBottom: 20 }}>Registro de auditoría</Text>
            {auditLog.map((entry) => (
              <View
                key={entry.id}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  marginBottom: 4,
                  backgroundColor: "rgba(255,255,255,0.055)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.13)",
                }}
              >
                <ActionBadge action={entry.action} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#E6F3F3", fontSize: 12.5 }}>
                    <Text style={{ fontWeight: "700" }}>{entry.actor}</Text>
                    <Text style={{ color: "#8DA8AC" }}> → </Text>
                    <Text style={{ fontWeight: "700" }}>{entry.target}</Text>
                    {entry.reason ? <Text style={{ color: "#8DA8AC" }}>: {entry.reason}</Text> : null}
                  </Text>
                </View>
                <Text style={{ color: "#5E7E82", fontFamily: "monospace", fontSize: 11 }}>{entry.time}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Ban modal */}
      <Modal visible={showBan} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowBan(false)}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.65)" }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              borderRadius: 12,
              padding: 28,
              width: 380,
              backgroundColor: "rgba(255,255,255,0.055)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.13)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <View
                style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,127,114,0.15)" }}
              >
                <Text style={{ fontSize: 20 }}>🔨</Text>
              </View>
              <View>
                <Text style={{ color: "#E6F3F3", fontWeight: "700", fontSize: 17 }}>Banear usuario</Text>
                <Text style={{ color: "#8DA8AC", fontSize: 12 }}>{banTarget}</Text>
              </View>
            </View>

            <Text style={{ color: "#8DA8AC", fontWeight: "600", textTransform: "uppercase", marginBottom: 6, fontSize: 10, letterSpacing: 0.9 }}>
              Motivo (visible para el equipo)
            </Text>
            <TextInput
              multiline
              numberOfLines={3}
              placeholder="Describí brevemente el motivo del baneo..."
              placeholderTextColor="#5E7E82"
              value={banReason}
              onChangeText={setBanReason}
              style={{
                width: "100%",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: "#E6F3F3",
                fontSize: 14,
                marginBottom: 16,
                backgroundColor: "rgba(255,255,255,0.10)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
                textAlignVertical: "top",
                minHeight: 80,
              }}
            />

            <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setShowBan(false)}
                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }}
              >
                <Text style={{ color: "#E6F3F3", fontSize: 13 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBan}
                disabled={banLoading}
                style={{ backgroundColor: "#FF7F72", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13 }}>
                  {banLoading ? "Baneando..." : "Confirmar baneo"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}
