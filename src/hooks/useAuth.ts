import { useState, useEffect, useCallback } from 'react';
import { getItem, setItem, removeItem } from '../utils/storage';
import { authService, type TokenPair } from '../features/auth/auth';
import { MEDICINE_STORAGE_KEY, INTAKE_LOG_STORAGE_KEY } from '../features/medicine/medicineStore';
import { MOOD_STORAGE_KEY } from '../features/wellness/wellnessStore';
import { CYCLE_STORAGE_KEY, CYCLE_SETTINGS_STORAGE_KEY } from '../features/cycle/cycleStore';
import { CAREGIVER_STORAGE_KEY, CAREGIVER_TRANSACTION_STORAGE_KEY } from '../features/staff/staffStore';
import { QUICK_TAP_STORAGE_KEY, RESOURCE_LOG_STORAGE_KEY } from '../features/resources/resourceStore';

const SESSION_KEY = 'habita.session';

// Same key `onboarding/profile.tsx` writes to (`PROFILE_STORAGE_KEY` there) — duplicated
// rather than imported, same pattern already used for this key in
// `src/features/family/api.ts` (docs/DECISIONS.md D-019).
const PROFILE_STORAGE_KEY = 'habita.user_profile';

// Keys that belong to *this account*, not this device — cleared whenever a different
// phone number signs in on the same device, or on an explicit sign-out. Deliberately
// excludes `habita.user_phone`: onboarding/phone.tsx always overwrites it with the
// number just entered, before this ever runs, so clearing it here would erase the value
// the very next screen needs. `habita.lang`/`habita.theme.palette` are device
// preferences, not account data, and are never touched by this.
//
// Mood and cycle data (added M4-T6/M4-T8) matter here more than anything else on the
// list: leaving them behind would show a second person signing in on the same device
// the first account's mood notes and period history.
// const ACCOUNT_SCOPED_KEYS = [
//   PROFILE_STORAGE_KEY,
//   MEDICINE_STORAGE_KEY,
//   INTAKE_LOG_STORAGE_KEY,
//   MOOD_STORAGE_KEY,
//   CYCLE_STORAGE_KEY,
//   CYCLE_SETTINGS_STORAGE_KEY,
// ];
const ACCOUNT_SCOPED_KEYS = [PROFILE_STORAGE_KEY,  MOOD_STORAGE_KEY,
  CYCLE_STORAGE_KEY,
  CYCLE_SETTINGS_STORAGE_KEY, MEDICINE_STORAGE_KEY, INTAKE_LOG_STORAGE_KEY, CAREGIVER_STORAGE_KEY, CAREGIVER_TRANSACTION_STORAGE_KEY, RESOURCE_LOG_STORAGE_KEY, QUICK_TAP_STORAGE_KEY];

async function clearAccountData(): Promise<void> {
  await Promise.all(ACCOUNT_SCOPED_KEYS.map((key) => removeItem(key)));
}

// Normalizes to the same trailing-10-digit shape `auth.ts`'s private `toBackendPhone`
// uses, so a display-formatted cached value ("+91 98765 43210") still compares equal to
// a differently-formatted one for the same real number.
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

// Refresh a little before the access token's actual claimed expiry, so a request that's
// already in flight doesn't race a token expiring mid-request.
const REFRESH_SKEW_MS = 30_000;

interface Session extends TokenPair {
  issuedAt: number;
  phone: string;
}

function isExpired(session: Session): boolean {
  return Date.now() >= session.issuedAt + session.expiresIn - REFRESH_SKEW_MS;
}

// Module-level, not component-level: `useAuth()` is a plain hook, so every caller has
// its own `session` state (see the note below) — without this, two screens calling
// getAccessToken() around the same moment on an expired token would each fire their own
// POST /auth/refresh, and the second would plausibly fail on an already-rotated refresh
// token. Coalescing every concurrent caller onto one in-flight refresh avoids that race.
let refreshInFlight: Promise<Session | null> | null = null;

async function refreshSession(current: Session): Promise<Session | null> {
  try {
    const tokens = await authService.refresh(current.refreshToken);
    const next: Session = { ...tokens, issuedAt: Date.now(), phone: current.phone };
    await setItem(SESSION_KEY, next);
    return next;
  } catch {
    // The refresh token itself is invalid or expired (e.g. genuinely idle for its full
    // ~30-day life) — nothing left to silently recover. Clear the stale session so the
    // caller's null result reads as "signed out," not "signed in with a token that will
    // keep failing." A dedicated re-auth banner (`docs/BACKLOG.md` M2-T5) still doesn't
    // exist — this is the fallback until it does.
    await removeItem(SESSION_KEY);
    return null;
  }
}

// Returns a session good for at least REFRESH_SKEW_MS, transparently refreshing it first
// via POST /auth/refresh if the access token has expired or is about to. This is what
// `docs/BACKLOG.md` M2-T3 called "silent refresh via the now-existing refresh() call on
// an expired token" — `refresh()` has existed in `auth.ts` since M2-T1, but nothing
// called it until this. Confirmed live (2026-08-11): a genuinely expired token was
// getting a bare `403` with no body from the backend on `PUT /profile/details`, silently
// surfacing to the user as "Couldn't save your profile" with no indication why.
async function getValidSession(current: Session | null): Promise<Session | null> {
  if (!current || !isExpired(current)) {
    return current;
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(current).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// A plain hook, not a Context — each caller gets its own local copy of `session`/
// `pending`. That's fine here: nothing needs `signedIn` to update reactively mid-session
// across components, since navigation only ever moves forward through explicit
// `navigate()` calls (Phone -> Otp -> Profile -> Dashboard). `_layout.tsx` only reads it
// once, at boot, to pick the initial route. The module-level refresh dedup above is what
// keeps this safe despite every screen holding its own copy of `session`.
export default function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Resolve through getValidSession, not a bare storage read: a session that's been
    // sitting long enough for even its refresh token to die was still reading as
    // `signedIn: true` here before (docs/DECISIONS.md D-029) — the boot guard only ever
    // checked "does a session object exist," never whether it (or a refresh of it) still
    // actually works. That left the app parked on Dashboard with a token that would fail
    // every request, showing screens like Profile as silently empty instead of routing
    // back to sign-in.
    getItem<Session | null>(SESSION_KEY, null).then(async (stored) => {
      const valid = await getValidSession(stored);
      if (!cancelled) {
        setSession(valid);
        setPending(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phone: string) => {
    // Returns { isNewUser } so the Otp screen knows whether to route a successful
    // verification to Profile setup (new user) or straight to Dashboard (returning
    // user who already has one).
    return authService.loginOrRegister(phone);
  }, []);

  const verify = useCallback(async (phone: string, code: string) => {
    const tokens = await authService.verifyOtp(phone, code);

    // Confirmed live (2026-08-11, docs/DECISIONS.md D-028): this device's cached
    // profile survives a plain sign-out (M2-T6 only ever cleared the session token), so
    // a second phone number signing in on the same device kept seeing the first
    // account's cached name/photo/medicines — several of which (avatar, photo, role)
    // have no backend source at all and would never self-correct via a live fetch. Check
    // the cached profile's own phone, not the session's, since it's the thing that
    // actually survives an incomplete sign-out and is the real leak vector.
    const cachedProfile = await getItem<{ phone?: string } | null>(PROFILE_STORAGE_KEY, null);
    if (cachedProfile?.phone && normalizePhone(cachedProfile.phone) !== normalizePhone(phone)) {
      await clearAccountData();
    }

    const next: Session = { ...tokens, issuedAt: Date.now(), phone };
    await setItem(SESSION_KEY, next);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    const current = session ?? (await getItem<Session | null>(SESSION_KEY, null));
    if (current) {
      // Best-effort: blacklists both tokens server-side (docs/DECISIONS.md) so they
      // can't be replayed before their natural expiry. A failure here (offline, backend
      // unreachable, token already expired) shouldn't block sign-out — the local session
      // is cleared below regardless, the same end state the user asked for either way.
      await authService.logout(current.accessToken, current.refreshToken).catch(() => {});
    }
    await removeItem(SESSION_KEY);
    await clearAccountData();
    setSession(null);
  }, [session]);

  // Read-through-state-then-storage, then silently refresh if what's found has expired
  // (or is about to). Updates this hook instance's own `session` state whenever the
  // resolved session differs from what was read, so `signedIn` stays accurate too if a
  // refresh fails and clears the session.
  const resolveSession = useCallback(async () => {
    const current = session ?? (await getItem<Session | null>(SESSION_KEY, null));
    const valid = await getValidSession(current);
    if (valid !== current) {
      setSession(valid);
    }
    return valid;
  }, [session]);

  const getAccessToken = useCallback(async () => (await resolveSession())?.accessToken ?? null, [resolveSession]);

  // `userId` comes from verify-otp's/refresh's response (docs/ARCHITECTURE.md §6) and is
  // the only reliable way to recognize "this is me" against a Family's `ownerUserId`
  // (src/features/family/api.ts).
  const getUserId = useCallback(async () => (await resolveSession())?.userId ?? null, [resolveSession]);

  // The session's own `phone` — exactly the string the user verified with, in the app's
  // display format. `docs/DECISIONS.md` D-029: this is the reliable source for "my own
  // phone number" in the Profile screen — `ProfileDetailsResponse.phone` exists too, but
  // is a bare 10-digit backend format that would need reformatting, and the local
  // `habita.user_profile` cache only ever has a value once the user has saved at least
  // once, which is exactly why the field was showing empty for a freshly-signed-in
  // account.
  const getPhone = useCallback(async () => (await resolveSession())?.phone ?? null, [resolveSession]);

  return {
    signedIn: !!session,
    pending,
    login,
    verify,
    logout,
    getPhone,
    getAccessToken,
    getUserId,
  };
}
