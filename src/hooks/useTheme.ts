import {useEffect, useSyncExternalStore} from 'react';
import {
  currentPaletteMeta,
  loadSavedTheme,
  saveTheme,
  subscribeToThemeChanges,
  theme,
} from '../theme';

let hydrated = false;

/**
 * Tracks the active palette.
 *
 * This used to hold `theme` in `useState` and re-set it after a change, but
 * `theme.colors` is the same mutable object every time, so React bailed out on
 * identity and never re-rendered. The palette *key* is the value that actually
 * changes, so that is what drives the subscription.
 */
export default function useTheme() {
  const paletteKey = useSyncExternalStore(
    subscribeToThemeChanges,
    () => currentPaletteMeta.key,
  );

  useEffect(() => {
    // Guarded at module scope so several consumers do not each re-read storage.
    // Restoring the saved palette notifies subscribers, which re-renders us.
    if (hydrated) return;
    hydrated = true;
    loadSavedTheme();
  }, []);

  return {
    theme,
    paletteKey,
    isDark: currentPaletteMeta.isDark,
    setTheme: (key: string) => saveTheme(key),
  };
}
