import { File, Paths } from "expo-file-system";
import { onDemoReset } from "./demoReset";

/**
 * A visit's records, kept on the device.
 *
 * The forms hold what was written in a module-level map per Authen Code, which
 * was gone the moment the app closed: a home visit filled in for a demo was
 * empty again after a restart. This writes one such map to a file whenever it
 * changes, and fills it back in at launch, before the navigator is built.
 *
 * Best effort, like the other stores: a failed write lasts the launch.
 */
export function keptMap<V>(
  name: string,
  map: Map<string, V>,
  /** For a value with something JSON flattens, like a Date. */
  revive?: (saved: V) => V,
): { save: () => void; hydrate: () => Promise<void> } {
  const file = () => new File(Paths.document, name);
  onDemoReset(() => {
    map.clear();
    const f = file();
    if (f.exists) f.delete();
  });
  return {
    save() {
      try {
        file().write(JSON.stringify([...map]));
      } catch {
        // The next change tries again.
      }
    },
    async hydrate() {
      try {
        const f = file();
        if (!f.exists) return;
        const saved = JSON.parse(await f.text()) as [string, V][];
        for (const [key, value] of saved) {
          map.set(key, revive != null ? revive(value) : value);
        }
      } catch {
        // Unreadable is the same as nothing kept.
      }
    },
  };
}
