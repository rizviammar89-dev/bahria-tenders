// Story 1.4 + 2.3b: auth session + role state. The root layout uses this to gate between
// the login screen and the (role-aware) app. `loading` stays true until the session AND, when
// signed in, the role are both resolved — so the tab navigator mounts once with the right tabs.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { completeSignInFromUrl } from '@/lib/auth-account';
import { confirmPendingSubscription } from '@/lib/subscription';
import { deriveAuth } from '@/lib/auth-state';
import type { Role } from '@/lib/role-tabs';
import { supabase } from '@/lib/supabase';

// Dual-role: an account is always a resident; `isProvider` unlocks provider features. `mode` is the
// active view the user is in (a saved preference, NOT a capability change). `role` exposed below is
// the ACTIVE role (= mode, clamped to 'resident' when the account isn't a provider) so existing
// role-gated screens/tabs keep working unchanged.
type Mode = 'resident' | 'provider';
const MODE_KEY = 'bt.activeMode';

// Module-scope (keeps the time read out of the component's pure render — react-hooks/purity).
function accessIsCurrent(iso: string | null): boolean {
  return iso != null && new Date(iso).getTime() > Date.now();
}

type AuthState = {
  session: Session | null;
  role: Role; // active role (= active mode); null until resolved
  isProvider: boolean; // capability: is this account a provider at all (regardless of subscription)?
  providerActive: boolean; // capability AND subscription/trial still current → provider features usable
  providerAccessUntil: string | null; // ISO timestamp the provider subscription/trial is valid through
  loading: boolean;
  hasProfile: boolean | null; // false → signed in via OTP but no profile yet → profile setup
  refreshRole: () => void;
  /** Switch the active view. 'provider' is a no-op unless providerActive. */
  switchMode: (mode: Mode) => void;
  /** Turn this account into a provider (open model: instant) and switch to provider view. */
  enableProvider: (serviceIds: string[]) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  isProvider: false,
  providerActive: false,
  providerAccessUntil: null,
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
    providerAccessUntil: string | null;
    exists: boolean;
  }>({
    uid: null,
    role: null,
    isProvider: false,
    providerAccessUntil: null,
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
    // Re-fetch role/access whenever the app returns to the foreground — e.g. coming back from the
    // Safepay checkout browser, so an extended subscription unlocks provider mode without a reload.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRoleNonce((n) => n + 1);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('subscription-callback')) {
        // Returning from Safepay checkout via deep link — confirm the payment, refresh access, and
        // clear the deep-linked route so expo-router doesn't show an unmatched page.
        confirmPendingSubscription(url)
          .catch(() => {})
          .finally(() => setRoleNonce((n) => n + 1));
        try {
          router.replace('/');
        } catch {
          /* router may not be ready */
        }
        return;
      }
      completeSignInFromUrl(url).catch(() => {});
    });
    return () => {
      appStateSub.remove();
      sub.remove();
    };
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
          .select('role, is_provider, provider_access_until')
          .eq('id', uid)
          .maybeSingle();
        if (mounted)
          setRoleState({
            uid,
            role: (data?.role as Role) ?? null,
            isProvider: data?.is_provider === true,
            providerAccessUntil: (data?.provider_access_until as string | null) ?? null,
            exists: data != null,
          });
      } catch {
        if (mounted)
          setRoleState({ uid, role: null, isProvider: false, providerAccessUntil: null, exists: false }); // degraded
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
  const providerAccessUntil = resolved ? roleState.providerAccessUntil : null;
  // providerActive = is a provider AND the trial/subscription window is still open. Expired providers
  // keep the capability (so we can show the renew prompt) but can't act as a provider.
  const providerActive = isProvider && accessIsCurrent(providerAccessUntil);
  // Everyone can be a resident; an active provider defaults to provider view (mode ?? 'provider').
  // An expired provider is forced back to resident view until they renew.
  const role: Role = !resolved
    ? declaredRole
    : providerActive && (mode ?? 'provider') === 'provider'
      ? 'provider'
      : 'resident';

  const refreshRole = () => setRoleNonce((n) => n + 1);

  const switchMode = (next: Mode) => {
    if (next === 'provider' && !providerActive) return; // can't enter provider view without active access
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
      value={{
        session,
        role,
        isProvider,
        providerActive,
        providerAccessUntil,
        loading,
        hasProfile,
        refreshRole,
        switchMode,
        enableProvider,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
