import { sampleVillages } from "../models/household";
import { followUpPatients } from "../models/followUp";
import { sampleTasks, visitHolder } from "../models/task";
import { sampleDetail } from "../models/patientDetail";
import { DEV_SCREEN } from "./devTarget";

/**
 * Opens the app straight onto a screen while that screen is being worked on.
 *
 * The build writes the screen's name into `devTarget`, and the app comes up on
 * it with the tab host underneath, so Back still works and the rest of the app
 * is reachable. A normal build has it as null and nothing changes.
 */
const TARGET = DEV_SCREEN;

/**
 * The stand-in a screen needs to open at all.
 *
 * A detail screen is about a particular patient or house, and arriving there
 * with nothing would crash rather than show anything — so each one is given
 * the first record of its kind.
 */
function paramsFor(screen: string, arg?: string): object | undefined {
  const resident = followUpPatients[0]?.resident;
  const house = sampleVillages[0]?.houses[0];

  switch (screen) {
    case "HealthTracking":
    case "CgmDetail":
    case "Resident":
      return resident == null ? undefined : { resident };
    // Written as "VitalDetail:glucose": one page serves all six readings, so
    // the build has to say which of them it is being opened on.
    case "VitalDetail":
      return resident == null ? undefined : { resident, kind: arg ?? "spo2" };
    case "AcceptTask":
      return sampleTasks[0] == null ? undefined : { task: sampleTasks[0] };
    // The record pages, on the first posting's patient.
    case "CommunityPatient":
    case "Medication":
    case "Diagnosis":
      return sampleTasks[0] == null ? undefined : { holder: visitHolder(sampleTasks[0], sampleDetail) };
    case "HouseList":
      return sampleVillages[0] == null
        ? undefined
        : { village: sampleVillages[0] };
    case "HouseDetail":
      return house == null ? undefined : { house };
    case "AddHouse":
      return sampleVillages[0] == null
        ? undefined
        : { village: sampleVillages[0] };
    default:
      return undefined;
  }
}

/** The navigation state to start on, or undefined for the app's own. */
export function devInitialState() {
  if (TARGET == null || TARGET === "") return undefined;
  // "Main" alone: the tabs, past the sign-in steps a fresh install runs.
  if (TARGET === "Main") return { index: 0, routes: [{ name: "Main" }] };
  // "Screen" or "Screen:argument" — a page that serves more than one thing
  // needs to be told which.
  const [name, arg] = TARGET.split(":");
  return {
    index: 1,
    routes: [{ name: "Main" }, { name, params: paramsFor(name, arg) }],
  };
}
