import {
  PUSH_CLICK_ACTIONS,
  type PushClickAction,
  type PushPayload,
  type PushType,
} from './types';

/**
 * Turns a raw FCM data payload into a typed one, or null.
 *
 * Everything here is defensive on purpose. This is the one place in the app where
 * data arrives that no screen requested and no `apiFetch` shaped — a malformed or
 * newer-than-the-app message must produce a no-op, never a crash in a background
 * handler the user cannot see or recover from. So: unknown `type` -> null, missing
 * required field -> null, and no exception escapes.
 *
 * FCM guarantees data values are strings, but a `notifee`/`messaging` payload
 * replayed from a cold start can hand back already-parsed values, so each reader
 * accepts both rather than assuming.
 */

function readString(raw: Record<string, unknown>, key: string): string | null {
  const value = raw[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/**
 * `"5"` -> 5. Returns null for `"abc"`, `""`, negatives and non-integers rather
 * than letting a `NaN` reach the UI and render as "NaN left".
 */
function readCount(raw: Record<string, unknown>, key: string): number | null {
  const asString = readString(raw, key);
  if (asString === null) {
    return null;
  }
  const parsed = Number(asString);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function readClickAction(raw: Record<string, unknown>): PushClickAction | null {
  const value = readString(raw, 'click_action');
  return value !== null && (PUSH_CLICK_ACTIONS as string[]).includes(value)
    ? (value as PushClickAction)
    : null;
}

/** `YYYY-MM-DD`, and a real calendar date — rejects `2026-13-45`. */
function readIsoDate(raw: Record<string, unknown>, key: string): string | null {
  const value = readString(raw, key);
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return roundTrips ? value : null;
}

export function parsePushPayload(raw: unknown): PushPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const type = readString(data, 'type') as PushType | null;
  const clickAction = readClickAction(data);
  if (type === null || clickAction === null) {
    return null;
  }

  switch (type) {
    case 'DOSAGE_REMINDER': {
      const medicineName = readString(data, 'medicineName');
      return medicineName === null
        ? null
        : { type, medicineName, clickAction };
    }

    case 'LOW_STOCK': {
      const medicineName = readString(data, 'medicineName');
      const remainingQuantity = readCount(data, 'remainingQuantity');
      return medicineName === null || remainingQuantity === null
        ? null
        : { type, medicineName, remainingQuantity, clickAction };
    }

    case 'UTILITY_DUE_SOON':
    case 'UTILITY_DUE_TODAY': {
      const utilityType = readString(data, 'utilityType');
      const provider = readString(data, 'provider');
      const dueDate = readIsoDate(data, 'dueDate');
      return utilityType === null || provider === null || dueDate === null
        ? null
        : { type, utilityType, provider, dueDate, clickAction };
    }

    default:
      // A `type` the running app predates. Ignored, not guessed at.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * The title/body an alert renders as, expressed as i18n keys plus their
 * interpolation values — so the same payload renders in whichever of the six
 * locales is active, including one changed after the message arrived.
 */
export interface PushCopy {
  titleKey: string;
  bodyKey: string;
  values: Record<string, string | number>;
}

export function pushCopy(payload: PushPayload): PushCopy {
  switch (payload.type) {
    case 'DOSAGE_REMINDER':
      return {
        titleKey: 'notifications.dosage_title',
        bodyKey: 'notifications.dosage_body',
        values: { medicine: payload.medicineName },
      };
    case 'LOW_STOCK':
      return {
        titleKey: 'notifications.low_stock_title',
        // Separate key at 0 rather than an "0 left" sentence, which reads as a
        // reminder when it is actually "you have run out".
        bodyKey:
          payload.remainingQuantity === 0
            ? 'notifications.low_stock_body_empty'
            : 'notifications.low_stock_body',
        values: { medicine: payload.medicineName, count: payload.remainingQuantity },
      };
    case 'UTILITY_DUE_SOON':
      return {
        titleKey: 'notifications.utility_due_soon_title',
        bodyKey: 'notifications.utility_due_soon_body',
        values: {
          utility: payload.utilityType,
          provider: payload.provider,
          date: payload.dueDate,
        },
      };
    case 'UTILITY_DUE_TODAY':
      return {
        titleKey: 'notifications.utility_due_today_title',
        bodyKey: 'notifications.utility_due_today_body',
        values: {
          utility: payload.utilityType,
          provider: payload.provider,
          date: payload.dueDate,
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/**
 * Which registered route a tap opens, driven by `click_action` rather than
 * `type` — the backend decides the destination, and it already distinguishes the
 * dosage screen from the medicine list.
 *
 * `OPEN_DOSAGE_SCREEN` and `OPEN_MEDICINE_SCREEN` both land on `Medicine`
 * because that screen owns both the schedule and the stock list; the param tells
 * it which to surface. Route names must stay in step with `RootStackParamList`
 * (agent.md rule 6).
 */
export type PushRoute =
  | { screen: 'Medicine'; params: { focus: 'dosage' | 'stock' } }
  | { screen: 'Resources'; params: { focus: 'bills' } };

export function routeFor(payload: PushPayload): PushRoute {
  switch (payload.clickAction) {
    case 'OPEN_DOSAGE_SCREEN':
      return { screen: 'Medicine', params: { focus: 'dosage' } };
    case 'OPEN_MEDICINE_SCREEN':
      return { screen: 'Medicine', params: { focus: 'stock' } };
    case 'OPEN_UTILITY_BILLS_SCREEN':
      return { screen: 'Resources', params: { focus: 'bills' } };
  }
}
