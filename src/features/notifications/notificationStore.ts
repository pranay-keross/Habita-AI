import { getItem, setItem } from '../../utils/storage';
import type { PushPayload, PushSection } from './types';
import { sectionOf } from './types';

/**
 * The received-alerts inbox, device-local.
 *
 * A push that arrives while the phone is locked is gone the moment it is swiped
 * away, and "your medicine ran out" is not something to lose that easily. Keeping
 * a local copy is what lets the Medicine and Resources screens show the alert
 * again after the fact, and what makes the unread badge possible.
 *
 * Device-local by deliberate choice, matching every other module here except
 * auth/profile/family: the backend has no notification-history endpoint (only
 * `POST /devices/register`), so there is nothing to sync against.
 */

export const NOTIFICATION_STORAGE_KEY = 'habita.notifications';

/**
 * Capped so a chatty backend cannot grow AsyncStorage without bound. 100 is far
 * past what anyone scrolls and still small enough to read and write in one go.
 */
export const MAX_STORED_NOTIFICATIONS = 100;

export interface StoredNotification {
  id: string;
  payload: PushPayload;
  receivedAt: number; // epoch ms
  read: boolean;
}

export async function loadNotifications(): Promise<StoredNotification[]> {
  return getItem<StoredNotification[]>(NOTIFICATION_STORAGE_KEY, []);
}

export async function saveNotifications(items: StoredNotification[]): Promise<void> {
  await setItem(NOTIFICATION_STORAGE_KEY, items.slice(0, MAX_STORED_NOTIFICATIONS));
}

/** Newest first — the order the list renders in. */
export function sortByNewest(items: StoredNotification[]): StoredNotification[] {
  return [...items].sort((a, b) => b.receivedAt - a.receivedAt);
}

/**
 * A stable identity for one alert, so the same message delivered twice does not
 * appear twice.
 *
 * FCM explicitly does not guarantee at-most-once delivery, and the cold-start tap
 * handler can legitimately hand back a message the foreground handler already
 * saw. Both are ordinary, so dedupe on content rather than treating a duplicate
 * as an error: the same medicine at the same stock level on the same day is the
 * same alert. The date, not the timestamp, is the grain — two "due soon" pushes
 * for one bill on one day should collapse.
 */
export function notificationId(payload: PushPayload, receivedAt: number): string {
  const day = new Date(receivedAt).toISOString().slice(0, 10);
  switch (payload.type) {
    case 'DOSAGE_REMINDER':
      // Dosage reminders legitimately repeat within a day (morning and night),
      // so the hour is part of the identity where for others the day is enough.
      return `${payload.type}:${payload.medicineName}:${day}:${new Date(receivedAt).getUTCHours()}`;
    case 'LOW_STOCK':
      return `${payload.type}:${payload.medicineName}:${payload.remainingQuantity}:${day}`;
    default:
      return `${payload.type}:${payload.provider}:${payload.utilityType}:${payload.dueDate}`;
  }
}

/**
 * Adds one alert, newest first, ignoring a duplicate. Returns the same array
 * reference when nothing changed so callers can skip a needless write and
 * re-render.
 */
export function addNotification(
  items: StoredNotification[],
  payload: PushPayload,
  receivedAt: number = Date.now(),
): StoredNotification[] {
  const id = notificationId(payload, receivedAt);
  if (items.some((n) => n.id === id)) {
    return items;
  }
  return [{ id, payload, receivedAt, read: false }, ...items].slice(
    0,
    MAX_STORED_NOTIFICATIONS,
  );
}

export function markRead(items: StoredNotification[], id: string): StoredNotification[] {
  return items.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markSectionRead(
  items: StoredNotification[],
  section: PushSection,
): StoredNotification[] {
  return items.map((n) =>
    sectionOf(n.payload) === section && !n.read ? { ...n, read: true } : n,
  );
}

export function forSection(
  items: StoredNotification[],
  section: PushSection,
): StoredNotification[] {
  return sortByNewest(items.filter((n) => sectionOf(n.payload) === section));
}

export function unreadCount(items: StoredNotification[], section?: PushSection): number {
  return items.filter(
    (n) => !n.read && (section === undefined || sectionOf(n.payload) === section),
  ).length;
}
