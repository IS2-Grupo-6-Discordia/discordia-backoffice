import type { ReactNode } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { formatTime, serviceColor, serviceLabel, type LogLine } from "@/api/observability"

type IconName = React.ComponentProps<typeof Ionicons>["name"]

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
  // Con allLabel, el primer chip es "todos" y equivale a null.
  allLabel?: string
}) {
  const items: { value: T | null; label: string }[] = allLabel ? [{ value: null, label: allLabel }, ...options] : options
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <Pressable
            key={item.label}
            onPress={() => onChange(item.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: active ? "rgba(55,214,192,0.17)" : "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: active ? "#37D6C0" : "transparent",
            }}
          >
            <Text style={{ color: active ? "#37D6C0" : "#8DA8AC", fontWeight: "700", fontSize: 12 }}>{item.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <Text style={{ color: "#5E7E82", fontSize: 11.5, fontWeight: "700", width: 64 }}>{label}</Text>
      {children}
    </View>
  )
}

export function ServiceDot({ service }: { service: string | null }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: serviceColor(service) }} />
}

const LEVEL_COLORS: Record<string, string> = { error: "#FF7F72", warn: "#F0C24B", info: "#8DA8AC", debug: "#5E7E82" }

export function LevelTag({ level }: { level: string | null }) {
  const color = LEVEL_COLORS[level ?? ""] ?? "#8DA8AC"
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, backgroundColor: `${color}22`, minWidth: 44, alignItems: "center" }}>
      <Text style={{ color, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase" }}>{level ?? "—"}</Text>
    </View>
  )
}

export function LogRow({ line, onOpenTrace }: { line: LogLine; onOpenTrace?: (traceId: string) => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Text style={{ color: "#5E7E82", fontSize: 11.5, width: 108, fontVariant: ["tabular-nums"] }}>{formatTime(line.timestamp)}</Text>
      <LevelTag level={line.level} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, width: 104 }}>
        <ServiceDot service={line.service} />
        <Text style={{ color: "#C9DADB", fontSize: 12 }} numberOfLines={1}>
          {serviceLabel(line.service)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: "#E6F3F3", fontSize: 12.5, fontFamily: "monospace" }} numberOfLines={3}>
          {line.message}
        </Text>
        {line.requestId ? (
          <Text style={{ color: "#5E7E82", fontSize: 11, marginTop: 2 }} selectable>
            request_id {line.requestId}
          </Text>
        ) : null}
      </View>
      {line.traceId && onOpenTrace ? (
        <Pressable onPress={() => onOpenTrace(line.traceId!)} accessibilityRole="link" accessibilityLabel="Abrir la traza" hitSlop={6}>
          <Text style={{ color: "#37D6C0", fontSize: 12, fontWeight: "700" }}>Traza</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 48, alignItems: "center" }}>
      <ActivityIndicator color="#37D6C0" size="large" />
    </View>
  )
}

export function Message({ icon, text, tone = "muted", onRetry }: { icon: IconName; text: string; tone?: "muted" | "error"; onRetry?: () => void }) {
  const color = tone === "error" ? "#FF7F72" : "#8DA8AC"
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 40, paddingHorizontal: 32 }}>
      <Ionicons name={icon} size={30} color={color} />
      <Text style={{ color, fontSize: 13.5, textAlign: "center", lineHeight: 19 }}>{text}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry}>
          <Text style={{ color: "#37D6C0", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function RefreshButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Actualizar"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 9999,
        backgroundColor: "rgba(255,255,255,0.06)",
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Ionicons name="refresh" size={14} color="#C9DADB" />
      <Text style={{ color: "#C9DADB", fontWeight: "700", fontSize: 12 }}>Actualizar</Text>
    </Pressable>
  )
}
