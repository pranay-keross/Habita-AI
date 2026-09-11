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

/**
 * `undetermined` means the OS reports it has never been asked.
 *
 * **iOS only.** Notifee's own typing marks `NOT_DETERMINED` as `@platform ios`;
 * on Android a missing `POST_NOTIFICATIONS` grant reports as `DENIED`, with no
 * way to tell "never asked" from "said no". Anything deciding whether to prompt
 * must therefore keep its own record of having asked rather than relying on this
 * — see `shouldPromptForPermission` in `hooks/usePushNotifications.ts`.
 */
export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'undetermined'
  /**
   * Android's `never_ask_again`. The OS will not show the dialog again no
   * matter what the app does, so prompting is pointless — only Settings can
   * change it. Kept distinct from `denied`, which is a dismissal the user may
   * still reconsider.
   */
  | 'blocked';

/** Unsubscribe, returned by every listener registration. */
export type Unsubscribe = () => void;

export interface PushMessaging {
  /** Whether a real transport is behind this, for diagnostics and tests. */
  readonly isAvailable: boolean;

  /**
   * The current permission state, **without prompting**.
   *
   * The distinction that matters: `requestPermission()` shows UI, and calling it
   * on every mount is how an app ends up nagging. Read this first.
   *
   * On Android this cannot distinguish "never asked" from "refused" — both report
   * `denied` — so the caller keeps its own record of having asked. See
   * `shouldPromptForPermission` in `hooks/usePushNotifications.ts`.
   */
  getPermissionStatus(): Promise<PermissionStatus>;

  /**
   * Asks the OS for notification permission — **shows UI**. Call only when
   * `shouldPromptForPermission()` says so.
   *
   * Returns `blocked` when Android reports `never_ask_again`: the dialog will not
   * appear again for any caller, and only Settings can change it.
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

  async getPermissionStatus(): Promise<PermissionStatus> {
    return 'unavailable';
  }

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
      const cause = (err as { message?: string })?.message ?? String(err);
      // "native module not found" means the JS package is installed but the app
      // binary predates it. A Metro reload cannot fix that — the native side
      // only exists after a real rebuild. Said explicitly because the generic
      // message sent one teammate looking in the wrong place entirely.
      const missingNative = /native module|has not been (registered|linked)|NativeModule/i.test(cause);
      console.warn(
        '[notifications] Firebase transport failed to load; push is disabled. ' +
          'Alerts will not arrive.\nCause: ' +
          cause +
          (missingNative
            ? '\n\nThe JS package is installed but this app binary does not contain its' +
              '\nnative code, so the app must be REBUILT - reloading Metro will not fix it:' +
              '\n    npx react-native run-android' +
              '\nIf it still fails after a rebuild:  node scripts/check-push-setup.js'
            : '\n\nRun:  node scripts/check-push-setup.js'),
      );
    }
    return new NoopPushMessaging();
  }
}

export const pushMessaging: PushMessaging = resolveTransport();
