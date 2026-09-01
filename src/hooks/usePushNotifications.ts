import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import useAuth from './useAuth';
import { registerDevice } from '../features/notifications/api';
import {
  getSnapshot,
  hydrate,
  readOne,
  readSection,
  receive,
  subscribe,
} from '../features/notifications/inbox';
import { pushMessaging } from '../features/notifications/messaging';
import { forSection, unreadCount } from '../features/notifications/notificationStore';
import { routeFor, type PushRoute } from '../features/notifications/parse';
import type { PushSection } from '../features/notifications/types';

/**
 * Read access to the alert inbox, plus the read/unread actions.
 *
 * Safe to mount on as many screens as need it: every mount subscribes to the one
 * store in `features/notifications/inbox.ts` rather than keeping its own copy,
 * so marking an alert read on one screen is immediately true on the others.
 *
 * The transport lifecycle — permission, token registration, listeners — lives in
 * `usePushRegistration` below, which is mounted exactly once at the root.
 */
export default function usePushNotifications() {
  const items = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    void hydrate();
  }, []);

  const markAsRead = useCallback((id: string) => readOne(id), []);
  const markSectionAsRead = useCallback((section: PushSection) => readSection(section), []);

  // `forSection` and `unreadCount` allocate, so memoise on the snapshot rather
  // than recomputing four derived lists on every unrelated render.
  return useMemo(
    () => ({
      notifications: items,
      medchest: forSection(items, 'medchest'),
      utilities: forSection(items, 'utilities'),
      unread: unreadCount(items),
      unreadMedchest: unreadCount(items, 'medchest'),
      unreadUtilities: unreadCount(items, 'utilities'),
      markAsRead,
      markSectionAsRead,
    }),
    [items, markAsRead, markSectionAsRead],
  );
}

/**
 * Owns the push lifecycle: register this device with the backend, listen for
 * alerts, and hand taps back as a route to navigate to.
 *
 * Mount once, at the root — registration belongs to sign-in, not to whichever
 * screen happens to open first, and a second set of listeners would record every
 * arrival twice. Everything it touches is behind the `PushMessaging` interface,
 * so with the no-op transport in place today it mounts, does nothing, and costs
 * nothing (`docs/DECISIONS.md` D-059).
 */
export function usePushRegistration(onOpen?: (route: PushRoute) => void) {
  const { signedIn, getAccessToken } = useAuth();

  useEffect(() => {
    void hydrate();
  }, []);

  // --- Device registration -------------------------------------------------
  //
  // Re-runs on sign-in and again whenever FCM rotates the token. Skipping the
  // rotation case is the classic way a push integration quietly stops
  // delivering some weeks after it ships.
  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const send = async (fcmToken: string) => {
      try {
        const token = await getAccessToken();
        if (token && !cancelled) {
          await registerDevice(fcmToken, Platform.OS, token);
        }
      } catch {
        // A failed registration must never break sign-in. The next launch or
        // token refresh retries; the user gets a working app either way.
      }
    };

    (async () => {
      const status = await pushMessaging.requestPermission();
      if (status !== 'granted' || cancelled) {
        return;
      }
      const fcmToken = await pushMessaging.getToken();
      if (fcmToken && !cancelled) {
        // Printed in dev only, and only the token — no account data. There is
        // otherwise no way to send this device a test push without reading it
        // off the device, which makes the whole feature awkward to verify by
        // hand. See docs/DECISIONS.md D-059.
        if (__DEV__) {
          console.log('[notifications] FCM token:', fcmToken);
        }
        await send(fcmToken);
      }
      if (!cancelled) {
        unsubscribe = pushMessaging.onTokenRefresh((rotated) => void send(rotated));
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [signedIn, getAccessToken]);

  // --- Delivery ------------------------------------------------------------
  //
  // `onOpen` is typically an inline arrow, so it is read through a ref-like
  // pattern via the dependency list rather than re-subscribing on every render.
  useEffect(() => {
    const stopForeground = pushMessaging.onMessage((payload) => receive(payload));
    const stopOpened = pushMessaging.onNotificationOpened((payload) => {
      receive(payload);
      onOpen?.(routeFor(payload));
    });
    return () => {
      stopForeground();
      stopOpened();
    };
  }, [onOpen]);
}
