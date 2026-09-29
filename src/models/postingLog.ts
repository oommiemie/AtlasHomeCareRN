import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { isEn, tr } from "../i18n";
import { postingReasonLabel } from "./task";

/**
 * What was done with each posting: taken, or turned down and why.
 *
 * A carer is asked to account for a refused visit long after refusing it —
 * a supervisor asks at the end of the month, or the same posting comes
 * round again and the reason is the answer to "why is this still open".
 * So the decision is written down at the moment it is made, and kept
 * beside the session rather than in it: signing out does not unmake it.
 */
export type PostingDecision = {
  /** The posting this was about. */
  taskId: string;
  /** Whose posting it was, as it read at the time. */
  name: string;
  detail: string;
  /** What kind of appointment the posting was. */
  visitType?: string;
  kind: "accepted" | "rejected";
  /** When the decision was made, ISO. */
  at: string;
  /** Why it was turned down — the reason chosen, and anything typed. */
  reason?: string;
  note?: string;
};

/**
 * A few decisions already on the record, so the page has something to
 * show on a fresh install — the same stand-in every other list in this
 * app opens with. Days are counted back from now; the first real decision
 * a carer makes joins them at the top.
 */
const ago = (days: number, hour: number, minute: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const SEED: PostingDecision[] = [
  {
    taskId: "seed-1",
    name: "นาง สมหญิง ใจดี",
    detail: tr(
      "ติดตามระดับน้ำตาลและทบทวนการใช้ยาเบาหวานที่บ้าน",
      "Follow up blood glucose and review diabetes medication at home",
    ),
    kind: "accepted",
    at: ago(1, 9, 20),
  },
  {
    taskId: "seed-2",
    name: "นาย ประสิทธิ์ วงศ์ทอง",
    detail: tr(
      "ทำแผลกดทับบริเวณก้นกบและประเมินการดูแลของญาติ",
      "Dress the sacral pressure injury and assess the family's care",
    ),
    kind: "rejected",
    at: ago(2, 14, 5),
    reason: tr("ติดต่อผู้ป่วยไม่ได้", "Could not reach the patient"),
    note: tr(
      "โทร 3 ครั้งไม่รับสาย ประสานงาน อสม. ให้ช่วยติดตามแล้ว",
      "Called 3 times with no answer. Asked the VHV to follow up.",
    ),
  },
  {
    taskId: "seed-3",
    name: "นางสาว กมลชนก อินทร์แก้ว",
    detail: tr(
      "เยี่ยมมารดาหลังคลอดและประเมินภาวะซึมเศร้าหลังคลอด",
      "Postpartum visit to the mother and screening for postpartum depression",
    ),
    kind: "accepted",
    at: ago(3, 10, 40),
  },
  {
    taskId: "seed-4",
    name: "นาย ภูมิพัฒน์ พรหมมา",
    detail: tr(
      "ดูแลผู้ป่วยติดเตียงและสอนญาติเรื่องการพลิกตะแคงตัว",
      "Bedbound patient care and teaching the family to reposition",
    ),
    kind: "rejected",
    at: ago(5, 16, 30),
    reason: tr("ผู้ป่วยไม่สะดวก", "Patient not available"),
    note: tr(
      "ญาติขอเลื่อนเป็นสัปดาห์หน้า เนื่องจากต้องพาไปตรวจที่โรงพยาบาล",
      "Family asked to move it to next week — they are taking the patient to a hospital appointment",
    ),
  },
  {
    taskId: "seed-5",
    name: "นาง อรทัย เกียรติยศ",
    detail: tr(
      "ประเมินภาวะสมองเสื่อมและแนะนำการจัดสภาพแวดล้อมในบ้าน",
      "Assess for dementia and advise on the home environment",
    ),
    kind: "accepted",
    at: ago(8, 8, 15),
  },
];

/*
  The seed's words in both languages, so a log saved in one language reads in
  the other: the log is written to disk with the seed in it, in whatever
  language the app spoke that day.
*/
const SEED_TEXT: [string, string][] = [
  // The reasons the reject sheet offers that the seed does not already use.
  ["ผู้ป่วยเสียชีวิตแล้ว", "Patient has died"],
  ["อื่นๆ", "Other"],
  [
    "ติดตามระดับน้ำตาลและทบทวนการใช้ยาเบาหวานที่บ้าน",
    "Follow up blood glucose and review diabetes medication at home",
  ],
  [
    "ทำแผลกดทับบริเวณก้นกบและประเมินการดูแลของญาติ",
    "Dress the sacral pressure injury and assess the family's care",
  ],
  ["ติดต่อผู้ป่วยไม่ได้", "Could not reach the patient"],
  [
    "โทร 3 ครั้งไม่รับสาย ประสานงาน อสม. ให้ช่วยติดตามแล้ว",
    "Called 3 times with no answer. Asked the VHV to follow up.",
  ],
  [
    "เยี่ยมมารดาหลังคลอดและประเมินภาวะซึมเศร้าหลังคลอด",
    "Postpartum visit to the mother and screening for postpartum depression",
  ],
  [
    "ดูแลผู้ป่วยติดเตียงและสอนญาติเรื่องการพลิกตะแคงตัว",
    "Bedbound patient care and teaching the family to reposition",
  ],
  ["ผู้ป่วยไม่สะดวก", "Patient not available"],
  [
    "ญาติขอเลื่อนเป็นสัปดาห์หน้า เนื่องจากต้องพาไปตรวจที่โรงพยาบาล",
    "Family asked to move it to next week — they are taking the patient to a hospital appointment",
  ],
  [
    "ประเมินภาวะสมองเสื่อมและแนะนำการจัดสภาพแวดล้อมในบ้าน",
    "Assess for dementia and advise on the home environment",
  ],
];

/** A saved detail, reason or note in the language on screen, where it is known. */
export function postingTextLabel(text: string): string {
  const hit = SEED_TEXT.find(([th, en]) => (isEn ? th : en) === text);
  return hit != null ? tr(hit[0], hit[1]) : postingReasonLabel(text);
}

let log: PostingDecision[] = SEED;
const watchers = new Set<() => void>();
const store = () => new File(Paths.document, "postings.json");

function notify(): void {
  for (const w of watchers) w();
}

async function persist(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) f.create({ intermediates: true });
    f.write(JSON.stringify(log));
  } catch {
    // A log that cannot be written is still a log for this session.
    toast(
      tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"),
      "error",
    );
  }
}

export async function hydratePostingLog(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as unknown;
    // What was saved, and the stand-ins under it — a real decision on the
    // same posting replaces its seed rather than sitting beside it.
    if (Array.isArray(saved)) {
      const kept = saved as PostingDecision[];
      const ids = new Set(kept.map((d) => d.taskId));
      log = [...kept, ...SEED.filter((d) => !ids.has(d.taskId))];
    }
  } catch {
    log = [];
  }
  notify();
}

/** Write a decision, newest first. One per posting — the latest stands. */
export function recordDecision(d: Omit<PostingDecision, "at">): void {
  log = [
    { ...d, at: new Date().toISOString() },
    ...log.filter((x) => x.taskId !== d.taskId),
  ];
  notify();
  void persist();
}

export function usePostingLog(): PostingDecision[] {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => log,
  );
}

/** What was decided about one posting, where anything was. */
export function decisionFor(taskId: string): PostingDecision | undefined {
  return log.find((d) => d.taskId === taskId);
}
