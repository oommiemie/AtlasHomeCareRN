import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Check, Moon, Smartphone, Sun, Tag, Type, Zap } from "lucide-react-native";

import { GlassSliderNative } from "../../modules/glass-slider";

import { IosStepSlider } from "../components/IosStepSlider";

import { Card } from "../components/Card";
import { SettingsGroup, SettingsScreen } from "../components/SettingsScreen";
import { toast } from "../components/Toast";
import { feel } from "../utils/haptics";
import {
  TEXT_SIZES,
  setReduceMotion,
  setTabLabels,
  setTextSize,
  setTheme,
  useDisplay,
  type ThemeChoice,
} from "../models/display";
import {
  FILL_SUBTLE,
  PRIMARY_500,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { tr } from "../i18n";

type Glyph = typeof Type;

const THEMES: { key: ThemeChoice; Icon: Glyph; label: string; detail: string }[] = [
  {
    key: "system",
    Icon: Smartphone,
    label: tr("ตามระบบ", "System"),
    detail: tr(
      "เปลี่ยนตามการตั้งค่าของเครื่อง",
      "Follows your device settings",
    ),
  },
  {
    key: "light",
    Icon: Sun,
    label: tr("สว่าง", "Light"),
    detail: tr("พื้นขาวตลอดเวลา", "Always a light background"),
  },
  {
    key: "dark",
    Icon: Moon,
    label: tr("มืด", "Dark"),
    detail: tr("พื้นดำตลอดเวลา", "Always a dark background"),
  },
];

/**
 * "การแสดงผล" — the shell, as this carer wants to meet it.
 *
 * Every row here changes something the moment it is touched. A page of
 * switches that only remember themselves would be worse than no page.
 */
export function DisplaySettingsScreen() {
  const display = useDisplay();
  const saved = TEXT_SIZES.findIndex((t) => t.key === display.textSize);
  /**
   * The size under the finger, before it is the app's.
   *
   * Writing it to the store on every notch crossed was what made the drag
   * feel broken: a change there remounts the whole app so that every screen
   * takes the new size at once, and the remount took this screen — and the
   * gesture with it — out from under the finger. One notch was all anybody
   * could move. So the drag lives here, the preview above reads it, and the
   * app is told once, when the finger lifts.
   */
  const [dragging, setDragging] = useState<number | null>(null);
  const at = dragging ?? (saved < 0 ? 2 : saved);
  // The committed size is already in every rendered size, so the preview
  // only has to carry the difference between that and the one being tried.
  const preview = TEXT_SIZES[at].scale / TEXT_SIZES[saved < 0 ? 2 : saved].scale;

  return (
    <SettingsScreen title={tr("การแสดงผล", "Display")}>
      <SettingsGroup title={tr("ลักษณะที่ปรากฏ", "Appearance")}>
        <Card padded={false}>
          {THEMES.map((t, i) => (
            <Choice
              key={t.key}
              Icon={t.Icon}
              label={t.label}
              detail={t.detail}
              on={display.theme === t.key}
              first={i === 0}
              onPress={() => {
                feel("tick");
                const changed = display.theme !== t.key;
                setTheme(t.key);
                // A tick later: this change remounts the app, toast host and all.
                if (changed)
                  setTimeout(
                    () => toast(tr("เปลี่ยนธีมแล้ว", "Theme changed"), "success"),
                    0,
                  );
              }}
            />
          ))}
        </Card>
      </SettingsGroup>

      <SettingsGroup title={tr("ขนาดตัวอักษร", "Text size")}>
        {/*
          The sample sits above the slider rather than below it, so the
          thing being changed is what the eye is already on when the choice
          is made. It is ordinary app text: this page scales along with
          everything else, which is the most honest preview there is.
        */}
        <Card>
          <View style={{ gap: SPACE.sm }}>
            <Text
              style={{
                fontSize: Math.round(16 * preview),
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              นาง จันทร์เพ็ญ บุญมี
            </Text>
            <Text
              style={{
                fontSize: Math.round(14 * preview),
                lineHeight: Math.round(20 * preview),
                color: TEXT_MUTED,
              }}
            >
              {tr(
                "เยี่ยมบ้าน · 08:30 น. · ทบทวนรายการยาและวัดความดัน",
                "Home visit · 08:30 · Review medications and check blood pressure",
              )}
            </Text>
          </View>
        </Card>

        <Card style={{ gap: SPACE.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
            {/* The ends of the range, shown rather than named — the small
                letter and the large one are what the slider does. */}
            <Text style={{ fontSize: 14, color: TEXT_MUTED }}>
              {tr("ก", "A")}
            </Text>
            <View style={{ flex: 1 }}>
              <SizeSlider
                index={at}
                count={TEXT_SIZES.length}
                onChange={setDragging}
                onSettle={(i) => {
                  setDragging(null);
                  const changed = display.textSize !== TEXT_SIZES[i].key;
                  setTextSize(TEXT_SIZES[i].key);
                  // A tick later, past the same remount as the theme's.
                  if (changed)
                    setTimeout(
                      () =>
                        toast(
                          tr("เปลี่ยนขนาดตัวอักษรแล้ว", "Text size changed"),
                          "success",
                        ),
                      0,
                    );
                }}
              />
            </View>
            <Text style={{ fontSize: 26, color: TEXT_MUTED }}>
              {tr("ก", "A")}
            </Text>
          </View>

          {/* The size by name. The step it is out of said nothing a carer
              needed — the slider already shows how far along it is — but
              the name is what they would tell somebody else. */}
          <Text
            style={{
              textAlign: "center",
              fontSize: 14,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {TEXT_SIZES[at]?.label ?? tr("ปกติ", "Default")}
          </Text>
        </Card>
      </SettingsGroup>

      <SettingsGroup title={tr("ทั่วไป", "General")}>
        <Card padded={false}>
          <Toggle
            Icon={Tag}
            label={tr("แสดงชื่อเมนูใต้แถบไอคอน", "Show tab bar labels")}
            detail={tr(
              "ปิดแล้วแถบล่างจะเหลือแต่ไอคอน",
              "When off, the bottom bar shows icons only",
            )}
            value={display.tabLabels}
            onChange={(on) => {
              setTabLabels(on);
              toast(
                on
                  ? tr("แสดงชื่อเมนูแล้ว", "Tab labels shown")
                  : tr("ซ่อนชื่อเมนูแล้ว", "Tab labels hidden"),
                "success",
              );
            }}
            first
          />
          <Toggle
            Icon={Zap}
            label={tr("ลดการเคลื่อนไหว", "Reduce motion")}
            detail={tr(
              "ตัดอนิเมชั่นของแอพออก หน้าจอจะเปลี่ยนทันทีแทนการค่อยๆ เลื่อน",
              "Turns off the app's animations; screens change instantly instead of sliding",
            )}
            value={display.reduceMotion}
            onChange={(on) => {
              setReduceMotion(on);
              toast(
                on
                  ? tr("เปิดลดการเคลื่อนไหวแล้ว", "Reduce motion on")
                  : tr("ปิดลดการเคลื่อนไหวแล้ว", "Reduce motion off"),
                "success",
              );
            }}
          />
        </Card>
      </SettingsGroup>
    </SettingsScreen>
  );
}

/** A setting that is simply on or off. */
function Toggle({
  Icon,
  label,
  detail,
  value,
  onChange,
  first,
}: {
  Icon: Glyph;
  label: string;
  detail: string;
  value: boolean;
  onChange: (on: boolean) => void;
  first?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        // The row carries the padding, not the text block inside it: given
        // to the text alone the switch rides up off the row's centre line.
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderTopWidth: first === true ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <Icon size={20} color={TEXT_PRIMARY} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, color: TEXT_PRIMARY }}>{label}</Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(on) => {
          feel("tick");
          onChange(on);
        }}
        trackColor={{ true: PRIMARY_500 }}
        style={{ alignSelf: "center" }}
      />
    </View>
  );
}

/**
 * Apple's own slider, set to the five sizes.
 *
 * SwiftUI's `Slider`, hosted by a native module of this app's own — see
 * modules/glass-slider. Not `UISlider` through the community wrapper, which
 * is what this was: UIKit's slider has no tick marks, so the dots under it
 * had to be drawn here and lined up with the control by arithmetic, and
 * they came out low and short. iOS 26 gave SwiftUI's slider real ticks, so
 * the system places them, the thumb covers the one it sits on, and the
 * whole control follows whatever the next iOS does to sliders.
 *
 * The range is the INDEX into the sizes, not the scale, because the steps
 * are not evenly spaced in scale and a slider must move in even ones.
 *
 * Two handlers, and the difference matters: the slide runs on every step
 * crossed while the finger is down and only moves the preview, while the
 * settle is what tells the app. Writing the size on every change remounts
 * the whole app so each screen takes the new size at once, and that
 * remount pulled this screen out from under the gesture.
 */
function SizeSlider({
  index,
  count,
  onChange,
  onSettle,
}: {
  index: number;
  count: number;
  /** Each step crossed, while the finger is still down. */
  onChange: (i: number) => void;
  /** The one it came to rest on. */
  onSettle: (i: number) => void;
}) {
  if (GlassSliderNative == null) {
    // Every build without the native module — an older iPhone, and every
    // Android — gets the same control drawn rather than a gap where it was.
    return (
      <IosStepSlider
        value={index}
        steps={count}
        onSlide={(i) => {
          feel("tick");
          onChange(i);
        }}
        onSettle={onSettle}
        accessibilityLabel={tr("ขนาดตัวอักษร", "Text size")}
      />
    );
  }
  return (
    <GlassSliderNative
      value={index}
      steps={count}
      onSlide={(e) => {
        feel("tick");
        onChange(Math.round(e.nativeEvent.value));
      }}
      onSettle={(e) => onSettle(Math.round(e.nativeEvent.value))}
      accessibilityLabel={tr("ขนาดตัวอักษร", "Text size")}
      style={{ height: 44 }}
    />
  );
}

/**
 * One of a set, chosen by a tick.
 *
 * The same shape as a menu's toggled item — glyph, name, and the tick at
 * the trailing edge — because it is the same act: one of these is on, and
 * picking another turns this one off.
 */
function Choice({
  Icon,
  label,
  detail,
  on,
  first,
  onPress,
}: {
  Icon: Glyph;
  label: string;
  detail: string;
  on: boolean;
  first?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        minHeight: 56,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderTopWidth: first === true ? 0 : 1,
        borderTopColor: SEPARATOR,
        backgroundColor: pressed ? FILL_SUBTLE : "transparent",
      })}
    >
      <Icon size={20} color={on ? PRIMARY_500 : TEXT_PRIMARY} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, color: TEXT_PRIMARY }}>{label}</Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>{detail}</Text>
      </View>
      <View style={{ width: 20, alignItems: "center" }}>
        {on && <Check size={18} color={PRIMARY_500} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}
