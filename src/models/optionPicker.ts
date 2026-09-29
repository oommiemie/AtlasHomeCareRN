/**
 * What the option sheet is being asked to show.
 *
 * A store rather than route params: the request carries a callback, and a
 * function is not something to put through a navigator's params — it cannot
 * be serialised, and React Navigation says so out loud. Only one sheet can be
 * open at a time, so one slot is enough.
 */
/**
 * One answer in the sheet.
 *
 * A plain string where the word is the whole of it; a pair where the answer
 * needs a second line to be told apart from another with the same name.
 */
export type Option =
  | string
  | {
      value: string;
      detail?: string;
      /**
       * What the sheet and the field show, where that is not the value
       * itself: an answer saved in Thai and compared as written keeps its
       * Thai `value`, and says it in the app's language here.
       */
      label?: string;
    };

export const optionValue = (o: Option) => (typeof o === "string" ? o : o.value);
export const optionDetail = (o: Option) =>
  typeof o === "string" ? "" : (o.detail ?? "");
/** The words an option is shown in: its label, or the value where it has none. */
export const optionLabel = (o: Option) =>
  typeof o === "string" ? o : (o.label ?? o.value);
/** What to show for a chosen value: its option's label, or the value itself. */
export const labelForValue = (options: readonly Option[], value: string) => {
  const o = options.find((x) => optionValue(x) === value);
  return o == null ? value : optionLabel(o);
};

export type OptionRequest = {
  title: string;
  options: readonly Option[];
  /** What is currently chosen, so the sheet can tick it. */
  value: string;
  /** Adds a field above the list. Worth it past a handful of options. */
  searchable?: boolean;
  onPick: (value: string) => void;
};

let request: OptionRequest | null = null;

/** Set immediately before the sheet is pushed, read as it mounts. */
export const setOptionRequest = (r: OptionRequest) => {
  request = r;
};

export const optionRequest = () => request;
