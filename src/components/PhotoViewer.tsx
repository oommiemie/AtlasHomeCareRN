import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";

import { tr } from "../i18n";

/**
 * A photograph, full-screen.
 *
 * The form shows the pictures as a grid of thumbnails; this is the one the
 * carer tapped, at the size the phone can show it, over a black ground —
 * because a wound or a pill box photographed to be looked at later is no
 * use as a 96-point square. Swipe or use the arrows to move between the
 * others in the set; the count and a close cross sit over the top.
 *
 * A horizontal `ScrollView` paged to the screen width, rather than a
 * gesture library: the whole of what this needs is to snap between
 * full-width pages, which paging does, and it is one fewer dependency for
 * something the platform already draws.
 */
export function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  /** Which one to open on; null when closed. */
  index: number | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // The window as it is now, not as it was when the viewer was built: a
  // tablet turned on its side while a photo is open re-pages to the new
  // width rather than leaving each picture a portrait's width apart.
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(index ?? 0);
  const scroll = useState<ScrollView | null>(null);
  const [ref, setRef] = scroll;

  const open = index != null;

  /* Jump to the tapped photo the moment it opens, without an animation —
     the modal's own slide is the animation, and a scroll on top of it
     reads as a stutter. */
  useEffect(() => {
    if (!open) return;
    setAt(index ?? 0);
    // After the list has laid out at the modal's width.
    const id = setTimeout(
      () => ref?.scrollTo({ x: (index ?? 0) * width, animated: false }),
      0,
    );
    return () => clearTimeout(id);
    // `width` is left out on purpose: a turn keeps the photo being looked
    // at (below), not the one that was tapped to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, ref]);

  // Turned while open: the pages are now a different width, so move to
  // where the one on screen is in the new layout.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(
      () => ref?.scrollTo({ x: at * width, animated: false }),
      0,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const go = (to: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, to));
    ref?.scrollTo({ x: clamped * width, animated: true });
    setAt(clamped);
  };

  return (
    <Modal
      visible={open}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      // iOS holds a modal upright unless told otherwise; a tablet turns.
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <ScrollView
          ref={setRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setAt(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          style={{ flex: 1 }}
        >
          {photos.map((uri) => (
            <Zoomable key={uri} uri={uri} width={width} height={height} />
          ))}
        </ScrollView>

        {/* The close cross, top right, clear of the notch. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr("ปิด", "Close")}
          hitSlop={8}
          style={{
            position: "absolute",
            top: insets.top + 8,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        >
          <X size={22} color="#FFFFFF" strokeWidth={2.6} />
        </Pressable>

        {/* Which of how many, top centre. */}
        {photos.length > 1 && (
          <View
            style={{
              position: "absolute",
              top: insets.top + 14,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
            pointerEvents="none"
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>
              {`${at + 1} / ${photos.length}`}
            </Text>
          </View>
        )}

        {/* Arrows, for a thumb that would rather not swipe. */}
        {photos.length > 1 && at > 0 && (
          <Pressable
            onPress={() => go(at - 1)}
            accessibilityRole="button"
            accessibilityLabel={tr("รูปก่อนหน้า", "Previous photo")}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              marginTop: -22,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.16)",
            }}
          >
            <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        )}
        {photos.length > 1 && at < photos.length - 1 && (
          <Pressable
            onPress={() => go(at + 1)}
            accessibilityRole="button"
            accessibilityLabel={tr("รูปถัดไป", "Next photo")}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              marginTop: -22,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.16)",
            }}
          >
            <ChevronRight size={26} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

/**
 * One photograph that pinches to zoom.
 *
 * The zoom is the platform's own, off a zoom `ScrollView`, so there is no
 * gesture library. The one rule that keeps it from jumping is that the
 * thing being zoomed has a *fixed pixel size* — exactly the screen — not a
 * percentage: a percentage height is recomputed as the zoom scale changes,
 * and the picture bounces in and out on its own as the layout chases the
 * scale. A box the size of the screen with the image `contain`ed in it
 * scales cleanly.
 *
 * Whether it is zoomed is read back from the scroll's actual `zoomScale`
 * rather than tracked by hand, so a pinch and a double tap can never
 * disagree about where the picture is.
 */
function Zoomable({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const inner = useState<ScrollView | null>(null);
  const [ref, setRef] = inner;
  const zoomed = useState(false);
  const [isZoomed, setZoomed] = zoomed;

  const toggle = () => {
    if (isZoomed) {
      ref?.scrollResponderZoomTo({ x: 0, y: 0, width, height, animated: true });
    } else {
      const z = 2.5;
      ref?.scrollResponderZoomTo({
        x: width / 2 - width / (2 * z),
        y: height / 2 - height / (2 * z),
        width: width / z,
        height: height / z,
        animated: true,
      });
    }
  };

  return (
    <ScrollView
      ref={setRef}
      style={{ width, height }}
      contentContainerStyle={{ width, height }}
      maximumZoomScale={4}
      minimumZoomScale={1}
      bouncesZoom
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      // The truth of whether it is zoomed, from the scroll itself.
      onScroll={(e) => setZoomed(e.nativeEvent.zoomScale > 1.01)}
    >
      <Pressable onPress={toggle} style={{ width, height }}>
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode="contain"
        />
      </Pressable>
    </ScrollView>
  );
}
