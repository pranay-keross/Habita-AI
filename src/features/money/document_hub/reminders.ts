import { getItem, setItem } from '../../../utils/storage';
import {
  alertId,
  cancelGroup,
  scheduleGroup,
  type LocalAlert,
} from '../../notifications/localScheduler';
import type { DocumentExpiryPush } from '../../notifications/types';
import type { DocHubEntry } from './types';

/**
 * Document expiry reminders.
 *
 * A Wise Home's document module "auto creates reminders for due dates/expiry dates
 * in the document"; Habita AI computed expiry but only ever *displayed* it, on a
 * screen the user had to remember to open — which is the one thing someone with an
 * expiring passport reliably does not do. See
 * `docs/AWH_FEATURE_GAP_ANALYSIS.md` §1.1 gap 1.5.
 *
 * The alert set is built here as a pure function of (documents, settings, now), so
 * it is testable without notifee, without a backend, and without a clock. Firing is
 * `features/notifications/localScheduler.ts`'s job, and the payloads it fires are
 * the same `DOCUMENT_EXPIRING_SOON` / `DOCUMENT_EXPIRED` messages the backend will
 * send once §3.1's daily job exists — at which point this file's `sync` call sites
 * are deleted and nothing else changes.
 */

export const DOC_REMINDER_STORAGE_KEY = 'habita.doc_reminders';

export interface DocReminderSettings {
  enabled: boolean;
  /**
   * Days before expiry to fire, descending. Matches the backend contract's
   * `leadDays` (§3.2 A2) so the two produce the same reminder set.
   */
  leadDays: number[];
  /** Local hour of day to fire at, 0-23. */
  reminderHour: number;
  /**
   * Per-document suppression, `documentId -> YYYY-MM-DD`. Mirrors
   * `POST /vault/documents/{id}/snooze` (§3.1 A4) so the field survives the
   * move to the server contract unchanged.
   */
  snoozedUntil: Record<string, string>;
}

/**
 * 60/30/14/7/1 rather than a single threshold: renewing a passport takes weeks, so
 * a one-week warning is already too late, while a 60-day warning alone is easy to
 * note and then forget. The existing in-app `getDocStatus()` already treats 60 days
 * as "expiring", so the first reminder lines up with the badge the user sees.
 *
 * 9am local: early enough to act on the same day, late enough not to arrive
 * overnight. The backend contract carries quiet hours for the same reason.
 */
export const DEFAULT_DOC_REMINDER_SETTINGS: DocReminderSettings = {
  enabled: true,
  leadDays: [60, 30, 14, 7, 1],
  reminderHour: 9,
  snoozedUntil: {},
};

export async function loadDocReminderSettings(): Promise<DocReminderSettings> {
  const stored = await getItem<Partial<DocReminderSettings>>(DOC_REMINDER_STORAGE_KEY, {});
  // Merged field-by-field rather than spread wholesale: a settings object written
  // by an older build is missing keys a newer one reads, and `{...defaults,
  // ...stored}` would happily let `leadDays: undefined` through into the loop.
  return {
    enabled: typeof stored?.enabled === 'boolean' ? stored.enabled : DEFAULT_DOC_REMINDER_SETTINGS.enabled,
    leadDays: normalizeLeadDays(stored?.leadDays),
    reminderHour:
      typeof stored?.reminderHour === 'number' &&
      Number.isInteger(stored.reminderHour) &&
      stored.reminderHour >= 0 &&
      stored.reminderHour <= 23
        ? stored.reminderHour
        : DEFAULT_DOC_REMINDER_SETTINGS.reminderHour,
    snoozedUntil:
      stored?.snoozedUntil && typeof stored.snoozedUntil === 'object'
        ? stored.snoozedUntil
        : {},
  };
}

export async function saveDocReminderSettings(settings: DocReminderSettings): Promise<void> {
  await setItem(DOC_REMINDER_STORAGE_KEY, {
    ...settings,
    leadDays: normalizeLeadDays(settings.leadDays),
  });
}

/** Positive integers, deduped, descending. Anything else is dropped, not clamped. */
function normalizeLeadDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return DEFAULT_DOC_REMINDER_SETTINGS.leadDays;
  }
  const clean = [...new Set(value.filter(
    (n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0,
  ))].sort((a, b) => b - a);
  return clean.length > 0 ? clean : DEFAULT_DOC_REMINDER_SETTINGS.leadDays;
}

/**
 * `"2026-10-14"` at `hour` o'clock, in the device's own timezone.
 *
 * Built from the parts rather than `new Date("2026-10-14")`, which parses a bare
 * date as UTC midnight — that is the bug that makes a reminder land on the 13th
 * for everyone west of Greenwich, and the same trap `types.ts` documents for
 * `UtilityBillPush.dueDate`.
 */
export function localDateAt(isoDate: string, hour: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), hour, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every reminder the vault warrants, as of `now`.
 *
 * Pure: no storage, no notifee, no `Date.now()`. That is what makes the awkward
 * cases — a document already expired, a document expiring today, a lead day that
 * has already passed, a snoozed document — testable at all.
 */
export function buildDocumentAlerts(
  docs: DocHubEntry[],
  settings: DocReminderSettings,
  now: number = Date.now(),
): LocalAlert[] {
  if (!settings.enabled) {
    return [];
  }

  const alerts: LocalAlert[] = [];

  for (const doc of docs) {
    const expiryAt = localDateAt(doc.expiryDate, settings.reminderHour);
    if (expiryAt === null) {
      // A document with an unparseable expiry date is a data problem, not a
      // reason to abandon the other documents' reminders.
      continue;
    }

    const snoozedUntil = settings.snoozedUntil[doc.id];
    const snoozeEndsAt = snoozedUntil ? localDateAt(snoozedUntil, 0) : null;

    const base = {
      documentId: doc.id,
      documentTitle: doc.title,
      documentCategory: doc.category,
      expiryDate: doc.expiryDate,
      clickAction: 'OPEN_DOCUMENT_ALERTS_SCREEN' as const,
    };

    for (const leadDays of settings.leadDays) {
      const fireAt = expiryAt - leadDays * DAY_MS;
      // Past lead days are skipped rather than fired late: being told on the 1st
      // that a document expires "in 60 days" when it expires in 12 is worse than
      // silence, and the shorter thresholds below still catch it.
      if (fireAt <= now || (snoozeEndsAt !== null && fireAt < snoozeEndsAt)) {
        continue;
      }
      const payload: DocumentExpiryPush = {
        ...base,
        type: 'DOCUMENT_EXPIRING_SOON',
        daysLeft: leadDays,
      };
      alerts.push({
        id: alertId('documents', doc.id, `d${leadDays}`),
        payload,
        fireAt,
      });
    }

    // The lapse itself, on the expiry day. Distinct from the countdown above:
    // "expires in 1 day" and "has expired" are different facts and the second one
    // is the one that changes what the user must do.
    if (expiryAt > now && !(snoozeEndsAt !== null && expiryAt < snoozeEndsAt)) {
      const payload: DocumentExpiryPush = { ...base, type: 'DOCUMENT_EXPIRED' };
      alerts.push({ id: alertId('documents', doc.id, 'expired'), payload, fireAt: expiryAt });
    }
  }

  return alerts;
}

/**
 * Recomputes and reschedules every document reminder from the current vault.
 *
 * Safe and cheap to call on every load of the Document Hub or the alerts screen:
 * `scheduleGroup` replaces the group wholesale and reuses stable ids, so a
 * repeated call converges on the same schedule instead of stacking duplicates.
 * That is deliberate — it is what makes "renew the passport and stop being
 * nagged" work without a separate invalidation path.
 */
export async function syncDocumentReminders(
  docs: DocHubEntry[],
  settings?: DocReminderSettings,
): Promise<number> {
  const resolved = settings ?? (await loadDocReminderSettings());
  if (!resolved.enabled) {
    await cancelGroup('documents');
    return 0;
  }
  return scheduleGroup('documents', buildDocumentAlerts(docs, resolved));
}

/** Turns reminders on or off, rescheduling or cancelling to match. */
export async function setDocRemindersEnabled(
  enabled: boolean,
  docs: DocHubEntry[],
): Promise<DocReminderSettings> {
  const settings = { ...(await loadDocReminderSettings()), enabled };
  await saveDocReminderSettings(settings);
  await syncDocumentReminders(docs, settings);
  return settings;
}

/** Suppresses one document's reminders until `untilDate` (`YYYY-MM-DD`). */
export async function snoozeDocument(
  documentId: string,
  untilDate: string,
  docs: DocHubEntry[],
): Promise<DocReminderSettings> {
  const current = await loadDocReminderSettings();
  const settings: DocReminderSettings = {
    ...current,
    snoozedUntil: { ...current.snoozedUntil, [documentId]: untilDate },
  };
  await saveDocReminderSettings(settings);
  await syncDocumentReminders(docs, settings);
  return settings;
}
