import { createContext, useContext, useRef, type ReactNode } from "react";
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

export function ScreenFrame({ children }: { children: ReactNode }) {
  const height = useRef(0);
  return (
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
  );
}

/** The page's height as last laid out, or 0 outside a frame. */
export function usePageHeight(): { current: number } {
  return useContext(FrameContext) ?? { current: 0 };
}
