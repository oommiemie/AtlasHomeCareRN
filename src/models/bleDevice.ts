/**
 * The measuring instruments a carer carries, over Bluetooth.
 *
 * Simulated, the way the card reader is: there is no BLE stack in this build
 * and no cuff on the desk, so `scan` and `measure` answer on a timer with
 * plausible figures. What is real is the *shape* — a scan that takes a
 * moment and may find nothing, devices that each know which readings they
 * produce, a measurement that takes as long as the instrument really takes,
 * and an occasional failure. Swapping in `react-native-ble-plx` later means
 * replacing the two promises below and nothing else.
 */

import { tr } from "../i18n";

/** What a scan turns up. */
export type BleDevice = {
  id: string;
  /** As it advertises itself. */
  name: string;
  /** What the carer calls it. */
  kind: string;
  /** Which screening fields it fills. */
  fills: string[];
  /** How long a reading takes, in seconds — a cuff is slow, a scale is not. */
  seconds: number;
  /** Signal strength, 0–3 bars. */
  signal: number;
  /**
   * Whether the phone is already talking to it.
   *
   * A scan turns up two different things and they are not interchangeable:
   * instruments this phone has paired with before and is connected to now,
   * which can be used at once, and instruments that are merely *in the
   * room* advertising themselves, which have to be connected first. A list
   * that showed both the same way would have the carer pressing a cuff that
   * belongs to the clinic next door.
   */
  connected: boolean;
};

export const DEVICES: BleDevice[] = [
  {
    id: "bp-01",
    name: "BP-7156",
    kind: tr("เครื่องวัดความดัน", "Blood pressure monitor"),
    fills: ["bp", "pulse"],
    seconds: 9,
    signal: 3,
    connected: true,
  },
  {
    id: "ox-01",
    name: "SPO-500",
    kind: tr("เครื่องวัดออกซิเจนปลายนิ้ว", "Pulse oximeter"),
    fills: ["spo2", "pulse"],
    seconds: 5,
    signal: 3,
    connected: true,
  },
  {
    id: "gl-01",
    name: "GLU-200",
    kind: tr("เครื่องวัดน้ำตาลในเลือด", "Blood glucose meter"),
    fills: ["glucose"],
    seconds: 6,
    signal: 2,
    connected: false,
  },
  {
    id: "sc-01",
    name: "SCALE-2",
    kind: tr("เครื่องชั่งน้ำหนัก", "Weighing scale"),
    fills: ["weight"],
    seconds: 4,
    signal: 2,
    connected: false,
  },
  {
    id: "th-01",
    name: "THERMO-7",
    kind: tr("เครื่องวัดอุณหภูมิ", "Thermometer"),
    fills: ["temp"],
    seconds: 3,
    signal: 1,
    connected: false,
  },
];

/** How the instruments name themselves in the record. */
export function deviceOf(id: string): BleDevice | undefined {
  return DEVICES.find((d) => d.id === id);
}

/**
 * Connect to one that is only advertising.
 *
 * A second or so, the way a BLE handshake is, and it can fail — a device
 * that walked out of range between the scan and the tap is the ordinary
 * case, not an exotic one.
 */
export function connectDevice(device: BleDevice): Promise<void> {
  return new Promise((done, fail) =>
    setTimeout(
      () =>
        Math.random() < 0.1
          ? fail(new Error(tr("เชื่อมต่อไม่สำเร็จ", "Couldn't connect")))
          : (() => {
              // Held for the rest of the session, as a real pairing is.
              const live = DEVICES.find((d) => d.id === device.id);
              if (live != null) live.connected = true;
              done();
            })(),
      1400,
    ),
  );
}

/**
 * Look for instruments.
 *
 * Two and a half seconds, and it does not always find everything: a scan
 * that returned the same five devices instantly would teach the carer that
 * the button is decoration. The thermometer is the one that hides, because
 * it is the one with one bar of signal.
 */
export function scanDevices(): Promise<BleDevice[]> {
  return new Promise((done) =>
    setTimeout(
      () => done(DEVICES.filter((d) => d.signal > 1 || Math.random() > 0.4)),
      2500,
    ),
  );
}

/**
 * Take a reading, and hand back what goes in which box.
 *
 * The figures are drawn around what a well adult produces, wide enough that
 * two measurements in a row are not the same number — a demonstration where
 * every reading is 120/80 is a demonstration of nothing.
 *
 * Roughly one in twelve fails, because instruments do: a cuff that slips, a
 * finger that moves. The form has to have somewhere to put that.
 */
export function measure(device: BleDevice): Promise<Record<string, string>> {
  const pick = (lo: number, hi: number, dp = 0) =>
    (lo + Math.random() * (hi - lo)).toFixed(dp);

  const values: Record<string, string> = {};
  for (const field of device.fills) {
    switch (field) {
      case "bp":
        values.bp = `${pick(108, 138)}/${pick(66, 88)}`;
        break;
      case "pulse":
        values.pulse = pick(62, 92);
        break;
      case "spo2":
        values.spo2 = pick(95, 99);
        break;
      case "glucose":
        values.glucose = pick(82, 128);
        break;
      case "weight":
        values.weight = pick(48, 82, 1);
        break;
      case "temp":
        values.temp = pick(36.2, 37.3, 1);
        break;
    }
  }

  return new Promise((done, fail) =>
    setTimeout(
      () =>
        Math.random() < 0.08
          ? fail(new Error(tr("อ่านค่าไม่สำเร็จ", "Couldn't get a reading")))
          : done(values),
      device.seconds * 1000,
    ),
  );
}
