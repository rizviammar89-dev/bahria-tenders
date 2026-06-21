// Story 1.4 + 2.3b: auth session + role state. The root layout uses this to gate between
// the login screen and the (role-aware) app. `loading` stays true until the session AND, when
// signed in, the role are both resolved — so the tab navigator mounts once with the right tabs.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { completeSignInFromUrl } from '@/lib/auth-account';
import { deriveAuth } from '@/lib/auth-state';
import type { Role } from '@/lib/role-tabs';
import { supabase } from '@/lib/supabase';

// Dual-role: an account is always a resident; `isProvider` unlocks provider features. `mode` is the
// active view the user is in (a saved preference, NOT a capability change). `role` exposed below is
// the ACTIVE role (= mode, clamped to 'resident' when the account isn't a provider) so existing
// role-gated screens/tabs keep working unchanged.
type Mode = 'resident' | 'provider';
const MODE_KEY = 'bt.activeMode';

type AuthState = {
  session: Session | null;
  role: Role; // active role (= active mode); null until resolved
  isProvider: boolean; // capability: can this account act as a provider at all?
  loading: boolean;
  hasProfile: boolean | null; // false → signed in via OTP but no profile yet → profile setup
  refreshRole: () => void;
  /** Switch the active view. 'provider' is a no-op unless the account isProvider. */
  switchMode: (mode: Mode) => void;
  /** Turn this account into a provider (open model: instant) and switch to provider view. */
  enableProvider: (serviceIds: string[]) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  isProvider: false,
  loading: true,
  hasProfile: null,
  refreshRole: () => {},
  switchMode: () => {},
  enableProvider: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Bumped to force a role re-fetch (e.g. right after self-signup inserts the profile, since the
  // session uid is unchanged so the uid-keyed effect wouldn't otherwise re-run).
  const [roleNonce, setRoleNonce] = useState(0);
  // Tagged with the uid the role was fetched for, so we can tell whether it's resolved for the
  // CURRENT session without a synchronous setState in an effect body.
  const [roleState, setRoleState] = useState<{
    uid: string | null;
    role: Role;
    isProvider: boolean;
    exists: boolean;
  }>({
    uid: null,
    role: null,
    isProvider: false,
    exists: false,
  });
  // Active-view preference, loaded from storage. null = not loaded yet → fall back to a sensible
  // default (provider view for provider accounts) so there's no resident-tab flash on launch.
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((v) => setMode(v === 'provider' ? 'provider' : v === 'resident' ? 'resident' : null))
      .catch(() => {});
  }, []);

  // OAuth redirect: Android often delivers the Google redirect as an OS deep link (app://auth-callback)
  // rather than through the in-app browser result. Catch it here, exchange it for a session, and the
  // session listener above flips the app into the signed-in state.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) completeSignInFromUrl(url).catch(() => {});
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      completeSignInFromUrl(url).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Session: getSession on mount + subscribe. The auth callback only does sync setState
  // (never an awaited supabase call — that can deadlock the client).
  useEffect(() => {
    let mounted = true;
    let settled = false;
    const markLoaded = (next: Session | null) => {
      if (!mounted) return;
      settled = true;
      setSession(next);
      setSessionLoaded(true);
    };
    supabase.auth
      .getSession()
      .then(({ data }) => markLoaded(data.session))
      .catch(() => markLoaded(null));
    // Safety net: if the backend is unreachable, supabase-js's startup token refresh can hang
    // with no timeout, leaving the app stuck on the splash forever. Fall back to the signed-out
    // state so the user at least reaches the login screen instead of a frozen blank screen.
    const t = setTimeout(() => {
      if (mounted && !settled) markLoaded(null);
    }, 8000);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) {
        setSession(next);
        setSessionLoaded(true);
      }
    });
    return () => {
      mounted = false;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Role follows the session. Only fetches when signed in; setState lives in the async
  // callbacks (no synchronous setState in the effect body).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let mounted = true;
    (async () => {
      try {
        // maybeSingle: no row (new OTP user without a profile yet) → data null, no throw.
        const { data } = await supabase
          .from('profiles')
          .select('role, is_provider')
          .eq('id', uid)
          .maybeSingle();
        if (mounted)
          setRoleState({
            uid,
            role: (data?.role as Role) ?? null,
            isProvider: data?.is_provider === true,
            exists: data != null,
          });
      } catch {
        if (mounted) setRoleState({ uid, role: null, isProvider: false, exists: false }); // degraded: treat as no profile
      }
    })();
    return () => {
      mounted = false;
    };
    // Depend on the stable uid, not the session object — avoids re-fetching the role on every
    // hourly TOKEN_REFRESHED (new session object, same user). roleNonce forces a re-fetch on demand.
  }, [session?.user?.id, roleNonce]);

  const { role: declaredRole, loading, hasProfile } = deriveAuth({
    sessionUserId: session?.user?.id ?? null,
    sessionLoaded,
    roleState,
  });

  // Capability + active role. Only meaningful once resolved for this session with a profile.
  const resolved = !loading && hasProfile === true;
  const isProvider = resolved && roleState.isProvider;
  // Everyone can be a resident; a provider account defaults to provider view (mode ?? 'provider').
  const role: Role = !resolved
    ? declaredRole
    : isProvider && (mode ?? 'provider') === 'provider'
      ? 'provider'
      : 'resident';

  const refreshRole = () => setRoleNonce((n) => n + 1);

  const switchMode = (next: Mode) => {
    if (next === 'provider' && !isProvider) return; // can't enter provider view without the capability
    setMode(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  const enableProvider = async (serviceIds: string[]) => {
    const uid = session?.user?.id;
    if (!uid) return { error: 'You are not signed in.' };
    if (serviceIds.length === 0) return { error: 'Pick at least one trade.' };
    // role stays whatever it was at signup (server-only column); the is_provider flag is the gate,
    // and the DB trigger auto-verifies on enable (open model).
    const { error } = await supabase
      .from('profiles')
      .update({ is_provider: true, service_ids: serviceIds })
      .eq('id', uid);
    if (error) return { error: error.message };
    refreshRole(); // re-fetch isProvider
    setMode('provider');
    AsyncStorage.setItem(MODE_KEY, 'provider').catch(() => {});
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{ session, role, isProvider, loading, hasProfile, refreshRole, switchMode, enableProvider }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
