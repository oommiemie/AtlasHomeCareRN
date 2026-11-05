import { Linking } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

import app from "../../app.json";
import { tr } from "../i18n";

/**
 * A video visit: a room the carer opens, and a link the patient taps.
 *
 * The patient does not have this app and is not going to install it for a
 * ten-minute call, so the room has to be something a phone's browser can
 * join from a link in an SMS or a LINE chat. That is a Jitsi room: open
 * source, joined from any browser, and a hospital can run its own — which
 * is where it should be run, because what is said on a video visit is a
 * clinical record. The server is set in app.json (`extra.videoRoomBase`),
 * so moving off the public one is a change of address, not of code.
 *
 * The room's name is a random string and nothing else: a name in a URL is
 * in every log between here and the server.
 */
export const ROOM_BASE: string = (
  (app.expo.extra as { videoRoomBase?: string }).videoRoomBase ??
  "https://meet.jit.si"
).replace(/\/+$/, "");

/** A room nobody can guess: twelve letters and digits after the app's name. */
export function newRoom(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 12; i++) id += abc[Math.floor(Math.random() * abc.length)];
  return `AtlasHomeCare-${id}`;
}

/*
  Settings carried in the link's fragment, which the server never sees.

  `disableDeepLinking` keeps a phone's browser in the browser rather than
  sending the patient to an app store page first; the pre-join page is
  skipped for the carer, who has already said who they are by signing in.
*/
const BROWSER = "config.disableDeepLinking=true";

/** What the patient is sent. */
export const patientLink = (room: string): string =>
  `${ROOM_BASE}/${room}#${BROWSER}`;

/** What the carer opens: the same room, already named and past the lobby. */
export const carerLink = (room: string, carer: string): string =>
  `${ROOM_BASE}/${room}#${BROWSER}&config.prejoinConfig.enabled=false&userInfo.displayName=${encodeURIComponent(JSON.stringify(carer))}`;

/** The message the link travels in. */
export const inviteText = (room: string, carer: string): string =>
  tr(
    `สวัสดีค่ะ ${carer} จากทีมเยี่ยมบ้านจะวิดีโอคอลหาคุณ กดลิงก์นี้เพื่อเข้าห้องได้เลย ไม่ต้องติดตั้งแอป\n${patientLink(room)}`,
    `Hello, ${carer} from the home-care team would like to video call you. Tap this link to join — no app needed.\n${patientLink(room)}`,
  );

/*
  The browser the room opens in, asked for softly.

  A sheet over the app — Safari's on iOS, Chrome's custom tab on Android —
  rather than a web view drawn by the app: the camera and the microphone
  work there the way they do in the browser, with nothing to grant by hand.
  A build from before the module was added has no native half; there the
  room opens in the browser itself.
*/
type Browser = typeof import("expo-web-browser");
const browser: Browser | null = (() => {
  if (requireOptionalNativeModule("ExpoWebBrowser") == null) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-web-browser") as Browser;
  } catch {
    return null;
  }
})();

/** Open the room over the app. Resolves when the carer closes it. */
export async function openRoom(url: string): Promise<void> {
  if (browser == null) {
    await Linking.openURL(url);
    return;
  }
  await browser.openBrowserAsync(url, {
    presentationStyle: browser.WebBrowserPresentationStyle.FULL_SCREEN,
    dismissButtonStyle: "close",
    enableBarCollapsing: true,
    showTitle: false,
  });
}
