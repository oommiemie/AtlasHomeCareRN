import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

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
    detail: "ติดตามระดับน้ำตาลและทบทวนการใช้ยาเบาหวานที่บ้าน",
    kind: "accepted",
    at: ago(1, 9, 20),
  },
  {
    taskId: "seed-2",
    name: "นาย ประสิทธิ์ วงศ์ทอง",
    detail: "ทำแผลกดทับบริเวณก้นกบและประเมินการดูแลของญาติ",
    kind: "rejected",
    at: ago(2, 14, 5),
    reason: "ติดต่อผู้ป่วยไม่ได้",
    note: "โทร 3 ครั้งไม่รับสาย ประสานงาน อสม. ให้ช่วยติดตามแล้ว",
  },
  {
    taskId: "seed-3",
    name: "นางสาว กมลชนก อินทร์แก้ว",
    detail: "เยี่ยมมารดาหลังคลอดและประเมินภาวะซึมเศร้าหลังคลอด",
    kind: "accepted",
    at: ago(3, 10, 40),
  },
  {
    taskId: "seed-4",
    name: "นาย ภูมิพัฒน์ พรหมมา",
    detail: "ดูแลผู้ป่วยติดเตียงและสอนญาติเรื่องการพลิกตะแคงตัว",
    kind: "rejected",
    at: ago(5, 16, 30),
    reason: "ผู้ป่วยไม่สะดวก",
    note: "ญาติขอเลื่อนเป็นสัปดาห์หน้า เนื่องจากต้องพาไปตรวจที่โรงพยาบาล",
  },
  {
    taskId: "seed-5",
    name: "นาง อรทัย เกียรติยศ",
    detail: "ประเมินภาวะสมองเสื่อมและแนะนำการจัดสภาพแวดล้อมในบ้าน",
    kind: "accepted",
    at: ago(8, 8, 15),
  },
];

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
  log = [{ ...d, at: new Date().toISOString() }, ...log.filter((x) => x.taskId !== d.taskId)];
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
