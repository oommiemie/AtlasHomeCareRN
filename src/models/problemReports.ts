import { AppState, Platform } from "react-native";
import { File, Paths } from "expo-file-system";

import app from "../../app.json";
import { isEn } from "../i18n";
import { APP } from "./appInfo";
import { currentSession } from "./session";

/**
 * "รายงานปัญหา", on its way to the app's central system.
 *
 * Written down first and sent second: a carer reports a fault from where
 * the fault happened, which is as often as not a house with one bar of
 * signal. A report that needed the network at the moment of pressing
 * "ส่ง" would be lost exactly when it mattered. So it goes into an outbox
 * on the phone, the outbox is sent now, and whatever does not go is sent
 * again when the app next comes to the front.
 *
 * Where it goes is set in app.json (`extra.reportEndpoint`), the central
 * system's address for reports — a JSON POST, one report per request.
 * Until it is set, reports wait in the outbox rather than being dropped.
 */
export const REPORT_ENDPOINT: string = (
  (app.expo.extra as { reportEndpoint?: string }).reportEndpoint ?? ""
).trim();

export type DeviceInfo = {
  app: string;
  version: string;
  os: string;
  osVersion: string;
  model: string;
  expo: string;
  reactNative: string;
  language: string;
};

export type ProblemReport = {
  id: string;
  kind: string;
  detail: string;
  /** Who reported it, and where they were working — to call them back. */
  providerId: string;
  facility: string | null;
  device: DeviceInfo | null;
  createdAt: string;
};

/**
 * What the phone is, for whoever triages the fault. The device's own name
 * is left out: it is often the owner's name.
 */
export function deviceInfo(): DeviceInfo {
  const c = Platform.constants as {
    Model?: string;
    Manufacturer?: string;
    interfaceIdiom?: string;
  };
  return {
    app: APP.name,
    version: APP.version,
    os: Platform.OS,
    osVersion: String(Platform.Version),
    model:
      Platform.OS === "android"
        ? [c.Manufacturer, c.Model].filter(Boolean).join(" ")
        : c.interfaceIdiom === "pad"
          ? "iPad"
          : "iPhone",
    expo: APP.expo,
    reactNative: APP.reactNative,
    language: isEn ? "en" : "th",
  };
}

/* ----------------------------------------------------------- the outbox */

let outbox: ProblemReport[] = [];
const store = () => new File(Paths.document, "problem-reports.json");

function persist(): void {
  try {
    const f = store();
    if (outbox.length > 0) f.write(JSON.stringify(outbox));
    else if (f.exists) f.delete();
  } catch {
    // Still in memory; the next change writes it again.
  }
}

/** Post one report. True only when the central system said it has it. */
async function post(report: ProblemReport): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      signal: ctl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let flushing: Promise<void> | null = null;

/** Send everything waiting, oldest first; keep what does not go. */
export function flushReports(): Promise<void> {
  if (REPORT_ENDPOINT === "" || outbox.length === 0) return Promise.resolve();
  flushing ??= (async () => {
    for (const r of [...outbox]) {
      if (!(await post(r))) break;
      outbox = outbox.filter((x) => x.id !== r.id);
      persist();
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/**
 * File a report: into the outbox, then sent. "sent" when the central
 * system took it; "queued" when it is waiting on the phone to be sent.
 */
export async function submitReport(r: {
  kind: string;
  detail: string;
  attachDevice: boolean;
}): Promise<"sent" | "queued"> {
  const s = currentSession();
  const report: ProblemReport = {
    id: `pr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: r.kind,
    detail: r.detail.trim(),
    providerId: s.providerId,
    facility: s.facility?.code ?? null,
    device: r.attachDevice ? deviceInfo() : null,
    createdAt: new Date().toISOString(),
  };
  outbox = [...outbox, report];
  persist();
  await flushReports();
  return outbox.some((x) => x.id === report.id) ? "queued" : "sent";
}

/** Read the outbox back at launch, and try it once. */
export async function hydrateReports(): Promise<void> {
  try {
    const f = store();
    if (f.exists) {
      const saved = JSON.parse(await f.text()) as unknown;
      if (Array.isArray(saved)) outbox = saved as ProblemReport[];
    }
  } catch {
    outbox = [];
  }
  void flushReports();
}

// Whatever is waiting goes again each time the app comes back to the front.
AppState.addEventListener("change", (state) => {
  if (state === "active") void flushReports();
});
