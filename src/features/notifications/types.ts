// Push notifications — Medicine Chest dosage/stock alerts and Utility bill alerts.
//
// The four payloads below are what the backend sends today. They arrive as an FCM
// *data* message, which matters more than it looks: FCM data values are always
// strings on the wire, so `remainingQuantity` is `"5"`, never `5`. Nothing here
// types a data field as a number — `parse.ts` does the coercion once, at the edge,
// and every consumer downstream gets real types.
//
// Every user-facing string these produce is an i18n key, never literal text
// (agent.md rule 2) — a notification that can only render in English is the same
// defect as a screen that can only render in English.

/** `type` on the wire. Anything else is ignored rather than guessed at. */
export type PushType =
  | 'DOSAGE_REMINDER'
  | 'LOW_STOCK'
  | 'UTILITY_DUE_SOON'
  | 'UTILITY_DUE_TODAY';

export const PUSH_TYPES: PushType[] = [
  'DOSAGE_REMINDER',
  'LOW_STOCK',
  'UTILITY_DUE_SOON',
  'UTILITY_DUE_TODAY',
];

/**
 * `click_action` on the wire — where a tap should land. Kept separate from
 * `PushType` because the backend maps two different medicine alerts onto two
 * different screens, and it is the server's call which one, not ours.
 */
export type PushClickAction =
  | 'OPEN_DOSAGE_SCREEN'
  | 'OPEN_MEDICINE_SCREEN'
  | 'OPEN_UTILITY_BILLS_SCREEN';

export const PUSH_CLICK_ACTIONS: PushClickAction[] = [
  'OPEN_DOSAGE_SCREEN',
  'OPEN_MEDICINE_SCREEN',
  'OPEN_UTILITY_BILLS_SCREEN',
];

// ---------------------------------------------------------------------------
// Parsed payloads
// ---------------------------------------------------------------------------

interface PushBase {
  clickAction: PushClickAction;
}

/** `{"type":"DOSAGE_REMINDER","medicineName":"Paracetamol",...}` */
export interface DosageReminderPush extends PushBase {
  type: 'DOSAGE_REMINDER';
  medicineName: string;
}

/**
 * `{"type":"LOW_STOCK","medicineName":"Paracetamol","remainingQuantity":"5",...}`
 *
 * `remainingQuantity` is a number here even though it crosses the wire as a
 * string — the screen shows it and the copy pluralises on it, so coercing at the
 * edge beats every call site remembering to.
 */
export interface LowStockPush extends PushBase {
  type: 'LOW_STOCK';
  medicineName: string;
  remainingQuantity: number;
}

/**
 * `{"type":"UTILITY_DUE_SOON"|"UTILITY_DUE_TODAY","utilityType":"Electricity",
 *   "provider":"WBSEDCL","dueDate":"2026-09-05",...}`
 *
 * `dueDate` stays the raw `YYYY-MM-DD` string rather than becoming a `Date`:
 * a bill is due on a calendar day in the user's own timezone, and `new Date()`
 * on a bare date parses as UTC midnight, which renders as the *previous* day
 * anywhere west of Greenwich. `dueDateParts` exists for formatting instead.
 */
export interface UtilityBillPush extends PushBase {
  type: 'UTILITY_DUE_SOON' | 'UTILITY_DUE_TODAY';
  utilityType: string;
  provider: string;
  dueDate: string;
}

export type PushPayload = DosageReminderPush | LowStockPush | UtilityBillPush;

/** The two sections these alerts belong to, for grouping and filtering. */
export type PushSection = 'medchest' | 'utilities';

export function sectionOf(payload: PushPayload): PushSection {
  return payload.type === 'DOSAGE_REMINDER' || payload.type === 'LOW_STOCK'
    ? 'medchest'
    : 'utilities';
}

// ---------------------------------------------------------------------------
// Device registration
// ---------------------------------------------------------------------------

/**
 * `POST /api/devices/register`.
 *
 * The Postman collection documents this as `{phone, code}`, which is a stale copy
 * of the verify-otp body — sending it 500s. The real shape is below, taken from
 * the backend's OpenAPI document (`DeviceTokenRequestDto`) and confirmed against
 * the live server. The route is authenticated: no bearer token gives 403.
 */
export interface DeviceTokenRequest {
  fcmToken: string;
  platform: string;
}
