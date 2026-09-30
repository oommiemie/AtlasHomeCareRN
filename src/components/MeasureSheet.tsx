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

import { ActionBar, PrimaryAction, SecondaryAction, useTrayRoom } from "./ActionBar";
import { BlurStage } from "./BlurStage";
import { BpMonitor3D } from "./BpMonitor3D";
import { BpResult } from "./BpResult";
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
  | {
      at: "measuring";
      device: BleDevice;
      /** Read already, but still being shown coming up on the monitor. */
      values?: Record<string, string>;
    }
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
  const trayRoom = useTrayRoom(insets.bottom + 96) || SPACE.lg;
  const [stage, setStage] = useState<Stage>({ at: "scanning" });
  // Counts readings, so measuring again restarts the cuff's monitor.
  const [run, setRun] = useState(0);

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
    setRun((n) => n + 1);
    measure(device)
      .then((values) =>
        // A cuff's reading waits for the monitor on screen to finish its
        // minute and show it; anything else is shown at once.
        device.fills.includes("bp")
          ? setStage((now) => (now.at === "measuring" && now.device === device ? { ...now, values } : now))
          : setStage({ at: "done", device, values }),
      )
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
              // trapped behind it — nothing where the tray is a footer.
              paddingBottom: trayRoom,
              ...readable(FORM_MAX),
            }}
            showsVerticalScrollIndicator={false}
          >
            {/*
              A cuff's monitor, pumping up and letting down while it
              measures; and once it has, the same one — not a new one
              starting over — kept smaller, showing its result, over the
              figures below. It runs out past the page's margins to its
              edges, so it sits on the page rather than in a box on it.
            */}
            {(stage.at === "measuring" || stage.at === "done") && stage.device.fills.includes("bp") && (
              <View style={{ alignSelf: "stretch", marginHorizontal: -GUTTER }}>
                <BpMonitor3D
                  run={run}
                  compact={stage.at === "done"}
                  compactHeight={160}
                  result={bpReading(stage.values)}
                  onDone={() =>
                    setStage((now) =>
                      now.at === "measuring" && now.values != null
                        ? { at: "done", device: now.device, values: now.values }
                        : now,
                    )
                  }
                />
              </View>
            )}

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
                // A cuff has its monitor above; anything else, the spinner.
                plain={stage.device.fills.includes("bp")}
                icon={<ActivityIndicator size="small" color={PRIMARY_500} />}
                title={tr(`กำลังวัดด้วย${stage.device.kind}`, `Measuring with ${stage.device.kind.toLowerCase()}`)}
                detail={tr(
                  "ให้ผู้ป่วยอยู่นิ่งจนกว่าเครื่องจะอ่านค่าเสร็จ",
                  "Ask the patient to keep still until the reading is complete",
                )}
              />
            )}

            {/* A cuff's reading is one card that carries its own "read"
                line and source, short enough that the monitor, it and the
                tray sit on one screen; any other instrument's is a row a
                figure under a "read" chip. */}
            {stage.at === "done" && bpReading(stage.values) != null && (
              <BpResult {...bpReading(stage.values)!} source={stage.device.name} />
            )}
            {stage.at === "done" && bpReading(stage.values) == null && (
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
            action, and it changes with the state — and none while the app
            is busy with a device: searching again in the middle of a
            reading would only throw the reading away.
          */}
          {stage.at !== "scanning" && stage.at !== "connecting" && stage.at !== "measuring" && (
            <ActionBar>
              {stage.at === "done" ? (
                // Side by side — again on the left, the answer on the
                // right — so the tray is one row high and the reading
                // above it is not pushed off the screen.
                <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryAction
                      label={tr("วัดใหม่อีกครั้ง", "Measure again")}
                      // Straight to measuring: it was in use a moment ago.
                      onPress={() => read(stage.device)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryAction
                      label={tr("ใช้ค่านี้", "Use these values")}
                      onPress={() => {
                        onUse(stage.values);
                        onClose();
                      }}
                    />
                  </View>
                </View>
              ) : (
                <SecondaryAction
                  label={stage.at === "found" ? tr("ค้นหาใหม่", "Search again") : tr("ค้นหาอีกครั้ง", "Try again")}
                  onPress={rescan}
                />
              )}
            </ActionBar>
          )}
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

/** A cuff's reading, as the monitor's screen shows it. */
function bpReading(values: Record<string, string> | undefined) {
  if (values?.bp == null) return null;
  const [sys, dia] = values.bp.split("/").map(Number);
  const pulse = values.pulse == null ? null : Number(values.pulse);
  return { sys, dia, pulse };
}

/** A state with nothing to do but wait. */
function Waiting({
  icon,
  plain,
  title,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  /** No disc: there is a picture of what is happening above it already. */
  plain?: boolean;
  title: string;
  detail: string;
  tone?: string;
}) {
  return (
    <View style={{ alignItems: "center", gap: SPACE.md, paddingVertical: plain ? SPACE.sm : SPACE.huge }}>
      {!plain && (
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
      )}
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
