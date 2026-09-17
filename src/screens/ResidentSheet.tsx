import { Image, Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { X } from "lucide-react-native";

import { Glass } from "../components/Glass";
import { BmiChart } from "../components/BmiGauge";
import { Card } from "../components/Card";
import { GlassIconButton } from "../components/GlassIconButton";
import { UIcon } from "../components/UIcon";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  bmiFraction,
  bmiHealthy,
  bmiLabel,
  bmiOf,
  initialOf,
  SCREENING_LABEL,
  type Resident,
  type Screening,
  type ScreeningKind,
} from "../models/household";
import { screeningStamp } from "../utils/thaiDate";
import {
  CANVAS,
  DANGER,
  PRIMARY_700,
  SEPARATOR,
  SPACE,
  SUCCESS,
  SURFACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

/** The design's spacing — Figma 101:15626. */
const SHEET = {
  /** Between the stacked cards. */
  gap: 10,
  /** Above the avatar, and again below the button row. */
  heroTop: 40,
  heroGap: 10,
  card: { radius: 24, pad: 16 },
  banner: { height: 102 },
} as const;

/**
 * One resident's health record — Figma 101:15626.
 *
 * Presented as a system sheet (see the route's `presentation: "modal"`), so
 * the page behind insets and scales back the way iOS does it — the sheet
 * itself draws no rounded corners or grabber, because UIKit supplies both.
 *
 * The three ways to reach this person are a row under their name rather than
 * two buttons buried in the phone card: they are what the record is opened
 * for, and there they were reachable only after reading past the number.
 */
export function ResidentSheet() {
  const { resident } = useRoute<RouteProp<RootStackParamList, "Resident">>().params;
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          paddingTop: SHEET.heroTop,
          paddingBottom: insets.bottom + SPACE.huge,
          gap: SHEET.gap,
        }}
      >
        <Hero resident={resident} />
        <Vitals resident={resident} />

        <Card style={{ padding: SHEET.card.pad }}>
          <Field label="เบอร์โทรศัพท์" value={resident.phone} />
          <View
            style={{
              height: 1,
              backgroundColor: SEPARATOR,
              marginVertical: SHEET.gap,
            }}
          />
          <Field label="โรคประจำตัว" value={conditionOf(resident)} />
        </Card>

        <Card>
          <BmiChart
            value={bmiOf(resident)}
            fraction={bmiFraction(resident)}
            label={bmiLabel(resident)}
            healthy={bmiHealthy(resident)}
            weightKg={resident.weightKg}
            heightCm={resident.heightCm}
          />
        </Card>

        {chunk(resident.screenings, 2).map((row, i) => (
          <View key={i} style={{ flexDirection: "row", gap: SHEET.gap }}>
            {row.map((s) => (
              <ScreeningCard key={s.name} screening={s} />
            ))}
            {row.length === 1 && <View style={{ flex: 1 }} />}
          </View>
        ))}
      </ScrollView>

      <View style={{ position: "absolute", top: SPACE.lg, left: SPACE.lg }}>
        <GlassIconButton onPress={() => nav.goBack()} accessibilityLabel="ปิด">
          <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
        </GlassIconButton>
      </View>
    </View>
  );
}

/**
 * The chronic conditions, read off the screenings rather than stored.
 *
 * A resident record has no condition field of its own; what it has is the
 * panel, and the ones that came back at risk are the answer to the question.
 * Derived, the two can never disagree.
 */
function conditionOf(r: Resident): string {
  const risky = r.screenings.filter((s) => s.status === "atRisk").map((s) => s.name);
  return risky.length ? risky.join(", ") : "ไม่มี";
}

function Hero({ resident }: { resident: Resident }) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: SHEET.heroGap,
        // The design leaves 16 under the row before the first card; the
        // scroll's own gap covers ten of it.
        marginBottom: SPACE.lg - SHEET.gap,
      }}
    >
      {/*
        The avatar on Apple's glass, tinted rather than filled — the same
        treatment as the accept-task hero. 0.95 is as saturated as the blue
        goes while the material still shows: the tint is painted OVER the
        glass, not mixed into it, so a full 1.0 leaves a flat disc.
      */}
      <Glass
        tintColor="rgba(0,145,255,0.95)"
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "600", color: "#FFFFFF" }}>
          {initialOf(resident.name)}
        </Text>
      </Glass>

      <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: "600", color: TEXT_PRIMARY }}>
        {resident.name}
      </Text>

      <View style={{ flexDirection: "row", gap: SHEET.gap }}>
        <GlassIconButton
          size={48}
          onPress={() =>
            Linking.openURL(`tel:${resident.phone}`).catch(() => toast("โทรออกไม่ได้"))
          }
          accessibilityLabel={`โทรหา ${resident.name}`}
        >
          <UIcon name="phoneFlip" size={20} color={PRIMARY_700} />
        </GlassIconButton>
        <GlassIconButton
          size={48}
          onPress={() => toast("วิดีโอคอลยังไม่เปิดใช้งาน")}
          accessibilityLabel={`วิดีโอคอล ${resident.name}`}
        >
          <UIcon name="videoCameraAlt" size={20} color={PRIMARY_700} />
        </GlassIconButton>
        <GlassIconButton
          size={48}
          onPress={() => toast("ข้อความยังไม่เปิดใช้งาน")}
          accessibilityLabel={`ส่งข้อความหา ${resident.name}`}
        >
          <UIcon name="comment" size={20} color={PRIMARY_700} />
        </GlassIconButton>
      </View>
    </View>
  );
}

/**
 * Age, sex and blood group — the three things about a resident that do not
 * change.
 *
 * Stated once, plainly, on white. The design puts them on a blue photograph
 * in white type, which needed a black wash laid over the artwork before the
 * type was legible at all; the picture was carrying no meaning to pay for
 * that. The layout underneath it — three equal columns, the name of the fact
 * over its value — is the design's, and is what survives here.
 */
function Vitals({ resident }: { resident: Resident }) {
  return (
    <View
      style={{
        height: SHEET.banner.height,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: SURFACE,
        borderRadius: SHEET.card.radius,
      }}
    >
      <Fact label="อายุ" value={`${resident.age} ปี`} />
      <Fact label="เพศ" value={resident.gender} />
      <Fact label="หมู่เลือด" value={resident.bloodType} />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{ fontSize: 16, lineHeight: 24, fontWeight: "600", color: TEXT_PRIMARY }}
      >
        {value}
      </Text>
    </View>
  );
}

/** A labelled line of the record. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>{label}</Text>
      <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: "600", color: TEXT_PRIMARY }}>
        {value}
      </Text>
    </View>
  );
}

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * The mark each screening carries — Figma 102:15785 and 102:15793.
 *
 * Looked up by the screening's kind rather than its Thai name: the name is
 * display text, and the first time it is translated a lookup keyed on it
 * would silently leave every card blank.
 */
const SCREENING_ART: Record<ScreeningKind, number> = {
  diabetes: require("../../assets/images/screening_diabetes.png"),
  pressure: require("../../assets/images/screening_pressure.png"),
  stroke: require("../../assets/images/screening_stroke.png"),
  obesity: require("../../assets/images/screening_obesity.png"),
};

/**
 * One screening. Green reads as settled, red as needing action; an
 * unassessed result is neither, so it stays grey rather than borrowing
 * either meaning.
 *
 * The mark sits at the right, clear of the three lines of text — the design
 * gives it 48pt against the card's trailing edge, where it identifies the
 * card without competing with the result for the first look.
 */
function ScreeningCard({ screening }: { screening: Screening }) {
  const ink =
    screening.status === "normal"
      ? SUCCESS
      : screening.status === "atRisk"
        ? DANGER
        : TEXT_DISABLED;

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: SURFACE,
        borderRadius: SHEET.card.radius,
        paddingHorizontal: SHEET.card.pad,
        paddingVertical: 13,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: SPACE.sm }}>
        <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
          {screening.name}
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: "600", color: ink }}>
          {SCREENING_LABEL[screening.status]}
        </Text>
        <Text style={{ fontSize: 10, lineHeight: 13, color: TEXT_MUTED }}>
          {screeningStamp(screening.takenAt)}
        </Text>
      </View>

      <Image
        source={SCREENING_ART[screening.kind]}
        style={{ width: 48, height: 48, marginLeft: SPACE.sm }}
        resizeMode="contain"
        accessibilityRole="none"
      />
    </View>
  );
}
