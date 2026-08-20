import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Layout metrics derived from the live window size.
 *
 * Every screen before this one was drawn at a single implicit width (~390dp) with
 * fixed pixel values, so a 320dp phone clipped its stat chips and a tablet stretched
 * a two-column row across 800dp of empty space. This hook is the one place that
 * turns the window size into layout numbers; `useThemedStyles` still owns colour,
 * type and spacing tokens, and nothing here reads the palette.
 *
 * Layout values that depend on the window therefore arrive as *inline* style
 * overrides on top of a themed style — the factory signature stays
 * `(tokens: ThemeTokens) => StyleSheet`, unchanged, so the source-scan guard in
 * `__tests__/themedScreens.test.tsx` and the convention in
 * `docs/ARCHITECTURE.md` §11 both still hold.
 */

// The width the existing screens were drawn at (iPhone 14 / Pixel 7 logical width).
// Scaling is relative to this, so a 390dp device gets exactly the numbers already
// tuned by hand and nothing shifts under the current design.
const BASE_WIDTH = 390;

// Beyond this, a single column of content stops being readable and starts being a
// stretched line of text. Wide layouts centre inside this instead of filling.
const CONTENT_MAX_WIDTH = 640;

export type SizeClass = 'compact' | 'regular' | 'expanded';

export interface Responsive {
  width: number;
  height: number;
  sizeClass: SizeClass;
  /** < 360dp — small phones; drop to one column and tighten padding. */
  isCompact: boolean;
  /** >= 600dp — tablets and landscape phones; allow extra columns. */
  isExpanded: boolean;
  isLandscape: boolean;
  /** Scales a hand-tuned dp value by window width, clamped so nothing runs away. */
  scale: (size: number, min?: number, max?: number) => number;
  /** Same idea for type, but clamped much harder — text scales far less than boxes. */
  font: (size: number) => number;
  /** How many columns of `minItemWidth` fit in the usable content width. */
  columns: (minItemWidth: number, max?: number) => number;
  /** Width of one column in an `n`-column grid with `gap` between items. */
  columnWidth: (n: number, gap: number, outerPadding?: number) => number;
  /** Usable content width — window width capped at `CONTENT_MAX_WIDTH`. */
  contentWidth: number;
  contentMaxWidth: number;
}

export default function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const sizeClass: SizeClass = width < 360 ? 'compact' : width >= 600 ? 'expanded' : 'regular';
    const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);
    const ratio = contentWidth / BASE_WIDTH;

    const scale = (size: number, min = 0.86, max = 1.24) =>
      Math.round(size * Math.min(max, Math.max(min, ratio)));

    // Type gets a much narrower band than boxes: a 26pt title at 1.24x is 32pt and
    // wraps worse, not better. The OS font-scale setting is applied by `Text` on top
    // of this and is deliberately not read here — doubling it up is what makes
    // accessibility-sized text overflow.
    const font = (size: number) =>
      Math.round(size * Math.min(1.1, Math.max(0.94, ratio)));

    const columns = (minItemWidth: number, max = 4) =>
      Math.max(1, Math.min(max, Math.floor(contentWidth / minItemWidth)));

    const columnWidth = (n: number, gap: number, outerPadding = 0) =>
      Math.floor((contentWidth - outerPadding * 2 - gap * (n - 1)) / n);

    return {
      width,
      height,
      sizeClass,
      isCompact: sizeClass === 'compact',
      isExpanded: sizeClass === 'expanded',
      isLandscape,
      scale,
      font,
      columns,
      columnWidth,
      contentWidth,
      contentMaxWidth: CONTENT_MAX_WIDTH,
    };
  }, [width, height]);
}
