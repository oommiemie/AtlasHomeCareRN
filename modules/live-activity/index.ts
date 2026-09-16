import { requireOptionalNativeModule } from "expo-modules-core";

/** One frame of the activity, as the island will draw it. */
export type ScribeActivityState = {
  phase: "listening" | "paused" | "ready";
  /** Epoch milliseconds when the current stretch of listening began. */
  startedAt: number;
  /** Seconds already on the clock at `startedAt`. */
  carried: number;
  covered: number;
  total: number;
};

type Native = {
  isAvailable(): boolean;
  start(patient: string, state: ScribeActivityState): Promise<boolean>;
  update(state: ScribeActivityState): Promise<boolean>;
  end(): Promise<boolean>;
};

/*
  Optional, deliberately. The native module is compiled into the app; the
  island itself is only on iPhones from the 14 Pro on, and only if Live
  Activities are allowed in Settings. Everything here answers quietly when
  any of that is missing, and the sheet's own pill does the job instead.
*/
const native = requireOptionalNativeModule<Native>("LiveActivity");

export const LiveActivity = {
  isAvailable(): boolean {
    try {
      return native?.isAvailable() ?? false;
    } catch {
      return false;
    }
  },
  async start(patient: string, state: ScribeActivityState): Promise<boolean> {
    try {
      return (await native?.start(patient, state)) ?? false;
    } catch {
      return false;
    }
  },
  async update(state: ScribeActivityState): Promise<boolean> {
    try {
      return (await native?.update(state)) ?? false;
    } catch {
      return false;
    }
  },
  async end(): Promise<boolean> {
    try {
      return (await native?.end()) ?? false;
    } catch {
      return false;
    }
  },
};
