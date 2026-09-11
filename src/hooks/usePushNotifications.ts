import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
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
import { pushMessaging, type PermissionStatus } from '../features/notifications/messaging';
import { getItem, setItem } from '../utils/storage';
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
      documents: forSection(items, 'documents'),
      staff: forSection(items, 'staff'),
      unread: unreadCount(items),
      unreadMedchest: unreadCount(items, 'medchest'),
      unreadUtilities: unreadCount(items, 'utilities'),
      unreadDocuments: unreadCount(items, 'documents'),
      unreadStaff: unreadCount(items, 'staff'),
      markAsRead,
      markSectionAsRead,
    }),
    [items, markAsRead, markSectionAsRead],
  );
}

/**
 * Remembers that the OS prompt has been shown once.
 *
 * Needed because Android cannot answer "has this user been asked yet?" — a
 * missing `POST_NOTIFICATIONS` grant and an explicit refusal both report as
 * `denied` (notifee marks `NOT_DETERMINED` as iOS-only). Without a record of our
 * own the choice is between never prompting and prompting on every launch, and
 * both of those have now been shipped as bugs.
 */
// v2: the v1 key was written by a path that recorded "asked" even when notifee
// silently resolved without showing a dialog (no foreground Activity). Devices
// carrying that stale flag would never be prompted again, so the key is renamed
// rather than reused — every install gets exactly one more chance, now that
// `requestPermission` goes through PermissionsAndroid and really does prompt.
export const PERMISSION_ASKED_KEY = 'habita.push_permission_asked_v2';

/**
 * Whether to show the OS notification-permission dialog.
 *
 * Pure, and separated out because getting it wrong is invisible in both
 * directions: too eager and the app nags on every launch, too shy and the user
 * is never asked and simply never receives an alert. Both have happened here.
 *
 * - `granted` — nothing to ask.
 * - `unavailable` — no working transport, so the prompt would do nothing. Not
 *   recorded as "asked", so a later build that *does* have Firebase still asks.
 * - `undetermined` — iOS, genuinely never asked. Prompt.
 * - `denied` — on **Android** this is also what "never asked" looks like, so
 *   `askedBefore` is the only thing separating a first run from a refusal.
 */
export function shouldPromptForPermission(
  status: PermissionStatus,
  askedBefore: boolean,
): boolean {
  if (status === 'granted' || status === 'unavailable' || status === 'blocked') {
    return false;
  }
  return status === 'undetermined' || !askedBefore;
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

  // `getAccessToken` is NOT referentially stable: `useAuth` derives it from
  // `resolveSession`, which closes over the `session` state and calls
  // `setSession` on every silent refresh. Depending on it directly re-ran the
  // registration effect on every session change — and that effect used to call
  // `requestPermission()`, which is why a user who had refused notifications was
  // re-prompted more or less every time they opened the app. Held in a ref so
  // the effect below can depend on `signedIn` alone.
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

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
        const token = await getAccessTokenRef.current();
        if (token && !cancelled) {
          await registerDevice(fcmToken, Platform.OS, token);
        }
      } catch {
        // A failed registration must never break sign-in. The next launch or
        // token refresh retries; the user gets a working app either way.
      }
    };

    (async () => {
      let status = await pushMessaging.getPermissionStatus();

      if (status !== 'granted' && !cancelled) {
        const askedBefore = await getItem<boolean>(PERMISSION_ASKED_KEY, false);
        if (shouldPromptForPermission(status, askedBefore)) {
          status = await pushMessaging.requestPermission();
          // Recorded only once the OS actually answered. `unavailable` means the
          // dialog never appeared — no Play Services, or notifee could not reach
          // a foreground Activity — and persisting the flag there would mean the
          // user is never asked again because of a transient startup condition.
          // `unavailable` is excluded on purpose: it means no dialog appeared, so
          // recording it would spend the one prompt on a transient condition.
          if (status === 'granted' || status === 'denied' || status === 'blocked') {
            await setItem(PERMISSION_ASKED_KEY, true);
          }
        } else if (__DEV__) {
          console.log(
            `[notifications] permission prompt skipped (status=${status}, askedBefore=${askedBefore}). ` +
              (status === 'unavailable'
                ? 'The Firebase/notifee transport is not available — this build may need a native rebuild: npx react-native run-android'
                : status === 'blocked'
                  ? 'Android has blocked the dialog (never_ask_again) — only Settings can change it now.'
                  : 'The user already declined; re-prompting is suppressed by design. Clear app data to reset.'),
          );
        }
      }

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
  // `getAccessToken` deliberately absent: it changes identity on every session
  // refresh and is read through a ref instead. Including it re-ran registration —
  // and the permission prompt — on every token refresh.
  }, [signedIn]);

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
