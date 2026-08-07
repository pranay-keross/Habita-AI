import { API_BASE_URL } from '../../config';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface ApiFetchOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // No HTTP response at all — offline, DNS failure, server unreachable. Status 0
    // distinguishes this from a real HTTP error status for parseAuthError below.
    throw new ApiError(0, null);
  }

  const text = await res.text();
  const parsed = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, parsed);
  }
  return parsed as T;
}

// Separate from apiFetch because a multipart body must not get a JSON Content-Type or a
// JSON.stringify'd body — fetch derives the multipart boundary itself from the FormData.
export async function postMultipart<T>(
  path: string,
  form: FormData,
  token?: string | null,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: form });
  } catch {
    throw new ApiError(0, null);
  }

  const text = await res.text();
  const parsed = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, parsed);
  }
  return parsed as T;
}

// Every 4xx from the backend's `Saheli-Backend.postman_collection.json` examples is a
// 400 or 401 with a structured `{message: string, ...}` body — status code alone can't
// tell "phone not registered" (login) apart from "phone already registered" (register)
// or a wrong/expired/missing OTP, since they're all 400. Match on `message` instead.
export type AuthErrorKind =
  | 'not_registered'      // login: this phone has never completed registration
  | 'already_registered'  // register: this phone is already a verified user
  | 'invalid_phone'       // register/login/verify-otp: fails the 10-digit-India validator
  | 'invalid_code'        // verify-otp: wrong code, expired, no pending OTP, or too many attempts
  | 'network'
  | 'unknown';

function extractMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'message' in body && typeof (body as { message: unknown }).message === 'string') {
    return (body as { message: string }).message;
  }
  return null;
}

export function parseAuthError(err: unknown): AuthErrorKind {
  if (!(err instanceof ApiError)) {
    return 'unknown';
  }
  if (err.status === 0) {
    return 'network';
  }

  const message = extractMessage(err.body);

  if (err.status === 400) {
    if (message === 'Phone number is not registered') {
      return 'not_registered';
    }
    if (message === 'Phone number is already registered') {
      return 'already_registered';
    }
    if (message === 'Validation failed') {
      return 'invalid_phone';
    }
    // Everything else at 400 on this API is an OTP problem: "No pending OTP for this
    // phone", "OTP has expired, please request a new one", "Incorrect OTP", "Maximum
    // OTP attempts exceeded, please request a new one".
    return 'invalid_code';
  }

  if (err.status === 401) {
    // Only `refresh` returns 401 today ("Invalid or expired refresh token", "Invalid
    // refresh token") — nothing calls refresh() yet, so this branch is currently unused
    // in practice, but kept accurate for when M2-T3 wires it up.
    return 'invalid_code';
  }

  return 'unknown';
}
