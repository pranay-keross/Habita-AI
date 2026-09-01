import { Platform } from 'react-native';
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
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { parsePushPayload, pushCopy } from './parse';
import { t } from '../../i18n';
import type { PushPayload } from './types';
import type { PermissionStatus, PushMessaging, Unsubscribe } from './messaging';

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

  async requestPermission(): Promise<PermissionStatus> {
    try {
      // Notifee owns the Android 13+ POST_NOTIFICATIONS runtime prompt; the
      // Firebase call covers iOS. Both are no-ops once already answered.
      const settings = await notifee.requestPermission();
      if (Platform.OS === 'android') {
        await ensureChannel();
        return settings.authorizationStatus >= 1 ? 'granted' : 'denied';
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
