import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"
import { deleteServer, reactivateServer, suspendServer } from "@/api/admin"
import { ApiError, friendlyError } from "@/api/client"
import { getServerDossier, getUserNames, type ServerDossier } from "@/api/dossier"
import { useAuth } from "@/context/AuthContext"
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

type Pending = "suspend" | "reactivate" | "delete"

const PENDING_COPY: Record<Pending, { title: string; text: string; label: string; tone: "danger" | "primary" }> = {
  suspend: {
    title: "Suspender servidor",
    text: "Ningún miembro va a poder entrar al servidor ni a sus llamadas mientras dure la suspensión. No se borra nada.",
    label: "Suspender",
    tone: "danger",
  },
  reactivate: {
    title: "Levantar suspensión",
    text: "Los miembros recuperan el acceso normal al servidor, con todo su contenido como estaba.",
    label: "Levantar suspensión",
    tone: "primary",
  },
  delete: {
    title: "Eliminar servidor",
    text: "Se eliminan para siempre el servidor y todos sus canales, mensajes, roles, miembros e invitaciones, y se cortan sus llamadas en curso. No se puede deshacer.",
    label: "Eliminar para siempre",
    tone: "danger",
  },
}

function abbr(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export default function ServerDossierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { logout } = useAuth()
  const wide = useWindowDimensions().width >= 900
  const [dossier, setDossier] = useState<ServerDossier | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [gone, setGone] = useState<"missing" | "deleted" | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [typedName, setTypedName] = useState("")
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError("")
    try {
      const data = await getServerDossier(id)
      setDossier(data)
      const ids = [
        data.server.ownerId,
        ...data.recentJoins.map((j) => j.userId),
        ...data.reports.map((r) => r.reporterId),
        ...data.moderation.map((m) => m.actorId),
      ]
      setNames(await getUserNames(ids).catch(() => new Map()))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      else if (err instanceof ApiError && err.status === 404) setGone("missing")
      else setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [id, logout])

  useEffect(() => {
    load()
  }, [load])

  const open = (kind: Pending) => {
    setActionError("")
    setTypedName("")
    setPending(kind)
  }

  const confirm = async () => {
    if (!dossier || !pending) return
    setActing(true)
    setActionError("")
    try {
      if (pending === "delete") {
        await deleteServer(dossier.server.id, typedName.trim())
        setPending(null)
        setDossier(null)
        setGone("deleted")
        return
      }
      if (pending === "suspend") await suspendServer(dossier.server.id)
      else await reactivateServer(dossier.server.id)
      setPending(null)
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      else setActionError(friendlyError(err))
    } finally {
      setActing(false)
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(main)/servers"))

  if (loading && !dossier && !gone) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#37D6C0" size="large" />
      </View>
    )
  }

  if (gone || error || !dossier) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <BackLink label="Volver" onPress={back} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            paddingHorizontal: 24,
          }}
        >
          <Ionicons
            name={gone === "deleted" ? "checkmark-circle-outline" : gone ? "server-outline" : "alert-circle-outline"}
            size={32}
            color={gone === "deleted" ? "#4FD69C" : "#FF7F72"}
          />
          <Text
            style={{
              color: gone === "deleted" ? "#4FD69C" : "#FF7F72",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {gone === "deleted"
              ? "El servidor se eliminó de forma permanente."
              : gone
                ? "Este servidor no existe o ya fue eliminado."
                : error}
          </Text>
          {gone ? null : (
            <Pressable onPress={load}>
              <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          )}
        </View>
      </View>
    )
  }

  const s = dossier.server
  const owner = names.get(s.ownerId) ?? "Usuario"

  const columnA = (
    <>
      <Section icon="information-circle-outline" title="Datos del servidor">
        <InfoRow label="Estado" value={<Tag type={s.suspended ? "sus" : "ok"}>{s.suspended ? "Suspendido" : "Activo"}</Tag>} />
        {s.suspended && s.suspendedAt ? <InfoRow label="Suspendido el" value={formatDateTime(s.suspendedAt)} /> : null}
        <InfoRow label="Creado el" value={formatDate(s.createdAt)} />
        <InfoRow label="Miembros" value={String(s.memberCount)} />
        <InfoRow
          label="Dueño"
          value={
            <Pressable onPress={() => router.push(`/(main)/expediente/usuario/${s.ownerId}`)} accessibilityRole="link">
              <Text style={{ color: "#37D6C0", fontSize: 13, fontWeight: "700" }}>{owner}</Text>
            </Pressable>
          }
        />
      </Section>

      <Section icon="chatbubbles-outline" title="Actividad de mensajería reciente">
        {dossier.messagingAvailable ? (
          <Empty text="Sin mensajes recientes." />
        ) : (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Ionicons name="time-outline" size={15} color="#F0C24B" style={{ marginTop: 1 }} />
            <Text
              style={{
                color: "#C9DADB",
                fontSize: 13,
                flex: 1,
                lineHeight: 19,
              }}
            >
              Todavía no hay datos de mensajería: el servicio de mensajes de la plataforma aún no está en funcionamiento.
            </Text>
          </View>
        )}
      </Section>

      <Section icon="enter-outline" title="Últimos ingresos" count={dossier.recentJoins.length}>
        {dossier.recentJoins.length ? (
          dossier.recentJoins.map((j) => (
            <ListRow
              key={j.userId}
              title={names.get(j.userId) ?? "Usuario"}
              subtitle={`${j.role === "owner" ? "Dueño" : j.role === "admin" ? "Administrador" : "Miembro"} · ${formatDateTime(j.joinedAt)}`}
              onPress={() => router.push(`/(main)/expediente/usuario/${j.userId}`)}
              accessibilityLabel={`Ver expediente de ${names.get(j.userId) ?? "usuario"}`}
            />
          ))
        ) : (
          <Empty text="Sin miembros." />
        )}
      </Section>
    </>
  )

  const columnB = (
    <>
      <Section icon="flag-outline" title="Reportes" count={dossier.reports.length}>
        {dossier.reports.length ? (
          dossier.reports.map((r) => <ReportRow key={r.id} report={r} names={names} />)
        ) : (
          <Empty text="El servidor no tiene reportes." />
        )}
      </Section>

      <Section icon="shield-checkmark-outline" title="Acciones de moderación" count={dossier.moderation.length}>
        {dossier.moderation.length ? (
          dossier.moderation.map((m, i) => <ModerationRow key={i} entry={m} names={names} />)
        ) : (
          <Empty text="No se aplicó ninguna medida." />
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
        {s.iconUrl ? (
          <Image source={{ uri: s.iconUrl }} style={{ width: 48, height: 48, borderRadius: 14 }} />
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "rgba(55,214,192,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#37D6C0", fontWeight: "800", fontSize: 16 }}>{abbr(s.name)}</Text>
          </View>
        )}
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
            Expediente de servidor
          </Text>
          <Text style={{ color: "#E6F3F3", fontSize: 20, fontWeight: "800" }} numberOfLines={1}>
            {s.name}
          </Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13 }}>
            {s.memberCount} {s.memberCount === 1 ? "miembro" : "miembros"} · creado el {formatDate(s.createdAt)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {s.suspended ? (
            <ActionButton label="Levantar suspensión" icon="play-circle-outline" tone="primary" onPress={() => open("reactivate")} />
          ) : (
            <ActionButton label="Suspender" icon="pause-circle-outline" tone="danger" onPress={() => open("suspend")} />
          )}
          <ActionButton label="Eliminar" icon="trash-outline" tone="danger" onPress={() => open("delete")} />
        </View>
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
        title={pending ? PENDING_COPY[pending].title : ""}
        subtitle={`${s.name} · ${s.memberCount} ${s.memberCount === 1 ? "miembro" : "miembros"}`}
        text={pending ? PENDING_COPY[pending].text : ""}
        confirmLabel={pending ? PENDING_COPY[pending].label : ""}
        tone={pending ? PENDING_COPY[pending].tone : "danger"}
        requireName={pending === "delete" ? s.name : undefined}
        acting={acting}
        error={actionError}
        typedName={typedName}
        onTypedName={setTypedName}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </ScrollView>
  )
}
