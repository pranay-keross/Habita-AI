import { Alert } from 'react-native';
import { ApiError } from '../auth/api';
import { t } from '../../i18n';

/** A failed store operation, normalised from the backend's error envelope. */
export interface StoreError {
  /** HTTP status; 0 when the server was unreachable (offline / timeout). */
  status: number;
  /** Backend `code` (e.g. INSUFFICIENT_WARDROBE), or NETWORK / NO_SESSION / UNKNOWN. */
  code: string;
  /** Backend `message`, when one was sent. */
  message?: string;
}

export const NETWORK_ERROR: StoreError = { status: 0, code: 'NETWORK' };
export const NO_SESSION_ERROR: StoreError = { status: 401, code: 'NO_SESSION' };

// Backend codes with a localized explanation (docs/WARDROBE_API_SPEC.md §6).
const KNOWN_CODES = new Set([
  'NETWORK',
  'NO_SESSION',
  'INSUFFICIENT_WARDROBE',
  'STYLIST_UNAVAILABLE',
  'ITEM_NOT_FOUND',
  'OCCASION_NOT_FOUND',
  'OUTFIT_NOT_FOUND',
  'COLLECTION_NOT_FOUND',
  'TRIP_NOT_FOUND',
  'TRIP_OUTFIT_NOT_FOUND',
  'CHECKLIST_ITEM_NOT_FOUND',
  'INVALID_DATE',
  'INVALID_PRICE',
  'INVALID_CATEGORY',
  'INVALID_SEASON',
  'INVALID_ICON_KEY',
  'INVALID_EVENT_TYPE',
  'INVALID_MOOD',
  'MISSING_REQUIRED_FIELD',
  'UNSUPPORTED_FILE_TYPE',
  'FILE_TOO_LARGE',
  'MALFORMED_REQUEST_BODY',
  'VISION_UNAVAILABLE',
  'VISION_FAILED',
  'NO_IMAGE_PROVIDED',
]);

export function toStoreError(err: unknown): StoreError {
  if (err instanceof ApiError) {
    if (err.status === 0) return NETWORK_ERROR;
    const body = err.body as { code?: unknown; message?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code : err.status === 401 ? 'NO_SESSION' : 'UNKNOWN';
    const message = typeof body?.message === 'string' ? body.message : undefined;
    return { status: err.status, code, message };
  }
  return { status: -1, code: 'UNKNOWN', message: err instanceof Error ? err.message : undefined };
}

export function isOfflineError(error: StoreError | undefined): boolean {
  return error?.code === 'NETWORK';
}

/** Human-readable, localized description of a store error. */
export function describeStoreError(error: StoreError): string {
  if (KNOWN_CODES.has(error.code)) {
    return t(`style_pantry.err_${error.code}`);
  }
  return error.message || t('style_pantry.err_UNKNOWN');
}

/** Standard error alert for a failed wardrobe action. */
export function showStoreErrorAlert(error: StoreError): void {
  Alert.alert(
    isOfflineError(error) ? t('common.network_unavailable_title') : t('style_pantry.error_title'),
    describeStoreError(error),
  );
}
