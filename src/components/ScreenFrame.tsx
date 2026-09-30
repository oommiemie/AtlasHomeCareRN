import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { View } from "react-native";

/**
 * How tall the page this is on actually is.
 *
 * A page presented as an iOS sheet starts below the top of the screen, and
 * everything on it measures itself from the sheet's own top edge. Something
 * drawn over the whole screen — the dropdown a field opens — needs to know
 * how far down that edge is, and the screen's height less the page's is the
 * answer: a sheet is anchored to the foot of the screen, and a page that
 * fills the screen gives nought.
 */
const FrameContext = createContext<{ current: number } | null>(null);

/**
 * A place in the page's header that the page's action tray can move into.
 *
 * On a tablet held sideways a tray pinned to the foot of a form sits a long
 * way from the eye and over the last of the form besides; its buttons go up
 * beside the header's toolbar instead. The header says it is there, the
 * tray puts its buttons in, and the header draws whatever is in it. A plain
 * store rather than state: the tray writes after every render of its own,
 * and state held up here would render the whole page again each time.
 */
export type HeaderSlot = {
  headers: number;
  node: ReactNode;
  listeners: Set<() => void>;
  set: (node: ReactNode) => void;
};

function makeSlot(): HeaderSlot {
  const slot: HeaderSlot = {
    headers: 0,
    node: null,
    listeners: new Set(),
    set: (node) => {
      if (slot.node === node) return;
      slot.node = node;
      slot.listeners.forEach((l) => l());
    },
  };
  return slot;
}

const SlotContext = createContext<HeaderSlot | null>(null);

/**
 * Cuts a subtree off from the page's header slot. A Modal renders inside
 * the page's tree and would otherwise inherit it, so a sheet's own tray
 * moved its buttons up into the header of the page behind the sheet.
 */
export function NoHeaderSlot({ children }: { children: ReactNode }) {
  return <SlotContext.Provider value={null}>{children}</SlotContext.Provider>;
}

/** The page's header slot, or null outside a frame. */
export function useHeaderSlot(): HeaderSlot | null {
  return useContext(SlotContext);
}

/** What is in the header slot now, re-rendering when it changes. */
export function useHeaderSlotContent(slot: HeaderSlot | null): ReactNode {
  return useSyncExternalStore(
    (l) => {
      if (slot == null) return () => {};
      slot.listeners.add(l);
      return () => {
        slot.listeners.delete(l);
      };
    },
    () => slot?.node ?? null,
  );
}

export function ScreenFrame({ children }: { children: ReactNode }) {
  const height = useRef(0);
  const slot = useRef<HeaderSlot | null>(null);
  if (slot.current == null) slot.current = makeSlot();
  return (
    <SlotContext.Provider value={slot.current}>
      <FrameContext.Provider value={height}>
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            height.current = e.nativeEvent.layout.height;
          }}
        >
          {children}
        </View>
      </FrameContext.Provider>
    </SlotContext.Provider>
  );
}

/** The page's height as last laid out, or 0 outside a frame. */
export function usePageHeight(): { current: number } {
  return useContext(FrameContext) ?? { current: 0 };
}
