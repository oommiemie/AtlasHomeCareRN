import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CircleCheck, TriangleAlert } from "lucide-react-native";

import { ChoiceChip } from "../components/ChoiceChip";
import { ActionBar, PrimaryAction } from "../components/ActionBar";
import { Card } from "../components/Card";
import { TextField } from "../components/FormField";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import { planToday } from "../models/clock";
import { currentSession } from "../models/session";
import {
  ACTIVITIES,
  COURSES,
  LOTS,
  courseOf,
  lotsOf,
  openSession,
  type Lot,
  type VaccineKind,
} from "../models/vaccination";
import { startOfDay, thaiShortDate, thaiTime } from "../utils/thaiDate";
import { isEn, tr } from "../i18n";
import { FORM_MAX, readable, useLayout, GUTTER } from "../theme/layout";
import {
  DANGER_BG,
  DANGER_INK,
  INK_OK,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
  WARNING_BG,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Params = RouteProp<RootStackParamList, "OpenVaccineSession">;

const DAY_MS = 24 * 60 * 60 * 1000;

// dd/mm/yyyy, as the vial prints it — the Buddhist year in Thai.
const thaiExpiry = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + (isEn ? 0 : 543)}`;

/**
 * The details of the vial, entered once for the whole session.
 *
 * This is the screen the safety of everything after it rests on: fifty
 * records are about to be written from what is on it. So it is built around
 * one idea — there are exactly TWO things to decide here.
 *
 * The carer picks the vaccine, and types the lot number off the vial. The
 * maker, the expiry, the dose, the route and the site are looked up against
 * that lot, and the provider is whoever is signed in. An earlier version
 * drew all of those as grey rounded boxes, which is what this app draws
 * text fields as — so the page looked like a form with five things to fill
 * in, four of which could not be filled in at all. They are plain rows of
 * label and value now, and only the one thing that IS typed looks like a
 * field.
 *
 * The expiry is the one looked-up value that can be WRONG in a way that
 * matters, so it is checked here rather than sixty rows later: a lot that
 * has expired, or is about to, says so before the session opens.
 */
export function OpenVaccineSessionScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { width } = useLayout();
  const { activityId } = useRoute<Params>().params;
  const activity = ACTIVITIES.find((a) => a.id === activityId) ?? ACTIVITIES[0];
  const me = currentSession();

  /*
    Only an immunisation has a vial.

    A school health check and a nursery screening run this same four-step
    flow over the same roster, and there is nothing to pick for them: no
    vaccine, no lot, no dose. The page drops to the activity, the provider
    and the date, and the button opens straight away.
  */
  /*
    Whether there is a vial in this at all.

    Read off what the sitting RECORDS, not off which service it belongs to.
    The two lined up while immunisation was the only kind that gave anything
    out of a bottle, and they would come apart the moment a health check
    handed out vitamin A — the question this block asks is "is there a lot
    number", and `records` is the field that answers it.
  */
  const shots = activity.records === "dose";

  const [kind, setKind] = useState<VaccineKind>("MMR");
  const [typed, setTyped] = useState(lotsOf("MMR")[0]?.lot ?? "");

  /*
    The lot is typed, and then looked for.

    Typed because a batch that reached the fridge this morning is not in
    anybody's master data yet, and a carer holding it should not be stuck.
    Looked for because everything this app does to keep a session safe —
    which dose this is, whether the vial has expired — comes from the
    record behind the number. So the field takes anything, and the page
    says plainly whether what was typed is a batch it knows.
  */
  const lot: Lot | undefined = LOTS.find(
    (l) =>
      l.kind === kind && l.lot.toUpperCase() === typed.trim().toUpperCase(),
  );

  const pickKind = (next: VaccineKind) => {
    setKind(next);
    // The lot has to move with the vaccine: a DTP lot number under an MMR
    // heading is exactly the confusion this screen exists to prevent.
    setTyped(lotsOf(next)[0]?.lot ?? "");
  };

  const days =
    lot == null
      ? 0
      : Math.floor(
          (startOfDay(lot.expiresAt).getTime() -
            startOfDay(planToday).getTime()) /
            DAY_MS,
        );
  const expired = shots && lot != null && days < 0;
  const expiring = shots && lot != null && !expired && days <= 30;
  const dash = "—";

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={tr("เปิด Session", "Open session")} />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            ...readable(FORM_MAX),
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            // Clears the floating bar at the foot.
            paddingBottom: insets.bottom + 110,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
          // With the keyboard up, a tap on a suggested lot has to reach the
          // chip rather than being eaten dismissing the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Which sitting this is. It was nowhere on the page before, so a
              carer with two schools in a morning had to trust they had
              tapped the right card. */}
          <Card style={{ padding: SPACE.lg, gap: 2 }}>
            <Text
              style={{ fontSize: 17, fontWeight: "800", color: TEXT_PRIMARY }}
            >
              {activity.title}
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>
              {`${activity.place} · ${activity.group}`}
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_MUTED }}>
              {tr(
                `${thaiShortDate(activity.at)} · ${thaiTime(activity.at)} · ${activity.targets} คน`,
                `${thaiShortDate(activity.at)} · ${thaiTime(activity.at)} · ${activity.targets} people`,
              )}
            </Text>
          </Card>

          {/* The only two decisions on the page, in their own card so they
              read as the thing to do rather than as the top of a form. A
              sitting with no vial has neither of them. */}
          {shots && (
            <Card style={{ padding: SPACE.lg, gap: SPACE.md }}>
              <View style={{ gap: SPACE.sm }}>
                <Text
                  style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}
                >
                  {tr("วัคซีน", "Vaccine")}
                </Text>
                {/* Chips, each its own capsule — so a sixth vaccine is one more
                  chip on the next line rather than a segment squeezed out of
                  a track that has to hold them all in a row. */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: SPACE.sm,
                  }}
                >
                  {COURSES.map((c) => (
                    <Chip
                      key={c.kind}
                      label={c.kind}
                      on={c.kind === kind}
                      onPress={() => pickKind(c.kind)}
                    />
                  ))}
                </View>
              </View>

              {/*
              The app's own field, not one drawn here.

              Everything else typed into this app — a temperature, an
              address, a note — goes into the 48pt capsule from FormField,
              and a lot number drawn by hand a few points off was the only
              box in the app that was nearly but not quite it. The green
              tick is the one thing added: the five rows underneath fill
              themselves in from what is typed here, so it is worth saying
              plainly when the number found something.
            */}
              <TextField
                label={tr(
                  "Lot Number — อ่านจากข้างขวด",
                  "Lot number — read from the vial",
                )}
                value={typed}
                onChangeText={setTyped}
                placeholder={tr("เช่น MMR260917A", "e.g. MMR260917A")}
                autoCapitalize="characters"
                autoCorrect={false}
                trailing={
                  lot != null ? (
                    <CircleCheck size={18} color={INK_OK} strokeWidth={2.4} />
                  ) : undefined
                }
                error={
                  typed.trim() !== "" && lot == null
                    ? tr(
                        "ไม่พบ Lot นี้ในระบบ — ตรวจเลขอีกครั้ง หรือแจ้งเพิ่ม Lot ก่อนเปิด Session",
                        "Lot not found — check the number, or ask for the lot to be added before opening the session",
                      )
                    : null
                }
              />
            </Card>
          )}

          {/* Everything the lot decided, and the two facts every sitting
              has. Rows, not boxes. */}
          <Card padded={false}>
            {shots && (
              <Row
                label={tr("ผู้ผลิต", "Manufacturer")}
                value={lot?.maker ?? dash}
              />
            )}
            {shots && (
              <Row
                label={tr("วันหมดอายุ", "Expiry date")}
                value={lot == null ? dash : thaiExpiry(lot.expiresAt)}
                note={
                  expired
                    ? {
                        text: tr(
                          `หมดอายุแล้ว ${-days} วัน`,
                          `Expired ${-days} days ago`,
                        ),
                        bad: true,
                      }
                    : expiring
                      ? {
                          text: tr(`เหลืออีก ${days} วัน`, `${days} days left`),
                          bad: false,
                        }
                      : undefined
                }
              />
            )}
            {shots && (
              <Row
                label="Dose / Route / Site"
                value={
                  lot == null
                    ? dash
                    : tr(
                        `เข็ม ${lot.dose} · ${courseOf(lot.kind).route} · ${lot.site}`,
                        `Dose ${lot.dose} · ${courseOf(lot.kind).route} · ${lot.site}`,
                      )
                }
              />
            )}
            <Row
              label={tr("ผู้ให้บริการ", "Provider")}
              value={`${me.displayName} (P-10428)`}
            />
            <Row
              label={tr("วันที่ให้บริการ", "Service date")}
              value={thaiShortDate(planToday)}
              last
            />
          </Card>
        </ScrollView>
      </HeaderFade>

      {/*
        The app's own floating bar, which is glass. A flat blue capsule at
        the end of a scroll was the one control on this page that did not
        look like the rest of the app — and it was below the fold on a short
        phone, so the page ended without an obvious way on.
      */}
      <ActionBar
        side={width < 600 ? 25 : Math.max(25, (width - FORM_MAX) / 2 + 25)}
      >
        <PrimaryAction
          label={tr(
            `เปิด Session · ${activity.targets} คน`,
            `Open session · ${activity.targets} people`,
          )}
          // A session cannot open on a batch the app knows nothing about:
          // the duplicate and interval checks are worked out from the dose,
          // and the dose comes from the record behind the lot.
          disabled={shots ? lot == null || expired : false}
          onPress={() => {
            if (shots && lot == null) return;
            openSession(activity, {
              lot: shots ? lot : undefined,
              provider: me.displayName,
              providerCode: "P-10428",
              // The moment the sitting opened, not the top of the day.
              // `planToday` is midnight — every record written from it
              // said the class had been vaccinated at 00:00.
              at: new Date(),
            });
            if (expiring) {
              toast(
                tr(
                  `เปิด Session แล้ว · Lot นี้จะหมดอายุใน ${days} วัน`,
                  `Session opened · this lot expires in ${days} days`,
                ),
                "warning",
              );
            } else {
              toast(tr("เปิด Session แล้ว", "Session opened"), "success");
            }
            nav.replace("VaccineSession");
          }}
        />
      </ActionBar>
    </View>
  );
}

/**
 * One vaccine, as a chip — the app's shared one (`ChoiceChip`).
 *
 * It was Apple's glass, tinted blue when on and neutral when off. But these
 * sit on an opaque white card, and glass there has nothing behind it to
 * refract: the four vaccines not chosen came out as bare words with no edge
 * — on Android always, and on an iPhone as near as makes no difference. The
 * weighing form's chips were changed from glass to paint for the same
 * reason, and these now match them and every other form's.
 *
 * Choosing the one already chosen does nothing: a session is always for
 * exactly one vaccine.
 */
function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <ChoiceChip
      label={label}
      on={on}
      onPress={() => {
        if (!on) onPress();
      }}
      // No tick for a press that changes nothing.
      haptic={!on}
      contentStyle={{ height: 40, paddingVertical: 0 }}
    />
  );
}

/** A looked-up value: label over value, and nothing that invites a tap. */
function Row({
  label,
  value,
  note,
  last,
}: {
  label: string;
  value: string;
  /** A word about the value itself — an expiry running out, usually. */
  note?: { text: string; bad: boolean };
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderBottomWidth: last === true ? 0 : 1,
        borderBottomColor: SEPARATOR,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }}>
        {label}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            lineHeight: 21,
            fontWeight: "600",
            color: TEXT_PRIMARY,
          }}
        >
          {value}
        </Text>
        {note != null ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: RADIUS.capsule,
              backgroundColor: note.bad ? DANGER_BG : WARNING_BG,
            }}
          >
            <TriangleAlert
              size={11}
              color={note.bad ? DANGER_INK : WARNING}
              strokeWidth={2.4}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: note.bad ? DANGER_INK : WARNING,
              }}
            >
              {note.text}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
