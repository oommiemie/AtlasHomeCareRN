import { Linking, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ChevronRight,
  ClipboardPen,
  HeartPulse,
  House,
  Navigation,
  Phone,
  Route,
  UserRound,
} from "lucide-react-native";

import { Glass } from "./Glass";
import { toast } from "./Toast";
import { openTask } from "../navigation/openTask";
import type { RootStackParamList } from "../navigation/RootStack";
import { visitsByIds } from "../models/assistant";
import { briefOf, type AssistantAction } from "../models/assistantTools";
import { planToday } from "../models/clock";
import { houseOfResident, residentById } from "../models/household";
import { detailOf } from "../models/patientDetail";
import {
  givenName,
  hasLocation,
  isDone,
  visitHolder,
  yearTasks,
} from "../models/task";
import { openDirections } from "../utils/routing";
import { isSameDay } from "../utils/thaiDate";
import { feel } from "../utils/haptics";
import { tr } from "../i18n";
import {
  DANGER,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICON: Record<AssistantAction["kind"], typeof Phone> = {
  open_patient: UserRound,
  open_health: HeartPulse,
  call: Phone,
  navigate: Navigation,
  start_visit: ClipboardPen,
  plan_route: Route,
  open_household: House,
  call_caregiver: Phone,
};

/** What a button says: what it does, and to whom. */
function labelOf(a: AssistantAction): string {
  const who = residentById(a.residentId ?? "");
  const name = who != null ? givenName(who.name) : "";
  switch (a.kind) {
    case "open_patient":
      return tr(`เปิดหน้า${name}`, `Open ${name}`);
    case "open_health":
      return tr(`ค่าสุขภาพ${name}`, `${name}'s readings`);
    case "call":
      return tr(`โทรหา${name}`, `Call ${name}`);
    case "navigate":
      return tr(`นำทางไปบ้าน${name}`, `Directions to ${name}`);
    case "start_visit":
      return tr(`เริ่มบันทึกเยี่ยม${name}`, `Start ${name}'s visit`);
    case "plan_route":
      return tr("วางเส้นทางรอบวันนี้", "Plan today's route");
    case "open_household":
      return tr(`บ้านของ${name}`, `${name}'s household`);
    case "call_caregiver":
      return tr(`โทรหาผู้ดูแลของ${name}`, `Call ${name}'s caregiver`);
  }
}

/**
 * Do what a button offered.
 *
 * Only ever on a press: the model can offer, the carer decides. Each
 * looks its patient and visit up again now rather than trusting what the
 * thread saved, so a visit done since the answer opens as done.
 */
function runAction(nav: Nav, a: AssistantAction): void {
  const who = residentById(a.residentId ?? "");
  const task = a.taskId != null ? visitsByIds([a.taskId])[0] : undefined;
  feel("tick");
  switch (a.kind) {
    case "open_patient":
      if (task != null) openTask(nav, task);
      else if (who != null) nav.navigate("HealthTracking", { resident: who });
      return;
    case "open_health":
      if (who != null) nav.navigate("HealthTracking", { resident: who });
      return;
    case "call":
      if (who?.phone) {
        // The phone's own dialler asks before it rings.
        Linking.openURL(`tel:${who.phone.replace(/[^0-9+]/g, "")}`).catch(() =>
          toast(tr("โทรออกไม่ได้", "Couldn't place the call"), "error"),
        );
      } else toast(tr("ไม่มีเบอร์โทร", "No phone number"), "warning");
      return;
    case "navigate": {
      if (task != null && hasLocation(task)) {
        nav.navigate("ExploreMap", { focus: task });
        return;
      }
      const house = who != null ? houseOfResident(who.id) : undefined;
      if (house != null) openDirections(house, house.number);
      return;
    }
    case "start_visit":
      if (task != null)
        nav.navigate("HomeVisit", { holder: visitHolder(task, detailOf(task)) });
      return;
    case "call_caregiver": {
      const phone = who != null ? detailOf({ residentId: who.id }).caregiverPhone : "";
      if (phone)
        Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() =>
          toast(tr("โทรออกไม่ได้", "Couldn't place the call"), "error"),
        );
      else toast(tr("ไม่มีเบอร์ผู้ดูแล", "No caregiver number"), "warning");
      return;
    }
    case "open_household": {
      const house = who != null ? houseOfResident(who.id) : undefined;
      if (house != null) nav.navigate("HouseDetail", { house });
      return;
    }
    case "plan_route": {
      const tour = yearTasks.filter(
        (t) => isSameDay(t.dueAt, planToday) && !isDone(t) && hasLocation(t),
      );
      if (tour.length === 0)
        toast(tr("วันนี้ไม่มีนัดที่เหลือให้วางเส้นทาง", "No visits left today to route"), "info");
      else nav.navigate("ExploreMap", { tour });
      return;
    }
  }
}

/**
 * The buttons an answer offers, under it.
 *
 * Glass capsules in a wrapping row, the action's icon and what it does in
 * the app's blue — the same as a tray's secondary button, small enough to
 * sit under a sentence without becoming the page.
 */
export function ActionButtons({ actions }: { actions: AssistantAction[] }) {
  const nav = useNavigation<Nav>();
  if (actions.length === 0) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACE.sm,
        alignSelf: "stretch",
      }}
    >
      {actions.map((a, i) => {
        const Icon = ICON[a.kind];
        const label = labelOf(a);
        return (
          <Pressable
            key={`${a.kind}-${a.residentId ?? i}`}
            onPress={() => runAction(nav, a)}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Glass
              interactive
              style={{
                height: 38,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: SPACE.md,
                borderRadius: RADIUS.capsule,
                overflow: "hidden",
              }}
            >
              <Icon size={16} color={PRIMARY_500} strokeWidth={2.4} />
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: "600", color: PRIMARY_500 }}
              >
                {label}
              </Text>
            </Glass>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Where to start this morning, before anything has been asked.
 *
 * Worked out on the phone (`briefOf`), so it is there with no signal and
 * says the same thing the model would be told: the people most worth
 * seeing first, each with the reasons why. A row opens the person; the
 * line under the card asks the assistant to talk it through.
 */
export function BriefCard({ onAsk }: { onAsk: (q: string) => void }) {
  const nav = useNavigation<Nav>();
  const b = briefOf(planToday);
  const top = b.priorities.slice(0, 3);
  if (top.length === 0) return null;
  const left = b.today.filter((t) => !isDone(t)).length;
  return (
    <View
      style={{
        alignSelf: "stretch",
        backgroundColor: SURFACE,
        borderRadius: RADIUS.card,
        paddingVertical: SPACE.md,
      }}
    >
      <View style={{ paddingHorizontal: SPACE.lg, gap: 2, marginBottom: SPACE.sm }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT_PRIMARY }}>
          {tr("เริ่มจากใครก่อนดี", "Where to start")}
        </Text>
        <Text style={{ fontSize: 13, color: TEXT_MUTED }}>
          {tr(
            `วันนี้เหลือ ${left} นัด${b.overdue.length > 0 ? ` · เกินกำหนด ${b.overdue.length}` : ""}`,
            `${left} visits left today${b.overdue.length > 0 ? ` · ${b.overdue.length} overdue` : ""}`,
          )}
        </Text>
      </View>
      {top.map((p, i) => {
        const task = p.taskId != null ? visitsByIds([p.taskId])[0] : undefined;
        const who = residentById(p.residentId);
        return (
          <Pressable
            key={p.residentId}
            onPress={() => {
              feel("tick");
              if (task != null) openTask(nav, task);
              else if (who != null) nav.navigate("HealthTracking", { resident: who });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${p.name} ${p.reasons.join(" ")}`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.md,
              paddingHorizontal: SPACE.lg,
              paddingVertical: SPACE.sm + 2,
              opacity: pressed ? 0.6 : 1,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: SEPARATOR,
            })}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: i === 0 ? `${DANGER}1A` : `${PRIMARY_500}14`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: i === 0 ? DANGER : PRIMARY_500,
                }}
              >
                {i + 1}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY }}
              >
                {p.name}
              </Text>
              <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 17, color: TEXT_MUTED }}>
                {p.reasons.join(" · ")}
              </Text>
            </View>
            <ChevronRight size={18} color={TEXT_MUTED} strokeWidth={2.2} />
          </Pressable>
        );
      })}
      <Pressable
        onPress={() =>
          onAsk(tr("เช้านี้ควรเริ่มจากใครก่อน เพราะอะไร", "Who should I start with this morning, and why?"))
        }
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: SPACE.xs,
          paddingHorizontal: SPACE.lg,
          paddingTop: SPACE.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: PRIMARY_500 }}>
          {tr("ให้ผู้ช่วยอธิบายลำดับนี้", "Ask the assistant to explain")}
        </Text>
      </Pressable>
    </View>
  );
}
