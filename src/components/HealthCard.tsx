import { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import { GlassWidget } from "./GlassWidget";
import { LinearGradient } from "expo-linear-gradient";

import { Avatar } from "./Avatar";
import { Chevron } from "./Chevron";
import { Sparkline } from "./Sparkline";
import {
  bmiHealthy,
  bmiLabel,
  bmiOf,
  genderLabel,
  initialOf,
  residentById,
  type Resident,
} from "../models/household";
import { planToday } from "../models/task";
import {
  formatReading,
  latestVitals,
  metricOf,
  sparkFor,
  statusOf,
  type MetricKind,
  type Tone,
} from "../models/vitals";
import {
  DANGER_INK,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TYPE,
  WARNING,
  shadow,
} from "../theme/tokens";
import { tr } from "../i18n";

/** The readings the card shows, in the order a carer reads them. */
const SHOWN: MetricKind[] = ["bp", "glucose", "spo2", "pulse", "temp"];

const INK: Record<Tone, string> = {
  normal: TEXT_PRIMARY,
  warn: WARNING,
  alert: DANGER_INK,
};

/**
 * One patient's health, as the assistant sends it: their latest readings as
 * figures, each coloured by where it stands and with its week as a line
 * under it, and their BMI — the health profile's first screen, small
 * enough to sit under an answer. Tapping it opens the profile.
 *
 * Drawn from the same records the profile reads, never from the model's
 * words: the sentence above it is the model's summary, and these are the
 * numbers it summarised.
 */
export function HealthCard({
  residentId,
  onOpen,
}: {
  residentId: string;
  onOpen: (resident: Resident) => void;
}) {
  /*
    Three tiles across where the card is wide enough for them — a tablet's
    column — and two on a phone, as drawn. Measured off the tiles' own row,
    so the card answers to the column it is given, not to the screen.
  */
  const [rowW, setRowW] = useState(0);
  const tileW: number | "48.5%" =
    rowW >= 540 ? (rowW - SPACE.sm * 2) / 3 : "48.5%";
  const resident = residentById(residentId);
  if (resident == null) return null;
  const latest = latestVitals(resident);

  return (
    <GlassWidget
      onPress={() => onOpen(resident)}
      accessibilityLabel={tr(`ค่าสุขภาพล่าสุดของ ${resident.name}`, `Latest health readings for ${resident.name}`)}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
          paddingHorizontal: SPACE.xs,
          paddingTop: SPACE.xs,
        }}
      >
        {/* Who this is, at a glance: their photo where one was taken, their
            initial where not — the same disc the house and the profile use. */}
        <Avatar
          size={44}
          initial={initialOf(resident.name)}
          photo={resident.photo}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ ...TYPE.rowTitle, color: TEXT_PRIMARY }}
          >
            {resident.name}
          </Text>
          <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>
            {tr(
              `${resident.age} ปี · ${resident.gender} · ค่าสุขภาพล่าสุด`,
              `Age ${resident.age} · ${genderLabel(resident.gender)} · Latest readings`,
            )}
          </Text>
        </View>
        <Chevron />
      </View>

      <View
        onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}
      >
        {SHOWN.map((kind) => {
          const metric = metricOf(kind);
          const reading = latest[kind];
          const status =
            reading == null
              ? null
              : statusOf(kind, reading.value, reading.value2);
          const ink = status == null ? TEXT_MUTED : INK[status.tone];
          const spark = sparkFor(resident, kind, planToday);
          return (
            <Tile key={kind} art={ART[kind]} width={tileW}>
              <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>
                {metric.short}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 3,
                }}
              >
                <Text style={{ ...TYPE.figure, color: ink }}>
                  {reading == null ? "-" : formatReading(metric, reading)}
                </Text>
                <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>
                  {metric.unit}
                </Text>
              </View>
              {status != null && (
                <Text
                  style={{ ...TYPE.caption, fontWeight: "600", color: ink }}
                >
                  {status.label}
                </Text>
              )}
              {spark.values.length > 1 && (
                // Short of the tile's right edge: the corner is the picture's.
                <View
                  style={{
                    marginTop: SPACE.xs,
                    marginRight: ART_SIZE - SPACE.md,
                  }}
                >
                  <Sparkline
                    height={28}
                    series={[
                      {
                        values: spark.values,
                        ink: metric.ink,
                        severity: spark.severity,
                      },
                      ...(spark.values2 != null && metric.ink2 != null
                        ? [
                            {
                              values: spark.values2,
                              ink: metric.ink2,
                              severity: spark.severity2,
                            },
                          ]
                        : []),
                    ]}
                  />
                </View>
              )}
            </Tile>
          );
        })}

        {/* BMI, which has no week of readings: the figure and its band. */}
        <Tile art={ART.bmi} width={tileW}>
          <Text style={{ ...TYPE.caption, color: TEXT_MUTED }}>BMI</Text>
          <Text
            style={{
              ...TYPE.figure,
              color: bmiHealthy(resident) ? TEXT_PRIMARY : WARNING,
            }}
          >
            {bmiOf(resident).toFixed(1)}
          </Text>
          <Text
            style={{
              ...TYPE.caption,
              fontWeight: "600",
              color: bmiHealthy(resident) ? TEXT_MUTED : WARNING,
            }}
          >
            {bmiLabel(resident)}
          </Text>
        </Tile>
      </View>
    </GlassWidget>
  );
}

/**
 * Each reading's picture — the 3D art the health profile's cards use — set
 * into its tile's lower corner, its foot fading into the white.
 */
const ART: Record<MetricKind | "bmi", ImageSourcePropType> = {
  bp: require("../../assets/images/bp_3d.png"),
  glucose: require("../../assets/images/glucose_3d.png"),
  spo2: require("../../assets/images/lungs_3d.png"),
  pulse: require("../../assets/images/heart_3d.png"),
  temp: require("../../assets/images/temp_glass.png"),
  waist: require("../../assets/images/waist_3d.png"),
  cgm: require("../../assets/images/cgm_sensor.png"),
  bmi: require("../../assets/images/bmi_scale_3d.png"),
};

/** How big a tile's picture is drawn. */
const ART_SIZE = 56;

/** One figure's tile: half the card's width, solid white, its art in the corner. */
function Tile({
  art,
  width,
  children,
}: {
  art: ImageSourcePropType;
  width: number | "48.5%";
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        width,
        padding: SPACE.md,
        gap: 2,
        borderRadius: RADIUS.lg,
        // Solid white, each figure its own box on the glass pane — with a
        // hairline and a soft lift, so it reads as a card even where the
        // page behind the glass is white as well.
        backgroundColor: "#FFFFFF",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(0,0,0,0.08)",
        boxShadow: shadow({ blur: 8, y: 2, opacity: 0.08 }),
      }}
    >
      {/* Clipped in a layer of its own, so the tile keeps its shadow. */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
        }}
      >
        <Image
          source={art}
          resizeMode="contain"
          accessibilityRole="none"
          style={{
            position: "absolute",
            bottom: -6,
            right: -4,
            width: ART_SIZE,
            height: ART_SIZE,
          }}
        />
        {/* Its foot dissolving into the tile, as the BMI card's scale does
            on the profile: a picture set into the card, not stuck on. */}
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.7)", "#FFFFFF"]}
          locations={[0, 0.5, 1]}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: ART_SIZE + 10,
            // Over most of the picture, so only its top stands clear.
            height: ART_SIZE * 0.85,
          }}
        />
      </View>
      {children}
    </View>
  );
}
