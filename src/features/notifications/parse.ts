import {
  PUSH_CLICK_ACTIONS,
  PUSH_TYPES,
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

/**
 * Like `readCount` but allows a fractional value, because money is not an integer
 * count — a salary can legitimately be `12300.50`. Still rejects negatives: an
 * outstanding amount below zero means the payroll math upstream is wrong, and
 * rendering "you owe ₹-400" is worse than dropping the alert.
 */
function readAmount(raw: Record<string, unknown>, key: string): number | null {
  const asString = readString(raw, key);
  if (asString === null) {
    return null;
  }
  const parsed = Number(asString);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/** `YYYY-MM` — a payroll month, which is not a date and must not be parsed as one. */
function readMonth(raw: Record<string, unknown>, key: string): string | null {
  const value = readString(raw, key);
  if (value === null || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12 ? value : null;
}

/**
 * Which destinations each alert type is allowed to open.
 *
 * Checking the action is *known* is not enough — it also has to belong to this
 * type. Without this, a `DOCUMENT_EXPIRING_SOON` carrying `OPEN_DOSAGE_SCREEN`
 * parses cleanly and `routeFor` then sends the user to the Medicine screen from
 * a notification about their passport. That is precisely the "guessed at"
 * behaviour this module exists to avoid, and it only became reachable once there
 * were more than two sections.
 *
 * The two medicine actions are deliberately interchangeable across the two
 * medicine types: `types.ts` records that choosing between the dosage screen and
 * the stock list is the server's call, not this client's.
 */
const ALLOWED_ACTIONS: Record<PushType, readonly PushClickAction[]> = {
  DOSAGE_REMINDER: ['OPEN_DOSAGE_SCREEN', 'OPEN_MEDICINE_SCREEN'],
  LOW_STOCK: ['OPEN_DOSAGE_SCREEN', 'OPEN_MEDICINE_SCREEN'],
  UTILITY_DUE_SOON: ['OPEN_UTILITY_BILLS_SCREEN'],
  UTILITY_DUE_TODAY: ['OPEN_UTILITY_BILLS_SCREEN'],
  DOCUMENT_EXPIRING_SOON: ['OPEN_DOCUMENT_ALERTS_SCREEN'],
  DOCUMENT_EXPIRED: ['OPEN_DOCUMENT_ALERTS_SCREEN'],
  STAFF_SALARY_DUE: ['OPEN_STAFF_SCREEN'],
  STAFF_SALARY_OVERDUE: ['OPEN_STAFF_SCREEN'],
};

function readClickAction(
  raw: Record<string, unknown>,
  type: PushType,
): PushClickAction | null {
  const value = readString(raw, 'click_action');
  if (value === null || !(PUSH_CLICK_ACTIONS as string[]).includes(value)) {
    return null;
  }
  const action = value as PushClickAction;
  return ALLOWED_ACTIONS[type]?.includes(action) ? action : null;
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
  // Type first: the action is only meaningful relative to it, and an unknown
  // type has no allowed-action list to check against.
  if (type === null || !(PUSH_TYPES as string[]).includes(type)) {
    return null;
  }
  const clickAction = readClickAction(data, type);
  if (clickAction === null) {
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

    case 'DOCUMENT_EXPIRING_SOON':
    case 'DOCUMENT_EXPIRED': {
      const documentId = readString(data, 'documentId');
      const documentTitle = readString(data, 'documentTitle');
      const documentCategory = readString(data, 'documentCategory');
      const expiryDate = readIsoDate(data, 'expiryDate');
      if (
        documentId === null ||
        documentTitle === null ||
        documentCategory === null ||
        expiryDate === null
      ) {
        return null;
      }
      // Absent by design on DOCUMENT_EXPIRED, so a missing value is not a
      // malformed message — only a present-but-unusable one would be, and
      // `readCount` already turns that into null.
      const daysLeft = readCount(data, 'daysLeft');
      return {
        type,
        documentId,
        documentTitle,
        documentCategory,
        expiryDate,
        ...(daysLeft === null ? {} : { daysLeft }),
        clickAction,
      };
    }

    case 'STAFF_SALARY_DUE':
    case 'STAFF_SALARY_OVERDUE': {
      const staffId = readString(data, 'staffId');
      const staffName = readString(data, 'staffName');
      const month = readMonth(data, 'month');
      const amount = readAmount(data, 'amount');
      const dueDate = readIsoDate(data, 'dueDate');
      return staffId === null ||
        staffName === null ||
        month === null ||
        amount === null ||
        dueDate === null
        ? null
        : { type, staffId, staffName, month, amount, dueDate, clickAction };
    }

    default:
      // A `type` the running app predates. Ignored, not guessed at.
      return null;
  }
}

/**
 * The exact inverse of `parsePushPayload` — a payload back onto the wire shape.
 *
 * Needed because some alerts are now scheduled *by the client* rather than sent
 * by the backend (document expiry today, staff salary reminders — see
 * `docs/AWH_FEATURE_GAP_ANALYSIS.md` §4). A locally-scheduled notification must
 * carry the identical `data` a server push would, so that tapping it runs the
 * same `parsePushPayload` -> `routeFor` path with no second code path to keep in
 * step. Every value is a string, exactly as FCM would deliver it.
 *
 * `parsePushPayload(toPushData(p))` round-trips to `p` for every payload type;
 * that is pinned in `__tests__/notifications.test.ts`.
 */
export function toPushData(payload: PushPayload): Record<string, string> {
  const base: Record<string, string> = {
    type: payload.type,
    click_action: payload.clickAction,
  };
  switch (payload.type) {
    case 'DOSAGE_REMINDER':
      return { ...base, medicineName: payload.medicineName };
    case 'LOW_STOCK':
      return {
        ...base,
        medicineName: payload.medicineName,
        remainingQuantity: String(payload.remainingQuantity),
      };
    case 'UTILITY_DUE_SOON':
    case 'UTILITY_DUE_TODAY':
      return {
        ...base,
        utilityType: payload.utilityType,
        provider: payload.provider,
        dueDate: payload.dueDate,
      };
    case 'DOCUMENT_EXPIRING_SOON':
    case 'DOCUMENT_EXPIRED':
      return {
        ...base,
        documentId: payload.documentId,
        documentTitle: payload.documentTitle,
        documentCategory: payload.documentCategory,
        expiryDate: payload.expiryDate,
        // Omitted rather than sent as "undefined", which `readCount` would
        // reject anyway — but an absent key is what the backend actually sends.
        ...(payload.daysLeft === undefined ? {} : { daysLeft: String(payload.daysLeft) }),
      };
    case 'STAFF_SALARY_DUE':
    case 'STAFF_SALARY_OVERDUE':
      return {
        ...base,
        staffId: payload.staffId,
        staffName: payload.staffName,
        month: payload.month,
        amount: String(payload.amount),
        dueDate: payload.dueDate,
      };
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
    case 'DOCUMENT_EXPIRING_SOON':
      return {
        titleKey: 'notifications.doc_expiring_title',
        // Three separate keys rather than one "%{count} days left" sentence:
        // "expires in 0 days" reads as a countdown when it actually means today,
        // and "in 1 days" is wrong in every locale. Splitting them is also what
        // lets Hindi/Bengali/Tamil/Arabic phrase each case naturally instead of
        // pluralising an English sentence shape.
        bodyKey:
          payload.daysLeft === 0
            ? 'notifications.doc_expiring_body_today'
            : payload.daysLeft === 1
              ? 'notifications.doc_expiring_body_tomorrow'
              : 'notifications.doc_expiring_body',
        values: {
          title: payload.documentTitle,
          count: payload.daysLeft ?? 0,
          date: payload.expiryDate,
        },
      };
    case 'DOCUMENT_EXPIRED':
      return {
        titleKey: 'notifications.doc_expired_title',
        bodyKey: 'notifications.doc_expired_body',
        values: { title: payload.documentTitle, date: payload.expiryDate },
      };
    case 'STAFF_SALARY_DUE':
      return {
        titleKey: 'notifications.staff_salary_due_title',
        bodyKey: 'notifications.staff_salary_due_body',
        values: { name: payload.staffName, amount: payload.amount, date: payload.dueDate },
      };
    case 'STAFF_SALARY_OVERDUE':
      return {
        titleKey: 'notifications.staff_salary_overdue_title',
        bodyKey: 'notifications.staff_salary_overdue_body',
        values: { name: payload.staffName, amount: payload.amount, date: payload.dueDate },
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
  | { screen: 'Resources'; params: { focus: 'bills' } }
  | { screen: 'ExpirationAlerts'; params: undefined }
  | { screen: 'Staff'; params: undefined };

export function routeFor(payload: PushPayload): PushRoute {
  switch (payload.clickAction) {
    case 'OPEN_DOSAGE_SCREEN':
      return { screen: 'Medicine', params: { focus: 'dosage' } };
    case 'OPEN_MEDICINE_SCREEN':
      return { screen: 'Medicine', params: { focus: 'stock' } };
    case 'OPEN_UTILITY_BILLS_SCREEN':
      return { screen: 'Resources', params: { focus: 'bills' } };
    // Lands on the alerts screen rather than the tapped document itself: an
    // expiry alert almost never arrives alone (a passport and its visa lapse
    // together), and the alerts screen is where the renew action lives.
    case 'OPEN_DOCUMENT_ALERTS_SCREEN':
      return { screen: 'ExpirationAlerts', params: undefined };
    case 'OPEN_STAFF_SCREEN':
      return { screen: 'Staff', params: undefined };
  }
}
