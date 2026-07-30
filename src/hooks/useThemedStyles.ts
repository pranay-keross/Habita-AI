import { useMemo, useSyncExternalStore } from 'react';
import {
  ThemeTokens,
  colors,
  currentPaletteMeta,
  fonts,
  radius,
  shadow,
  spacing,
  subscribeToThemeChanges,
} from '../theme';

/**
 * Builds a screen's styles from the active palette and rebuilds them when the
 * palette changes.
 *
 * `StyleSheet.create` at module scope reads `colors` once at module load, so
 * mutating the palette afterwards cannot restyle a mounted screen. Pass the
 * style block as a factory instead and call it from the render:
 *
 *   const makeStyles = ({ colors, spacing }: ThemeTokens) =>
 *     StyleSheet.create({ root: { backgroundColor: colors.background } });
 *
 *   const styles = useThemedStyles(makeStyles);
 *
 * Destructuring the factory parameter shadows the module-level imports, so an
 * existing style block can be wrapped without touching its body.
 *
 * The palette lives outside React as a mutable singleton (D-004), which is
 * exactly what `useSyncExternalStore` is for — it subscribes to the change
 * notification and re-renders on the palette key, and `useMemo` keeps the
 * StyleSheet from being rebuilt on unrelated renders.
 */
export default function useThemedStyles<T>(factory: (tokens: ThemeTokens) => T): T {
  const paletteKey = useSyncExternalStore(
    subscribeToThemeChanges,
    () => currentPaletteMeta.key,
  );

  return useMemo(
    () => factory({ colors, spacing, radius, fonts, shadow }),
    // `factory` is a module-scope function; the palette key is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paletteKey],
  );
}
