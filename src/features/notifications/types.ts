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
  | 'UTILITY_DUE_TODAY'
  | 'DOCUMENT_EXPIRING_SOON'
  | 'DOCUMENT_EXPIRED'
  | 'STAFF_SALARY_DUE'
  | 'STAFF_SALARY_OVERDUE';

export const PUSH_TYPES: PushType[] = [
  'DOSAGE_REMINDER',
  'LOW_STOCK',
  'UTILITY_DUE_SOON',
  'UTILITY_DUE_TODAY',
  'DOCUMENT_EXPIRING_SOON',
  'DOCUMENT_EXPIRED',
  'STAFF_SALARY_DUE',
  'STAFF_SALARY_OVERDUE',
];

/**
 * `click_action` on the wire — where a tap should land. Kept separate from
 * `PushType` because the backend maps two different medicine alerts onto two
 * different screens, and it is the server's call which one, not ours.
 */
export type PushClickAction =
  | 'OPEN_DOSAGE_SCREEN'
  | 'OPEN_MEDICINE_SCREEN'
  | 'OPEN_UTILITY_BILLS_SCREEN'
  | 'OPEN_DOCUMENT_ALERTS_SCREEN'
  | 'OPEN_STAFF_SCREEN';

export const PUSH_CLICK_ACTIONS: PushClickAction[] = [
  'OPEN_DOSAGE_SCREEN',
  'OPEN_MEDICINE_SCREEN',
  'OPEN_UTILITY_BILLS_SCREEN',
  'OPEN_DOCUMENT_ALERTS_SCREEN',
  'OPEN_STAFF_SCREEN',
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

/**
 * `{"type":"DOCUMENT_EXPIRING_SOON","documentId":"...","documentTitle":"Indian Passport",
 *   "documentCategory":"passport","expiryDate":"2026-10-14","daysLeft":"36",...}`
 *
 * The vault's answer to A Wise Home's "auto creates reminders for due dates/expiry dates"
 * — see `docs/AWH_FEATURE_GAP_ANALYSIS.md` §1.1 gap 1.5 and §3.1.2 for the wire contract.
 *
 * `expiryDate` stays a raw `YYYY-MM-DD` string for the same reason `UtilityBillPush.dueDate`
 * does: a passport expires on a calendar day in the holder's own timezone, and `new Date()`
 * on a bare date parses as UTC midnight, rendering as the previous day west of Greenwich.
 *
 * `daysLeft` is absent on `DOCUMENT_EXPIRED` (the document already lapsed, so a countdown
 * would be meaningless) and negative-safe when present: the parser rejects anything that
 * isn't a non-negative integer rather than letting `NaN` reach the copy.
 */
export interface DocumentExpiryPush extends PushBase {
  type: 'DOCUMENT_EXPIRING_SOON' | 'DOCUMENT_EXPIRED';
  documentId: string;
  documentTitle: string;
  documentCategory: string;
  expiryDate: string;
  /** Only meaningful for `DOCUMENT_EXPIRING_SOON`. */
  daysLeft?: number;
}

/**
 * `{"type":"STAFF_SALARY_DUE","staffId":"...","staffName":"Kamala Devi",
 *   "month":"2026-09","amount":"12300","dueDate":"2026-09-30",...}`
 *
 * Closes the "automated reminders ... for staff and vendor payments" gap (§1.3 gap 3.4).
 * `amount` is the *outstanding* net payable computed by `features/staff/payroll.ts`, not
 * the base salary — a partly-paid month must not remind for the full figure.
 */
export interface StaffSalaryPush extends PushBase {
  type: 'STAFF_SALARY_DUE' | 'STAFF_SALARY_OVERDUE';
  staffId: string;
  staffName: string;
  /** `YYYY-MM` — the payroll month, not a date. */
  month: string;
  amount: number;
  dueDate: string;
}

export type PushPayload =
  | DosageReminderPush
  | LowStockPush
  | UtilityBillPush
  | DocumentExpiryPush
  | StaffSalaryPush;

/** The sections these alerts belong to, for grouping and filtering. */
export type PushSection = 'medchest' | 'utilities' | 'documents' | 'staff';

export function sectionOf(payload: PushPayload): PushSection {
  switch (payload.type) {
    case 'DOSAGE_REMINDER':
    case 'LOW_STOCK':
      return 'medchest';
    case 'UTILITY_DUE_SOON':
    case 'UTILITY_DUE_TODAY':
      return 'utilities';
    case 'DOCUMENT_EXPIRING_SOON':
    case 'DOCUMENT_EXPIRED':
      return 'documents';
    case 'STAFF_SALARY_DUE':
    case 'STAFF_SALARY_OVERDUE':
      return 'staff';
  }
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
