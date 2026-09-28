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
import { Floating } from "../components/BlurStage";
import { Glass } from "../components/Glass";
import { LivingGradient } from "../components/LivingGradient";
import { ToolbarPill } from "../components/ToolbarPill";
import { PressableScale } from "../components/PressableScale";
import { toast } from "../components/Toast";
import {
  activitiesOf,
  isToday,
  useSession,
  type ActivityKind,
} from "../models/vaccination";
import { useStillOpen } from "../models/vaccineHistory";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  DANGER_INK,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  shadow,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Service = {
  title: string;
  subtitle: string;
  /** The service's own artwork, in place of a glyph. Every service has one. */
  image: ImageSourcePropType;
  route?: keyof RootStackParamList;
  /**
   * Which kind of group work this service is, where it is one.
   *
   * Carries two things at once and deliberately: it is the parameter the
   * activities screen is opened with, and it is what the tile counts its
   * own day's work by. Held as one field so the badge on a card and the
   * list behind it can never be about different services.
   */
  kind?: ActivityKind;
  /**
   * What the route needs, where it needs anything.
   *
   * The three kinds of group work share one screen and differ only by which
   * kind it is showing, so the card carries the kind rather than the app
   * carrying three near-identical screens.
   */
  params?: object;
};

const HOME_VISIT: Service[] = [
  {
    title: "ส่งเวชภัณฑ์และยา",
    subtitle: "ติดตามจัดส่งยาถึงบ้านผู้ป่วย",
    image: require("../../assets/services/medicine.png"),
    route: "Supplies",
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
    route: "CareActivities",
    kind: "dental",
  },
  {
    title: "วัคซีนโรงเรียน",
    subtitle: "บริการฉีดวัคซีนสร้างภูมิคุ้มกัน",
    image: require("../../assets/services/vaccine.png"),
    route: "CareActivities",
    kind: "vaccination",
  },
  {
    title: "ตรวจสุขภาพนักเรียน",
    subtitle: "วัดน้ำหนัก ส่วนสูง และภาวะโภชนาการ",
    image: require("../../assets/services/checkup.png"),
    route: "CareActivities",
    kind: "schoolHealth",
  },
  {
    // "คัดกรองพัฒนาการเด็กก่อนวัยเรียน" beside "วัคซีนโรงเรียน" and
    // "ตรวจสุขภาพนักเรียน": twice the length of either, wrapping to two
    // lines while its neighbours sit on one. Who it is for belongs on the
    // line under it, which is what that line is for.
    title: "คัดกรองเด็กเล็ก",
    subtitle: "ประเมินพัฒนาการ 5 ด้าน ในเด็กก่อนวัยเรียน",
    image: require("../../assets/services/screening.png"),
    route: "CareActivities",
    kind: "screening",
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

        Lifted off the page on Android, as the home screen's is, so the pill
        blurs the cards that scroll under it; see `Floating`.
      */}
      <Floating>
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
          <Text
            style={{
              flex: 1,
              fontSize: 24,
              fontWeight: "700",
              color: TEXT_PRIMARY,
            }}
          >
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
                onPress: () => nav.navigate("Notifications"),
              },
            ]}
          />
        </View>
      </Floating>
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
        // Figma's blur is a diameter; RN's radius is half of it.
        boxShadow: shadow({ blur: 20, y: 8, opacity: 0.12 }),
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
  /*
    How much of this service is due today.

    Counted the same way the activities page counts it — a sitting already
    under way is today's whatever it is dated, because it is being done,
    and one closed and filed is not waiting any more — so the number on the
    tile is the number of cards behind it rather than a second opinion
    about the same day. The badge is red because it is work waiting; a
    finished morning shows none.
  */
  const { session } = useSession();
  const stillOpen = useStillOpen();
  const dueToday = (kind: ActivityKind) =>
    activitiesOf(kind).filter(
      (a) => (isToday(a) || session?.activity.id === a.id) && stillOpen(a),
    ).length;

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
          today={s.kind == null ? 0 : dueToday(s.kind)}
          onPress={() => {
            if (s.route == null) {
              toast("ยังไม่เปิดใช้งาน");
              return;
            }
            // Cast at the call, not in the type: the param list is a union
            // across every route, and a card holding one route's params
            // cannot be narrowed to it from here.
            const go = nav.navigate as (r: string, p?: object) => void;
            go(s.route, s.kind == null ? s.params : { kind: s.kind });
          }}
        />
      ))}
    </View>
  );
}

function ServiceCard({
  service,
  today,
  onPress,
}: {
  service: Service;
  /** How many sittings of this service are due today. Nought shows nothing. */
  today: number;
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
      {/*
        The artwork, and what is waiting behind it.

        A carer opens this page in the morning to decide where to go, and
        the tiles all looked identical whether the service had five sittings
        today or none — so the decision was made by tapping into each of
        them in turn. The count is the whole of that decision, said once.

        Nothing where there is nothing: a "0" on every service that has no
        work today is four more things to read past on the way to the one
        that does.
      */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <Image
          source={service.image}
          style={{ width: 48, height: 48 }}
          resizeMode="contain"
        />
        {today > 0 && (
          /*
            A numeral and nothing else, in the app's red.

            "วันนี้ 5" was a sentence on a tile that already has two lines of
            them; what the eye is actually reading off this page is which
            number is biggest. Red because it is a count of work waiting
            rather than a fact about the service — the same red the bell
            carries on the home page, and the same shape.

            Held to a minimum width so a 1 and a 10 are the same size of
            thing: badges that grow with their digits make five services
            look like five different kinds of badge.
          */
          <Glass
            tintColor="rgba(255,56,60,0.16)"
            style={{
              marginTop: 2,
              minWidth: 24,
              height: 24,
              paddingHorizontal: 6,
              borderRadius: RADIUS.capsule,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: DANGER_INK,
                fontVariant: ["tabular-nums"],
              }}
            >
              {today}
            </Text>
          </Glass>
        )}
      </View>

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
