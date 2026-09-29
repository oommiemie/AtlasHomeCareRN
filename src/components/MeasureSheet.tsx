import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  Check,
  X,
} from "lucide-react-native";

import { ActionBar, PrimaryAction, SecondaryAction } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { Card } from "./Card";
import { Chevron } from "./Chevron";
import { GlassIconButton } from "./GlassIconButton";
import { toast } from "./Toast";
import {
  CANVAS,
  DANGER,
  GROUPED_BG,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../theme/tokens";
import { SCREENING_FIELDS } from "../models/community";
import {
  connectDevice,
  measure,
  scanDevices,
  type BleDevice,
} from "../models/bleDevice";
import { tr } from "../i18n";
import { GUTTER, FORM_MAX, readable } from "../theme/layout";

const NONE_FOUND = tr("ไม่พบอุปกรณ์ที่เชื่อมต่อได้", "No devices found to connect to");

/** Where the sheet has got to. */
type Stage =
  | { at: "scanning" }
  | { at: "found"; devices: BleDevice[] }
  | { at: "connecting"; device: BleDevice }
  | { at: "measuring"; device: BleDevice }
  | { at: "done"; device: BleDevice; values: Record<string, string> }
  | { at: "failed"; device: BleDevice | null; why: string };

/**
 * Taking the readings off the instruments instead of typing them.
 *
 * A carer on a round is carrying a cuff, an oximeter and a meter, and every
 * figure they produce has to be read off one screen and typed into another —
 * which is where the transcription errors live, and where the minutes go.
 * This is the same job done by the instruments talking to the phone.
 *
 * One sheet, four states, one after the other: looking, what was found,
 * taking the reading, and what came back. The carer chooses the instrument
 * because there may be two cuffs in the room and only one of them on this
 * patient; everything after that is waiting.
 *
 * Nothing is written into the form until the last step is accepted. A
 * reading that arrives while the carer is looking at something else and
 * quietly overwrites a figure they typed by hand is the one behaviour that
 * would make this worse than typing.
 */
export function MeasureSheet({
  visible,
  onClose,
  onUse,
}: {
  visible: boolean;
  onClose: () => void;
  /** Hand the readings to the form, keyed by screening field. */
  onUse: (values: Record<string, string>) => void;
}) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>({ at: "scanning" });

  /* Every opening starts a fresh scan: the room may not be the last room. */
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setStage({ at: "scanning" });
    scanDevices().then((devices) => {
      if (!live) return;
      if (devices.length === 0) toast(NONE_FOUND, "warning");
      setStage(
        devices.length === 0
          ? { at: "failed", device: null, why: NONE_FOUND }
          : { at: "found", devices },
      );
    });
    return () => {
      live = false;
    };
  }, [visible]);

  const rescan = () => {
    setStage({ at: "scanning" });
    scanDevices().then((devices) => {
      if (devices.length === 0) toast(NONE_FOUND, "warning");
      setStage(
        devices.length === 0
          ? { at: "failed", device: null, why: NONE_FOUND }
          : { at: "found", devices },
      );
    });
  };

  const read = (device: BleDevice) => {
    setStage({ at: "measuring", device });
    measure(device)
      .then((values) => setStage({ at: "done", device, values }))
      .catch((e: Error) => {
        toast(tr("วัดค่าไม่สำเร็จ", "Measurement failed"), "error");
        setStage({ at: "failed", device, why: e.message });
      });
  };

  /*
    One tap, and what it does depends on where the device already is.

    A connected instrument measures straight away; one that is only
    advertising is connected first and then measures, without a second tap —
    the carer's intent was "use this one", and making them press it twice to
    say so is the app asking about its own plumbing.
  */
  const take = (device: BleDevice) => {
    if (device.connected) {
      read(device);
      return;
    }
    setStage({ at: "connecting", device });
    connectDevice(device)
      .then(() => read(device))
      .catch((e: Error) => {
        toast(tr("เชื่อมต่ออุปกรณ์ไม่สำเร็จ", "Couldn't connect to the device"), "error");
        setStage({ at: "failed", device, why: e.message });
      });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <BlurStage>
        {/*
          The app's own sheet chrome — the reject sheet's, which is the one
          every sheet that is not the assistant wears: the page's canvas, a
          glass close button at the *left*, and the title centred at 16/600
          with a 44pt spacer opposite to hold it there. It had been built
          with its own grey ground, a left-aligned 20/800 title and the
          button on the right, which is a fourth kind of sheet nobody asked
          for.
        */}
        <View style={{ flex: 1, backgroundColor: CANVAS }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: GUTTER,
              paddingTop: SPACE.lg,
              ...readable(FORM_MAX),
            }}
          >
            <GlassIconButton onPress={onClose} accessibilityLabel={tr("ปิด", "Close")}>
              <X size={22} color={TEXT_PRIMARY} strokeWidth={2.6} />
            </GlassIconButton>
            <Text
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 16,
                fontWeight: "600",
                color: TEXT_PRIMARY,
              }}
            >
              {tr("วัดค่าผ่านอุปกรณ์", "Measure with a device")}
            </Text>
            {/* Balances the close button so the title stays centred. */}
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingVertical: SPACE.lg,
              paddingHorizontal: GUTTER,
              gap: SPACE.md,
              // Clears the floating tray, so the last thing read is never
              // trapped behind it.
              paddingBottom: insets.bottom + 96,
              ...readable(FORM_MAX),
            }}
            showsVerticalScrollIndicator={false}
          >
            {stage.at === "scanning" && (
              <Waiting
                icon={<BluetoothSearching size={26} color={PRIMARY_500} strokeWidth={2.2} />}
                title={tr("กำลังค้นหาอุปกรณ์", "Searching for devices")}
                detail={tr(
                  "เปิดเครื่องวัดและให้อยู่ใกล้โทรศัพท์",
                  "Turn the device on and keep it near the phone",
                )}
              />
            )}

            {stage.at === "found" && (
              <>
                <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                  {tr(
                    `พบ ${stage.devices.length} อุปกรณ์ — เลือกเครื่องที่จะใช้วัด`,
                    `${stage.devices.length} device${stage.devices.length === 1 ? "" : "s"} found — choose one to measure with`,
                  )}
                </Text>
                {/* Connected first: those can be used now, and the ones below
                    have to be joined to before they can be. */}
                {[true, false].map((live) => {
                  const group = stage.devices.filter((d) => d.connected === live);
                  if (group.length === 0) return null;
                  return (
                    <View key={String(live)} style={{ gap: SPACE.sm }}>
                      <Text
                        style={{
                          marginLeft: SPACE.sm,
                          fontSize: 12,
                          lineHeight: 18,
                          fontWeight: "600",
                          color: live ? SUCCESS : TEXT_MUTED,
                        }}
                      >
                        {live ? tr("เชื่อมต่อแล้ว", "Connected") : tr("ยังไม่เชื่อมต่อ", "Not connected")}
                      </Text>
                      <Card padded={false}>
                        {group.map((d, i) => (
                          <Pressable
                            key={d.id}
                            onPress={() => take(d)}
                            accessibilityRole="button"
                            accessibilityLabel={`${d.kind} ${d.name} ${
                              d.connected ? tr("เชื่อมต่อแล้ว", "Connected") : tr("ยังไม่เชื่อมต่อ", "Not connected")
                            }`}
                            style={({ pressed }) => ({
                              flexDirection: "row",
                              alignItems: "center",
                              gap: SPACE.md,
                              padding: SPACE.lg,
                              backgroundColor: pressed ? PRIMARY_100 : "transparent",
                              borderTopWidth: i === 0 ? 0 : 1,
                              borderTopColor: SEPARATOR,
                            })}
                          >
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: d.connected
                                  ? `${SUCCESS}1F`
                                  : GROUPED_BG,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {d.connected ? (
                                <BluetoothConnected
                                  size={18}
                                  color={SUCCESS}
                                  strokeWidth={2.2}
                                />
                              ) : (
                                <Bluetooth size={18} color={TEXT_MUTED} strokeWidth={2.2} />
                              )}
                            </View>
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 16,
                                  lineHeight: 21,
                                  fontWeight: "600",
                                  color: TEXT_PRIMARY,
                                }}
                              >
                                {d.kind}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}
                              >
                                {`${d.name} · ${fieldNames(d.fills)}`}
                              </Text>
                            </View>
                            <Bars level={d.signal} />
                            <Chevron />
                          </Pressable>
                        ))}
                      </Card>
                    </View>
                  );
                })}
              </>
            )}

            {stage.at === "connecting" && (
              <Waiting
                icon={<ActivityIndicator size="small" color={PRIMARY_500} />}
                title={tr(`กำลังเชื่อมต่อ${stage.device.kind}`, `Connecting to ${stage.device.kind.toLowerCase()}`)}
                detail={stage.device.name}
              />
            )}

            {stage.at === "measuring" && (
              <Waiting
                icon={<ActivityIndicator size="small" color={PRIMARY_500} />}
                title={tr(`กำลังวัดด้วย${stage.device.kind}`, `Measuring with ${stage.device.kind.toLowerCase()}`)}
                detail={tr(
                  "ให้ผู้ป่วยอยู่นิ่งจนกว่าเครื่องจะอ่านค่าเสร็จ",
                  "Ask the patient to keep still until the reading is complete",
                )}
              />
            )}

            {stage.at === "done" && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    alignSelf: "center",
                    paddingHorizontal: SPACE.md,
                    paddingVertical: 6,
                    borderRadius: RADIUS.capsule,
                    backgroundColor: `${SUCCESS}14`,
                  }}
                >
                  <Check size={14} color={SUCCESS} strokeWidth={2.8} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: SUCCESS }}>
                    {tr("อ่านค่าสำเร็จ", "Reading complete")}
                  </Text>
                </View>
                <Card>
                  {Object.entries(stage.values).map(([key, v], i) => {
                    const f = SCREENING_FIELDS.find((x) => x.key === key);
                    return (
                      <View
                        key={key}
                        style={{
                          flexDirection: "row",
                          alignItems: "baseline",
                          gap: SPACE.md,
                          paddingTop: i === 0 ? 0 : SPACE.md,
                          marginTop: i === 0 ? 0 : SPACE.md,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: SEPARATOR,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 14, color: TEXT_MUTED }}>
                          {f?.label ?? key}
                        </Text>
                        <Text
                          style={{ fontSize: 20, lineHeight: 26, fontWeight: "700", color: TEXT_PRIMARY }}
                        >
                          {v}
                        </Text>
                        <Text style={{ fontSize: 12, color: TEXT_MUTED }}>{f?.unit}</Text>
                      </View>
                    );
                  })}
                </Card>
                <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED, textAlign: "center" }}>
                  {tr(`จาก ${stage.device.name}`, `From ${stage.device.name}`)}
                </Text>
              </>
            )}

            {stage.at === "failed" && (
              <Waiting
                icon={<X size={26} color={DANGER} strokeWidth={2.4} />}
                tone={DANGER}
                title={stage.why}
                detail={
                  stage.device == null
                    ? tr(
                        "ตรวจสอบว่าเปิดเครื่องวัดและเปิด Bluetooth แล้ว",
                        "Check that the device and Bluetooth are both on",
                      )
                    : tr(
                        "ลองวัดใหม่อีกครั้ง หรือเลือกอุปกรณ์อื่น",
                        "Try measuring again, or choose another device",
                      )
                }
              />
            )}
          </ScrollView>

          {/*
            The app's floating tray, as the reject sheet carries it: a tray
            standing off the foot, not a bar ruled along the bottom edge. One
            action, and it changes with the state.
          */}
          <ActionBar>
            {stage.at === "done" ? (
              <PrimaryAction
                label={tr("ใช้ค่านี้", "Use these values")}
                onPress={() => {
                  onUse(stage.values);
                  onClose();
                }}
              />
            ) : (
              <SecondaryAction
                label={stage.at === "found" ? tr("ค้นหาใหม่", "Search again") : tr("ค้นหาอีกครั้ง", "Try again")}
                onPress={rescan}
              />
            )}
          </ActionBar>
        </View>
      </BlurStage>
    </Modal>
  );
}

/** What an instrument fills, in the form's own words. */
function fieldNames(keys: string[]): string {
  return keys
    .map((k) => SCREENING_FIELDS.find((f) => f.key === k)?.label ?? k)
    .join(" · ");
}

/** A state with nothing to do but wait. */
function Waiting({
  icon,
  title,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone?: string;
}) {
  return (
    <View style={{ alignItems: "center", gap: SPACE.md, paddingVertical: SPACE.huge }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: `${tone ?? PRIMARY_500}14`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <Text
        style={{ fontSize: 16, lineHeight: 21, fontWeight: "600", color: TEXT_PRIMARY, textAlign: "center" }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: TEXT_MUTED, textAlign: "center" }}>
        {detail}
      </Text>
    </View>
  );
}

/** Signal strength, as three rising bars. */
function Bars({ level }: { level: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 14 }}>
      {[6, 10, 14].map((h, i) => (
        <View
          key={h}
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            backgroundColor: i < level ? PRIMARY_500 : `${TEXT_MUTED}33`,
          }}
        />
      ))}
    </View>
  );
}
