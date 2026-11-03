import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Baby,
  CalendarRange,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  House,
  Smile,
  Stethoscope,
  Syringe,
} from "lucide-react-native";

import { Card } from "../components/Card";
import { FilterSelect } from "../components/FilterSelect";
import { IosSpinner } from "../components/IosSpinner";
import { toast } from "../components/Toast";
import { HeaderFade, HEADER_FADE } from "../components/HeaderFade";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { Segments } from "../components/Segments";
import { StatusTag } from "../components/StatusTag";
import { ToolbarPill } from "../components/ToolbarPill";
import { planToday } from "../models/clock";
import { professionLabel } from "../models/providerAccount";
import {
  buildReport,
  patientsOf,
  pct,
  reportYears,
  type Kpi,
  type KpiKey,
  type PatientRow,
  type Report,
} from "../models/report";
import { reportFileName, reportWorkbook } from "../models/reportExcel";
import { useSession } from "../models/session";
import { useVaccineHistory } from "../models/vaccineHistory";
import { tr } from "../i18n";
import { feel } from "../utils/haptics";
import { shareFile } from "../utils/shareFile";
import { buddhistYear, thaiMonthShort, thaiShortDate } from "../utils/thaiDate";
import { GUTTER, readable, useLayout } from "../theme/layout";
import { useClosedVisits } from "../models/closedVisits";
import { SERVICE_TONE } from "../theme/serviceTone";
import {
  CANVAS,
  DANGER_INK,
  FILL_SUBTLE,
  INK_OK,
  PRIMARY_100,
  PRIMARY_500,
  RADIUS,
  SEPARATOR,
  SPACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TONE_INK,
  WASH_PANEL,
  type PanelTone,
} from "../theme/tokens";

/*
  Colour in small doses.

  The first draft gave every indicator a picture, a ring in red, amber or
  green, and a gradient behind the summary, and the page read as a
  dashboard of alarms; the next had none at all and every row looked alike.
  So each indicator carries its service's hue in two small places — the
  glyph's tile and its bar — the same hues the services page uses, and red
  and green are kept for the verdict alone.
*/

const yearLabel = (y: number) =>
  tr(`ปี ${buddhistYear(new Date(y, 0, 1))}`, String(y));

/** Each indicator's service hue and glyph; home visits take the brand's own. */
const toneOf = (k: KpiKey): PanelTone => (k === "visits" ? "sky" : SERVICE_TONE[k]);
const inkOf = (k: KpiKey): string => (k === "visits" ? PRIMARY_500 : TONE_INK[toneOf(k)]);
const GLYPH: Record<KpiKey, typeof House> = {
  visits: House,
  vaccination: Syringe,
  schoolHealth: Stethoscope,
  screening: Baby,
  dental: Smile,
};

/** What one of each indicator is counted in. */
const UNIT: Record<KpiKey, string> = {
  visits: tr("ครั้ง", "visits"),
  vaccination: tr("คน", "people"),
  schoolHealth: tr("คน", "people"),
  screening: tr("คน", "children"),
  dental: tr("คน", "children"),
};

// A function, not a constant: the theme's colours are swapped in place when
// it turns dark, and an object built once at load kept the light ink.
const figure = () => ({
  color: TEXT_PRIMARY,
  fontWeight: "700" as const,
  fontVariant: ["tabular-nums" as const],
});

/**
 * "รายงาน" — the carer's year, read against the KPI it is assessed by.
 *
 * Laid out in the order a review goes: the verdict, each indicator against
 * its pass mark, then the months, the kinds of visit and the people behind
 * them — the place to look once an indicator has come out short.
 */
export function ReportScreen() {
  const insets = useSafeAreaInsets();
  const history = useVaccineHistory();
  const years = useMemo(reportYears, []);
  const [year, setYear] = useState(years[0]);
  // A visit closed since the report was built counts on it.
  const closed = useClosedVisits();
  const report = useMemo(
    () => buildReport(year, history, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `closed` stands for the plan, which is changed in place
    [year, history, closed],
  );
  const exporting = useExport(report);
  // Wide enough for two columns (a landscape iPad, a desktop browser): the
  // verdict and its indicators on the left, the months and kinds of visit
  // beside them, rather than one column of bars a page wide.
  const { wide } = useLayout();

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <ScreenHeader
        title={tr("รายงานผลการปฏิบัติงาน", "Performance report")}
        right={
          <ToolbarPill
            slots={[
              {
                icon: exporting.busy ? (
                  <IosSpinner size={20} />
                ) : (
                  <FileSpreadsheet size={20} color={TEXT_PRIMARY} />
                ),
                label: tr("ส่งออกเป็น Excel", "Export to Excel"),
                onPress: exporting.run,
              },
            ]}
          />
        }
      />
      <HeaderFade from={0} to={HEADER_FADE}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: HEADER_FADE,
            paddingBottom: insets.bottom + SPACE.huge,
            gap: SPACE.md,
            ...readable(),
          }}
        >
          <View
            style={
              wide
                ? { flexDirection: "row", alignItems: "flex-start", gap: SPACE.lg }
                : { gap: SPACE.md }
            }
          >
            {/* Raised like the summary inside it: the year menu opens over the column beside. */}
            <View style={{ flex: wide ? 1 : undefined, gap: SPACE.md, zIndex: 10 }}>
              {/* Above the cards, so the year menu opens over them. */}
              <View style={{ zIndex: 10 }}>
                <Summary
                  report={report}
                  picker={
                    <FilterSelect
                      value={String(year)}
                      options={years.map((y) => ({
                        key: String(y),
                        label: yearLabel(y),
                        Icon: CalendarRange,
                      }))}
                      onChange={(k) => {
                        feel("tick");
                        setYear(Number(k));
                      }}
                      renderTrigger={({ toggle, label }) => (
                        <Pressable
                          onPress={toggle}
                          accessibilityRole="button"
                          accessibilityLabel={tr(`เลือกปี: ${label}`, `Year: ${label}`)}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: SPACE.md,
                            height: 32,
                            borderRadius: RADIUS.capsule,
                            backgroundColor: FILL_SUBTLE,
                            opacity: pressed ? 0.6 : 1,
                          })}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY }}>
                            {label}
                          </Text>
                          <ChevronDown size={16} color={TEXT_SECONDARY} />
                        </Pressable>
                      )}
                    />
                  }
                />
              </View>

              <SectionHeader title={tr("ตัวชี้วัด", "Indicators")} count={report.kpis.length} flush />
              <Card padded={false}>
                {report.kpis.map((k, i) => (
                  <KpiRow key={k.key} kpi={k} first={i === 0} />
                ))}
              </Card>
            </View>
            <View style={{ flex: wide ? 1 : undefined, gap: SPACE.md }}>
              <SectionHeader title={tr("ผลงานรายเดือน", "By month")} flush />
              <Monthly report={report} />

              <SectionHeader title={tr("การเยี่ยมบ้านแยกตามประเภท", "Home visits by type")} flush />
              <ByType report={report} />
            </View>
          </View>

          <Patients report={report} />

          <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
            {tr(
              "นับเฉพาะงานที่ถึงกำหนดแล้ว รอบงานกลุ่มที่ยังไม่ปิดงานนับเป็นยังไม่ได้ให้บริการ คะแนน KPI คือค่าเฉลี่ยของสัดส่วนที่แต่ละตัวชี้วัดทำได้เทียบกับเกณฑ์ (สูงสุดตัวละ 100)",
              "Only work that has fallen due is counted; rounds not yet closed count as not served. The KPI score averages how far each indicator reached its own target (at most 100 each).",
            )}
          </Text>
        </ScrollView>
      </HeaderFade>
    </View>
  );
}

/* ------------------------------------------------------------- parts */

/** A thin bar, filled to `value` (0–1), with an optional mark across it. */
function Bar({
  value,
  mark,
  height = 4,
  color = PRIMARY_500,
}: {
  value: number;
  mark?: number;
  height?: number;
  color?: string;
}) {
  return (
    <View style={{ height: height + 6, justifyContent: "center" }}>
      <View style={{ height, borderRadius: height / 2, backgroundColor: FILL_SUBTLE, overflow: "hidden" }}>
        <View
          style={{
            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
            height: "100%",
            borderRadius: height / 2,
            backgroundColor: color,
          }}
        />
      </View>
      {mark != null && (
        <View
          style={{
            position: "absolute",
            left: `${mark * 100}%`,
            top: 0,
            bottom: 0,
            width: 1.5,
            backgroundColor: TEXT_MUTED,
          }}
        />
      )}
    </View>
  );
}

/** A figure over its label, for a row of them. */
function Stat({ value, label, first }: { value: string; label: string; first?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: first ? 0 : SPACE.md,
        borderLeftWidth: first ? 0 : 1,
        borderLeftColor: SEPARATOR,
      }}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...figure(), fontSize: 20, lineHeight: 28 }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
        {label}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------- summary */

/** Whose year, the verdict on it, and the year being looked at. */
function Summary({ report, picker }: { report: Report; picker: React.ReactNode }) {
  const me = useSession();
  const { passed, scored, score } = report;

  return (
    <Card>
      <View style={{ gap: SPACE.lg, padding: SPACE.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, zIndex: 2 }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 24, fontWeight: "600", color: TEXT_PRIMARY }}>
              {me.displayName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {me.account != null ? professionLabel(me.account.profession) : tr("เจ้าหน้าที่", "Staff")}
              {me.facility != null ? ` · ${me.facility.name}` : ""}
            </Text>
          </View>
          {picker}
        </View>

        <View style={{ gap: SPACE.sm }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                {tr("คะแนน KPI", "KPI score")}
              </Text>
              <Text style={{ ...figure(), fontSize: 44, lineHeight: 52, fontWeight: "800" }}>
                {score ?? "–"}
                <Text style={{ fontSize: 17, fontWeight: "500", color: TEXT_MUTED }}> / 100</Text>
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", paddingBottom: 6 }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
                {tr("ผ่านเกณฑ์", "Indicators met")}
              </Text>
              <Text style={{ ...figure(), fontSize: 20, lineHeight: 28 }}>
                {passed}
                <Text style={{ fontWeight: "500", color: TEXT_MUTED }}>
                  {tr(` / ${scored} ตัว`, ` / ${scored}`)}
                </Text>
              </Text>
              {/* One dot per indicator, green for the ones that passed. */}
              <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                {report.kpis
                  .filter((k) => k.pass != null)
                  .map((k) => (
                    <View
                      key={k.key}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: k.pass ? INK_OK : FILL_SUBTLE,
                      }}
                    />
                  ))}
              </View>
            </View>
          </View>
          <Bar value={(score ?? 0) / 100} height={6} />
          <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
            {report.partial
              ? tr(`ข้อมูลถึง ${thaiShortDate(report.asOf)}`, `To ${thaiShortDate(report.asOf)}`)
              : tr("ข้อมูลทั้งปี", "Full year")}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: SEPARATOR }} />

        <View style={{ flexDirection: "row" }}>
          <Stat first value={report.visits.done.toLocaleString()} label={tr("เยี่ยมบ้าน (ครั้ง)", "Home visits")} />
          <Stat value={report.rounds.held.toLocaleString()} label={tr("งานกลุ่ม (รอบ)", "Group rounds")} />
          <Stat value={report.rounds.people.toLocaleString()} label={tr("ผู้รับบริการ (คน)", "People served")} />
        </View>
      </View>
    </Card>
  );
}

/* --------------------------------------------------------- indicators */

function KpiRow({ kpi, first }: { kpi: Kpi; first: boolean }) {
  const Glyph = GLYPH[kpi.key];
  const ink = inkOf(kpi.key);
  return (
    <View
      style={{
        flexDirection: "row",
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: WASH_PANEL[toneOf(kpi.key)][1],
        }}
      >
        <Glyph size={19} color={ink} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: SPACE.sm }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, lineHeight: 22, fontWeight: "600", color: TEXT_PRIMARY }}>
            {kpi.title}
          </Text>
          <Text style={{ ...figure(), fontSize: 17, lineHeight: 24 }}>{pct(kpi.rate)}</Text>
        </View>
        <Bar value={kpi.rate ?? 0} mark={kpi.target} color={ink} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: TEXT_MUTED, fontVariant: ["tabular-nums"] }}>
            {`${kpi.done.toLocaleString()} / ${kpi.total.toLocaleString()} ${UNIT[kpi.key]} · `}
            {tr(`เกณฑ์ ${Math.round(kpi.target * 100)}%`, `target ${Math.round(kpi.target * 100)}%`)}
          </Text>
          {kpi.pass == null ? (
            <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
              {tr("ไม่มีงานถึงกำหนด", "No work due")}
            </Text>
          ) : kpi.pass ? (
            <StatusTag label={tr("ผ่านเกณฑ์", "Met")} ink={INK_OK} Icon={CircleCheck} />
          ) : (
            <StatusTag
              label={tr(`ขาด ${kpi.short.toLocaleString()}`, `${kpi.short.toLocaleString()} short`)}
              ink={DANGER_INK}
              Icon={CircleAlert}
            />
          )}
        </View>
        {kpi.note != null && (
          <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_SECONDARY }}>{kpi.note}</Text>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------ months */

/** Twelve bars, one series at a time. This month's is the one in blue. */
function Monthly({ report }: { report: Report }) {
  const [series, setSeries] = useState(0);
  const values = report.months.map((m) => (series === 0 ? m.visits : m.people));
  // Months not reached yet are drawn as empty slots, not as zeros.
  const reached = (m: number) => !report.partial || m <= report.asOf.getMonth();
  const counted = values.filter((_, m) => reached(m));
  const total = counted.reduce((a, b) => a + b, 0);
  const average = counted.length === 0 ? 0 : total / counted.length;
  const top = Math.max(1, ...values);
  const current = report.year === planToday.getFullYear() ? planToday.getMonth() : -1;
  const BAR_H = 112;

  return (
    <Card>
      <View style={{ gap: SPACE.lg, padding: SPACE.xs }}>
        <Segments
          labels={[tr("เยี่ยมบ้าน", "Home visits"), tr("ผู้รับบริการงานกลุ่ม", "Group work served")]}
          index={series}
          onChange={(i) => {
            feel("tick");
            setSeries(i);
          }}
        />

        <View style={{ flexDirection: "row" }}>
          <Stat
            first
            value={total.toLocaleString()}
            label={series === 0 ? tr("รวมทั้งปี (ครั้ง)", "Year total") : tr("รวมทั้งปี (คน)", "Year total")}
          />
          <Stat value={average.toFixed(average >= 100 ? 0 : 1)} label={tr("เฉลี่ยต่อเดือน", "Monthly average")} />
        </View>

        <View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: BAR_H }}>
            {values.map((v, m) => (
              <View
                key={m}
                style={{
                  flex: 1,
                  height: reached(m) ? Math.max(2, (v / top) * BAR_H) : 2,
                  borderRadius: 3,
                  backgroundColor: reached(m) ? PRIMARY_500 : FILL_SUBTLE,
                  opacity: reached(m) && current >= 0 && m !== current ? 0.3 : 1,
                }}
              />
            ))}
          </View>
          {average > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: (average / top) * BAR_H,
                height: 1,
                backgroundColor: TEXT_MUTED,
              }}
            />
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginTop: -SPACE.sm }}>
          {values.map((_, m) => (
            <Text
              key={m}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 10,
                lineHeight: 14,
                fontWeight: m === current ? "700" : "400",
                color: m === current ? TEXT_PRIMARY : TEXT_MUTED,
              }}
            >
              {thaiMonthShort(new Date(report.year, m, 1))}
            </Text>
          ))}
        </View>
        <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
          {tr("เส้นแนวนอนคือค่าเฉลี่ยต่อเดือน", "The line across is the monthly average")}
        </Text>
      </View>
    </Card>
  );
}

/* -------------------------------------------------------- visit types */

/** One hue per kind of visit, from the same set the indicators use. */
const TYPE_INK = [PRIMARY_500, TONE_INK.violet, TONE_INK.peach, TONE_INK.mint, TONE_INK.sky];

/** Each kind of visit: made against due, so a weak spot shows by name. */
function ByType({ report }: { report: Report }) {
  const { byType, missed, ahead } = report.visits;
  return (
    <Card padded={false}>
      {byType.length === 0 && (
        <Text style={{ padding: SPACE.lg, fontSize: 14, lineHeight: 22, color: TEXT_MUTED }}>
          {tr("ยังไม่มีนัดเยี่ยมที่ถึงกำหนดในปีนี้", "No visits have fallen due this year")}
        </Text>
      )}
      {byType.map((r, i) => {
        const rate = r.total === 0 ? 0 : r.done / r.total;
        return (
          <View
            key={r.label}
            style={{
              gap: 4,
              paddingHorizontal: SPACE.lg,
              paddingVertical: SPACE.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: SEPARATOR,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: SPACE.sm }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_INK[i % TYPE_INK.length], alignSelf: "center" }} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, lineHeight: 22, color: TEXT_PRIMARY }}>
                {r.label}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED, fontVariant: ["tabular-nums"] }}>
                {`${r.done}/${r.total}`}
              </Text>
              <Text style={{ ...figure(), width: 56, textAlign: "right", fontSize: 15, lineHeight: 22 }}>
                {pct(rate)}
              </Text>
            </View>
            <Bar value={rate} color={TYPE_INK[i % TYPE_INK.length]} />
          </View>
        );
      })}
      {(missed > 0 || ahead > 0) && (
        <View style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: SEPARATOR }}>
          <Text style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
            {missed > 0 && (
              <Text style={{ color: DANGER_INK, fontWeight: "600" }}>
                {tr(`ค้างเยี่ยม ${missed} ครั้ง`, `${missed} missed`)}
              </Text>
            )}
            {missed > 0 && ahead > 0 && report.year === planToday.getFullYear() ? " · " : ""}
            {ahead > 0 && report.year === planToday.getFullYear()
              ? tr(`ยังไม่ถึงกำหนด ${ahead} ครั้ง`, `${ahead} still to come`)
              : ""}
          </Text>
        </View>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ export */

/**
 * The report as an Excel file, sent wherever the reviewer wants it — from
 * the toolbar, where every page in the app keeps what it does to itself.
 */
function useExport(report: Report) {
  const me = useSession();
  const [busy, setBusy] = useState(false);

  const run = () => {
    if (busy) return;
    feel("tick");
    setBusy(true);
    // A frame for the spinner to show before the sheets are built — the
    // visit sheet reads every visit's readings, which takes a moment.
    setTimeout(async () => {
      try {
        const bytes = reportWorkbook(report, me, new Date());
        await shareFile(reportFileName(report, me), bytes, tr("ส่งออกรายงาน KPI", "Export KPI report"));
      } catch {
        feel("error");
        toast(tr("สร้างไฟล์ไม่สำเร็จ", "Couldn't create the file"), "error");
      } finally {
        setBusy(false);
      }
    }, 50);
  };

  return { busy, run };
}

/* ---------------------------------------------------------- patients */

const FIRST = 5;

/** The people the year's visits were for, the ones with visits missed first. */
function Patients({ report }: { report: Report }) {
  const rows = useMemo(() => patientsOf(report), [report]);
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST);

  return (
    <>
      <SectionHeader title={tr("รายชื่อผู้ป่วยที่ดูแล", "Patients on the round")} count={rows.length} flush />
      <Card padded={false}>
        {shown.map((p, i) => (
          <PatientLine key={p.residentId} p={p} first={i === 0} />
        ))}
        {rows.length > FIRST && (
          <Pressable
            onPress={() => {
              feel("tick");
              setAll((v) => !v);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({
              paddingVertical: SPACE.md,
              alignItems: "center",
              borderTopWidth: 1,
              borderTopColor: SEPARATOR,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: "600", color: PRIMARY_500 }}>
              {all ? tr("แสดงน้อยลง", "Show fewer") : tr(`ดูทั้งหมด ${rows.length} คน`, `Show all ${rows.length}`)}
            </Text>
          </Pressable>
        )}
      </Card>
    </>
  );
}

function PatientLine({ p, first }: { p: PatientRow; first: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: SEPARATOR,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PRIMARY_100,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: PRIMARY_500 }}>
          {p.name.replace(/^(นางสาว|นาง|นาย|เด็กชาย|เด็กหญิง)\s*/, "")[0] ?? "?"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 22, fontWeight: "600", color: TEXT_PRIMARY }}>
          {p.name}
          <Text style={{ fontWeight: "400", color: TEXT_MUTED }}>{tr(` · ${p.age} ปี`, ` · ${p.age}`)}</Text>
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: TEXT_MUTED }}>
          {p.visitType} · {p.detail}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ ...figure(), fontSize: 15, lineHeight: 22 }}>
          {p.done}
          <Text style={{ fontWeight: "400", color: TEXT_MUTED }}>/{p.due}</Text>
        </Text>
        {p.missed > 0 && (
          <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: "600", color: DANGER_INK }}>
            {tr(`ค้าง ${p.missed}`, `${p.missed} missed`)}
          </Text>
        )}
      </View>
    </View>
  );
}
