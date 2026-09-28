import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ShieldCheck, TriangleAlert } from "lucide-react-native";

import {
  ActionBar,
  PrimaryAction,
  SecondaryAction,
} from "../components/ActionBar";
import { Card } from "../components/Card";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusTag } from "../components/StatusTag";
import { toast } from "../components/Toast";
import type { RootStackParamList } from "../navigation/RootStack";
import {
  CHECK_LABEL,
  checkTarget,
  closeSession,
  growthTally,
  openSessionNow,
  OUTCOME_LABEL,
  record,
  tally,
  useSession,
  type Check,
  type Row,
} from "../models/vaccination";
import { keep } from "../models/vaccineHistory";
import { ageLabel } from "../models/growth";
import { feel } from "../utils/haptics";
import {
  DANGER_BG,
  DANGER_INK,
  FILL_SUBTLE,
  INK_OK,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARNING,
  WARNING_BG,
} from "../theme/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Params = RouteProp<RootStackParamList, "VaccineResult">;

/** Clears the two capsules in the tray at the foot. */
const BAR_CLEAR = 170;

/**
 * Step 3 of 3: what the batch would write, read before it writes it.
 *
 * One job. This page used to have two — the batch about to go in, and a
 * receipt for the batch that just had — and they were built from the same
 * figures, the same names and the same reasons, so whichever one a carer
 * was looking at, it looked like the other. That is what made the flow
 * impossible to follow: two halves of one page, reached different ways,
 * saying the same thing on either side of a save.
 *
 * So the receipt is gone. It was never the only copy: a sitting is written
 * to the history on every save, and the history's own detail page lists
 * every person in it with their outcome, their reason and any override —
 * which is a better summary than this page ever was, and it survives the
 * app being closed.
 *
 * What is left is the step the flow was actually missing. Fifty names
 * ticked on a roster being worked down quickly is not the same act as fifty
 * entries in fifty vaccination records, and this is where the difference is
 * read: the ones the records object to, in full, before anything is
 * written.
 */
export function VaccineResultScreen() {
  const nav = useNavigation<Nav>();
  const { ids } = useRoute<Params>().params ?? {};
  const { session } = useSession();

  /*
    The batch waiting to be written, while it is still waiting.

    One page, two halves of one act: what this batch WOULD write, and what
    the sitting stands at once it has. Not two pages — the buttons do not
    move, the header does not change, and pressing save does not take
    anybody anywhere. The page simply stops being a question and starts
    being an answer.
  */
  const [pending, setPending] = useState<string[] | null>(ids ?? null);

  if (session == null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="รายละเอียดการบันทึก" />
        <Text
          style={{ padding: SPACE.lg, fontSize: 15, color: TEXT_SECONDARY }}
        >
          ยังไม่ได้เปิด Session
        </Text>
      </View>
    );
  }

  const { setup } = session;

  /*
    Closing the sitting, from the page that reports it.

    Not from the roster. Somebody who has just read what was written is the
    person in a position to say the day is done, and sending them back to a
    list of names to press a different button was the long way round.
  */
  /*
    The one button that commits.

    Everything before it is a draft on the phone: rows can be taken back,
    reasons rewritten, the whole sitting reopened from the activities page.
    This writes it to the history, closes the session and deletes the draft
    — which is what "ส่งขึ้นระบบ" means here, and why the alert says plainly
    that nothing can be changed afterwards.
  */
  /*
    A draft, and nothing further.

    It writes into the sitting on the phone and stops there — not to the
    history, not to the system. Everything in it can still be taken back
    from the roster, and it stays that way until the sitting is closed.
    That is the whole difference between the two buttons in this tray, and
    it is why this one does not end anything: it saves, and hands the
    morning back.
  */
  const saveDraft = () => {
    if (batch.length === 0) return;
    // The rows `record` flags: a warning nobody gave a reason for.
    const flagged = batch.filter(
      (b) => b.check.level === "warn" && b.row.override == null,
    ).length;
    const out = record(batch.map((b) => b.row.target.id));
    feel("success");
    setPending(null);
    nav.navigate("CareActivities", { kind: session.activity.kind });
    if (flagged > 0) {
      toast(
        `บันทึกร่างแล้ว ${out.saved} ราย · มี ${flagged} รายที่มีคำเตือน`,
        "warning",
      );
    } else {
      toast(
        `บันทึกร่างแล้ว ${out.saved} ราย · แก้ไขได้จนกว่าจะปิดงาน`,
        "success",
      );
    }
  };

  const close = () => {
    const s = session;
    const t0 = tally(s);
    const now = t0.targets - t0.recorded - t0.absent - t0.refused;
    // What would still be unanswered once this batch had gone in.
    const left = now - batch.length;

    /*
      Two short paragraphs: what this is and what is in it, then what
      pressing the button does. Short lines rather than sentences — a carer
      reads this standing up at the end of a clinic — but enough to know
      which session is closing and what "ค้าง" means for the ones left.
    */
    const counts = [
      batch.length > 0 ? `บันทึก ${batch.length} ราย` : null,
      left > 0 ? `ค้าง ${left} ราย (ยังไม่ได้บันทึก)` : null,
    ].filter((c) => c != null);
    const message = [
      [s.activity.title, counts.join(" · ")]
        .filter((l) => l.length > 0)
        .join("\n"),
      "ส่งขึ้นระบบและปิด Session นี้\nหลังจากนี้แก้ไขไม่ได้อีก",
    ].join("\n\n");

    Alert.alert(batch.length > 0 ? "บันทึกและปิดงาน" : "ปิดงาน", message, [
      {
        text: "ปิดงาน",
        onPress: () => {
          /*
            The selection goes in on the way out.

            Closing used to commit whatever had already been drafted and
            silently drop whatever was still ticked — so a carer who
            finished the last ten and pressed the button that ends the
            morning lost the last ten. One press: write what is selected,
            then send the sitting.
          */
          if (batch.length > 0) record(batch.map((b) => b.row.target.id));
          // Read back rather than reused: `record` replaces the session, so
          // the one in hand is the one from before the save.
          const done = openSessionNow() ?? s;
          keep(done);
          closeSession();
          feel("success");
          if (left > 0) toast(`ปิดงานแล้ว · ค้าง ${left} ราย`, "warning");
          else toast("ปิดงานและส่งขึ้นระบบแล้ว", "success");
          nav.navigate("CareActivities", { kind: done.activity.kind });
        },
      },
      { text: "ยกเลิก", style: "cancel" },
    ]);
  };

  /*
    The batch, worst first.

    A carer checking fifty names reads the top of the list and trusts the
    rest, so the ones the records object to go where they will be read.
    Within each band the roster's own order is kept, because that is the
    order the class was worked through.
  */
  const rank = { warn: 0, review: 1, ready: 2 } as const;
  const batch = session.rows
    .filter(
      (r) => (pending ?? []).includes(r.target.id) && r.outcome === "waiting",
    )
    .map((r) => ({ row: r, check: checkTarget(r.target, setup.lot) }))
    .sort((a, b) => rank[a.check.level] - rank[b.check.level]);

  const odd = batch.filter((b) => b.check.level !== "ready");
  const plain = batch.length - odd.length;
  const warns = odd.filter((b) => b.check.level === "warn").length;

  const t = tally(session);
  const waiting = t.targets - t.recorded - t.absent - t.refused;

  /*
    A weighing round is summed up differently, because it answers a
    different question.

    "บันทึกบริการแล้ว 8 ราย" is the whole story of a vaccination morning and
    almost none of a nutrition one: eight children weighed is the work, not
    the finding. What the centre reports — and what decides who is visited
    before the next quarter — is how many came out of the tables badly, so
    those are the figures this half shows.
  */
  const weighing = session.activity.records === "growth";
  const g = growthTally(session);
  const outOfBand = session.rows
    .filter((r) => r.growth != null && r.growth.level !== "normal")
    .sort(
      (a, b) =>
        (a.growth?.level === "abnormal" ? 0 : 1) -
        (b.growth?.level === "abnormal" ? 0 : 1),
    );

  /*
    Everyone the records objected to who got a dose anyway, and everyone the
    next round has to catch. The two lists the second half of the page is
    for: what to look at again, and who to come back for.
  */
  const checkAgain = session.rows
    .filter(
      (r) => r.outcome === "recorded" && (r.flag != null || r.override != null),
    )
    .sort(
      (a, b) => (a.override == null ? 0 : 1) - (b.override == null ? 0 : 1),
    );
  const follow = session.rows.filter(
    (r) => r.outcome === "absent" || r.outcome === "refused",
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="รายละเอียดการบันทึก" />

      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: SPACE.lg,
            paddingTop: HEADER_FADE,
            // One capsule or two, depending on whether there is anything
            // left to save.
            paddingBottom: batch.length > 0 ? BAR_CLEAR : BAR_CLEAR - 56,
            gap: SPACE.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {pending != null ? (
            <>
              {/* What is being given, and to how many. The same two facts the
                roster's card leads with, so the two pages read as one thing
                continued rather than as two screens about a class. */}
              <Card style={{ gap: SPACE.md }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: SPACE.md,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontSize: 22,
                        lineHeight: 30,
                        fontWeight: "700",
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {setup.lot == null
                        ? session.activity.title
                        : `${setup.lot.kind} เข็ม ${setup.lot.dose}`}
                    </Text>
                    <Text style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                      {setup.lot == null
                        ? session.activity.place
                        : `Lot ${setup.lot.lot} · ${setup.lot.site}`}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 26,
                        lineHeight: 32,
                        fontWeight: "800",
                        color: TEXT_PRIMARY,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {batch.length}
                    </Text>
                    <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                      รายที่จะบันทึก
                    </Text>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: SEPARATOR }} />

                <View style={{ flexDirection: "row" }}>
                  <Figure label="ผ่านการตรวจสอบ" value={plain} ink={INK_OK} />
                  <Figure
                    label="ต้องตรวจสอบ"
                    value={odd.length - warns}
                    ink={WARNING}
                  />
                  <Figure label="มีคำเตือน" value={warns} ink={DANGER_INK} />
                </View>
              </Card>

              {/* What pressing the button actually does. The difference
              between the two in the tray is the whole model of this
              screen, and it was in neither of their labels. */}
              <Text
                style={{
                  paddingHorizontal: SPACE.xs,
                  fontSize: 12,
                  lineHeight: 19,
                  color: TEXT_MUTED,
                }}
              >
                บันทึกร่างเก็บไว้ในเครื่อง ยังแก้ไขได้ —
                ส่งขึ้นระบบเมื่อกดปิดงาน
              </Text>

              {warns > 0 && (
                <Text
                  style={{
                    paddingHorizontal: SPACE.xs,
                    fontSize: 13,
                    lineHeight: 20,
                    color: DANGER_INK,
                  }}
                >
                  กดบันทึกแล้วรายที่มีคำเตือนจะถูกบันทึกไปพร้อมคำเตือนนั้น
                </Text>
              )}

              {/* Only the ones with something to say. Most of a class is
                ordinary, and a list that prints all of it is a list nobody
                reads to the end — which is this page's whole job. */}
              {odd.length > 0 && (
                <>
                  <Text
                    style={{
                      marginTop: SPACE.xs,
                      fontSize: 16,
                      lineHeight: 24,
                      fontWeight: "700",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {`ต้องดูก่อนบันทึก ${odd.length} ราย`}
                  </Text>

                  <Card padded={false}>
                    {odd.map((b, i) => (
                      <Odd key={b.row.target.id} {...b} first={i === 0} />
                    ))}
                  </Card>
                </>
              )}

              {plain > 0 && (
                <Text
                  style={{
                    paddingHorizontal: SPACE.xs,
                    fontSize: 12,
                    lineHeight: 19,
                    color: TEXT_MUTED,
                  }}
                >
                  {`อีก ${plain} รายผ่านการตรวจสอบทั้งหมด ไม่มีข้อทักท้วง`}
                </Text>
              )}

              {batch.length === 0 && (
                <Card>
                  <Text
                    style={{ fontSize: 14, lineHeight: 21, color: TEXT_MUTED }}
                  >
                    ไม่มีรายชื่อที่รอบันทึกในชุดนี้
                  </Text>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Where the sitting stands. */}
              <Card style={{ gap: SPACE.md }}>
                <Text
                  style={{
                    fontSize: 26,
                    lineHeight: 36,
                    fontWeight: "800",
                    color: TEXT_PRIMARY,
                  }}
                >
                  {weighing
                    ? `ชั่งน้ำหนักแล้ว ${g.measured} ราย`
                    : `บันทึกบริการแล้ว ${t.recorded} ราย`}
                </Text>

                <View style={{ height: 1, backgroundColor: SEPARATOR }} />

                <View style={{ flexDirection: "row" }}>
                  {weighing ? (
                    <>
                      <Figure
                        label="ปกติ"
                        value={g.measured - g.abnormal - g.watch}
                        ink={INK_OK}
                      />
                      <Figure
                        label="เฝ้าระวัง"
                        value={g.watch}
                        ink={g.watch > 0 ? WARNING : TEXT_MUTED}
                      />
                      <Figure
                        label="ผิดปกติ"
                        value={g.abnormal}
                        ink={g.abnormal > 0 ? DANGER_INK : TEXT_MUTED}
                      />
                      <Figure
                        label="ค้าง"
                        value={waiting}
                        ink={waiting > 0 ? WARNING : INK_OK}
                      />
                    </>
                  ) : (
                    <>
                      <Figure
                        label="บันทึกแล้ว"
                        value={t.recorded}
                        ink={INK_OK}
                      />
                      <Figure label="ไม่มา" value={t.absent} />
                      <Figure label="ปฏิเสธ" value={t.refused} />
                      <Figure
                        label="ค้าง"
                        value={waiting}
                        ink={waiting > 0 ? WARNING : INK_OK}
                      />
                    </>
                  )}
                </View>
              </Card>

              {/* The children the tables found something in, worst first.
                  A count of them is the one figure on this page nobody can
                  act on: what a nutrition round produces is a list of names
                  and what to do about each. */}
              {weighing && outOfBand.length > 0 && (
                <>
                  <Text
                    style={{
                      marginTop: SPACE.xs,
                      fontSize: 16,
                      lineHeight: 24,
                      fontWeight: "700",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {`ต้องติดตาม ${outOfBand.length} ราย`}
                  </Text>
                  <Card padded={false}>
                    {outOfBand.map((r, i) => (
                      <Weighed key={r.target.id} row={r} first={i === 0} />
                    ))}
                  </Card>
                </>
              )}

              {/* What to look at again: a dose the records objected to, given anyway.
                  The ones with no reason entered come first — those are the ones
                  worth walking back for. */}
              {checkAgain.length > 0 && (
                <>
                  <Text
                    style={{
                      marginTop: SPACE.xs,
                      fontSize: 16,
                      lineHeight: 24,
                      fontWeight: "700",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {`ต้องตรวจสอบ ${checkAgain.length} ราย`}
                  </Text>
                  <Card padded={false}>
                    {checkAgain.map((r, i) => (
                      <Given key={r.target.id} row={r} first={i === 0} />
                    ))}
                  </Card>
                </>
              )}

              {/* Who the next round has to catch, and why. A count of follow-ups is
                  the one figure here nobody can act on: a follow-up list is a list of
                  names. */}
              {follow.length > 0 && (
                <>
                  <Text
                    style={{
                      marginTop: SPACE.xs,
                      fontSize: 16,
                      lineHeight: 24,
                      fontWeight: "700",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {`เข้าคิวติดตาม ${follow.length} ราย`}
                  </Text>
                  <Card padded={false}>
                    {follow.map((r, i) => (
                      <View
                        key={r.target.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: SPACE.md,
                          padding: SPACE.lg,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: SEPARATOR,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            fontSize: 15,
                            lineHeight: 22,
                            fontWeight: "600",
                            color: TEXT_PRIMARY,
                          }}
                        >
                          {r.target.name}
                        </Text>
                        <View style={{ flex: 1.2, gap: 1 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              lineHeight: 18,
                              fontWeight: "600",
                              color: TEXT_SECONDARY,
                            }}
                          >
                            {OUTCOME_LABEL[r.outcome]}
                          </Text>
                          {r.note != null && (
                            <Text
                              style={{
                                fontSize: 12,
                                lineHeight: 18,
                                color: TEXT_MUTED,
                              }}
                            >
                              {r.note}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </Card>
                </>
              )}

              {/* The receipt. True, reassuring, and not what anybody came here to
                  read — so it sits at the foot. */}
              <Text
                style={{
                  paddingHorizontal: SPACE.xs,
                  fontSize: 12,
                  lineHeight: 19,
                  color: TEXT_MUTED,
                }}
              >
                Sync ขึ้น Server แล้ว · สร้าง Service Record รายบุคคล พร้อม
                Audit Trail (ผู้บันทึก / เวลา / อุปกรณ์ / Activity)
              </Text>
            </>
          )}
        </ScrollView>
      </HeaderFade>

      {/*
        Two buttons, and no third that only goes back.

        There was one: "กลับไปแก้ไขรายการ", which is true before a save and
        a lie after it — a recorded row cannot be unticked, unrecorded or
        removed, and once the whole class is in there is nothing to go back
        and select either. Renaming it only moved the lie about. All it ever
        did was navigate, which the arrow in the header has done on every
        screen in this app since the first one.

        What is left are the two things this page can do that nothing else
        can: write the batch, and close the sitting.
      */}
      {/*
        The save button is there when there is something to save.

        Not greyed out — gone. A disabled button is a promise that
        something could be done here if only you found the way, and on a
        page whose whole batch has already gone in there is no way and
        nothing to find. What is left is the one thing that is still true:
        the sitting can be closed.
      */}
      <ActionBar>
        {batch.length > 0 ? (
          <>
            {/*
              Drafting on top, closing beneath it and in blue.

              The two are not a pair of equals: one ends the morning and
              sends the records, the other puts the phone down for ten
              minutes. The blue belongs on the one somebody is walking
              towards. The order is the other way about — the draft is read
              first and passed over, and the button that commits sits at the
              foot where a thumb comes to rest, which is the right place for
              the press that cannot be taken back.
            */}
            <SecondaryAction
              label={`บันทึกร่าง ${batch.length} คน`}
              onPress={saveDraft}
            />
            <PrimaryAction label="บันทึกและปิดงาน" onPress={close} />
          </>
        ) : (
          /* On its own it is the only thing to do, so it leads. */
          <PrimaryAction label="ปิดงาน" onPress={close} />
        )}
      </ActionBar>
    </View>
  );
}

/**
 * One name the records have something to say about.
 *
 * In full, not as a coloured tag: this is the last place before the write
 * where anybody can change their mind, and a chip reading "เตือน" says
 * nothing a carer can act on.
 */
function Odd({
  row,
  check,
  first,
}: {
  row: Row;
  check: Check;
  first: boolean;
}) {
  const warn = check.level === "warn";

  return (
    <View
      style={{
        padding: SPACE.lg,
        gap: SPACE.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY }}
          >
            {row.target.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: TEXT_MUTED }}>
            {`HN ${row.target.hn} · ${row.target.room}`}
          </Text>
        </View>
        <StatusTag
          label={warn ? CHECK_LABEL.warn : CHECK_LABEL.review}
          ink={warn ? DANGER_INK : WARNING}
          Icon={TriangleAlert}
        />
      </View>

      {check.reason != null && (
        <View
          style={{
            padding: SPACE.md,
            borderRadius: RADIUS.lg,
            backgroundColor: warn ? DANGER_BG : WARNING_BG,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              color: warn ? DANGER_INK : WARNING,
            }}
          >
            {check.reason}
          </Text>
        </View>
      )}

      {/* The reason already given, where one was. */}
      {row.override != null && (
        <View
          style={{
            flexDirection: "row",
            gap: SPACE.sm,
            alignItems: "flex-start",
          }}
        >
          <ShieldCheck
            size={14}
            color={WARNING}
            strokeWidth={2.2}
            style={{ marginTop: 2 }}
          />
          <Text
            style={{ flex: 1, fontSize: 12, lineHeight: 19, color: WARNING }}
          >
            {row.override}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * A dose the records objected to, given anyway.
 *
 * The finding and whatever was said back to it — a reason the carer entered
 * before the save, or nothing, which is itself the thing worth seeing.
 */
function Given({ row, first }: { row: Row; first: boolean }) {
  const said = row.override != null;
  return (
    <View
      style={{
        padding: SPACE.lg,
        gap: SPACE.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY }}
          >
            {row.target.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: TEXT_MUTED }}>
            {`HN ${row.target.hn} · ${row.target.room}`}
          </Text>
        </View>
        <StatusTag
          label={said ? "ระบุแล้ว" : "ยังไม่ระบุเหตุผล"}
          ink={said ? WARNING : DANGER_INK}
          Icon={said ? ShieldCheck : TriangleAlert}
        />
      </View>

      {row.flag != null && (
        <View
          style={{
            padding: SPACE.md,
            borderRadius: RADIUS.lg,
            backgroundColor: DANGER_BG,
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 20, color: DANGER_INK }}>
            {row.flag}
          </Text>
        </View>
      )}

      {row.override != null && (
        <View
          style={{
            flexDirection: "row",
            gap: SPACE.sm,
            alignItems: "flex-start",
          }}
        >
          <ShieldCheck
            size={14}
            color={WARNING}
            strokeWidth={2.2}
            style={{ marginTop: 2 }}
          />
          <Text
            style={{ flex: 1, fontSize: 12, lineHeight: 19, color: WARNING }}
          >
            {row.override}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * A child whose measurements came out of the bands.
 *
 * The verdict, the numbers it was read from, and what the visit is for. Not
 * a bare "ผิดปกติ": the whole difference between this round's two findings —
 * thin now, or short for years — is which line of this row is red, and a
 * summary that flattened them would send the same follow-up to both.
 */
function Weighed({ row, first }: { row: Row; first: boolean }) {
  const gr = row.growth;
  if (gr == null) return null;
  const abnormal = gr.level === "abnormal";
  return (
    <View
      style={{
        padding: SPACE.lg,
        gap: SPACE.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 16, fontWeight: "700", color: TEXT_PRIMARY }}
          >
            {row.target.name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: TEXT_MUTED }}>
            {`HN ${row.target.hn} · ${row.target.sex} · ${ageLabel(gr.months)}`}
          </Text>
        </View>
        <StatusTag
          label={gr.label}
          ink={abnormal ? DANGER_INK : WARNING}
          Icon={TriangleAlert}
        />
      </View>

      <View
        style={{
          padding: SPACE.md,
          borderRadius: RADIUS.lg,
          backgroundColor: abnormal ? DANGER_BG : FILL_SUBTLE,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            lineHeight: 20,
            color: abnormal ? DANGER_INK : TEXT_SECONDARY,
          }}
        >
          {`${gr.kg.toFixed(1)} กก. · ${gr.cm.toFixed(1)} ซม. · ${gr.place}`}
        </Text>
      </View>

      {gr.development !== "สมวัย" && (
        <Text style={{ fontSize: 12, lineHeight: 19, color: WARNING }}>
          {`พัฒนาการ${gr.development} — เข้าคิวประเมินตามแบบ DSPM`}
        </Text>
      )}
    </View>
  );
}

function Figure({
  label,
  value,
  ink = TEXT_PRIMARY,
}: {
  label: string;
  value: number;
  ink?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontSize: 22,
          lineHeight: 30,
          fontWeight: "700",
          color: ink,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {/* No `adjustsFontSizeToFit`: it scales text UP as readily as down,
          and a row of figures whose labels are different sizes cannot be
          compared, which is the only thing a row of figures is for. */}
      <Text numberOfLines={1} style={{ fontSize: 11, color: TEXT_MUTED }}>
        {label}
      </Text>
    </View>
  );
}
