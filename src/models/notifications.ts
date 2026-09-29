import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { tr } from "../i18n";
import { planToday } from "./clock";

/**
 * What the app tells a carer about, and what they have read.
 *
 * The categories are the ones the settings screen already switches on and
 * off, so a notification that arrives can be traced to the switch that
 * allowed it. Kept beside the session rather than in it: what somebody has
 * read is theirs, and signing out does not unread it.
 */
export type NoticeKind =
  | "new_task"
  | "reminder"
  | "changed"
  | "vitals"
  | "message"
  | "announcement"
  | "app_update";

export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  /** When it arrived, ISO. */
  at: string;
  read: boolean;
  /** Where tapping it goes, where it goes anywhere. */
  target?: { route: "TaskList" | "PostingLog" | "FollowUp" | "Houses" | "HouseMap" };
};

/** What each kind is called where the list groups them. */
export const KIND_LABEL: Record<NoticeKind, string> = {
  new_task: tr("ภารกิจใหม่", "New tasks"),
  reminder: tr("เตือนนัดหมาย", "Appointment reminders"),
  changed: tr("เปลี่ยนแปลงนัด", "Appointment changes"),
  vitals: tr("สัญญาณชีพผิดปกติ", "Abnormal vital signs"),
  message: tr("ข้อความจากผู้ป่วย", "Patient messages"),
  announcement: tr("ประกาศ", "Announcements"),
  app_update: tr("อัปเดตแอพ", "App updates"),
};

const hoursAgo = (h: number) => {
  const d = new Date();
  d.setHours(d.getHours() - h, d.getMinutes(), 0, 0);
  return d.toISOString();
};

/** A day's worth of notices, so the page has something to show. */
const SEED: Notice[] = [
  {
    id: "n1",
    kind: "new_task",
    title: tr("มีภารกิจใหม่ในพื้นที่ของคุณ", "A new task in your area"),
    body: tr(
      "นาง เบญจมาศ อินทรแก้ว · ติดตามผู้ป่วยวัณโรคระหว่างกินยา",
      "นาง เบญจมาศ อินทรแก้ว · Follow-up of a TB patient on treatment",
    ),
    at: hoursAgo(1),
    read: false,
    target: { route: "TaskList" },
  },
  {
    id: "n2",
    kind: "reminder",
    title: tr("อีก 1 ชั่วโมงถึงเวลานัด", "Appointment in 1 hour"),
    body: tr(
      "นางสาว กมลชนก อินทร์แก้ว · เยี่ยมมารดาหลังคลอด เวลา 10:00 น.",
      "นางสาว กมลชนก อินทร์แก้ว · Postpartum visit at 10:00",
    ),
    at: hoursAgo(2),
    read: false,
  },
  {
    id: "n3",
    kind: "vitals",
    title: tr("ค่าที่บันทึกอยู่นอกเกณฑ์", "A recorded value is out of range"),
    body: tr(
      "นาง จันทร์เพ็ญ บุญมี · ความดัน 158/96 mmHg สูงกว่าเกณฑ์",
      "นาง จันทร์เพ็ญ บุญมี · Blood pressure 158/96 mmHg, above target",
    ),
    at: hoursAgo(5),
    read: false,
    target: { route: "FollowUp" },
  },
  {
    id: "n4",
    kind: "changed",
    title: tr("ผู้ป่วยขอเลื่อนนัด", "Patient asked to reschedule"),
    body: tr(
      "นาย ภูมิพัฒน์ พรหมมา · ขอเลื่อนเป็นสัปดาห์หน้า",
      "นาย ภูมิพัฒน์ พรหมมา · Asked to move it to next week",
    ),
    at: hoursAgo(26),
    read: true,
  },
  {
    id: "n5",
    kind: "announcement",
    title: tr("ประกาศจากหน่วยงาน", "Announcement from your unit"),
    body: tr(
      "อบรมการใช้แบบประเมิน ADL รูปแบบใหม่ วันที่ 30 กันยายน 2569",
      "Training on the new ADL assessment form, September 30, 2026",
    ),
    at: hoursAgo(30),
    read: true,
  },
  {
    id: "n6",
    kind: "message",
    title: tr("ข้อความจากผู้ดูแล", "Message from a caregiver"),
    body: tr(
      "บุตรสาวของ นาง อรทัย เกียรติยศ สอบถามเรื่องการจัดยาประจำสัปดาห์",
      "The daughter of นาง อรทัย เกียรติยศ asked about this week's medication organizer",
    ),
    at: hoursAgo(52),
    read: true,
  },
];

let notices: Notice[] = SEED;
const watchers = new Set<() => void>();
const store = () => new File(Paths.document, "notices.json");

function notify(): void {
  for (const w of watchers) w();
}

async function persist(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) f.create({ intermediates: true });
    f.write(JSON.stringify(notices));
  } catch {
    // Unread counts that cannot be saved are still right for this session.
    toast(
      tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"),
      "error",
    );
  }
}

export async function hydrateNotices(): Promise<void> {
  try {
    const f = store();
    if (!f.exists) return;
    const saved = JSON.parse(await f.text()) as unknown;
    if (Array.isArray(saved)) {
      // What was saved wins; anything seeded since is added under it.
      // A seeded notice keeps its saved read state but takes its words from
      // the seed, so it reads in whichever language the app now speaks.
      // Anything else saved is a record, and stays as it was written.
      const kept = (saved as Notice[]).map((n) => {
        const seed = SEED.find((x) => x.id === n.id);
        return seed ? { ...n, title: seed.title, body: seed.body } : n;
      });
      const ids = new Set(kept.map((n) => n.id));
      notices = [...kept, ...SEED.filter((n) => !ids.has(n.id))].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
    }
  } catch {
    notices = SEED;
  }
  notify();
}

export function useNotices(): Notice[] {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => notices,
  );
}

/** How many are still unread — the number on the bell. */
export function useUnreadCount(): number {
  return useNotices().filter((n) => !n.read).length;
}

export function markRead(id: string): void {
  notices = notices.map((n) => (n.id === id ? { ...n, read: true } : n));
  notify();
  void persist();
}

export function markAllRead(): void {
  notices = notices.map((n) => (n.read ? n : { ...n, read: true }));
  notify();
  void persist();
}

/** Post a new notice — what a push would do once there is a server. */
export function pushNotice(n: Omit<Notice, "id" | "at" | "read">): void {
  notices = [{ ...n, id: `${Date.now()}`, at: new Date().toISOString(), read: false }, ...notices];
  notify();
  void persist();
}

/** "วันนี้" / "เมื่อวาน" / the date — how a list of notices is grouped. */
export function dayOf(at: string): "today" | "yesterday" | "earlier" {
  const d = new Date(at);
  const days = Math.floor((planToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return "earlier";
}
