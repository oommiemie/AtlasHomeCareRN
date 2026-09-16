import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { sampleDetail } from "../models/patientDetail";
import { visitHolder, type Task } from "../models/task";
import type { RootStackParamList } from "./RootStack";

/**
 * Where a tap on a task goes.
 *
 * A posting is still a decision — take it or not — so it opens the full
 * record with the pair of buttons. A visit already taken has no decision
 * left in it; tapping it opens the page where the work is done, with the
 * patient's record and the things to record, and no page in between.
 */
export function taskRoute(t: Task): { name: "AcceptTask"; params: RootStackParamList["AcceptTask"] } | { name: "CommunityPatient"; params: RootStackParamList["CommunityPatient"] } {
  return t.status != null
    ? { name: "CommunityPatient", params: { holder: visitHolder(t, sampleDetail), task: t, detail: sampleDetail } }
    : { name: "AcceptTask", params: { task: t } };
}

export function openTask(nav: NativeStackNavigationProp<RootStackParamList>, t: Task): void {
  const r = taskRoute(t);
  if (r.name === "CommunityPatient") nav.navigate(r.name, r.params);
  else nav.navigate(r.name, r.params);
}
