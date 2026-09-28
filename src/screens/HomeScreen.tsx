import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { MapView, PROVIDER_DEFAULT } from "../components/Map";
import {
  Bell,
  Calendar,
  CalendarCheck,
  SlidersHorizontal,
  User,
} from "lucide-react-native";

import { useHere } from "../utils/useHere";
import { useTabBarInset } from "../utils/useTabBarInset";
import { Glass } from "../components/Glass";
import { Card } from "../components/Card";
import { BlurBackdrop, Floating } from "../components/BlurStage";
import { LivingGradient } from "../components/LivingGradient";
import { PressableScale } from "../components/PressableScale";
import { SectionHeader } from "../components/SectionHeader";
import { ShortcutRow } from "../components/ShortcutRow";
import {
  TaskPostingCard,
  POSTING_CARD_HEIGHT,
} from "../components/TaskPostingCard";
import { ToolbarPill } from "../components/ToolbarPill";
import { UserPhoto } from "../components/UserPhoto";
import { UIcon } from "../components/UIcon";
import { ActivityCard } from "../components/ActivityCard";
import { VisitCard } from "../components/VisitCard";
import type { RootStackParamList } from "../navigation/RootStack";
import { givenNameOf, useSession } from "../models/session";
import { useUnreadCount } from "../models/notifications";
import { openTask } from "../navigation/openTask";
import { DaySummary, type KindCount } from "../components/DaySummary";
import { useStillOpen } from "../models/vaccineHistory";
import { SERVICE_TONE } from "../theme/serviceTone";
import {
  activitiesOf,
  isOpen,
  isToday,
  tally,
  // Aliased: this screen already has a `useSession` — the carer's login —
  // and the two are nothing to do with each other.
  useSession as useSitting,
  type Activity,
  type ActivityKind,
} from "../models/vaccination";
import {
  CAROUSEL_LIMIT,
  isDone,
  planToday,
  sampleTasks,
  todayTasks,
} from "../models/task";
import { thaiShortDate } from "../utils/thaiDate";
import {
  CANVAS,
  CANVAS_CLEAR,
  DANGER,
  PANEL,
  PLATE,
  PRIMARY_100,
  PRIMARY_500,
  TONE_INK,
  type PanelTone,
  RADIUS,
  RIM_LIT,
  SEPARATOR,
  SPACE,
  SURFACE,
  SURFACE_SUNK,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  currentTheme,
  shadow,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The greeting uses the given name alone.
 *
 * A surname in a hello reads as an announcement rather than a greeting, and
 * the line already competes for width with the toolbar pill beside it. The
 * profile page still carries the full name, which is where it belongs.
 */

/** "วันนี้" — the carer's day at a glance. */
export function HomeScreen() {
  const me = useSession();
  const unread = useUnreadCount();
  const { here } = useHere();

  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const nav = useNavigation<Nav>();

  const { width } = useWindowDimensions();

  /*
    The day's group work, alongside the day's visits.

    A carer's morning is not only houses: they are also due at a school
    with a vial, or at a ศพด. with a scale. Those lived one tab away on the
    services page, so the one screen that claims to say what today holds
    said two thirds of it — somebody who opened the app and saw two visits
    walked out without knowing about the fifty children waiting at nine.

    A sitting already under way counts as today's whatever it is dated: it
    is being done, which is what today's work means.
  */
  const { session: sitting } = useSitting();
  const groups = useMemo(() => {
    const live = (a: Activity) => sitting?.activity.id === a.id;
    return [
      ...activitiesOf("vaccination"),
      ...activitiesOf("schoolHealth"),
      ...activitiesOf("screening"),
      // ทันตกรรม stays off until the service is switched on, as it does on
      // the summary card below.
    ]
      .filter((a) => isToday(a) || live(a))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [sitting]);

  const all = todayTasks();
  const visitsDone = all.filter(isDone).length;

  /*
    The group work, split by the service it belongs to.

    The summary card used to count houses. It is the first thing on the
    home page and it said "งานทั้งหมด 2" over a page that then listed two
    visits AND eight sittings — a figure that was true of a third of the
    day and read as the whole of it. Counting the sittings in as well fixed
    the arithmetic and left the same mistake one level down: a vaccination
    round, a weighing round and a screening round are three services with
    three registers and three sets of equipment, and a carer who is behind
    is behind on ONE of them. So each keeps its own count and its own ring,
    in the order the services are listed everywhere else in the app.

    A sitting counts as finished when it has been closed and filed, which
    is the same test the history is keyed by: nothing reaches the history
    until ปิดงาน, so a half-worked roster is still outstanding, which is
    what a carer looking at this card needs it to say.
  */
  const stillOpen = useStillOpen();
  const kinds: KindCount[] = useMemo(() => {
    return (
      [
        {
          kind: "vaccination" as const,
          label: "วัคซีน",
          tone: SERVICE_TONE.vaccination,
        },
        {
          kind: "schoolHealth" as const,
          label: "ตรวจสุขภาพ",
          tone: SERVICE_TONE.schoolHealth,
        },
        {
          kind: "screening" as const,
          label: "พัฒนาการ",
          tone: SERVICE_TONE.screening,
        },
        // ทันตกรรม is left off until the dental service is switched on: a
        // ring that always reads 0/0 is a service that looks broken.
      ] satisfies { kind: ActivityKind; label: string; tone: PanelTone }[]
    ).map((s) => {
      const mine = groups.filter((a) => a.kind === s.kind);
      return {
        label: s.label,
        done: mine.filter((a) => !stillOpen(a)).length,
        total: mine.length,
        ink: TONE_INK[s.tone],
      };
    });
  }, [groups, stillOpen]);

  /*
    What the list under "ภารกิจวันนี้" holds: only the work still
    to do, or under way.

    The heading promises what is outstanding, and the summary card above
    already counts what is finished. A visit done at nine, or a sitting
    closed and filed, left a card in the list that the carer scrolled past
    on the way to the next job, and made the figure beside the heading
    count work that was over. Finished work leaves the list; the plan tab
    still has the whole day.

    The list used to carry a filter (ทั้งหมด · รอดำเนินการ · เสร็จแล้ว).
    With the finished work gone it had nothing left to split: every visit
    here is today's and not yet done, which is all "รอดำเนินการ" meant.
  */
  const todo = all.filter((t) => !isDone(t));
  const openGroups = groups.filter(stillOpen);
  /** Whether today had work at all, so an empty list can say why it is. */
  const hadWork = all.length + groups.length > 0;

  const postings = sampleTasks.slice(0, CAROUSEL_LIMIT);
  /**
   * A card and the gap after it — the distance one page of the carousel
   * moves. Narrow enough that the cards either side show at the edges: a
   * row where one card fills the screen reads as a single card, and gives
   * no sign there is anything to swipe to.
   */
  const cardWidth = width * 0.78;
  const pageWidth = cardWidth + SPACE.md;
  /** What is left at each edge, so the neighbours peek by the same amount. */
  const peek = (width - cardWidth) / 2;

  /**
   * The postings turn, a page at a time, and never run out.
   *
   * The row is drawn three times and the carer is kept in the middle copy:
   * whenever the scroll leaves it — dragged forward past the end or back
   * past the start — the offset is moved a whole copy without animation.
   * The picture is identical either side of that move, so there is no seam
   * and no edge to hit: forwards or backwards, there is always another
   * card, and the auto-advance never reaches a stop.
   */
  const carousel = useRef<ScrollView>(null);
  const span = postings.length * pageWidth;
  // The header gradient, named so the summary frame can blur it.
  const ground = useRef<View | null>(null);
  const held = useRef(false);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Where the row actually is, kept in step with both hands and timer. */
  const at = useRef(span);

  /** Bring the offset back into the middle copy, invisibly. */
  const recentre = (x: number) => {
    if (span <= 0) return x;
    let next = x;
    if (x >= span * 2) next = x - span;
    else if (x < span) next = x + span;
    if (next !== x) carousel.current?.scrollTo({ x: next, animated: false });
    return next;
  };

  useEffect(() => {
    if (postings.length < 2) return;
    const id = setInterval(() => {
      if (held.current) return;
      const next = at.current + pageWidth;
      at.current = next;
      carousel.current?.scrollTo({ x: next, animated: true });
      // Once the slide has landed, step back a copy if it left the middle.
      setTimeout(() => {
        if (!held.current) at.current = recentre(at.current);
      }, 450);
      // Long enough to read a posting before the next one arrives: the
      // card carries a name, a job and a date, and five seconds is about
      // what that takes at a glance.
    }, 5500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postings.length, pageWidth, span]);

  const hold = () => {
    held.current = true;
    if (resume.current != null) clearTimeout(resume.current);
  };
  const release = () => {
    if (resume.current != null) clearTimeout(resume.current);
    resume.current = setTimeout(() => {
      held.current = false;
    }, 4000);
  };
  useEffect(
    () => () => {
      if (resume.current != null) clearTimeout(resume.current);
    },
    [],
  );

  return (
    // The gradient as the page's ground, so the day's summary frame can blur
    // it on Android as it does on iOS. See `BlurBackdrop`.
    <BlurBackdrop ground={<LivingGradient height={288} />} target={ground}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SPACE.sm,
          paddingBottom: 0,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting. The right inset clears the toolbar pill. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: SPACE.lg,
            // Clears the two-slot pill, now that the assistant lives in it.
            paddingRight: 144,
          }}
        >
          {/* The carer's own photograph, in a white rim — and whichever
              one they have set on the profile page, not the stand-in. */}
          <UserPhoto size={52} ring="rgba(255,255,255,0.85)" />
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            {/* The facility signed in under, not a fixed name: a carer
                attached to two of them was greeted by whichever one this
                line happened to have been written with. */}
            <Text numberOfLines={1} style={{ fontSize: 14, color: "#FFFFFF" }}>
              {me.facility?.name ?? "ยังไม่ได้เลือกสถานพยาบาล"}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}
            >
              {`สวัสดี, คุณ${givenNameOf(me.displayName)}`}
            </Text>
          </View>
        </View>

        <View style={{ height: SPACE.lg }} />

        <View style={{ height: SPACE.lg }} />

        <DaySummary
          blurTarget={ground}
          date={thaiShortDate(planToday)}
          visits={{
            total: all.length,
            todo: all.length - visitsDone,
            done: visitsDone,
          }}
          kinds={kinds}
        />

        <View style={{ height: SPACE.lg }} />

        {/* The carer's own first moves, under the figures they are the
            answer to: the day's counts say what is left, and this row is
            where a carer goes to do something about it. */}
        <ShortcutRow />

        <View style={{ height: SPACE.xxl }} />

        {/* Open postings. */}
        <SectionHeader
          title="ภารกิจใหม่รอรับงาน"
          count={sampleTasks.length}
          trailingLabel="เพิ่มเติม"
          onTrailing={() => nav.navigate("TaskList")}
        />
        <View style={{ height: SPACE.md }} />
        <ScrollView
          ref={carousel}
          horizontal
          showsHorizontalScrollIndicator={false}
          // A page at a time, under the finger as well as on its own.
          snapToInterval={pageWidth}
          disableIntervalMomentum
          decelerationRate="fast"
          // Padded by the peek on both ends, so the first and last card
          // rest in the middle the way every other one does.
          contentContainerStyle={{ paddingHorizontal: peek - SPACE.md / 2 }}
          // A hand on the cards stops the timer: a carousel that moves on
          // while somebody is reading it takes the card out from under them.
          onScrollBeginDrag={hold}
          onScrollEndDrag={(e) => {
            at.current = e.nativeEvent.contentOffset.x;
            release();
          }}
          // Start in the middle copy, so there is as much row behind as
          // there is ahead.
          contentOffset={{ x: span, y: 0 }}
          onMomentumScrollEnd={(e) => {
            at.current = recentre(e.nativeEvent.contentOffset.x);
            release();
          }}
        >
          {[...postings, ...postings, ...postings].map((t, i) => {
            const open = () => openTask(nav, t);
            return (
              <View
                key={`${t.id}-${i}`}
                style={{
                  width: cardWidth,
                  height: POSTING_CARD_HEIGHT,
                  marginHorizontal: SPACE.md / 2,
                }}
              >
                <TaskPostingCard task={t} onPress={open} onAccept={open} />
              </View>
            );
          })}
        </ScrollView>

        <View style={{ height: SPACE.xxl }} />

        {/* Today's accepted work, on a sheet of the page's own ground. */}
        <View
          style={{
            backgroundColor: CANVAS,
            borderTopLeftRadius: 36,
            borderTopRightRadius: 36,
            borderTopWidth: 1,
            borderTopColor: RIM_LIT,
            padding: SPACE.lg,
            paddingBottom: tabBar + SPACE.xxxl,
          }}
        >
          <SectionHeader
            title="ภารกิจวันนี้"
            count={todo.length + openGroups.length}
            flush
          />

          <View style={{ height: SPACE.md }} />
          <MapCard onPress={() => nav.navigate("ExploreMap")} here={here} />
          <View style={{ height: SPACE.md }} />

          {/* Nothing left: said as a day finished when there was work, so
              an empty list after a full morning reads as done, not as a
              day that never had anything in it. */}
          {todo.length === 0 && openGroups.length === 0 && (
            <View
              style={{
                paddingVertical: SPACE.xxxl,
                alignItems: "center",
                backgroundColor: SURFACE_SUNK,
                borderRadius: RADIUS.card,
              }}
            >
              {hadWork ? (
                <CalendarCheck size={28} color={TEXT_DISABLED} />
              ) : (
                <Calendar size={28} color={TEXT_DISABLED} />
              )}
              <Text
                style={{
                  marginTop: SPACE.md,
                  fontSize: 14,
                  color: TEXT_SECONDARY,
                  textAlign: "center",
                }}
              >
                {hadWork
                  ? "ภารกิจวันนี้เสร็จครบแล้ว"
                  : "วันนี้คุณไม่มีภารกิจที่ต้องทำ"}
              </Text>
            </View>
          )}

          {todo.length > 0 && (
            <View style={{ gap: SPACE.md }}>
              {todo.map((t) => (
                <VisitCard
                  key={t.id}
                  task={t}
                  now={planToday}
                  onPress={() => openTask(nav, t)}
                />
              ))}
            </View>
          )}

          {/*
            And the group work, under the visits rather than mixed into
            them.

            Two different shapes of job: a visit is one person at one house
            and a sitting is a room of fifty, and the cards say so — one
            leads with a name and the other with a class and a count. A
            sitting closed and filed has left, as a finished visit has.
          */}
          {openGroups.length > 0 && (
            <View
              style={{
                gap: SPACE.md,
                marginTop: todo.length > 0 ? SPACE.md : 0,
              }}
            >
              <SectionHeader
                title="งานกลุ่มวันนี้"
                count={openGroups.length}
                flush
              />
              {openGroups.map((a) => {
                const live =
                  sitting != null && sitting.activity.id === a.id
                    ? tally(sitting)
                    : null;
                return (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    progress={
                      live == null
                        ? undefined
                        : { done: live.recorded, total: live.targets }
                    }
                    onPress={() =>
                      isOpen(a.id)
                        ? nav.navigate("VaccineSession")
                        : nav.navigate("OpenVaccineSession", {
                            activityId: a.id,
                          })
                    }
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* The assistant and notifications, in the one pill. The assistant
          took the slot search had: what a carer reaches for up here is
          the helper, and the search lives on in the plan and list pages
          that have something to search. Lifted off the page on Android so
          its glass blurs what scrolls under it; see `Floating`. */}
      <Floating>
        <View
          style={{
            position: "absolute",
            top: insets.top + SPACE.sm,
            right: SPACE.lg,
          }}
        >
          <ToolbarPill
            slots={[
              {
                icon: <UIcon name="sparkles" size={20} color={TEXT_PRIMARY} />,
                label: "ผู้ช่วย AI",
                onPress: () => nav.navigate("Assistant"),
              },
              {
                icon: (
                  <View>
                    <Bell size={20} color={TEXT_PRIMARY} />
                    {/* The count, as a dot on the bell: a number small enough
                      to sit there is too small to read, and what the carer
                      needs to know is that there is something. */}
                    {unread > 0 && (
                      <View
                        style={{
                          position: "absolute",
                          top: -2,
                          right: -2,
                          width: 9,
                          height: 9,
                          borderRadius: 4.5,
                          backgroundColor: DANGER,
                          borderWidth: 1.5,
                          // The ring knocks the dot out of whatever is behind
                          // it, so it is the page's own ground, not white.
                          borderColor: SURFACE,
                        }}
                      />
                    )}
                  </View>
                ),
                label:
                  unread > 0
                    ? `การแจ้งเตือน ${unread} รายการใหม่`
                    : "การแจ้งเตือน",
                onPress: () => nav.navigate("Notifications"),
              },
            ]}
          />
        </View>
      </Floating>
    </BlurBackdrop>
  );
}

/** How much ground the card shows, in degrees. */
const SPAN = 0.012;

/**
 * Where the user dot sits across the card, as a fraction of its width.
 *
 * 0.78 keeps it clearly in the right-hand third — past the white wash and
 * the label — with room left before the marker would touch the edge.
 */
const DOT_ACROSS = 0.78;

/** A glance at the day's map, washed out so the text stays legible. */
function MapCard({
  onPress,
  here,
}: {
  onPress: () => void;
  here: { latitude: number; longitude: number };
}) {
  // Handed down from the screen, so the fix is requested once rather than
  // once per component that wants it.
  // The card's own width, not the screen's: it sits inside the page padding.
  const [width, setWidth] = useState(0);

  return (
    // The shadow rides on a wrapper, not on the card: the card clips to its
    // rounded corners with overflow "hidden" so the map cannot spill out,
    // and that would cut its own shadow away with it.
    //
    // Same values as an elevated VisitCard, so the two sit on one plane.
    <View
      style={{
        borderRadius: RADIUS.card,
        boxShadow: shadow({ blur: 8, y: 2, opacity: 0.08 }),
      }}
    >
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="สำรวจพื้นที่เยี่ยมบ้าน"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: 100,
          borderRadius: RADIUS.card,
          overflow: "hidden",
          backgroundColor: SURFACE,
        }}
      >
        {/*
        A live map rather than a screenshot, centred on where you actually
        are: the card invites you to go and look at the area, so showing
        somebody else's streets undercut it.

        Non-interactive — the whole card is one button, and a map that
        panned under the finger would swallow the tap.
      */}
        <MapView
          userInterfaceStyle={currentTheme()}
          provider={PROVIDER_DEFAULT}
          // Drawn wider than the card and overhanging the RIGHT edge, so the
          // map's centre — where the user dot sits — lands on the right of the
          // card, clear of the white wash and the label on the left.
          //
          // Overhanging the left does the opposite: the map then spans
          // [-N, W] and its centre falls at (W - N) / 2, which pushed the dot
          // to about a tenth across, straight under the text.
          //
          // Offsetting the region's longitude instead does almost nothing
          // here: MapKit fits the region to the shorter side, and this card is
          // 100pt tall against ~330 wide, so the visible longitude span comes
          // out roughly three times the one asked for and a fraction-of-span
          // nudge lands nowhere near where the arithmetic says.
          style={{
            position: "absolute",
            left: 0,
            // Solved from the measured width rather than guessed: the map
            // spans [0, W + overhang] so its centre is at (W + overhang) / 2,
            // and setting that equal to DOT_ACROSS * W gives the overhang.
            right: -width * (2 * DOT_ACROSS - 1),
            top: 0,
            bottom: 0,
          }}
          region={{
            ...here,
            latitudeDelta: SPAN,
            longitudeDelta: SPAN,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          pointerEvents="none"
        />
        <LinearGradient
          // The card's own face across the front, then out to nothing.
          //
          // At 0.88 the leading edge was only near-solid, so the map's streets
          // showed faintly through the label and the card read as smudged
          // rather than as text on paper. The ramp now holds the full surface
          // to just past the text and spends the rest of the width fading.
          //
          // Surface tokens rather than white: on a dark ground a white ramp
          // would take the label with it.
          colors={[SURFACE, SURFACE, PLATE, CANVAS_CLEAR]}
          locations={[0, 0.46, 0.74, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: SPACE.lg,
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}
          >
            สำรวจพื้นที่เยี่ยมบ้าน
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: SPACE.sm,
              gap: SPACE.sm,
            }}
          >
            <Text style={{ fontSize: 14 }}>☀️</Text>
            <Text
              numberOfLines={2}
              style={{ flex: 1, fontSize: 12, color: TEXT_MUTED }}
            >
              วันนี้อากาศแจ่มใสเหมาะสำหรับทำภารกิจของคุณ
            </Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}
