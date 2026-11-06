import { useState } from "react"
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from "react-native"

// Column chart for one metric over the period: one column per bucket, its own y-axis (the three
// metrics have very different scales, so they never share a plot). Built from plain Views so it
// needs no chart or SVG dependency.

const PLOT_HEIGHT = 112
const TOP_ROOM = 18 // room above the tallest column for its label and the tooltip
const AXIS_WIDTH = 36
const X_AXIS_HEIGHT = 18
const TOOLTIP_WIDTH = 128
export const CHART_HEIGHT = TOP_ROOM + PLOT_HEIGHT + X_AXIS_HEIGHT

const GRID = "rgba(255,255,255,0.07)"
const BASELINE = "rgba(255,255,255,0.16)"
const TEXT_PRIMARY = "#E6F3F3"
const TEXT_SECONDARY = "#C9DADB"
const TEXT_MUTED = "#8DA8AC"
const LINK = "#37D6C0"

const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 })

export function formatCount(n: number): string {
  return n.toLocaleString("es-AR")
}

function formatTick(n: number, max: number): string {
  return max >= 10_000 ? compact.format(n) : formatCount(n)
}

// Smallest 1/2/5 × 10^k at or above the peak, so the ticks are round numbers.
function niceMax(peak: number): number {
  if (peak <= 0) return 0
  const magnitude = 10 ** Math.floor(Math.log10(peak))
  for (const step of [1, 2, 5, 10]) {
    if (step * magnitude >= peak) return step * magnitude
  }
  return 10 * magnitude
}

function ticksFor(max: number): number[] {
  if (max === 0) return [0]
  return Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max]
}

function axisIndexes(count: number): number[] {
  if (count <= 1) return [0]
  if (count <= 3) return Array.from({ length: count }, (_, i) => i)
  return [0, Math.floor((count - 1) / 2), count - 1]
}

export default function MetricChart({
  color,
  values,
  labels,
  longLabels,
  caption,
  dimmed = false,
}: {
  color: string
  values: number[]
  labels: string[]
  longLabels: string[]
  caption: string
  dimmed?: boolean
}) {
  const [width, setWidth] = useState(0)
  const [hovered, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  const count = values.length
  // A new period can bring fewer buckets while the pointer still rests on an old index.
  const active = hovered !== null && hovered < count ? hovered : null
  const peak = Math.max(0, ...values)
  const max = niceMax(peak)
  const peakIndex = values.indexOf(peak)
  const slot = count > 0 ? width / count : 0
  const barWidth = Math.max(1, Math.min(24, slot - 2))
  const radius = Math.min(4, barWidth / 2)
  const heightOf = (value: number) => (max === 0 || value <= 0 ? 0 : Math.max(2, (value / max) * PLOT_HEIGHT))
  const centerOf = (i: number) => i * slot + slot / 2

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)

  return (
    <View style={{ opacity: dimmed ? 0.45 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>{caption}</Text>
        <Pressable
          onPress={() => setShowTable((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showTable ? `Ver gráfico de ${caption.toLowerCase()}` : `Ver tabla de ${caption.toLowerCase()}`}
        >
          <Text style={{ color: LINK, fontSize: 12, fontWeight: "700" }}>{showTable ? "Ver gráfico" : "Ver tabla"}</Text>
        </Pressable>
      </View>

      {showTable ? (
        // Same height as the chart, so switching views doesn't move the card.
        <ScrollView style={{ height: CHART_HEIGHT }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {values.map((value, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 4,
                borderBottomWidth: 1,
                borderBottomColor: GRID,
              }}
            >
              <Text style={{ color: TEXT_SECONDARY, fontSize: 12.5 }}>{longLabels[i]}</Text>
              <Text style={{ color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {formatCount(value)}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: "row", height: CHART_HEIGHT }}>
          <View style={{ width: AXIS_WIDTH, height: TOP_ROOM + PLOT_HEIGHT }}>
            {ticksFor(max).map((tick) => (
              <Text
                key={tick}
                style={{
                  position: "absolute",
                  right: 6,
                  top: TOP_ROOM + PLOT_HEIGHT * (max === 0 ? 1 : 1 - tick / max) - 7,
                  color: TEXT_MUTED,
                  fontSize: 10.5,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatTick(tick, max)}
              </Text>
            ))}
          </View>

          <View style={{ flex: 1 }} onLayout={onLayout}>
            <View style={{ height: TOP_ROOM + PLOT_HEIGHT }}>
              {ticksFor(max).map((tick) => (
                <View
                  key={tick}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: TOP_ROOM + PLOT_HEIGHT * (max === 0 ? 1 : 1 - tick / max),
                    height: 1,
                    backgroundColor: tick === 0 ? BASELINE : GRID,
                  }}
                />
              ))}

              {width > 0
                ? values.map((value, i) => (
                    <View
                      key={i}
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: centerOf(i) - barWidth / 2,
                        width: barWidth,
                        height: heightOf(value),
                        borderTopLeftRadius: radius,
                        borderTopRightRadius: radius,
                        backgroundColor: color,
                        opacity: active === null || active === i ? 1 : 0.45,
                      }}
                    />
                  ))
                : null}

              {width > 0 && peak > 0 && active === null ? (
                <Text
                  style={{
                    position: "absolute",
                    left: Math.min(Math.max(centerOf(peakIndex) - 40, 0), width - 80),
                    width: 80,
                    bottom: heightOf(peak) + 3,
                    textAlign: "center",
                    color: TEXT_SECONDARY,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {formatCount(peak)}
                </Text>
              ) : null}

              {peak === 0 ? (
                <Text style={{ position: "absolute", left: 0, right: 0, top: TOP_ROOM + PLOT_HEIGHT / 2 - 8, textAlign: "center", color: TEXT_MUTED, fontSize: 12 }}>
                  Sin actividad en el período
                </Text>
              ) : null}

              {/* Hit targets: the whole column slot, taller and wider than the mark. */}
              {width > 0
                ? values.map((value, i) => (
                    <Pressable
                      key={i}
                      onHoverIn={() => setActive(i)}
                      onHoverOut={() => setActive((a) => (a === i ? null : a))}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive((a) => (a === i ? null : a))}
                      onPress={() => setActive((a) => (a === i ? null : i))}
                      accessibilityLabel={`${longLabels[i]}: ${formatCount(value)}`}
                      style={{ position: "absolute", top: 0, bottom: 0, left: i * slot, width: slot }}
                    />
                  ))
                : null}

              {/* Beside the hovered column, not over it, flipping left near the right edge. */}
              {active !== null && width > 0 ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left:
                      centerOf(active) + barWidth / 2 + 6 + TOOLTIP_WIDTH <= width
                        ? centerOf(active) + barWidth / 2 + 6
                        : Math.max(0, centerOf(active) - barWidth / 2 - 6 - TOOLTIP_WIDTH),
                    width: TOOLTIP_WIDTH,
                    paddingHorizontal: 9,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: "#0F2230",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.14)",
                  }}
                >
                  <Text style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: "800" }}>{formatCount(values[active])}</Text>
                  <Text style={{ color: TEXT_MUTED, fontSize: 11.5 }}>{longLabels[active]}</Text>
                </View>
              ) : null}
            </View>

            <View style={{ height: X_AXIS_HEIGHT }}>
              {width > 0
                ? axisIndexes(count).map((i, n, all) => {
                    const first = n === 0
                    const last = n === all.length - 1 && all.length > 1
                    return (
                      <Text
                        key={i}
                        numberOfLines={1}
                        style={{
                          position: "absolute",
                          top: 4,
                          width: 64,
                          left: first ? 0 : last ? undefined : centerOf(i) - 32,
                          right: last ? 0 : undefined,
                          textAlign: first ? "left" : last ? "right" : "center",
                          color: TEXT_MUTED,
                          fontSize: 10.5,
                        }}
                      >
                        {labels[i]}
                      </Text>
                    )
                  })
                : null}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
