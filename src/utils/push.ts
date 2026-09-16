import * as Notifications from "expo-notifications";

import { pushNotice, type Notice, type NoticeKind } from "../models/notifications";

/**
 * Notifications the operating system delivers, not just the app's own list.
 *
 * These are LOCAL notifications: the app asks iOS to deliver something in a
 * few seconds, and iOS shows the banner whether the app is open, in the
 * background, or closed. That is the whole of what a carer experiences as
 * a push — the only part a server would add is deciding when to send, and
 * there is no server here yet.
 *
 * Everything that arrives is also written into the app's own list, so the
 * bell's count and the notification page stay true whichever way the
 * notice came in.
 */

/** Shown while the app is in front, rather than silently swallowed. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** What travels with a notification, so the list can rebuild the entry. */
type Payload = {
  kind: NoticeKind;
  target?: Notice["target"];
};

/**
 * Ask once, and remember the answer.
 *
 * iOS only shows the permission sheet the first time; after that a refusal
 * has to be changed in Settings, which is why this reports what it got
 * rather than asking again.
 */
export async function ensureNoticePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Hand one to iOS to deliver in `seconds`.
 *
 * Zero seconds is not allowed by the trigger API — a notification with no
 * delay is delivered immediately and never reaches the banner — so an
 * immediate send is written straight into the list instead.
 */
export async function sendNotice(
  n: { kind: NoticeKind; title: string; body: string; target?: Notice["target"] },
  seconds: number,
): Promise<"scheduled" | "in-app" | "denied"> {
  if (seconds <= 0) {
    pushNotice(n);
    return "in-app";
  }
  const allowed = await ensureNoticePermission();
  if (!allowed) {
    // Still worth recording: the carer can read it in the app even if the
    // phone will not show a banner.
    pushNotice(n);
    return "denied";
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: n.title,
      body: n.body,
      sound: true,
      data: { kind: n.kind, target: n.target } satisfies Payload,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
  });
  return "scheduled";
}

/**
 * Mirror delivered notifications into the app's own list.
 *
 * Called once, from the app's root. Returns the unsubscribe so a fast
 * refresh does not stack listeners.
 */
export function watchNotices(): () => void {
  const received = Notifications.addNotificationReceivedListener((event) => {
    const { title, body, data } = event.request.content;
    const payload = data as Partial<Payload> | undefined;
    pushNotice({
      kind: payload?.kind ?? "announcement",
      title: title ?? "การแจ้งเตือน",
      body: body ?? "",
      target: payload?.target,
    });
  });
  return () => received.remove();
}

/** Clear the red number on the app icon — done when the list is opened. */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // A badge that will not clear is not worth failing a screen over.
  }
}
