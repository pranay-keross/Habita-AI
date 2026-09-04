import type { PushPayload } from './types';

/**
 * The push transport, behind an interface.
 *
 * Same shape as `CbtCoach` in `features/wellness/cbtCoach.ts`, and for the same
 * reason (agent.md rule 8): the thing that actually talks to Firebase Cloud
 * Messaging needs `@react-native-firebase/app` + `/messaging`, which are *not*
 * installed — see `docs/DECISIONS.md` D-059. Everything on this side of the
 * interface (parsing, copy, routing, device registration, the in-app centre) is
 * built, tested and independent of that choice.
 *
 * `NoopPushMessaging` below is what runs today: it grants nothing, returns no
 * token, and delivers no messages. The app behaves exactly as it does now — no
 * crash, no dead UI — and swapping in the real transport is one new file plus one
 * line in `pushMessaging`, with no screen change, because screens only ever see
 * this interface.
 */

export type PermissionStatus = 'granted' | 'denied' | 'unavailable';

/** Unsubscribe, returned by every listener registration. */
export type Unsubscribe = () => void;

export interface PushMessaging {
  /** Whether a real transport is behind this, for diagnostics and tests. */
  readonly isAvailable: boolean;

  /**
   * Asks the OS for notification permission. Android 13+ needs the runtime
   * `POST_NOTIFICATIONS` grant; older Android is granted by default; iOS always
   * prompts. Safe to call more than once — the OS only prompts the first time.
   */
  requestPermission(): Promise<PermissionStatus>;

  /** The device's current FCM token, or null when unavailable or not permitted. */
  getToken(): Promise<string | null>;

  /**
   * Fires when FCM rotates the token. The new token must be re-registered with
   * the backend or the device silently stops receiving alerts — which is the
   * failure mode most push integrations ship with.
   */
  onTokenRefresh(handler: (token: string) => void): Unsubscribe;

  /** A message that arrived while the app was in the foreground. */
  onMessage(handler: (payload: PushPayload) => void): Unsubscribe;

  /**
   * The user tapped a notification. Covers both the app being backgrounded and
   * being launched cold from the tap — the cold-start case is the one usually
   * missed, and it is why this is a separate channel from `onMessage`.
   */
  onNotificationOpened(handler: (payload: PushPayload) => void): Unsubscribe;
}

/**
 * The no-op transport. Not a placeholder to be deleted — it stays as the
 * permanent fallback for a build without Firebase configured, an emulator with no
 * Play Services, and every test.
 */
export class NoopPushMessaging implements PushMessaging {
  readonly isAvailable = false;

  async requestPermission(): Promise<PermissionStatus> {
    return 'unavailable';
  }

  async getToken(): Promise<string | null> {
    return null;
  }

  onTokenRefresh(): Unsubscribe {
    return () => {};
  }

  onMessage(): Unsubscribe {
    return () => {};
  }

  onNotificationOpened(): Unsubscribe {
    return () => {};
  }
}

/**
 * The single instance the app talks to.
 *
 * Real FCM on Android, where `google-services.json` is configured; the no-op
 * everywhere else — iOS has no Firebase set up yet, and an emulator without Play
 * Services cannot deliver a message either. Both cases degrade to "no push"
 * rather than to a crash.
 *
 * Required lazily so that a build or a test which never touches push does not
 * pay to load the Firebase native modules, and so `jest` can run this module
 * without mocking them.
 */
function resolveTransport(): PushMessaging {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./firebaseMessaging');
    if (mod.firebaseMessagingAvailable()) {
      return new mod.FirebasePushMessaging();
    }
    // Expected on iOS, which has no Firebase configured yet. Not an error.
    return new NoopPushMessaging();
  } catch (err) {
    // Unexpected: Firebase is installed and this is Android, so reaching here
    // means a genuine misconfiguration. Silently degrading to "no push ever,
    // no explanation" is the worst possible failure for this feature, so say so
    // in dev. Production still degrades rather than crashing.
    if (__DEV__) {
      console.warn(
        '[notifications] Firebase transport failed to load; push is disabled. ' +
          'Alerts will not arrive. Cause:',
        err,
      );
    }
    return new NoopPushMessaging();
  }
}

export const pushMessaging: PushMessaging = resolveTransport();
