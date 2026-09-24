import { useMemo, useState } from "react";
import { Image, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertCircle, House, List as ListIcon } from "lucide-react-native";

import { Chevron } from "../components/Chevron";
import { Card } from "../components/Card";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import { Figure, Figures } from "../components/Figures";
import { Glass } from "../components/Glass";
import { SectionHeader } from "../components/SectionHeader";
import { UIcon } from "../components/UIcon";
import { SearchListScreen } from "../components/SearchListScreen";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  houseNeedsAttention,
  sampleVillages,
  searchVillages,
  villagePopulation,
  type Village,
} from "../models/household";
import {
  DANGER,
  DANGER_INK,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  SUCCESS,
  SURFACE,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** A village with the three numbers the list is read for, worked out once. */
type Row = {
  village: Village;
  houses: number;
  people: number;
  /** Houses with someone in them to follow up. */
  attention: number;
  /** Who lives there, by age band — what decides the kind of visit. */
  elderly: number;
  adults: number;
  children: number;
};

function summarise(v: Village): Row {
  const people = v.houses.flatMap((h) => h.residents);
  return {
    village: v,
    houses: v.houses.length,
    people: villagePopulation(v),
    attention: v.houses.filter(houseNeedsAttention).length,
    elderly: people.filter((r) => r.age >= 60).length,
    adults: people.filter((r) => r.age >= 18 && r.age < 60).length,
    children: people.filter((r) => r.age < 18).length,
  };
}

/**
 * How the list is ordered.
 *
 * A sort, not a filter. Sixteen of the twenty villages have someone to follow
 * up, so filtering to them hides four rows and answers nothing — what the
 * carer wants is the heaviest ones first.
 */
type Sort = "moo" | "attention";

const SORTS: FilterOption<Sort>[] = [
  { key: "moo", label: "ตามลำดับหมู่", Icon: ListIcon },
  { key: "attention", label: "ต้องติดตามก่อน", Icon: AlertCircle },
];

/**
 * "บ้านที่ดูแล" — every village this carer covers.
 *
 * Rebuilt around the two questions the screen is actually opened with: how
 * much ground am I covering, and where is something waiting on me. The
 * villages were twenty separate cards of two large count tiles each, so three
 * fitted on a screen and the follow-ups — which are the reason to open the
 * list at all — were not on it anywhere.
 *
 * Now the totals are stated once at the top, and the villages are one grouped
 * list of single rows: five to a screen, each carrying its counts inline and
 * a mark when it has follow-ups. The counts are the same numbers as before,
 * just no longer repeated in twenty pairs of tiles.
 */
export function HousesScreen() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("moo");
  const nav = useNavigation<Nav>();

  // Fixed sample data, and the attention count walks every house in every
  // village — not something to redo on each keystroke.
  const rows = useMemo(() => sampleVillages.map(summarise), []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          houses: t.houses + r.houses,
          people: t.people + r.people,
          attention: t.attention + r.attention,
        }),
        { houses: 0, people: 0, attention: 0 },
      ),
    [rows],
  );

  const matched = new Set(
    searchVillages(sampleVillages, query).map((v) => v.id),
  );
  const found = rows.filter((r) => matched.has(r.village.id));
  const shown =
    sort === "moo"
      ? found
      : [...found].sort(
          (a, b) =>
            b.attention - a.attention ||
            a.village.name.localeCompare(b.village.name, "th"),
        );

  const searching = query.trim().length > 0;

  return (
    <SearchListScreen
      title="บ้านที่ดูแล"
      query={query}
      onQuery={setQuery}
      placeholder="ค้นหาหมู่บ้าน"
    >
      {/* Held back while searching: a total that does not move as the list
          narrows reads as a result count that is refusing to update. */}
      {!searching && <Overview totals={totals} villages={rows.length} />}

      {/*
        The list's own heading, with the sort at the far end — the same row
        the home screen puts over its visits, from the same component.

        It was two chips, which stated the choice twice over and left the
        list with no name at all. The menu floats over the cards rather than
        pushing them down, so choosing an order does not move what you are
        looking at; that needs the raised stacking context around it.
      */}
      <View style={{ zIndex: 10 }}>
        <SectionHeader
          title="รายชื่อหมู่บ้าน"
          flush
          trailing={
            <FilterSelect value={sort} options={SORTS} onChange={setSort} />
          }
        />
      </View>

      {shown.length === 0 ? (
        <Empty query={query} />
      ) : (
        shown.map((r) => (
          <VillageCard
            key={r.village.id}
            row={r}
            onPress={() => nav.navigate("HouseList", { village: r.village })}
          />
        ))
      )}
    </SearchListScreen>
  );
}

/** The overview card's own geometry — Figma 269:9698. */
const OVERVIEW = {
  radius: 24,
  pad: 16,
  /**
   * Flush to the card's right edge, hanging past its foot.
   *
   * Held by its bottom, not its top: the design's 34pt from the top only
   * overflows the foot on a card of exactly its height, and the type sizes
   * here are the app's rather than the design's. Anchored this way the globe
   * breaks the lower edge whatever the card grows to.
   */
  art: { width: 160, height: 154, bottom: -9 },
} as const;

/**
 * The whole patch in one band — Figma 269:9698.
 *
 * The three figures fill exactly the space the artwork leaves: the design's
 * columns are a fixed 89pt on a 408pt card, which is the card's width less
 * its padding and less the 126pt globe. Held as a reserved right padding and
 * three equal columns instead of that fixed width, the same layout survives a
 * narrower screen — at 89pt each, "ประชากร" would have ended up under the globe.
 *
 * Not built on `Card`: this one needs the design's own shadow, which is far
 * wider and deeper than the card shadow, and the artwork has to hang past the
 * padding to the card's edge.
 */
function Overview({
  totals,
  villages,
}: {
  totals: { houses: number; people: number; attention: number };
  villages: number;
}) {
  return (
    <View
      style={{
        borderRadius: OVERVIEW.radius,
        shadowColor: "#000000",
        shadowOpacity: 0.12,
        // Figma's blur is a diameter; RN's radius is half of it.
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <View
        style={{
          backgroundColor: SURFACE,
          borderRadius: OVERVIEW.radius,
          // Trims the globe's foot, which is what makes it sit in the card.
          overflow: "hidden",
        }}
      >
        <Image
          source={require("../../assets/images/coverage_globe.png")}
          style={{
            position: "absolute",
            right: 0,
            bottom: OVERVIEW.art.bottom,
            width: OVERVIEW.art.width,
            height: OVERVIEW.art.height,
          }}
          resizeMode="stretch"
          accessibilityRole="none"
        />

        <View
          style={{
            padding: OVERVIEW.pad,
            // The globe's full column. The artwork all but fills its box —
            // three per cent of transparent margin — so there is nothing for
            // the text to tuck under.
            paddingRight: OVERVIEW.art.width,
          }}
        >
          {/* The app's own sizes, not the design's.
              
              Figma draws this card at 14/14/12/10; the app's scale puts a
              card heading at 16, a KPI figure at 20 — the plan screen's
              counters — and never uses 10 outside a badge. Taking the design's
              numbers literally would have made this the smallest heading and
              the smallest figures in the app. Colours, weights, spacing and
              layout are the design's throughout. */}
          <Text
            style={{
              fontSize: 16,
              lineHeight: 21,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            พื้นที่ที่รับผิดชอบ
          </Text>

          <View style={{ marginTop: SPACE.sm }}>
            <Figures ruled={totals.attention > 0}>
              <Figure value={villages} label="หมู่บ้าน" ink={TEXT_PRIMARY} />
              <Figure value={totals.houses} label="บ้าน" ink={PRIMARY_500} />
              <Figure value={totals.people} label="ประชากร" ink={SUCCESS} />
            </Figures>
          </View>

          {totals.attention > 0 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: SPACE.sm,
              }}
            >
              {/* The mark carries the alert, so the line reads as a state
                  before it is read as a sentence. */}
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: DANGER,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: "500",
                  color: DANGER,
                }}
              >
                {`${totals.attention} หลังที่ต้องติดตาม`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * How many houses in a village are waiting on a visit.
 *
 * Shown only when there are any. The green "ติดตามครบ" that used to fill the
 * slot claimed the follow-ups had been done, when all the data says is that
 * no one there is flagged — and it put a badge on every card, which left the
 * ones that do want attention no louder than the ones that do not.
 */
function FollowUpBadge({ attention }: { attention: number }) {
  return (
    <StatusTag
      label={`ต้องติดตาม ${attention}`}
      ink={DANGER_INK}
      Icon={AlertCircle}
    />
  );
}

/**
 * One village, on the visit card's frame.
 *
 * Deliberately the same object as a task: glass avatar, name with its pill,
 * arrow, a two-line body, a rule, then meta and a badge. A carer moving
 * between the two lists is reading one card design, not two — so the parts
 * line up in the same places and only the content differs.
 */
function VillageCard({ row, onPress }: { row: Row; onPress: () => void }) {
  const { village, houses, people, attention, elderly, adults, children } = row;

  // Only the bands that exist: "เด็ก 0 คน" is noise on a village with none.
  const bands = [
    elderly > 0 && `ผู้สูงอายุ ${elderly} คน`,
    adults > 0 && `ผู้ใหญ่ ${adults} คน`,
    children > 0 && `เด็ก ${children} คน`,
  ].filter(Boolean);

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${village.name} ${village.mooLabel} ${houses} หลัง ${people} คน`}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* The same tinted glass the visit cards and the map pins carry. */}
        <Glass
          tintColor="rgba(7,125,215,0.95)"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UIcon name="houseChimneyHeart" size={16} color="#FFFFFF" />
        </Glass>

        {/* Name and หมู่ travel together — the flex is on the pair, so a long
            name shrinks beside its label instead of shoving it at the arrow. */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            marginLeft: SPACE.sm,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 14,
              fontWeight: "600",
              color: TEXT_PRIMARY,
            }}
          >
            {village.name}
          </Text>
          <View
            style={{
              marginLeft: SPACE.xs,
              backgroundColor: PRIMARY_100,
              borderRadius: RADIUS.capsule,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{ fontSize: 10, fontWeight: "500", color: PRIMARY_500 }}
            >
              {village.mooLabel}
            </Text>
          </View>
        </View>

        <View style={{ marginLeft: SPACE.sm }}>
          <Chevron />
        </View>
      </View>

      {/* No reserved height, unlike the visit card.
          
          That card holds two lines open so a row of them lines up whatever
          the detail's length. This line is generated from three counts and is
          all but always one line, so the reserve was empty space at the foot
          of every card — the card takes the height of what is in it. */}
      <Text
        numberOfLines={2}
        style={{
          marginTop: SPACE.md,
          fontSize: 12,
          lineHeight: 18,
          color: TEXT_MUTED,
        }}
      >
        {bands.join(" · ")}
      </Text>

      <View
        style={{ height: 1, backgroundColor: SEPARATOR, marginTop: SPACE.md }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: SPACE.sm,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: "500",
            color: TEXT_MUTED,
          }}
        >
          {`${houses} หลังคาเรือน · ${people} คน`}
        </Text>
        {attention > 0 && <FollowUpBadge attention={attention} />}
      </View>
    </Card>
  );
}

/** A blank list otherwise reads as a loading failure. */
function Empty({ query }: { query: string }) {
  const q = query.trim();
  const title = q ? `ไม่พบหมู่บ้าน "${q}"` : "ยังไม่มีหมู่บ้านในความดูแล";
  const hint = q
    ? "ลองค้นด้วยชื่อหมู่บ้านหรือเลขหมู่"
    : "เมื่อได้รับพื้นที่แล้วรายชื่อจะแสดงที่นี่";

  return (
    <View style={{ alignItems: "center", paddingTop: SPACE.huge * 2 }}>
      <House size={48} color={TEXT_PLACEHOLDER} />
      <Text
        style={{
          marginTop: SPACE.lg,
          fontSize: 16,
          fontWeight: "600",
          color: TEXT_PRIMARY,
        }}
      >
        {title}
      </Text>
      <Text style={{ marginTop: SPACE.sm, fontSize: 14, color: TEXT_MUTED }}>
        {hint}
      </Text>
    </View>
  );
}
