import { Text, View } from "react-native";

import { Avatar } from "./Avatar";
import { Card } from "./Card";
import type { CardHolder } from "../models/community";
import { genderLabel } from "../models/task";
import { tr } from "../i18n";
import { SPACE, TEXT_MUTED, TEXT_PRIMARY } from "../theme/tokens";

/**
 * Who this form is about, at the top of it.
 *
 * The forms a visit opens — the screening, the physiotherapy — had each
 * printed a one-line caption of the name and HN in the smallest grey type
 * on the page, which is the wrong weight for the one fact that must not be
 * mistaken. This is the patient page's own head at a size that fits above
 * a form: the initial on the brand disc, the name in the row's bold, and
 * the identifiers under it.
 */
export function PatientStrip({ holder }: { holder: CardHolder }) {
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
      <Avatar size={44} initial={holder.name[0] ?? "?"} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 16, lineHeight: 21, fontWeight: "700", color: TEXT_PRIMARY }}
        >
          {tr(`คุณ ${holder.name}`, holder.name)}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: TEXT_MUTED }}>
          {tr(
            `HN ${holder.hn} · ${holder.age} ปี · ${holder.gender}`,
            `HN ${holder.hn} · ${holder.age} yrs · ${genderLabel(holder.gender)}`,
          )}
        </Text>
      </View>
    </Card>
  );
}
