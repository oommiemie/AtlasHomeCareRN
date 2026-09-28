import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { DRUGS } from "./medication";
import { planToday } from "./clock";
import { everyResident, sampleVillages } from "./household";

/**
 * "ส่งเวชภัณฑ์และยา" — the medicines going out to houses this week.
 *
 * A separate errand from a visit. A carer on a round carries a bag for
 * people they are not otherwise seeing: the ones whose prescription came
 * back from the hospital, whose strips ran out, whose dressings are
 * changed by a relative. It is planned by route rather than by patient —
 * what decides the morning is which village the bag is going to.
 *
 * The rounds are generated from the registry so the person on a delivery
 * note is a person in the app, with the address the map already knows.
 */

export type DeliveryState = "waiting" | "onRoad" | "delivered" | "missed";

export const DELIVERY_LABEL: Record<DeliveryState, string> = {
  waiting: "รอจัดส่ง",
  onRoad: "กำลังนำส่ง",
  delivered: "ส่งแล้ว",
  missed: "ส่งไม่สำเร็จ",
};

export type Delivery = {
  id: string;
  residentId: string;
  name: string;
  address: string;
  village: string;
  /** What is in the bag, as it would be written on the note. */
  items: string[];
  /** The day it is meant to reach them. */
  dueAt: Date;
  state: DeliveryState;
  /** Why it did not arrive, where it did not. */
  note?: string;
};

/** A figure from a string, so the same round is the same every launch. */
const seedOf = (key: string) => {
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return n;
};

const REASONS = [
  "ไม่มีคนอยู่บ้าน",
  "ผู้ป่วยไปโรงพยาบาลตามนัด",
  "บ้านปิด ติดต่อญาติไม่ได้",
];

/**
 * A fortnight of deliveries, drawn from the people the app already holds.
 *
 * Two a day over ten working days, which is what a bag holds beside a
 * round of visits. Spread across the villages rather than concentrated,
 * because a delivery list that is all one village is a list somebody
 * would have done in one morning.
 */
function planned(): Delivery[] {
  const who = everyResident.filter((r) => r.age >= 45);
  const out: Delivery[] = [];
  let day = -4;
  for (let i = 0; i < 20; i++) {
    if (i % 2 === 0) day += 1;
    // Weekends are not delivery days either.
    const at = new Date(planToday);
    at.setDate(at.getDate() + day);
    if (at.getDay() === 0 || at.getDay() === 6) {
      day += at.getDay() === 6 ? 2 : 1;
      at.setDate(planToday.getDate() + day);
    }

    const person = who[(i * 7) % who.length];
    if (person == null) continue;
    const id = `sup-${i}-${person.id}`;
    const n = seedOf(id);
    const village = sampleVillages.find((v) =>
      v.houses.some((h) => h.residents.some((r) => r.id === person.id)),
    );
    const house = village?.houses.find((h) =>
      h.residents.some((r) => r.id === person.id),
    );

    const bag = [
      `${DRUGS[n % DRUGS.length].name} × ${1 + (n % 3)} แผง`,
      ...(n % 3 === 0 ? [`${DRUGS[(n + 5) % DRUGS.length].name} × 1 ขวด`] : []),
      ...(n % 4 === 0 ? ["แผ่นตรวจน้ำตาลปลายนิ้ว × 50 ชิ้น"] : []),
    ];

    const past = at.getTime() < planToday.getTime();
    const state: DeliveryState = past
      ? n % 9 === 0
        ? "missed"
        : "delivered"
      : at.getTime() === planToday.getTime() && n % 3 === 0
        ? "onRoad"
        : "waiting";

    out.push({
      id,
      residentId: person.id,
      name: person.name,
      address: house?.address ?? "",
      village: village == null ? "" : `${village.name} ${village.mooLabel}`,
      items: bag,
      dueAt: at,
      state,
      note: state === "missed" ? REASONS[n % REASONS.length] : undefined,
    });
  }
  return out.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

/* ----------------------------------------------------------- the store */

let rounds: Delivery[] = [];
const watchers = new Set<() => void>();
const store = () => new File(Paths.document, "supplies.json");

function publish(): void {
  for (const w of watchers) w();
}

function save(): void {
  try {
    const f = store();
    if (!f.exists) f.create({ intermediates: true });
    // Only what a carer changed. The round itself is worked out from the
    // registry every launch, so writing it down would be writing down a
    // copy that starts drifting the moment the registry moves.
    f.write(
      JSON.stringify(
        rounds
          .filter((d) => d.state !== "waiting")
          .map((d) => ({ id: d.id, state: d.state, note: d.note })),
      ),
    );
  } catch {
    // A round that cannot write itself down is still a round.
    toast("บันทึกลงเครื่องไม่สำเร็จ", "error");
  }
}

/** Read back what was marked, and rebuild the rest from the registry. */
export async function hydrateSupplies(): Promise<void> {
  rounds = planned();
  try {
    const f = store();
    if (f.exists) {
      const saved = JSON.parse(await f.text()) as {
        id: string;
        state: DeliveryState;
        note?: string;
      }[];
      const marked = new Map(saved.map((x) => [x.id, x]));
      rounds = rounds.map((d) => {
        const was = marked.get(d.id);
        return was == null ? d : { ...d, state: was.state, note: was.note };
      });
    }
  } catch {
    // Keep the generated round rather than losing the page.
  }
  publish();
}

export function useSupplies(): Delivery[] {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => rounds,
  );
}

/** Mark one delivery — and say why, where it did not arrive. */
export function markDelivery(
  id: string,
  state: DeliveryState,
  note?: string,
): void {
  rounds = rounds.map((d) =>
    d.id === id
      ? { ...d, state, note: state === "missed" ? note : undefined }
      : d,
  );
  publish();
  save();
}

/** How the round stands, in the four figures the page is read by. */
export const supplyCounts = (list: Delivery[]) => ({
  all: list.length,
  waiting: list.filter((d) => d.state === "waiting").length,
  onRoad: list.filter((d) => d.state === "onRoad").length,
  delivered: list.filter((d) => d.state === "delivered").length,
  missed: list.filter((d) => d.state === "missed").length,
});
