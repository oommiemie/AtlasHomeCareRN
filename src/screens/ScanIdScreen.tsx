import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X } from "lucide-react-native";

import { Glass } from "../components/Glass";
import { GlassIconButton } from "../components/GlassIconButton";
import { PressableScale } from "../components/PressableScale";
import { toast } from "../components/Toast";
import IdScanner from "../../modules/id-scanner";
import { readIdWithAi } from "../models/idAi";
import { readIdCard, scannedCount } from "../models/idCard";
import { idScanHandler } from "../models/idScan";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
} from "../theme/tokens";

/**
 * A Thai ID card's proportions — ISO/IEC 7810 ID-1, 85.6 by 54 millimetres.
 * The guide is cut to the card itself so filling it is unambiguous.
 */
const CARD_RATIO = 85.6 / 54;

/** How far in from the screen's edges the guide sits. */
const GUIDE_INSET = 24;

/** The scrim over everything but the guide. */
const SCRIM = "rgba(0,0,0,0.62)";

/**
 * "ถ่ายภาพบัตร" — the camera, with a frame to lay the card in.
 *
 * A camera of our own rather than the system picker, which is what the guide
 * costs: the picker presents its own screen and nothing can be drawn over it.
 * The frame is the whole point — a card photographed small in a wide frame is
 * a card Vision cannot resolve the text on, and nothing in the flow was
 * telling anyone to fill the shot.
 *
 * The whole photograph is read, not just the guide's rectangle. The guide is
 * there to get the card big and square in frame; cropping to it as well would
 * throw away a line that sat a few points outside.
 */
export function ScanIdScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const camera = useRef<CameraView>(null);
  const [size, setSize] = useState<string | undefined>(undefined);

  /**
   * The smallest capture that still resolves the card's print.
   *
   * The sizes a camera offers are device-specific strings like "1920x1080",
   * so the list has to be read and picked from rather than assumed.
   */
  const chooseSize = async () => {
    if (size != null) return;
    try {
      const sizes = (await camera.current?.getAvailablePictureSizesAsync()) ?? [];
      const wide = sizes
        .map((s) => ({ s, w: Number(s.split("x")[0]) }))
        .filter((o) => Number.isFinite(o.w) && o.w >= 1600)
        .sort((a, b) => a.w - b.w);
      if (wide.length > 0) setSize(wide[0].s);
    } catch {
      // The default size is a fine answer; it is only larger than it needs
      // to be.
    }
  };

  const guideWidth = width - GUIDE_INSET * 2;
  const guideHeight = guideWidth / CARD_RATIO;
  const guideTop = Math.max(insets.top + 96, (height - guideHeight) / 2 - 60);

  /**
   * Two readings of the same photograph, taken together.
   *
   * On-device Vision is instant, works with no network and never leaves the
   * phone, but it only ever returns lines — which field a line is has to be
   * guessed by pattern. The vision model on the cluster reads the card as a
   * card and answers with fields, which is both more of them and more often
   * right; it also needs a network and sends the photograph away.
   *
   * So both run, and the model's answers win where it gave one. If it is
   * unreachable or slow the on-device pass has already answered, and the
   * scanner works exactly as it did before.
   */
  const shoot = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const shot = await camera.current?.takePictureAsync({
        quality: 0.9,
        base64: true,
      });
      if (shot == null) {
        toast("ถ่ายภาพไม่สำเร็จ ลองใหม่", "error");
        return;
      }

      const [onDevice, fromModel] = await Promise.all([
        IdScanner.readText(shot.uri).then(readIdCard).catch(() => ({})),
        shot.base64 == null ? Promise.resolve({}) : readIdWithAi(shot.base64),
      ]);
      const found = { ...onDevice, ...fromModel };

      if (scannedCount(found) === 0) {
        toast(
          "อ่านข้อมูลจากบัตรไม่ได้ ลองใหม่ให้บัตรเต็มกรอบและชัดขึ้น",
          "error",
        );
        return;
      }
      idScanHandler()?.(found);
      nav.goBack();
    } catch {
      toast("อ่านข้อมูลจากบัตรไม่ได้", "error");
    } finally {
      setBusy(false);
    }
  };

  if (permission == null) return <View style={{ flex: 1, backgroundColor: "#000000" }} />;

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          alignItems: "center",
          justifyContent: "center",
          padding: SPACE.xl,
          gap: SPACE.lg,
        }}
      >
        <Text style={{ fontSize: 16, color: "#FFFFFF", textAlign: "center" }}>
          ต้องอนุญาตให้ใช้กล้องก่อน จึงจะถ่ายภาพบัตรได้
        </Text>
        <PressableScale
          onPress={() =>
            void requestPermission().then((r) => {
              if (!r.granted) {
                toast("ต้องอนุญาตให้ใช้กล้องในการตั้งค่าเครื่อง", "error");
              }
            })
          }
          accessibilityRole="button"
          accessibilityLabel="อนุญาตให้ใช้กล้อง"
          style={{
            height: 48,
            paddingHorizontal: SPACE.xxl,
            borderRadius: RADIUS.capsule,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: PRIMARY_500,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
            อนุญาต
          </Text>
        </PressableScale>
        <Pressable onPress={() => nav.goBack()} accessibilityRole="button" hitSlop={8}>
          <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.7)" }}>ปิด</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <CameraView
        ref={camera}
        style={{ flex: 1 }}
        facing="back"
        // Enough to resolve the print, small enough to send: a full 12MP
        // frame is several megabytes of base64 for eight lines of text.
        pictureSize={size}
        onCameraReady={() => void chooseSize()}
      />

      {/* The scrim is four rectangles around the guide rather than one view
          with a hole: a border cannot cut a hole in a fill, and a mask over a
          live camera preview costs a composite every frame. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      >
        <View style={{ height: guideTop, backgroundColor: SCRIM }} />
        <View style={{ flexDirection: "row", height: guideHeight }}>
          <View style={{ width: GUIDE_INSET, backgroundColor: SCRIM }} />
          <View style={{ flex: 1 }}>
            <Corner top left />
            <Corner top />
            <Corner left />
            <Corner />
          </View>
          <View style={{ width: GUIDE_INSET, backgroundColor: SCRIM }} />
        </View>
        <View style={{ flex: 1, backgroundColor: SCRIM }} />
      </View>

      <Text
        style={{
          position: "absolute",
          left: SPACE.xl,
          right: SPACE.xl,
          top: guideTop + guideHeight + SPACE.xl,
          fontSize: 16,
          lineHeight: 22,
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        วางบัตรให้เต็มกรอบ แล้วกดถ่าย
      </Text>

      <View
        style={{ position: "absolute", top: insets.top + SPACE.sm, left: SPACE.lg }}
      >
        {/* Dark glass over the live feed, as the Camera app's own
            controls are: the material takes what the lens sees. */}
        <GlassIconButton
          onPress={() => nav.goBack()}
          accessibilityLabel="ปิด"
          colorScheme="dark"
        >
          <X size={22} color="#FFFFFF" strokeWidth={2.6} />
        </GlassIconButton>
      </View>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: insets.bottom + SPACE.xl,
          alignItems: "center",
        }}
      >
        {/* The shutter: a white disc, as every camera's is, set in a ring
            of dark glass rather than a painted one. */}
        <Pressable
          onPress={() => void shoot()}
          accessibilityRole="button"
          accessibilityLabel="ถ่ายภาพบัตร"
          accessibilityState={{ busy }}
        >
          <Glass
            colorScheme="dark"
            interactive
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                alignItems: "center",
                justifyContent: "center",
                // Written out rather than taken from SURFACE: this disc
                // stands on the camera feed, which is dark whatever the app
                // is set to, and every camera's shutter is white.
                backgroundColor: "#FFFFFF",
              }}
            >
              {busy && <ActivityIndicator size="small" color={PRIMARY_500} />}
            </View>
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}

/** One bracket at a corner of the guide. */
function Corner({ top, left }: { top?: boolean; left?: boolean }) {
  const arm = 28;
  const weight = 3;
  return (
    <View
      style={{
        position: "absolute",
        width: arm,
        height: arm,
        [top === true ? "top" : "bottom"]: 0,
        [left === true ? "left" : "right"]: 0,
        [top === true ? "borderTopWidth" : "borderBottomWidth"]: weight,
        [left === true ? "borderLeftWidth" : "borderRightWidth"]: weight,
        borderColor: "#FFFFFF",
        [top === true
          ? left === true
            ? "borderTopLeftRadius"
            : "borderTopRightRadius"
          : left === true
            ? "borderBottomLeftRadius"
            : "borderBottomRightRadius"]: 10,
      }}
    />
  );
}
