import { Alert } from 'react-native';
import { ApiError } from '../features/auth/api';
import { t } from '../i18n';

/**
 * True when a request failed because the network itself was unreachable — offline, DNS
 * failure, server down — as opposed to a real HTTP error from a server that was actually
 * reached. Matches `apiFetch`'s `ApiError(0, null)` convention (`features/auth/api.ts`),
 * the same one `parseAuthError` uses for its 'network' kind.
 */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

/**
 * Shows the app-wide "no internet" alert. Use after a write action that has a local
 * offline fallback, once `isNetworkError` (or a store function's returned `offline`
 * flag) confirms the action didn't actually reach the server.
 */
export function showNetworkUnavailableAlert(): void {
  Alert.alert(t('common.network_unavailable_title'), t('common.network_unavailable_msg'));
}
