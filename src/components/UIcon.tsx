import { Image } from "react-native";

/**
 * A Flaticon UIcons glyph, as a tinted image.
 *
 * The icons are rendered out of `uicons-regular-rounded.ttf` (the `fi-rr-*`
 * set) rather than drawn from a font at runtime: the tab bar takes image
 * sources, not glyphs, and rendering the whole set the same way keeps one
 * pipeline instead of two. They are painted white so `tintColor` can carry
 * any colour.
 */
const ICONS = {
  // All three from the regular rounded face (`fi-rr-*`), U+EBE0 / U+F101 /
  // U+E9F2 / U+E9C0. The solid face carries the same codepoints, so the weight comes
  // from which font the PNG was rendered out of, not from the character.
  phoneFlip: require("../../assets/icons/phone_flip.png"),
  videoCameraAlt: require("../../assets/icons/video_camera_alt.png"),
  map: require("../../assets/icons/map.png"),
  locate: require("../../assets/icons/locate.png"),
  // fi-sr-location-arrow — the solid face, because Maps' locate arrow is
  // filled rather than outlined.
  locationArrow: require("../../assets/icons/location_arrow.png"),
  // fi-sr-house-chimney-heart, U+E886 — the solid face. Sits inside the
  // village cards' tinted glass disc, where an outline would disappear.
  houseChimneyHeart: require("../../assets/icons/house_chimney_heart.png"),
  // fi-rr-comment, U+E454 — beside the call and video buttons, so the three
  // ways of reaching someone are drawn from one family.
  comment: require("../../assets/icons/comment.png"),
  // The three standing facts on a resident's record: fi-rr-cake-birthday
  // U+E298, fi-rr-venus U+F0F8 / fi-rr-mars U+EA08, fi-rr-blood U+E1C3. The
  // sex glyph is picked by the value, so the mark states it too.
  cakeBirthday: require("../../assets/icons/cake_birthday.png"),
  venus: require("../../assets/icons/venus.png"),
  mars: require("../../assets/icons/mars.png"),
  blood: require("../../assets/icons/blood.png"),
  // The two AI marks, kept apart on purpose, by what the carer does rather
  // than by which page they are on.
  //
  // `sparkles` (fi-rr-sparkles, U+EE79) is the assistant that answers: the
  // helper in the home toolbar and the visit scribe, where the carer says
  // something — types it, or lets it listen — and the assistant replies.
  // `magicWand` (fi-rr-magic-wand, U+F63D) is the assistant reading the
  // record back: the patient and health briefs, and the diagnosis draft.
  // Nothing is said to it; it works from what is already on file. That the
  // draft can then be taken into the form does not change what the mark
  // promises — one wave over what is already written.
  //
  // The wand carries the same sparks as the plain mark, so the two read as a
  // pair rather than as two unrelated features.
  sparkles: require("../../assets/icons/sparkles.png"),
  magicWand: require("../../assets/icons/magic_wand.png"),
  // fi-rr-camera, U+E2C4 — the badge on an avatar that can be photographed.
  camera: require("../../assets/icons/camera.png"),
  // The vital signs, one mark each: fi-rr-heart-rate U+E846,
  // fi-rr-lungs U+E9D3, fi-rr-meter-droplet U+EA4F (a droplet on a dial — a
  // glucose meter, rather than the plain blood drop this set already spends
  // on blood type), fi-rr-thermometer-half U+EFA3,
  // fi-rr-tachometer-alt-average U+EF58 (a pressure gauge) and
  // fi-rr-circle-waveform-lines U+E3CD for the continuous monitor.
  heartRate: require("../../assets/icons/heart_rate.png"),
  lungs: require("../../assets/icons/lungs.png"),
  meterDroplet: require("../../assets/icons/meter_droplet.png"),
  thermometerHalf: require("../../assets/icons/thermometer_half.png"),
  // fi-rr-heart U+E83C — the mark on every card of the health page.
  heart: require("../../assets/icons/heart.png"),
  gauge: require("../../assets/icons/gauge.png"),
  waveformCircle: require("../../assets/icons/waveform_circle.png"),
  // fi-rr-plus-small U+EC3A and fi-rr-minus-small U+EA66 — the two states of
  // that badge: add a photograph, or take the one there away.
  plusSmall: require("../../assets/icons/plus_small.png"),
  minusSmall: require("../../assets/icons/minus_small.png"),
  // fi-rr-measuring-tape U+EA19 — the tape a waist is taken with, rendered
  // out of the same rounded face as the rest.
  measuringTape: require("../../assets/icons/measuring_tape.png"),
  // fi-rr-calendar-day U+E2A8 — the calendar with one day marked, for the
  // way back to today.
  calendarDay: require("../../assets/icons/calendar_day.png"),
} as const;

/** The names the set carries, for callers that keep one in a table. */
export type UIconName = keyof typeof ICONS;

/**
 * Where the icon's file ends up, for the places that need the file rather than
 * a React element — a native view, say, that tints its own glyph.
 */
export function uiconUri(name: UIconName): string | undefined {
  return Image.resolveAssetSource(ICONS[name])?.uri;
}

export function UIcon({
  name,
  size = 20,
  color,
}: {
  name: UIconName;
  size?: number;
  color: string;
}) {
  return (
    <Image
      source={ICONS[name]}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}
