import { apiFetch, parseAuthError } from './api';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // ms, e.g. 3600000 — the access token's lifetime from issuance
  userId: string;
}

// The backend expects a bare 10-digit Indian mobile number, no country code and no
// formatting — `register`/`login`/`verify-otp` all reject anything else with a 400
// ("must be a valid 10-digit Indian mobile number"). Screens pass around the
// user-facing, country-code-prefixed display string (e.g. "+91 98765 43210"); this is
// the one place that strips it down before it hits the network.
function toBackendPhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

// `register`/`login` only ever trigger an OTP send — neither returns a token, and
// nothing in the response (including the backend's dev-mode `devOtp` echo) is used for
// anything. Verification always goes through `verifyOtp`, never inferred from this.
export async function register(phone: string): Promise<void> {
  await apiFetch<unknown>('/auth/register', {
    method: 'POST',
    body: { phone: toBackendPhone(phone) },
  });
}

export async function login(phone: string): Promise<void> {
  await apiFetch<unknown>('/auth/login', {
    method: 'POST',
    body: { phone: toBackendPhone(phone) },
  });
}

export async function verifyOtp(phone: string, code: string): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/verify-otp', {
    method: 'POST',
    body: { phone: toBackendPhone(phone), code },
  });
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/refresh', { method: 'POST', body: { refreshToken } });
}

// Blacklists the access token (from the Bearer header) and, if provided, the refresh
// token too (server-side, via TokenBlacklistService) — both become unusable immediately
// even though neither has naturally expired. `/auth/logout` sits under the public
// `/api/auth/**` path (no `authenticated()` check), but the controller still reads
// whatever `Authorization` header is sent, so the access token must be passed explicitly
// here rather than relying on route-level auth.
export async function logout(accessToken: string, refreshToken?: string): Promise<void> {
  await apiFetch<unknown>('/auth/logout', {
    method: 'POST',
    body: refreshToken ? { refreshToken } : {},
    token: accessToken,
  });
}

// The Phone screen only ever collects a number, never a name, so there's no branch that
// has a name ready to send `register`. Try `login` first (existing user); if the backend
// says this number isn't registered, fall back to `register` so a first-time user still
// gets an OTP sent. `isNewUser` tells the caller which path was taken, so the screen
// after OTP verification can route a returning user straight to the Dashboard instead of
// back through Profile setup they've already completed.
export async function loginOrRegister(phone: string): Promise<{ isNewUser: boolean }> {
  try {
    await login(phone);
    return { isNewUser: false };
  } catch (err) {
    if (parseAuthError(err) === 'not_registered') {
      await register(phone);
      return { isNewUser: true };
    }
    throw err;
  }
}

export const authService = {
  register,
  login,
  verifyOtp,
  refresh,
  logout,
  loginOrRegister,
};
