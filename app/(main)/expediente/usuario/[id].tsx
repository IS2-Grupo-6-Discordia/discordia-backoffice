import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"
import { reactivateUser, suspendUser } from "@/api/admin"
import { ApiError, friendlyError } from "@/api/client"
import { getUserDossier, getUserNames, type UserDossier } from "@/api/dossier"
import { useAuth } from "@/context/AuthContext"
import Avatar from "@/components/Avatar"
import Tag from "@/components/Tag"
import {
  ActionButton,
  BackLink,
  ConfirmModal,
  Empty,
  InfoRow,
  ListRow,
  ModerationRow,
  ReportRow,
  Section,
  formatDate,
  formatDateTime,
} from "@/components/dossier/DossierParts"

type Activity = {
  at: string
  icon: "log-in-outline" | "enter-outline" | "pulse-outline"
  text: string
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export default function UserDossierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { user: me, logout } = useAuth()
  const wide = useWindowDimensions().width >= 900
  const [dossier, setDossier] = useState<UserDossier | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notFound, setNotFound] = useState(false)
  const [pending, setPending] = useState<"suspend" | "reactivate" | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError("")
    try {
      const data = await getUserDossier(id)
      setDossier(data)
      const ids = [...data.reports.map((r) => r.reporterId), ...data.moderation.map((m) => m.actorId)]
      setNames(await getUserNames(ids).catch(() => new Map()))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      else if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [id, logout])

  useEffect(() => {
    load()
  }, [load])

  const activity = useMemo<Activity[]>(() => {
    if (!dossier) return []
    const items: Activity[] = [
      ...dossier.sessions.map((s) => ({
        at: s.createdAt,
        icon: "log-in-outline" as const,
        text: "Inició sesión",
      })),
      ...dossier.memberships.map((m) => ({
        at: m.joinedAt,
        icon: "enter-outline" as const,
        text: `Se unió a ${m.serverName}`,
      })),
    ]
    if (dossier.account.lastActiveAt)
      items.push({
        at: dossier.account.lastActiveAt,
        icon: "pulse-outline",
        text: "Última actividad en la app",
      })
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12)
  }, [dossier])

  const confirm = async () => {
    if (!dossier || !pending) return
    setActing(true)
    setActionError("")
    try {
      if (pending === "suspend") await suspendUser(dossier.account.id)
      else await reactivateUser(dossier.account.id)
      setPending(null)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      else setActionError(friendlyError(err))
    } finally {
      setActing(false)
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(main)/users"))

  if (loading && !dossier) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#37D6C0" size="large" />
      </View>
    )
  }

  if (notFound || error || !dossier) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <BackLink label="Volver" onPress={back} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Ionicons name={notFound ? "person-remove-outline" : "alert-circle-outline"} size={32} color="#FF7F72" />
          <Text style={{ color: "#FF7F72", fontSize: 14, textAlign: "center" }}>{notFound ? "Este usuario no existe." : error}</Text>
          {notFound ? null : (
            <Pressable onPress={load}>
              <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          )}
        </View>
      </View>
    )
  }

  const a = dossier.account
  const isMe = me?.id === a.id

  const columnA = (
    <>
      <Section icon="person-circle-outline" title="Cuenta">
        <InfoRow label="Estado" value={<Tag type={a.isActive ? "ok" : "sus"}>{a.isActive ? "Activa" : "Suspendida"}</Tag>} />
        <InfoRow label="Rol" value={a.role === "staff" ? "Staff" : "Usuario"} />
        <InfoRow label="Registrado el" value={formatDate(a.createdAt)} />
        <InfoRow label="Ingresa con" value={a.hasPassword ? "Email y contraseña" : "Google"} />
        <InfoRow label="Última actividad" value={a.lastActiveAt ? formatDateTime(a.lastActiveAt) : "Sin registro"} />
      </Section>

      <Section icon="server-outline" title="Servidores" count={dossier.memberships.length}>
        {dossier.memberships.length ? (
          dossier.memberships.map((m) => (
            <ListRow
              key={m.serverId}
              title={m.serverName}
              subtitle={`${m.role === "owner" ? "Dueño" : m.role === "admin" ? "Administrador" : "Miembro"} · Se unió el ${formatDate(m.joinedAt)}`}
              right={m.suspended ? <Tag type="sus">Suspendido</Tag> : undefined}
              onPress={() => router.push(`/(main)/expediente/servidor/${m.serverId}`)}
              accessibilityLabel={`Ver expediente de ${m.serverName}`}
            />
          ))
        ) : (
          <Empty text="No pertenece a ningún servidor." />
        )}
      </Section>

      <Section icon="pulse-outline" title="Actividad reciente">
        {activity.length ? (
          activity.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 6,
              }}
            >
              <Ionicons name={item.icon} size={15} color="#8DA8AC" />
              <Text style={{ color: "#E6F3F3", fontSize: 13, flex: 1 }}>{item.text}</Text>
              <Text style={{ color: "#8DA8AC", fontSize: 12 }}>{formatDateTime(item.at)}</Text>
            </View>
          ))
        ) : (
          <Empty text="Sin actividad registrada." />
        )}
      </Section>
    </>
  )

  const columnB = (
    <>
      <Section icon="flag-outline" title="Reportes recibidos" count={dossier.reports.length}>
        {dossier.reports.length ? (
          dossier.reports.map((r) => <ReportRow key={r.id} report={r} names={names} />)
        ) : (
          <Empty text="No recibió reportes." />
        )}
      </Section>

      <Section icon="shield-checkmark-outline" title="Acciones de moderación" count={dossier.moderation.length}>
        {dossier.moderation.length ? (
          dossier.moderation.map((m, i) => <ModerationRow key={i} entry={m} names={names} />)
        ) : (
          <Empty text="No se le aplicó ninguna medida." />
        )}
      </Section>
    </>
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <BackLink label="Volver" onPress={back} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Avatar initials={initials(a.name)} uri={a.avatarUrl} size={48} />
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text
            style={{
              color: "#8DA8AC",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Expediente de usuario
          </Text>
          <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13 }} numberOfLines={1}>
            {a.email}
          </Text>
        </View>
        {isMe ? null : a.isActive ? (
          <ActionButton
            label="Suspender cuenta"
            icon="pause-circle-outline"
            tone="danger"
            onPress={() => {
              setActionError("")
              setPending("suspend")
            }}
          />
        ) : (
          <ActionButton
            label="Reactivar cuenta"
            icon="play-circle-outline"
            tone="primary"
            onPress={() => {
              setActionError("")
              setPending("reactivate")
            }}
          />
        )}
      </View>

      {wide ? (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>{columnA}</View>
          <View style={{ flex: 1 }}>{columnB}</View>
        </View>
      ) : (
        <>
          {columnA}
          {columnB}
        </>
      )}

      <ConfirmModal
        visible={!!pending}
        title={pending === "suspend" ? "Suspender cuenta" : "Reactivar cuenta"}
        subtitle={`${a.name} · ${a.email}`}
        text={
          pending === "suspend"
            ? "No va a poder iniciar sesión, se cierran sus sesiones abiertas y sale de las llamadas en curso."
            : "Vuelve a poder iniciar sesión y usar la plataforma con normalidad."
        }
        confirmLabel={pending === "suspend" ? "Suspender" : "Reactivar"}
        tone={pending === "suspend" ? "danger" : "primary"}
        acting={acting}
        error={actionError}
        typedName=""
        onTypedName={() => undefined}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </ScrollView>
  )
}
