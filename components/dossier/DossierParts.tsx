import type { ComponentProps, ReactNode } from "react"
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import ModalShell from "@/components/ModalShell"
import PressableScale from "@/components/PressableScale"
import Tag from "@/components/Tag"
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS, type ModerationEntry, type Report } from "@/api/dossier"

type IconName = ComponentProps<typeof Ionicons>["name"]

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function Section({ icon, title, count, children }: { icon: IconName; title: string; count?: number; children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        backgroundColor: "rgba(255,255,255,0.045)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={16} color="#37D6C0" />
        <Text style={{ color: "#E6F3F3", fontWeight: "800", fontSize: 14 }}>{title}</Text>
        {count !== undefined ? (
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 1,
              borderRadius: 9999,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text style={{ color: "#C9DADB", fontSize: 11, fontWeight: "700" }}>{count}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  )
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Text style={{ color: "#8DA8AC", fontSize: 13 }}>{label}</Text>
      {typeof value === "string" ? (
        <Text
          style={{
            color: "#E6F3F3",
            fontSize: 13,
            fontWeight: "600",
            flexShrink: 1,
            textAlign: "right",
          }}
        >
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <Text
      style={{
        color: "#5E7E82",
        fontSize: 13,
        fontStyle: "italic",
        paddingVertical: 4,
      }}
    >
      {text}
    </Text>
  )
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "700" }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 1 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={15} color="#5E7E82" /> : null}
    </View>
  )
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={accessibilityLabel ?? title}>
      {content}
    </Pressable>
  ) : (
    content
  )
}

export function ReportStatusTag({ status }: { status: Report["status"] }) {
  return <Tag type={status === "pending" ? "warn" : status === "reviewed" ? "ok" : "sus"}>{REPORT_STATUS_LABELS[status]}</Tag>
}

export function ReportRow({ report, names }: { report: Report; names: Map<string, string> }) {
  const reporter = names.get(report.reporterId) ?? "Usuario"
  const where = report.targetType === "user" ? ` · en ${report.serverName}` : ""
  return (
    <View
      style={{
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          style={{
            color: "#E6F3F3",
            fontSize: 13.5,
            fontWeight: "700",
            flex: 1,
          }}
        >
          {REPORT_REASON_LABELS[report.reason] ?? report.reason}
        </Text>
        <ReportStatusTag status={report.status} />
      </View>
      <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 2 }}>
        Reportado por {reporter}
        {where} · {formatDateTime(report.createdAt)}
      </Text>
      {report.detail ? <Text style={{ color: "#C9DADB", fontSize: 12.5, marginTop: 4 }}>“{report.detail}”</Text> : null}
    </View>
  )
}

const MODERATION_LABELS: Record<ModerationEntry["kind"], { text: string; icon: IconName; color: string }> = {
  suspended: {
    text: "Suspendido por el staff",
    icon: "pause-circle-outline",
    color: "#FF7F72",
  },
  reactivated: {
    text: "Reactivado por el staff",
    icon: "play-circle-outline",
    color: "#4FD69C",
  },
  deleted: {
    text: "Eliminado por el staff",
    icon: "trash-outline",
    color: "#FF7F72",
  },
  banned: { text: "Baneado", icon: "ban-outline", color: "#F0C24B" },
}

export function ModerationRow({ entry, names }: { entry: ModerationEntry; names: Map<string, string> }) {
  const meta = MODERATION_LABELS[entry.kind]
  const actor = entry.actorName ?? names.get(entry.actorId) ?? "alguien que ya no está"
  const title = entry.kind === "banned" ? `Baneado de ${entry.serverName ?? "un servidor"}` : meta.text
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Ionicons name={meta.icon} size={17} color={meta.color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 1 }}>
          {entry.kind === "banned" ? "Por" : "Lo hizo"} {actor} · {formatDateTime(entry.createdAt)}
        </Text>
        {entry.reason ? <Text style={{ color: "#C9DADB", fontSize: 12.5, marginTop: 3 }}>Motivo: {entry.reason}</Text> : null}
      </View>
    </View>
  )
}

export function ActionButton({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string
  icon: IconName
  tone: "danger" | "primary"
  onPress: () => void
}) {
  const danger = tone === "danger"
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      hoverStyle={danger ? { backgroundColor: "rgba(255,127,114,0.12)" } : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9999,
        borderWidth: danger ? 1 : 0,
        borderColor: "#FF7F72",
        backgroundColor: danger ? "transparent" : "#37D6C0",
      }}
    >
      <Ionicons name={icon} size={14} color={danger ? "#FF7F72" : "#04211D"} />
      <Text
        style={{
          color: danger ? "#FF7F72" : "#04211D",
          fontWeight: "700",
          fontSize: 12.5,
        }}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

export function ConfirmModal({
  visible,
  title,
  subtitle,
  text,
  confirmLabel,
  tone,
  requireName,
  acting,
  error,
  typedName,
  onTypedName,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  title: string
  subtitle?: string
  text: string
  confirmLabel: string
  tone: "danger" | "primary"
  requireName?: string
  acting: boolean
  error: string
  typedName: string
  onTypedName: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const nameOk = !requireName || typedName.trim() === requireName
  const disabled = acting || !nameOk
  return (
    <ModalShell visible={visible} onClose={() => (acting ? undefined : onCancel())} title={title} subtitle={subtitle}>
      <Text style={{ color: "#C9DADB", fontSize: 13.5, lineHeight: 20 }}>{text}</Text>
      {requireName ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginBottom: 6 }}>
            Para confirmar, escribí el nombre: <Text style={{ color: "#E6F3F3", fontWeight: "700" }}>{requireName}</Text>
          </Text>
          <TextInput
            value={typedName}
            onChangeText={onTypedName}
            placeholder={requireName}
            placeholderTextColor="#5A7A80"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!acting}
            accessibilityLabel="Nombre para confirmar"
            style={{
              color: "#E6F3F3",
              fontSize: 14,
              height: 40,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: nameOk ? "#FF7F72" : "rgba(255,255,255,0.13)",
              backgroundColor: "rgba(255,255,255,0.06)",
              ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
            }}
          />
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: "#FF7F72", fontSize: 12.5, marginTop: 10 }}>
          {error}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 18,
        }}
      >
        <Pressable
          onPress={onCancel}
          disabled={acting}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 13 }}>Cancelar</Text>
        </Pressable>
        <PressableScale
          onPress={onConfirm}
          disabled={disabled}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 10,
            backgroundColor: tone === "danger" ? "#FF7F72" : "#37D6C0",
            opacity: disabled ? 0.45 : 1,
          }}
        >
          {acting ? <ActivityIndicator size="small" color="#04211D" /> : null}
          <Text style={{ color: "#04211D", fontWeight: "800", fontSize: 13 }}>{confirmLabel}</Text>
        </PressableScale>
      </View>
    </ModalShell>
  )
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
        paddingVertical: 6,
        paddingRight: 10,
      }}
    >
      <Ionicons name="chevron-back" size={16} color="#8DA8AC" />
      <Text style={{ color: "#8DA8AC", fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  )
}
