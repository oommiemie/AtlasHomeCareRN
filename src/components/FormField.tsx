import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStage } from "./BlurStage";
import { DateHitLayer } from "./DateHitLayer";
import { openOptionMenu } from "./OptionMenu";
import { usePageHeight } from "./ScreenFrame";
import { Calendar, ChevronDown } from "lucide-react-native";

import { fromThaiDate, toThaiDate } from "../models/datePicker";
import { labelForValue, setOptionRequest, type Option } from "../models/optionPicker";
import { isEn, tr } from "../i18n";
import { thaiShortDate } from "../utils/thaiDate";
import {
  DANGER,
  GROUPED_BG,
  RADIUS,
  SPACE,
  TEXT_MUTED,
  TEXT_PLACEHOLDER,
  TEXT_PRIMARY,
} from "../theme/tokens";

/** The control's own shape — Figma 102:15915: a 48pt capsule on #F2F2F7. */
export const FIELD = { height: 48, pad: SPACE.lg } as const;

/** Read as the label renders — a const would freeze the ink at import. */
const labelStyle = () =>
  ({ fontSize: 14, lineHeight: 20, color: TEXT_MUTED }) as const;

/** A line of typed text in a note box, at the 16pt every control uses. */
const NOTE_LINE = 22;

/**
 * The label over any of the controls below.
 *
 * A required field is starred, in the app's own red — so what has to be
 * filled in is legible from the form itself rather than only from the
 * disabled button at the foot of it.
 */
function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={labelStyle()}>
      {text}
      {required === true && <Text style={{ color: DANGER }}> *</Text>}
    </Text>
  );
}

/** The capsule every control is drawn on. */
function Shell({
  children,
  invalid,
  fixedHeight,
}: {
  children: ReactNode;
  invalid?: boolean;
  /**
   * For a capsule whose children are all absolute and measure nothing — and
   * which has to clip, because one of them is scaled up well past its edges.
   */
  fixedHeight?: boolean;
}) {
  return (
    <View
      style={{
        height: fixedHeight === true ? FIELD.height : undefined,
        overflow: fixedHeight === true ? "hidden" : "visible",
        minHeight: FIELD.height,
        backgroundColor: GROUPED_BG,
        borderRadius: RADIUS.capsule,
        // A ring rather than a red fill: the fill is what makes it read as a
        // field, and losing that to say something is wrong costs more than
        // it tells.
        borderWidth: invalid === true ? 1.5 : 0,
        borderColor: DANGER,
        paddingHorizontal: FIELD.pad,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
      }}
    >
      {children}
    </View>
  );
}

/** A typed field. */
export function TextField({
  label,
  value,
  onChangeText,
  // Blank, not the design's "text" — that is a mock's stand-in, and shipped
  // it reads as a value somebody left in the field.
  placeholder = "",
  keyboardType,
  trailing,
  required,
  error,
  maxLength,
  ink,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Dots instead of characters — a password. */
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** Off for anything iOS has no business second-guessing — a lot number. */
  autoCorrect?: boolean;
  /**
   * Opens the keyboard with the page.
   *
   * For a form whose first act is always to type into this one field — a
   * weight off a scale with a child standing on it. One tap saved per
   * person, which on a class of fifty is fifty.
   */
  autoFocus?: boolean;
  /** A glyph at the trailing end — the calendar on a date, say. */
  trailing?: ReactNode;
  /**
   * What colour the typed value is.
   *
   * For a field whose *content* can be remarkable while still being
   * perfectly valid — a temperature of 39 is not a typing mistake, and
   * ringing the box in red the way `error` does would say it was. Left
   * off, the value is the ordinary ink.
   */
  ink?: string;
  /** Stars the label. Say so where the form cannot be finished without it. */
  required?: boolean;
  /** What is wrong with what is in it, shown under the field. */
  error?: string | null;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      {/* An empty label draws nothing rather than an empty line: on a tile
          the heading above the field is already the field's name. */}
      {label !== "" && <Label text={label} required={required} />}
      <Shell invalid={error != null}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={TEXT_PLACEHOLDER}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoFocus={autoFocus}
          style={{
            flex: 1,
            // The capsule's own height, so the tap target is the whole pill
            // rather than a line of text inside it.
            height: FIELD.height,
            fontSize: 16,
            fontWeight: ink != null ? "600" : "400",
            color: ink ?? TEXT_PRIMARY,
          }}
        />
        {trailing}
      </Shell>
      {/* An empty message rings the field and says nothing under it, for a
          box too narrow to carry a sentence. */}
      {error != null && error !== "" && (
        <Text
          style={{ paddingHorizontal: SPACE.md, fontSize: 12, color: DANGER }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

/**
 * Two numbers in one field, with a mark between them.
 *
 * A blood pressure is not one value and it is not two fields: it is written
 * 120/80, read aloud as one thing, and recorded as one thing. Typed into a
 * single box it needs a slash, and a box that needs a slash cannot have a
 * number pad — iOS puts one on the "numbers and punctuation" keyboard
 * instead, which is the full alphanumeric layout with digits that are a
 * third the size of a keypad's.
 *
 * So the box holds two inputs and prints the mark between them. Both get a
 * real number pad, and the pair still reads and stores as one value.
 */
export function PairField({
  label,
  first,
  second,
  onChange,
  separator = "/",
  hints = ["", ""],
  trailing,
  error,
  ink,
  required,
}: {
  label: string;
  first: string;
  second: string;
  onChange: (first: string, second: string) => void;
  separator?: string;
  hints?: [string, string];
  trailing?: ReactNode;
  error?: string | null;
  ink?: string;
  required?: boolean;
}) {
  const entry = {
    fontSize: 16,
    fontWeight: (ink != null ? "600" : "400") as "600" | "400",
    color: ink ?? TEXT_PRIMARY,
    height: FIELD.height,
    // Wide enough for three digits and no wider: the two halves should sit
    // either side of the mark, not at either end of the capsule.
    minWidth: 44,
  };
  return (
    <View style={{ gap: SPACE.sm }}>
      <Label text={label} required={required} />
      <Shell invalid={error != null}>
        <TextInput
          value={first}
          onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""), second)}
          placeholder={hints[0]}
          placeholderTextColor={TEXT_PLACEHOLDER}
          keyboardType="number-pad"
          maxLength={3}
          style={entry}
        />
        <Text style={{ fontSize: 16, color: TEXT_MUTED }}>{separator}</Text>
        <TextInput
          value={second}
          onChangeText={(v) => onChange(first, v.replace(/[^0-9]/g, ""))}
          placeholder={hints[1]}
          placeholderTextColor={TEXT_PLACEHOLDER}
          keyboardType="number-pad"
          maxLength={3}
          style={entry}
        />
        <View style={{ flex: 1 }} />
        {trailing}
      </Shell>
      {/* An empty message rings the field and says nothing under it, for a
          box too narrow to carry a sentence. */}
      {error != null && error !== "" && (
        <Text
          style={{ paddingHorizontal: SPACE.md, fontSize: 12, color: DANGER }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

/**
 * A field for more than a line: an account of something, not a value.
 *
 * The same fill and label as every other control, but a box rather than a
 * capsule — a pill four lines tall reads as a mistake, and the corner
 * radius is the card's so it sits in one without arguing. It grew out of
 * the screening and home-visit forms, which had each drawn their own; it
 * lives here so the next form that needs one does not draw a third.
 */
export function NoteField({
  label,
  value,
  onChangeText,
  placeholder = "",
  /** How tall, in lines of the text it holds. */
  lines = 5,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  lines?: number;
  required?: boolean;
}) {
  return (
    <View style={{ gap: SPACE.sm }}>
      <Label text={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline
        textAlignVertical="top"
        placeholder={placeholder}
        placeholderTextColor={TEXT_PLACEHOLDER}
        style={{
          // Sixteen, as in every other control here. It was fourteen — the
          // size the screening form had drawn its own box at before this
          // one existed — and a form whose long answers are set smaller
          // than its short ones is a form that looks like two forms.
          height: lines * NOTE_LINE + FIELD.pad * 2,
          backgroundColor: GROUPED_BG,
          borderRadius: RADIUS.lg,
          padding: FIELD.pad,
          fontSize: 16,
          lineHeight: NOTE_LINE,
          color: TEXT_PRIMARY,
        }}
      />
    </View>
  );
}

/**
 * A field whose answer is one of a fixed list.
 *
 * The list opens as its own sheet rather than a menu hanging off the field:
 * these run to a dozen options — religions, occupations — and a dropdown that
 * long has nowhere to go on a form that is already scrolling.
 *
 * Past a handful of answers the sheet takes a search field of its own, so a
 * list of villages is typed at rather than scrolled through.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = tr("เลือก", "Select"),
  required,
  searchable,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Adds a field above the list. Worth it past a handful of options. */
  searchable?: boolean;
}) {
  const nav = useNavigation();
  const chosen = value.trim().length > 0;
  /*
    On Android, the list drops from the field rather than coming up as a
    sheet — Material's exposed dropdown; see `OptionMenu`. The field is
    measured as it is pressed, since it rides a scrolling form, and names
    the page it is on so the menu can blur it.

    Not for a list that is searched: that keeps the sheet, where there is
    room for the keyboard. On both platforms: a choice of a handful from a
    sheet that rose over the whole form took the form away to answer a
    question the form was still asking.
  */
  const drops = !searchable;
  const stage = useStage();
  const { height: screenH } = useWindowDimensions();
  // How far down the screen this page starts. An iOS sheet measures its
  // fields from its own top edge, which sits below the screen's — and the
  // list drops in a layer over the whole screen, so without this it hung
  // exactly that far too high, over the field it answers. A page that fills
  // the screen starts at its top, and adds nothing.
  const pageHeight = usePageHeight();
  const sheetDrop = () =>
    Platform.OS === "ios" && pageHeight.current > 0
      ? Math.max(0, screenH - pageHeight.current)
      : 0;
  const field = useRef<View>(null);
  const [open, setOpen] = useState(false);

  const face = (
    <Shell>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 16,
          color: chosen ? TEXT_PRIMARY : TEXT_PLACEHOLDER,
        }}
      >
        {chosen ? labelForValue(options, value) : placeholder}
      </Text>
      {/* Turned over while the list is down, as Material's is. */}
      <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
        <ChevronDown size={18} color={TEXT_MUTED} />
      </View>
    </Shell>
  );

  return (
    <View style={{ gap: SPACE.sm }}>
      <Label text={label} required={required} />
      <Pressable
        ref={field}
        // The request is handed over through the picker's own store, not the
        // navigator: it carries a callback, and a function cannot go through
        // route params.
        onPress={() => {
          if (drops) {
            field.current?.measureInWindow((x, y, width, height) => {
              setOpen(true);
              openOptionMenu({
                anchor: { x, y: y + sheetDrop(), width, height },
                blurTarget: stage?.target,
                label,
                options,
                value,
                onPick: onChange,
                onClose: () => setOpen(false),
              });
            });
            return;
          }
          setOptionRequest({
            title: label,
            options,
            value,
            searchable,
            onPick: onChange,
          });
          nav.navigate("SelectOption" as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen ? labelForValue(options, value) : placeholder}`}
        accessibilityState={drops ? { expanded: open } : undefined}
      >
        {face}
      </Pressable>
    </View>
  );
}

/**
 * A date: the field reads like every other one, and the whole capsule opens
 * Apple's calendar.
 *
 * Getting both takes a trick, and it is worth saying what it is. UIKit's
 * compact picker is the only way to raise that popover — there is no API to
 * open it — but the control draws its own grey button and only that button is
 * tappable. So the control is laid over the whole field at zero opacity and
 * scaled up, which leaves its hit area covering the capsule while what you
 * see is our own text. Touches land on the picker; the popover is UIKit's;
 * the field looks like its neighbours.
 *
 * The scale has to be enough to cover the widest field on any phone — the
 * pill is around a hundred points and the capsule can be three and a half
 * times that — and generous is free, since nothing of it is drawn.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = tr("เลือกวันที่", "Select date"),
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  // Nobody in this registry was born before this, and none of them tomorrow.
  const earliest = useMemo(() => new Date(1900, 0, 1), []);
  const latest = useMemo(() => new Date(), []);
  const chosen = value.trim().length > 0;
  /*
    The value is kept as the registry writes it — day/month/Buddhist year —
    whatever the app speaks. In English it is shown as an English date,
    with the common-era year, and only shown so.
  */
  const parsed = fromThaiDate(value);
  const said = isEn && parsed != null ? thaiShortDate(parsed) : value;

  // An empty field opens on a plausible adult rather than on today: a
  // calendar that starts on a newborn is a long way from a birth date.
  const shown = useMemo(
    () => fromThaiDate(value) ?? new Date(latest.getFullYear() - 40, 0, 1),
    [value, latest],
  );

  return (
    <View style={{ gap: SPACE.sm }}>
      <Label text={label} required={required} />
      {/* The capsule is empty of laid-out children — both layers are
          absolute — so it is given its height rather than taking one. */}
      <Shell fixedHeight>
        {/* The live control, underneath everything. */}
        <DateHitLayer
          value={shown}
          minimumDate={earliest}
          maximumDate={latest}
          label={`${label}: ${chosen ? said : placeholder}`}
          scale={{ x: 6, y: 3 }}
          onPick={(next) => {
            onChange(toThaiDate(next));
          }}
        />

        {/* What you see, laid over it on the capsule's own colour — which is
            what hides the control rather than its alpha, and is why the
            ghost of a scaled-up date is not showing through. Transparent to
            touches, so they reach the control underneath. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.sm,
            paddingHorizontal: FIELD.pad,
            backgroundColor: GROUPED_BG,
            borderRadius: RADIUS.capsule,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 16,
              color: chosen ? TEXT_PRIMARY : TEXT_PLACEHOLDER,
            }}
          >
            {chosen ? said : placeholder}
          </Text>
          <Calendar size={18} color={TEXT_MUTED} />
        </View>
      </Shell>
    </View>
  );
}
