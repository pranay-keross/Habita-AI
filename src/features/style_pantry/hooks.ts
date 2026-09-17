import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Height of the on-screen keyboard (0 when hidden). The app targets SDK 36, where
 * Android enforces edge-to-edge and ignores `windowSoftInputMode="adjustResize"`, so
 * `KeyboardAvoidingView` never moves anything — pad the composer by this instead
 * (same approach as `components/BottomSheet.tsx`).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    // Under edge-to-edge the window extends beneath the navigation bar, so the space the
    // keyboard actually covers is (window bottom − keyboard top), which can exceed the
    // reported keyboard height by the nav-bar inset.
    const overlap = (e: KeyboardEvent) => {
      const { height: windowHeight } = Dimensions.get('window');
      const top = e.endCoordinates.screenY;
      const measured = typeof top === 'number' && top > 0 ? windowHeight - top : e.endCoordinates.height;
      return Math.max(0, Math.round(measured));
    };
    const show = Keyboard.addListener(showEvent, e => setHeight(overlap(e)));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
import { subscribeToLanguageChanges } from '../../i18n';

/** Re-renders the component whenever the app language changes. */
export function useLocaleRerender(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() => setVersion(v => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);
  return version;
}

export interface ScreenLoadState {
  /** True until the first load has finished. */
  loading: boolean;
  /** True during a pull-to-refresh. */
  refreshing: boolean;
  /** True when the data on screen came from the local cache. */
  offline: boolean;
  refresh: () => Promise<void>;
  /** Re-run the loader without toggling `loading` (e.g. after a write). */
  reload: () => Promise<void>;
}

/**
 * Runs `load` every time the screen gains focus (so edits made on a pushed screen
 * are visible when returning), plus on pull-to-refresh. `load` returns whether
 * the result was served offline so the screen can show the offline banner.
 */
export function useFocusLoad(load: () => Promise<{ offline: boolean } | void>): ScreenLoadState {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    try {
      const r = await loadRef.current();
      if (mounted.current) setOffline(Boolean(r && r.offline));
    } catch (err) {
      if (__DEV__) console.warn('[style_pantry] screen load failed', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      run().finally(() => {
        if (active && mounted.current) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [run]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    if (mounted.current) setRefreshing(false);
  }, [run]);

  return { loading, refreshing, offline, refresh, reload: run };
}

/** Tracks an in-flight async action so buttons can disable/spin without try/finally boilerplate. */
export function useBusy(): [boolean, <T>(work: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const wrap = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (busy) return undefined;
    setBusy(true);
    try {
      return await work();
    } catch (err) {
      if (__DEV__) console.warn('[style_pantry] action failed', err);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [busy]);
  return [busy, wrap];
}
