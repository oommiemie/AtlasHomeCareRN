import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Glass } from "./Glass";
import { UIcon } from "./UIcon";
import { genderLabel } from "../models/household";
import { tr } from "../i18n";
import {
  PRIMARY_500,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT_PRIMARY,
  shadow,
} from "../theme/tokens";

/**
 * A fact about the patient at the head of their page — age, sex, blood
 * group — on Apple's glass under the name.
 *
 * The pages that open on a person all carry these, and each drew its own
 * copy; one of them had them as a white card of three columns instead. One
 * tag, so a patient looks the same whichever page they are opened on.
 */
export function HeroTag({ label }: { label: string }) {
  return (
    <Glass
      style={{
        borderRadius: RADIUS.capsule,
        overflow: "hidden",
        paddingHorizontal: SPACE.md,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "500", color: PRIMARY_500 }}>
        {label}
      </Text>
    </Glass>
  );
}

/**
 * The patient's sex, as a mark on the lower right of their avatar — ♀ or
 * ♂ on a white disc — rather than a word in a row of tags. Placed by the
 * caller inside a box the avatar's size (see `AvatarWithGender`).
 */
export function GenderBadge({
  gender,
  size = 28,
}: {
  gender: string;
  size?: number;
}) {
  const female = gender === "หญิง";
  return (
    <View
      accessibilityLabel={genderLabel(gender)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: SURFACE,
        borderWidth: 2,
        borderColor: SURFACE,
        boxShadow: shadow({ blur: 6, y: 2, opacity: 0.18 }),
      }}
    >
      <UIcon
        name={female ? "venus" : "mars"}
        size={Math.round(size * 0.55)}
        color={female ? "#E0569B" : PRIMARY_500}
      />
    </View>
  );
}

/** An avatar with the patient's sex on its lower right edge. */
export function AvatarWithGender({
  size,
  gender,
  children,
}: {
  size: number;
  gender?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={{ width: size, height: size }}>
      {children}
      {gender != null && gender !== "" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
          }}
        >
          <GenderBadge gender={gender} />
        </View>
      )}
    </View>
  );
}

/**
 * The patient's name with their age as a tag right after it — the two read
 * together, the way a carer says them: "Siriporn, 85".
 */
export function NameWithAge({
  name,
  age,
  size = 20,
}: {
  name: string;
  age: number | string;
  size?: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: SPACE.sm,
      }}
    >
      <Text
        style={{
          flexShrink: 1,
          fontSize: size,
          lineHeight: Math.round(size * 1.3),
          fontWeight: "600",
          color: TEXT_PRIMARY,
          textAlign: "center",
        }}
      >
        {name}
      </Text>
      <HeroTag label={tr(`${age} ปี`, `${age} yrs`)} />
    </View>
  );
}
