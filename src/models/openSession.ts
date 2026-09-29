import { File, Paths } from "expo-file-system";

import { toast } from "../components/Toast";
import { tr } from "../i18n";
import {
  restoreSession,
  snapshotSession,
  watchSession,
  type SessionSnapshot,
} from "./vaccination";

/**
 * The sitting that is under way, kept on the phone.
 *
 * A class of fifty is not done in one sweep. A carer records the ten who
 * are ready, goes back for the ones the check flagged, steps out to take a
 * call, looks something up in another part of the app — and every one of
 * those used to end the session, because it lived in a variable that only
 * existed while the roster screen did. The work already saved survived, in
 * the history; what was lost was the half-finished roster, so coming back
 * meant opening a new session and starting the class again.
 *
 * Worse than losing it: a session opened twice gives no warning the second
 * time. The duplicate check reads the child's vaccination record, not the
 * batches this phone saved an hour ago, so the forty already done looked
 * like forty still to do.
 *
 * So it is written down, the same way the history is. Split from
 * `vaccination`, which holds the rules: that half is arithmetic over records
 * and can be run and checked anywhere, and it would stop being checkable the
 * moment it imported a store that reaches for the file system.
 */
const file = () => new File(Paths.document, "vaccine-session.json");

function save(): void {
  try {
    const snap = snapshotSession();
    // No session is no file. A stale one left on disk would be offered as
    // work in progress the next time the app opened.
    if (snap == null) {
      if (file().exists) file().delete();
      return;
    }
    file().write(JSON.stringify(snap));
  } catch {
    // The next change tries again; a failed write lasts until then.
    toast(
      tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save to this device"),
      "error",
    );
  }
}

/**
 * Read the open session back at launch.
 *
 * A file that no longer restores — its activity or its lot has gone from
 * master data — is deleted rather than left to fail again on every launch.
 */
export async function hydrateOpenSession(): Promise<void> {
  try {
    const f = file();
    if (!f.exists) return;
    const snap = JSON.parse(await f.text()) as SessionSnapshot;
    if (!restoreSession(snap)) f.delete();
  } catch {
    try {
      file().delete();
    } catch {
      // Nothing to be done; the next save overwrites it.
    }
  }

  // Only after the restore, so putting the session back does not
  // immediately write it out again.
  watchSession(save);
}
