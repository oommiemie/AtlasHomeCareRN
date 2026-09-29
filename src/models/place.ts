import type { LocationGeocodedAddress } from "expo-location";

import { tr } from "../i18n";

/** A Thai address, as far down as a pin can tell you. */
export type Place = {
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

export const EMPTY_PLACE: Place = {
  subdistrict: "",
  district: "",
  province: "",
  postalCode: "",
};

/**
 * A geocoder answer as a Thai address.
 *
 * iOS names these fields after CLPlacemark: `district` is the sub-locality —
 * แขวง or ตำบล — and `subregion` the sub-administrative area, which is เขต or
 * อำเภอ. Either can come back empty, so each falls back to the locality
 * rather than leaving its field blank.
 */
export const placeOf = (a: LocationGeocodedAddress): Place => ({
  subdistrict: a.district ?? a.city ?? "",
  district: a.subregion ?? a.city ?? "",
  province: a.region ?? "",
  postalCode: a.postalCode ?? "",
});

/** The place on one line, skipping whatever the geocoder did not know. */
export const placeSummary = (p: Place): string =>
  [p.subdistrict, p.district, p.province, p.postalCode]
    .filter((part) => part.trim().length > 0)
    .join(tr(" ", ", "));
