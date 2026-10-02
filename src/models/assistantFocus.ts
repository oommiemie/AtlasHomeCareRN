/**
 * Who the carer is looking at, read off the navigator.
 *
 * The assistant is opened over whatever page the carer was on, and a
 * question asked from a patient's page — "how has her pressure been?" — is
 * about that patient, without her name. Nothing in the app holds "the
 * current patient" (a card holder travels in route params on purpose; see
 * RootStack), so this walks down the stack from the top, past the
 * assistant itself, to the first page that is about somebody.
 */
import { navigationRef } from "../navigation/navigationRef";
import { everyResident, residentById, type Resident } from "./household";

/** The page a question was asked over, and the person it is about. */
export type Focus = {
  /** The route's name, for the prompt ("the patient's visit page"). */
  screen: string;
  resident?: Resident;
};

/** Pages about a person, and what they are called in a prompt. */
const PLACES: Record<string, string> = {
  CommunityPatient: "หน้าบันทึกเยี่ยมของผู้ป่วย",
  AcceptTask: "หน้ารายละเอียดภารกิจ",
  HealthTracking: "หน้าค่าสุขภาพของผู้ป่วย",
  VitalDetail: "หน้ากราฟค่าสุขภาพของผู้ป่วย",
  CgmDetail: "หน้ากราฟน้ำตาลของผู้ป่วย",
  BmiDetail: "หน้า BMI ของผู้ป่วย",
  HomeVisit: "หน้าบันทึกเยี่ยมบ้าน",
  HealthScreening: "หน้าคัดกรองสุขภาพ",
  TreatmentHistory: "หน้าประวัติการรักษา",
  Medication: "หน้าสั่งยา",
};

type Params = {
  resident?: Resident;
  task?: { residentId?: string };
  holder?: { name?: string };
  name?: string;
};

/** The person a route's params are about, however that page carries them. */
function personIn(params: Params | undefined): Resident | undefined {
  if (params == null) return undefined;
  if (params.resident?.id != null) return residentById(params.resident.id);
  if (params.task?.residentId != null) return residentById(params.task.residentId);
  // A card holder carries a name and an HN, not a resident id — matched by
  // the name, which is how the visit page itself finds their readings.
  const name = params.holder?.name ?? params.name;
  if (name == null) return undefined;
  const bare = name.replace(/^(คุณ|นาย|นางสาว|นาง)\s*/, "").trim();
  return everyResident.find((r) => r.name === name || r.name.includes(bare));
}

type NavState = {
  index?: number;
  routes: { name: string; params?: unknown; state?: NavState }[];
};

/** Every route from the root to the page on top, deepest last. */
function pathOf(state: NavState | undefined): { name: string; params?: unknown }[] {
  if (state == null) return [];
  const out: { name: string; params?: unknown }[] = [];
  for (const r of state.routes) {
    out.push(r);
    if (r.state != null) out.push(...pathOf(r.state));
  }
  return out;
}

/** The page under the assistant, and whom it is about — or null. */
export function screenFocus(): Focus | null {
  if (!navigationRef.isReady()) return null;
  const path = pathOf(navigationRef.getRootState() as unknown as NavState);
  for (let i = path.length - 1; i >= 0; i--) {
    const r = path[i];
    if (r.name === "Assistant") continue;
    const place = PLACES[r.name];
    if (place == null) continue;
    const resident = personIn(r.params as Params | undefined);
    if (resident != null) return { screen: place, resident };
  }
  return null;
}
