import { useState, useEffect, useCallback } from 'react';
import { getItem, setItem, removeItem } from '../utils/storage';
import { authService, type TokenPair } from '../features/auth/auth';

const SESSION_KEY = 'saheli.session';

interface Session extends TokenPair {
  issuedAt: number;
  phone: string;
}

// A plain hook, not a Context — each caller gets its own local copy of `session`/
// `pending`. That's fine here: nothing needs `signedIn` to update reactively mid-session
// across components, since navigation only ever moves forward through explicit
// `navigate()` calls (Phone -> Otp -> Profile -> Dashboard). `_layout.tsx` only reads it
// once, at boot, to pick the initial route.
export default function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getItem<Session | null>(SESSION_KEY, null).then((stored) => {
      if (!cancelled) {
        setSession(stored);
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
    const next: Session = { ...tokens, issuedAt: Date.now(), phone };
    await setItem(SESSION_KEY, next);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    await removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const getAccessToken = useCallback(async () => {
    if (session) {
      return session.accessToken;
    }
    const stored = await getItem<Session | null>(SESSION_KEY, null);
    return stored?.accessToken ?? null;
  }, [session]);

  return {
    signedIn: !!session,
    pending,
    login,
    verify,
    logout,
    getAccessToken,
  };
}
