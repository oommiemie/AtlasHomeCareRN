import { useSyncExternalStore } from "react";

import { keptMap } from "./keep";
import { tr } from "../i18n";

/**
 * Cases handed on: to another nurse, a doctor, a physiotherapist.
 *
 * Kept per visit (its Authen Code) and on the device, so the patient page
 * says who it went to after the app is closed. A prototype's handover: the
 * person chosen is told nothing — the page simply shows it as sent.
 */
export type Handover = {
  to: string;
  role: string;
  reason: string;
  note: string;
  at: number;
};

export const HANDOVER_REASONS: string[] = [
  tr("ต้องพบแพทย์", "Needs a doctor"),
  tr("ต้องทำกายภาพ", "Needs physiotherapy"),
  tr("ฝากติดตามต่อ", "Please follow up"),
  tr("ย้ายพื้นที่รับผิดชอบ", "Moved to another area"),
];

const sent = new Map<string, Handover>();
const kept = keptMap("handovers.json", sent);
export const hydrateHandovers = kept.hydrate;
const watchers = new Set<() => void>();

export function handOver(authenCode: string, h: Handover): void {
  sent.set(authenCode, h);
  kept.save();
  for (const w of watchers) w();
}

export function useHandover(authenCode: string): Handover | undefined {
  return useSyncExternalStore(
    (w) => {
      watchers.add(w);
      return () => {
        watchers.delete(w);
      };
    },
    () => sent.get(authenCode),
  );
}
