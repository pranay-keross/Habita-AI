import { PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage as onFcmMessage,
  onNotificationOpenedApp,
  onTokenRefresh as onFcmTokenRefresh,
  requestPermission as requestFcmPermission,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import notifee, {
  AndroidImportance,
  AuthorizationStatus as NotifeeAuthorizationStatus,
  EventType,
} from '@notifee/react-native';
import { parsePushPayload, pushCopy } from './parse';
import { t } from '../../i18n';
import type { PushPayload } from './types';
import type { PermissionStatus, PushMessaging, Unsubscribe } from './messaging';
import { requestPermissionExclusively } from '../../utils/permissionQueue';

/**
 * The real FCM transport (`docs/DECISIONS.md` D-059).
 *
 * Everything Firebase-specific is confined to this file. The rest of the app
 * talks to `PushMessaging`, so this can be swapped or removed without touching a
 * screen — which is also what keeps `NoopPushMessaging` viable as the permanent
 * fallback for iOS (not yet configured) and for any build without Play Services.
 */

/**
 * The channel every alert is posted to. Must match
 * `default_notification_channel_id` in `AndroidManifest.xml`, or a backgrounded
 * data message is dropped without a trace on Android 8+.
 */
export const ANDROID_CHANNEL_ID = 'habita_alerts';

/**
 * True where `POST_NOTIFICATIONS` is a runtime permission — Android 13 (API 33,
 * TIRAMISU) and above. Below that, notifications are granted at install time and
 * there is no dialog to show.
 *
 * A function rather than a module-level constant: as a constant it captured
 * `Platform` at import time, which makes the branch untestable and quietly
 * dependent on module load order.
 */
export function androidNeedsRuntimePermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: t('notifications.section_title'),
    importance: AndroidImportance.HIGH,
  });
}

/**
 * Draws the OS notification for a message that arrived in the foreground.
 *
 * FCM deliberately does not display foreground messages — without this, an alert
 * that arrives while the user is looking at another screen produces nothing at
 * all. Localised at display time, so it follows the app's current language
 * rather than whatever was active when the backend sent it.
 */
async function display(payload: PushPayload): Promise<void> {
  const copy = pushCopy(payload);
  await ensureChannel();
  await notifee.displayNotification({
    title: t(copy.titleKey, copy.values),
    body: t(copy.bodyKey, copy.values),
    data: { habitaType: payload.type },
    android: {
      channelId: ANDROID_CHANNEL_ID,
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
    },
  });
}

/**
 * Both transports hand back an FCM message; only the `data` half is ours.
 * Returns null for anything this app version does not recognise, which
 * `parsePushPayload` already handles without throwing.
 */
function toPayload(message: RemoteMessage | null | undefined): PushPayload | null {
  return message?.data ? parsePushPayload(message.data) : null;
}

export class FirebasePushMessaging implements PushMessaging {
  readonly isAvailable = true;

  /**
   * Reads the current setting without showing anything.
   *
   * `notifee.getNotificationSettings()` covers both platforms here: on Android it
   * reports the `POST_NOTIFICATIONS` grant, on iOS the UNUserNotificationCenter
   * authorization. `NOT_DETERMINED` (-1) is the only value that justifies a prompt.
   */
  async getPermissionStatus(): Promise<PermissionStatus> {
    try {
      // Android 13+ owns this as a real runtime permission, so ask the platform
      // directly rather than going through notifee's notification-settings view
      // of it. `check()` never shows UI.
      if (Platform.OS === 'android' && androidNeedsRuntimePermission()) {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        // A false here is "not granted" — Android cannot say whether that is a
        // refusal or a first run, which is why the caller keeps its own record.
        return granted ? 'granted' : 'denied';
      }

      const settings = await notifee.getNotificationSettings();
      switch (settings.authorizationStatus) {
        case NotifeeAuthorizationStatus.AUTHORIZED:
        case NotifeeAuthorizationStatus.PROVISIONAL:
          return 'granted';
        case NotifeeAuthorizationStatus.DENIED:
          return 'denied';
        default:
          return 'undetermined';
      }
    } catch {
      return 'unavailable';
    }
  }

  async requestPermission(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        // The channel must exist before the grant, or the first notification
        // after it has nowhere to post.
        await ensureChannel();

        if (!androidNeedsRuntimePermission()) {
          // Android 12 and below grant notifications at install time; there is
          // no dialog to show, so report what the OS already thinks.
          const settings = await notifee.getNotificationSettings();
          return settings.authorizationStatus >= 1 ? 'granted' : 'denied';
        }

        // `PermissionsAndroid` rather than `notifee.requestPermission()`.
        //
        // Notifee's implementation resolves as denied *without showing anything*
        // when it cannot cast `getCurrentActivity()` to a PermissionAwareActivity
        // — which happens during early startup. The caller cannot tell that
        // apart from a real refusal, records "already asked", and then never
        // prompts again: the OS reported `POST_NOTIFICATIONS granted=false` with
        // no `USER_SET` flag, i.e. a dialog the user was never actually shown.
        //
        // This is the same API the location prompt in `onboarding/profile.tsx`
        // already uses successfully in this app, and it returns a genuine
        // tri-state, so "dismissed" and "don't ask again" stay distinguishable.
        // Queued: the Profile screen asks for location at almost the same moment
        // after sign-in, and Android silently discards whichever request arrives
        // while the other's dialog is open. That is why this prompt never
        // appeared on a clean install while location's always did.
        const result = await requestPermissionExclusively(() =>
          PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS),
        );
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          return 'granted';
        }
        return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
      }
      const status = await requestFcmPermission(getMessaging());
      const granted =
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL;
      return granted ? 'granted' : 'denied';
    } catch {
      // No Play Services, or a build without Firebase configured. Treated as
      // "no push here" rather than an error the user has to see.
      return 'unavailable';
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await getToken(getMessaging());
    } catch {
      return null;
    }
  }

  onTokenRefresh(handler: (token: string) => void): Unsubscribe {
    try {
      return onFcmTokenRefresh(getMessaging(), handler);
    } catch {
      return () => {};
    }
  }

  onMessage(handler: (payload: PushPayload) => void): Unsubscribe {
    try {
      return onFcmMessage(getMessaging(), async (message: RemoteMessage) => {
        const payload = toPayload(message);
        if (payload) {
          handler(payload);
          await display(payload);
        }
      });
    } catch {
      return () => {};
    }
  }

  onNotificationOpened(handler: (payload: PushPayload) => void): Unsubscribe {
    const stops: Unsubscribe[] = [];
    try {
      // Tapped while the app was backgrounded.
      stops.push(
        onNotificationOpenedApp(getMessaging(), (m: RemoteMessage) => {
          const payload = toPayload(m);
          if (payload) handler(payload);
        }),
      );

      // Tapped on a notification this app drew itself via Notifee.
      stops.push(notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS && detail.notification?.data) {
          const payload = parsePushPayload(detail.notification.data);
          if (payload) handler(payload);
        }
      }));

      // Launched cold from the tap. This is the case most integrations miss:
      // the app was not running, so neither listener above ever fires, and the
      // tap silently opens the Dashboard instead of the alert's screen.
      void getInitialNotification(getMessaging())
        .then((m) => {
          const payload = toPayload(m);
          if (payload) handler(payload);
        })
        .catch(() => {});
    } catch {
      // Leave whatever did subscribe in place; the cleanup below is still safe.
    }
    return () => stops.forEach((stop) => stop());
  }
}

/**
 * True when a real Firebase app is configured for this build. Android reads
 * `google-services.json`, which is present; iOS has no `GoogleService-Info.plist`
 * yet (D-059), so this is false there and the no-op transport takes over.
 */
export function firebaseMessagingAvailable(): boolean {
  try {
    return Platform.OS === 'android' && getApp() != null;
  } catch {
    return false;
  }
}
