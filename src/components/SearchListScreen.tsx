import { useRef, useState, type ReactNode } from "react";
import {
  Animated,
  FlatList,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, Search } from "lucide-react-native";

import { GlassIconButton } from "./GlassIconButton";
import { HeaderWash } from "./ScreenHeader";
import { HeaderFade } from "./HeaderFade";
import { SearchField, SEARCH_FIELD_HEIGHT } from "./SearchField";
import { CANVAS, SPACE, TEXT_PRIMARY, TOUCH_MIN } from "../theme/tokens";

/** How far the list travels before the field gives way to the button. */
const COLLAPSE_AT = 40;

/**
 * The clear space between the search field and the first card.
 *
 * The header already carries its own 16pt of bottom padding, so this is added
 * to that — it is a gap between two blocks, not the whole distance. It was
 * SPACE.xl, which put 36pt of nothing under the field and made the list look
 * detached from the control filtering it.
 */
const CONTENT_GAP = SPACE.sm;

type Props<T> = {
  title: string;
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  /**
   * What sits above the list — and, where no `data` is given, the list too.
   */
  children?: ReactNode;
  /** Extra controls at the right end of the title row. */
  right?: ReactNode;
  /**
   * The rows, where there are enough of them to be worth virtualising.
   *
   * A list passed as `children` is mounted whole: every row builds its views
   * and does its own work before the screen can be shown, and does it again
   * whenever the list narrows. That is fine for a screen with a dozen cards
   * and not for the follow-up register, which has a hundred and sixty-seven
   * and asks each row for six generated readings — about a second of blocked
   * JavaScript on the way in, and the same again on each keystroke.
   *
   * Given these instead, the list keeps only what is on screen and a little
   * either side. `children` becomes the header above it.
   */
  data?: readonly T[];
  renderItem?: (item: T) => ReactNode;
  keyExtractor?: (item: T) => string;
};

/**
 * A searchable list screen: wash, pinned header, and a search field that
 * collapses into a button in the title row once the list moves.
 *
 * The field and the button are one control moving, not two swapping — the
 * field shrinks toward the corner the button occupies and the button grows
 * out of it, so the eye follows a single object.
 */
export function SearchListScreen<T>({
  title,
  query,
  onQuery,
  placeholder,
  children,
  right,
  data,
  renderItem,
  keyExtractor,
}: Props<T>) {
  const [collapsed, setCollapsed] = useState(false);
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const scroll = useRef<ScrollView>(null);
  const list = useRef<FlatList<T>>(null);
  const virtual = data != null && renderItem != null;

  /** The search button's target, whichever of the two is carrying the list. */
  const toTop = () =>
    virtual
      ? list.current?.scrollToOffset({ offset: 0, animated: true })
      : scroll.current?.scrollTo({ y: 0, animated: true });

  // Status bar, the 44pt title row, and the field with its gaps above and
  // below. Held constant whether or not the field is showing.
  const headerHeight =
    insets.top + SPACE.sm + TOUCH_MIN + SPACE.lg + SEARCH_FIELD_HEIGHT + SPACE.lg;

  // Below the title row *and its bottom padding*, so the button band is never
  // inside the ramp — see HeaderFade, which is where the rest of that lives.
  const fadeFrom = insets.top + SPACE.sm + TOUCH_MIN + SPACE.lg;

  // Driven by state rather than the scroll value: the swap is a discrete
  // change, and animating it off the raw offset made it flicker at the
  // threshold as the list settled.
  const progress = useRef(new Animated.Value(0)).current;

  const setCollapsedTo = (next: boolean) => {
    setCollapsed((was) => {
      if (was === next) return was;
      // Not the native driver: the blur strip's height animates off this
      // value, and layout props are JS-thread only.
      Animated.timing(progress, {
        toValue: next ? 1 : 0,
        duration: 240,
        useNativeDriver: false,
      }).start();
      return next;
    });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCollapsedTo(e.nativeEvent.contentOffset.y > COLLAPSE_AT);
  };

  /** What the list is scrolled and padded by, whichever container carries it. */
  const scrollProps = {
    onScroll,
    scrollEventThrottle: 16,
    keyboardDismissMode: "on-drag" as const,
    // A tap while the keyboard is up would otherwise be spent closing it,
    // leaving the card underneath unopened — one action costing two taps.
    keyboardShouldPersistTaps: "handled" as const,
    // Reserved rather than animated: the gap stays put as the field collapses,
    // so the list never jumps under the finger mid-scroll.
    contentContainerStyle: {
      paddingHorizontal: SPACE.lg,
      // Clears the fade's tail, not just the header, so the first card starts
      // fully opaque rather than part-way through the ramp.
      paddingTop: headerHeight + CONTENT_GAP,
      paddingBottom: insets.bottom + SPACE.huge,
      gap: SPACE.md,
    },
  };

  // Scale, never opacity — see buttonStyle. The field carries glass of its
  // own, so fading it by alpha strips the material and leaves a bare row.
  const fieldStyle = {
    transform: [
      {
        scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
      },
    ],
  };

  // Scale only, never opacity. UIVisualEffectView — which UIGlassEffect uses
  // — does not render its material when an ancestor has alpha below 1, so an
  // opacity fade leaves the pill as a bare icon with no glass under it. The
  // pill is mounted only once collapsed, so it is never drawn part-faded.
  const buttonStyle = {
    transform: [
      {
        scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
      },
    ],
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      {/* The sub-pages' own pale band, not the tabs' deep one: this screen is
          somewhere you drilled into, and it should look it. */}
      <HeaderWash height={headerHeight} />

      <HeaderFade from={fadeFrom} to={headerHeight + CONTENT_GAP}>
        {virtual ? (
          <FlatList
            ref={list}
            data={data}
            renderItem={({ item }) => <>{renderItem?.(item)}</>}
            keyExtractor={keyExtractor}
            /*
              Above the rows, not merely before them.

              The header carries the list's own controls, and a filter opens a
              menu that has to hang over the first few cards. As children of a
              ScrollView the header and the cards were siblings and a `zIndex`
              on the header lifted it; a FlatList wraps the header in a view of
              its own, so the zIndex went on the inside of a wrapper that had
              none and the cells — drawn after it — covered the menu. This is
              the wrapper.
            */
            ListHeaderComponentStyle={{ zIndex: 10 }}
            // Whatever was passed as children rides above the rows.
            ListHeaderComponent={
              children == null ? null : (
                <View style={{ gap: SPACE.md }}>{children}</View>
              )
            }
            // A screen's worth on the way in and a screen either side after:
            // the register's rows are cheap to draw and expensive to fill, so
            // the win is in not filling the hundred and sixty that are not
            // being looked at.
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            {...scrollProps}
          />
        ) : (
          <ScrollView ref={scroll} {...scrollProps}>
            {children}
          </ScrollView>
        )}
      </HeaderFade>
      <View
        // Over the list, not above it — and drawn after it, so the cards pass
        // behind the header rather than pushing it.
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          paddingTop: insets.top + SPACE.sm,
          paddingHorizontal: SPACE.lg,
          paddingBottom: SPACE.lg,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", minHeight: TOUCH_MIN }}
        >
          <GlassIconButton onPress={() => nav.goBack()} accessibilityLabel="ย้อนกลับ">
            <ChevronLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.4} />
          </GlassIconButton>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              marginLeft: SPACE.md,
              fontSize: 20,
              lineHeight: 26,
              fontWeight: "800",
              color: TEXT_PRIMARY,
            }}
          >
            {title}
          </Text>
          {right}
          {/* Absolutely placed so it can fade in over the row's right end
              without the title shifting as it appears. */}
          {collapsed && (
            <Animated.View
              pointerEvents="auto"
              style={[{ position: "absolute", right: 0 }, buttonStyle]}
            >
              {/* The same round button the back arrow uses — one glass
                  component for both ends of the row, so they cannot drift. */}
              <GlassIconButton
                accessibilityLabel="ค้นหา"
                onPress={toTop}
              >
                <Search size={20} color={TEXT_PRIMARY} />
              </GlassIconButton>
            </Animated.View>
          )}
        </View>

        {/* The slot keeps its height whether or not the field is in it, so the
            list below never jumps as the two swap. The field itself is
            unmounted once collapsed rather than faded — it carries glass, and
            a part-faded ancestor strips the material. */}
        <View style={{ marginTop: SPACE.lg, height: SEARCH_FIELD_HEIGHT }}>
          {!collapsed && (
            <Animated.View style={fieldStyle}>
              <SearchField
                value={query}
                onChangeText={onQuery}
                placeholder={placeholder}
              />
            </Animated.View>
          )}
        </View>
      </View>

    </View>
  );
}
