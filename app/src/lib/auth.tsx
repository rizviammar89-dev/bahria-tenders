// Story 1.4 + 2.3b: auth session + role state. The root layout uses this to gate between
// the login screen and the (role-aware) app. `loading` stays true until the session AND, when
// signed in, the role are both resolved — so the tab navigator mounts once with the right tabs.
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { deriveAuth } from '@/lib/auth-state';
import type { Role } from '@/lib/role-tabs';
import { supabase } from '@/lib/supabase';

type AuthState = { session: Session | null; role: Role; loading: boolean; refreshRole: () => void };

const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  loading: true,
  refreshRole: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Bumped to force a role re-fetch (e.g. right after self-signup inserts the profile, since the
  // session uid is unchanged so the uid-keyed effect wouldn't otherwise re-run).
  const [roleNonce, setRoleNonce] = useState(0);
  // Tagged with the uid the role was fetched for, so we can tell whether it's resolved for the
  // CURRENT session without a synchronous setState in an effect body.
  const [roleState, setRoleState] = useState<{ uid: string | null; role: Role }>({
    uid: null,
    role: null,
  });

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
        const { data } = await supabase.from('profiles').select('role').eq('id', uid).single();
        if (mounted) setRoleState({ uid, role: (data?.role as Role) ?? null });
      } catch {
        if (mounted) setRoleState({ uid, role: null }); // degraded: signed in, role unknown → only Home shows
      }
    })();
    return () => {
      mounted = false;
    };
    // Depend on the stable uid, not the session object — avoids re-fetching the role on every
    // hourly TOKEN_REFRESHED (new session object, same user). roleNonce forces a re-fetch on demand.
  }, [session?.user?.id, roleNonce]);

  const { role, loading } = deriveAuth({
    sessionUserId: session?.user?.id ?? null,
    sessionLoaded,
    roleState,
  });

  const refreshRole = () => setRoleNonce((n) => n + 1);

  return (
    <AuthContext.Provider value={{ session, role, loading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
