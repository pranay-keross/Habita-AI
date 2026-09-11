import { Platform } from 'react-native';
import { pushCopy, toPushData } from './parse';
import { t } from '../../i18n';
import type { PushPayload } from './types';

/**
 * Device-scheduled alerts, for the reminders no backend sends yet.
 *
 * Document expiry (`docs/AWH_FEATURE_GAP_ANALYSIS.md` §1.1 gap 1.5) and staff
 * salary reminders (gap 3.4) are both alerts the app can compute entirely from
 * data it already holds — expiry dates in the vault, attendance in the staff
 * roster. Waiting for the §3.1/§3.2 backend schedulers before shipping either
 * would mean shipping a "reminders" feature that never reminds anyone.
 *
 * So they are scheduled locally with notifee, and deliberately built to be
 * *replaced* rather than reworked: a locally-fired notification carries the
 * byte-identical `data` payload the backend will send (`toPushData`), so it
 * parses, dedupes, files into the inbox and routes on tap through exactly the
 * same code as a server push. When the server scheduler ships, deleting the
 * `schedule*` call sites is the whole migration — `parse.ts`, `routeFor`,
 * `AlertsCard` and the inbox are already correct for both.
 *
 * Everything here is best-effort. Notifee reaches for a native module, so on a
 * build without it (or in a headless context) each call degrades to "no local
 * reminder" rather than throwing into a caller that has no way to recover.
 */

/** Same channel the FCM transport posts to — see `firebaseMessaging.ts`. */
export const ANDROID_CHANNEL_ID = 'habita_alerts';

/**
 * One alert to fire at a moment in the future.
 *
 * `id` must be stable across reschedules for the *same* underlying alert (the
 * same document at the same lead-day threshold), because notifee replaces a
 * trigger notification that reuses an id. That stability is what stops the
 * common failure here: rescheduling on every screen focus and stacking a
 * duplicate reminder each time.
 */
export interface LocalAlert {
  id: string;
  payload: PushPayload;
  /** Epoch ms. Alerts in the past are dropped, not fired immediately. */
  fireAt: number;
  /**
   * Repeat every 24h from `fireAt`. Used by medicine dose reminders, which are the
   * one alert here that recurs — a document expires once, a salary falls due once a
   * month, but "take your 08:00 tablet" is true every single day.
   *
   * Set on the trigger rather than by scheduling N days of one-shot alerts, so the
   * reminder survives the app never being opened again: the OS owns the repeat.
   */
  repeatDaily?: boolean;
}

/**
 * The prefix every id in one group shares, so a reschedule can cancel the
 * group's stale alerts without touching another feature's. `documents` and
 * `staff` are the two groups today.
 */
export type AlertGroup = 'documents' | 'staff' | 'medicine';

export function alertId(group: AlertGroup, ...parts: (string | number)[]): string {
  return `habita:${group}:${parts.join(':')}`;
}

function isGroupId(group: AlertGroup, id: string): boolean {
  return id.startsWith(`habita:${group}:`);
}

/** Lazily required so a build or test that never schedules pays nothing for it. */
function notifee(): typeof import('@notifee/react-native') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@notifee/react-native');
  } catch {
    return null;
  }
}

async function ensureChannel(mod: typeof import('@notifee/react-native')): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await mod.default.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: t('notifications.section_title'),
    importance: mod.AndroidImportance.HIGH,
  });
}

/**
 * Replaces every scheduled alert in one group with `alerts`.
 *
 * Replace, not add: the source data changes underneath these reminders all the
 * time — a passport gets renewed, a salary gets paid — and a reminder for a
 * fact that is no longer true is worse than no reminder. Cancelling the group
 * first is what makes "renew the passport, stop being told it expires" work.
 *
 * Returns how many were actually scheduled, which is what the caller logs or
 * shows; it is not necessarily `alerts.length`, since past-dated alerts are
 * skipped.
 */
export async function scheduleGroup(
  group: AlertGroup,
  alerts: LocalAlert[],
  now: number = Date.now(),
): Promise<number> {
  const mod = notifee();
  if (mod === null) {
    return 0;
  }

  const due = alerts.filter((a) => a.fireAt > now);
  const keep = new Set(due.map((a) => a.id));

  try {
    await ensureChannel(mod);

    // Cancel this group's stale triggers before scheduling. Only ours: another
    // feature's pending reminders must survive an unrelated reschedule, which
    // `cancelAllNotifications()` would silently destroy.
    const existing = await mod.default.getTriggerNotificationIds();
    await Promise.all(
      existing
        .filter((id) => isGroupId(group, id) && !keep.has(id))
        .map((id) => mod.default.cancelTriggerNotification(id)),
    );

    await Promise.all(
      due.map(async (alert) => {
        const copy = pushCopy(alert.payload);
        await mod.default.createTriggerNotification(
          {
            id: alert.id,
            title: t(copy.titleKey, copy.values),
            body: t(copy.bodyKey, copy.values),
            // The wire shape a server push would carry, so the tap handler in
            // `firebaseMessaging.ts` parses and routes it with no special case.
            data: toPushData(alert.payload),
            android: {
              channelId: ANDROID_CHANNEL_ID,
              pressAction: { id: 'default' },
              smallIcon: 'ic_launcher',
            },
          },
          {
            type: mod.TriggerType.TIMESTAMP,
            timestamp: alert.fireAt,
            ...(alert.repeatDaily
              ? { repeatFrequency: mod.RepeatFrequency.DAILY }
              : {}),
            // `SET_AND_ALLOW_WHILE_IDLE`: fires through Doze, and — crucially —
            // needs no special permission.
            //
            // This previously used the deprecated `allowWhileIdle: true`, which
            // notifee maps to `setExactAndAllowWhileIdle`. That is an *exact*
            // alarm, and on Android 12+ exact alarms require `SCHEDULE_EXACT_ALARM`,
            // which is not granted here (Play restricts it to alarm/calendar apps).
            // The scheduling call threw a SecurityException, the catch below
            // swallowed it, and the device ended up with **zero** alarms — so
            // nothing fired once the app was backgrounded or killed, while
            // foreground alerts kept working because those go through
            // `displayNotification` and need no alarm at all.
            //
            // Inexact is right for this: a dose reminder landing within a few
            // minutes is fine, one that needs a permission grant to exist is not.
            alarmManager: { type: mod.AlarmType.SET_AND_ALLOW_WHILE_IDLE },
          },
        );
      }),
    );
    return due.length;
  } catch (err) {
    // Degrade rather than crash: the in-app alerts screens still show every expiry
    // and every unpaid salary, so this is "no push", not "no information".
    //
    // But say so in dev. Swallowing this silently is exactly how a
    // SecurityException from an exact-alarm request went unnoticed while the
    // device held zero scheduled alarms and every reminder quietly did nothing.
    if (__DEV__) {
      console.warn(
        `[notifications] failed to schedule ${due.length} "${group}" reminder(s); ` +
          'they will not fire in the background. Cause: ' +
          ((err as { message?: string })?.message ?? String(err)),
      );
    }
    return 0;
  }
}

/** Cancels a group's pending alerts — used when the user turns reminders off. */
export async function cancelGroup(group: AlertGroup): Promise<void> {
  const mod = notifee();
  if (mod === null) {
    return;
  }
  try {
    const existing = await mod.default.getTriggerNotificationIds();
    await Promise.all(
      existing
        .filter((id) => isGroupId(group, id))
        .map((id) => mod.default.cancelTriggerNotification(id)),
    );
  } catch {
    // Nothing to do — see the note in `scheduleGroup`.
  }
}
