import { apiFetch } from '../auth/api';
import type { DeviceTokenRequest } from './types';

/**
 * Habita AI — device registration for push notifications.
 *
 * `POST /api/devices/register` associates an FCM token with the signed-in user so
 * the backend knows where to send dosage, low-stock and utility-bill alerts.
 *
 * Two things the Postman collection gets wrong, both confirmed against the live
 * server on 2026-09-01:
 *
 * - The body is `{fcmToken, platform}` (the OpenAPI `DeviceTokenRequestDto`), not
 *   `{phone, code}`. Sending Postman's body returns 500.
 * - The route is authenticated. Without a bearer token it returns 403, not 401.
 *
 * It answers 200 with an empty body, so there is nothing to parse or return.
 */
export async function registerDevice(
  fcmToken: string,
  platform: string,
  token: string,
): Promise<void> {
  const body: DeviceTokenRequest = { fcmToken, platform };
  await apiFetch<void>('/devices/register', { method: 'POST', body, token });
}
