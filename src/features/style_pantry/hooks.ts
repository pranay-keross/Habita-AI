import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
