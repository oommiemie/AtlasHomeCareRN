import {
  Image,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Bell, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTabBarInset } from "../utils/useTabBarInset";
import { Card } from "../components/Card";
import { LivingGradient } from "../components/LivingGradient";
import { ToolbarPill } from "../components/ToolbarPill";
import { PressableScale } from "../components/PressableScale";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Service = {
  title: string;
  subtitle: string;
  /** The service's own picture, in place of a glyph. */
  image: ImageSourcePropType;
  route?: keyof RootStackParamList;
};

const HOME_VISIT: Service[] = [
  {
    title: "ส่งเวชภัณฑ์และยา",
    subtitle: "ติดตามจัดส่งยาถึงบ้านผู้ป่วย",
    image: require("../../assets/services/medicine.png"),
  },
  {
    title: "ติดตามสุขภาพ",
    subtitle: "เฝ้าระวังข้อมูลสุขภาพ",
    image: require("../../assets/services/health.png"),
    route: "FollowUp",
  },
  {
    title: "บ้านที่ดูแล",
    subtitle: "ข้อมูลสิ่งแวดล้อมของผู้ป่วย",
    image: require("../../assets/services/houses.png"),
    route: "Houses",
  },
];

const SCHOOL: Service[] = [
  {
    title: "ทันตสุขภาพในโรงเรียน",
    subtitle: "กิจกรรมตรวจสุขภาพช่องปาก",
    image: require("../../assets/services/dental.png"),
  },
  {
    title: "วัคซีนโรงเรียน",
    subtitle: "บริการฉีดวัคซีนสร้างภูมิคุ้มกัน",
    image: require("../../assets/services/vaccine.png"),
  },
];

/** "บริการ" — the work this carer can start, grouped by the kind of visit. */
export function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const nav = useNavigation<Nav>();

  return (
    <View style={{ flex: 1 }}>
      <LivingGradient height={insets.top + 288} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          // Clears the floating header below.
          paddingTop: insets.top + 64,
          paddingBottom: tabBar + SPACE.xxxl,
          gap: SPACE.lg,
        }}
      >
        <CommunityCard onPress={() => nav.navigate("CardReader")} />

        <SectionTitle label="งานเยี่ยมบ้าน" />
        <Grid items={HOME_VISIT} nav={nav} />

        <SectionTitle label="งานอนามัยโรงเรียน" />
        <Grid items={SCHOOL} nav={nav} />
      </ScrollView>

      {/*
        Title and toolbar over the wash, the way the plan and home screens
        carry theirs — this screen had a plain heading scrolling with its
        content and no toolbar at all, which made it the odd one of the four
        tabs.
      */}
      <View
        style={{
          position: "absolute",
          top: insets.top + SPACE.sm,
          left: SPACE.lg,
          right: SPACE.lg,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Text style={{ flex: 1, fontSize: 24, fontWeight: "700", color: TEXT_PRIMARY }}>
          บริการ
        </Text>
        <ToolbarPill
          slots={[
            {
              icon: <Search size={20} color={TEXT_PRIMARY} />,
              label: "ค้นหา",
              onPress: () => nav.navigate("Spotlight"),
            },
            {
              icon: <Bell size={20} color={TEXT_PRIMARY} />,
              label: "การแจ้งเตือน",
              onPress: () => toast("การแจ้งเตือนยังไม่เปิดใช้งาน"),
            },
          ]}
        />
      </View>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    // 16 Medium on #111111, per the design's section headers — a step
    // lighter than the card titles beneath them, which are SemiBold.
    <Text style={{ fontSize: 16, fontWeight: "500", color: TEXT_PRIMARY }}>
      {label}
    </Text>
  );
}

/** The community card's own geometry — Figma 84:9869. */
const COMMUNITY = {
  /*
    A fifth bigger than the design's 103, and the illustration with it.

    The card is the page's lead and at 103 it was barely taller than the tiles
    in the grid under it, which is the one thing a lead must not be. Both
    numbers are scaled together so the composition holds: the picture still
    hangs the same share past the foot, and the ribbon behind it is already
    far larger than the card and needs no change.

    The artwork is exported at exactly 101 by 100, so this is a 1.2x upscale
    of it. A 3D render carries that — the shading is soft and there is no fine
    detail to lose — but it is the ceiling. Bigger than this wants a bigger
    export, not a bigger number.
  */
  height: 124,
  radius: 24,
  padLeft: 16,
  /** The illustration, anchored to the top-right and clipped at the bottom. */
  art: { width: 121, height: 120, top: 19, right: 24 },
  /**
   * The ribbon watermark.
   *
   * The design gives it as a 389x350 box, but that is the bounding box of a
   * rect turned -60deg (Figma's `rotation`, counter-clockwise). Solving
   * w|cos|+h|sin| and w|sin|+h|cos| for 60deg gives the real rect: 217x324 —
   * the ribbon's own aspect, so `FILL` crops nothing and the picture is
   * simply the whole ribbon, tilted.
   *
   * Offsets are pre-transform, the way RN lays out before rotating, and are
   * anchored to the right so the crossing keeps its place beside the
   * illustration on a screen narrower than the design's 440.
   *
   * The sweep is then mirrored, so it runs the other way across the card
   * than the design does.
   */
  ribbon: { width: 217, height: 324, right: 69, top: -101.5, angle: "60deg" },
} as const;

/**
 * The community-work card — the page's lead (Figma 84:9869).
 *
 * White like every other card, but not the same weight: full width, a fixed
 * 103pt band, and a wide soft shadow, so it reads as the heading of the page
 * rather than one more item in the grid below.
 *
 * Two pictures do the rest. The ribbon is a watermark at a tenth opacity,
 * far larger than the card and deliberately hanging off both its top and
 * its right — the card clips it to a sweep. The illustration is anchored
 * top-right and runs past the bottom edge, so it reads as sitting in the
 * card rather than being framed by it. Both depend on the clip, so the
 * shadow has to live on the wrapper: a view with `overflow: hidden` loses
 * its own.
 */
function CommunityCard({ onPress }: { onPress: () => void }) {
  return (
    <View
      style={{
        borderRadius: COMMUNITY.radius,
        shadowColor: "#000000",
        shadowOpacity: 0.12,
        // Figma's blur is a diameter; RN's radius is half of it.
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="บริการงานชุมชน"
        style={{
          height: COMMUNITY.height,
          borderRadius: COMMUNITY.radius,
          overflow: "hidden",
          backgroundColor: SURFACE,
          justifyContent: "center",
          paddingLeft: COMMUNITY.padLeft,
          // Room for the illustration on the right.
          paddingRight: COMMUNITY.art.width + COMMUNITY.art.right,
        }}
      >
        <Image
          source={require("../../assets/images/community_ribbon.png")}
          style={{
            position: "absolute",
            right: COMMUNITY.ribbon.right,
            top: COMMUNITY.ribbon.top,
            width: COMMUNITY.ribbon.width,
            height: COMMUNITY.ribbon.height,
            opacity: 0.1,
            // Read right to left: the tilt is applied first, then the whole
            // sweep is flipped, so it leans the other way.
            transform: [{ scaleX: -1 }, { rotate: COMMUNITY.ribbon.angle }],
          }}
          resizeMode="contain"
        />

        <Image
          source={require("../../assets/images/community_art.png")}
          style={{
            position: "absolute",
            right: COMMUNITY.art.right,
            top: COMMUNITY.art.top,
            width: COMMUNITY.art.width,
            height: COMMUNITY.art.height,
          }}
          resizeMode="cover"
        />

        <Text
          numberOfLines={1}
          style={{ fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY }}
        >
          บริการงานชุมชน
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 12,
            lineHeight: 20,
            color: TEXT_MUTED,
          }}
        >
          {"บันทึกเยี่ยมบ้าน คัดกรองความเสี่ยง\nและประสานงานดูแลผู้ป่วยในชุมชน"}
        </Text>
      </PressableScale>
    </View>
  );
}

/**
 * A real wrapping grid, two columns wide — the design's own `layoutMode:
 * GRID` (84:9454).
 *
 * Cards are given a width of just under half and allowed to wrap, rather
 * than being chunked into rows of two by hand with a blank filler beside an
 * odd last one. That filler was what left "บ้านที่ดูแล" alone in a row with
 * nothing to be stretched against, so it stood at a different height from
 * the pair above it.
 */
function Grid({ items, nav }: { items: Service[]; nav: Nav }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        // 10 between the columns and between the rows, per the design's
        // 408-wide grid of two 199 cards.
        gap: 10,
      }}
    >
      {items.map((s) => (
        <ServiceCard
          key={s.title}
          service={s}
          onPress={() =>
            s.route ? nav.navigate(s.route as never) : toast("ยังไม่เปิดใช้งาน")
          }
        />
      ))}
    </View>
  );
}

function ServiceCard({
  service,
  onPress,
}: {
  service: Service;
  onPress: () => void;
}) {
  return (
    // minWidth 0 alongside the flex: Thai runs without spaces between
    // words, so a name like "ทันตสุขภาพในโรงเรียน" has no break the layout
    // can take and its intrinsic width pushed the card past its half of the
    // row. Allowed to shrink below its content, every card keeps the same
    // width and the text wraps inside it.
    <Card
      onPress={onPress}
      accessibilityLabel={service.title}
      style={{
        // Just under half, so two sit in a row with the gap between them.
        // A width rather than a flex: wrapped children cannot be flexed
        // into equal columns, they have to be sized.
        width: "48.5%",
        padding: SPACE.lg,
      }}
    >
      {/* The picture stands on its own, with no tinted tile behind it: the
          artwork carries its own colour and a plate under it would fight
          for the same job. */}
      <Image
        source={service.image}
        style={{ width: 48, height: 48 }}
        resizeMode="contain"
      />

      {/*
        No reserved lines and no minimum: the card is as tall as what is in
        it.

        Cards that share a wrapped row still come out level — a row stretches
        its children to the tallest of them — so the grid stays even without
        padding every card out to the size of the wordiest one.
      */}
      <Text
        numberOfLines={2}
        style={{
          marginTop: SPACE.sm,
          // 14/600, the size every other card title in the app uses for its
          // heading — the design's 16 was a step above the rest of them and
          // made these cards read as more important than the task cards
          // they sit alongside.
          fontSize: 14,
          fontWeight: "600",
          color: TEXT_PRIMARY,
          // Thai ascenders and tone marks overrun a tight line box.
          lineHeight: 20,
        }}
      >
        {service.title}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          marginTop: 0,
          fontSize: 12,
          lineHeight: 20,
          color: TEXT_MUTED,
        }}
      >
        {service.subtitle}
      </Text>
    </Card>
  );
}
