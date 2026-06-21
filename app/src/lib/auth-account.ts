// Account auth (Google-only). Sign-in is Google OAuth via an in-app browser session; there is no
// phone-OTP and no password, so logins never cost an SMS. New users (no profile yet) are routed to
// profile setup, where they TYPE their phone (not verified) — phone is still required because the
// resident gets the awarded trader's number to call them.
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { normalizePkPhone } from '@/lib/phone';
import type { Role } from '@/lib/role-tabs';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession(); // no-op on native; required so web closes the popup cleanly

// On Android the OAuth redirect can return BOTH via openAuthSessionAsync AND as an OS deep link,
// so the same code/token can be handled twice — dedupe so the second (already-spent) attempt no-ops.
const handledKeys = new Set<string>();

/** Establish a session from an OAuth redirect URL (PKCE `code`, or tokens in the fragment).
 *  Safe to call multiple times for the same URL. Returns null if there was nothing to handle. */
export async function completeSignInFromUrl(url: string): Promise<{ error: string | null } | null> {
  const parsed = Linking.parse(url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;

  if (code) {
    if (handledKeys.has(code)) return null;
    handledKeys.add(code);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) safeReplaceHome();
    return { error: error ? error.message : null };
  }

  // Fallback: implicit flow returns tokens in the URL fragment.
  const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    if (handledKeys.has(access_token)) return null;
    handledKeys.add(access_token);
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (!error) safeReplaceHome();
    return { error: error ? error.message : null };
  }
  return null; // not an auth redirect (e.g. some other deep link)
}

// Clear the unmatched "/auth-callback" route the OS deep link navigated to, back to the app root.
function safeReplaceHome() {
  try {
    router.replace('/');
  } catch {
    // router may not be ready in every context — the auth listener still flips the session.
  }
}

/** Open Google in an in-app browser, then establish the Supabase session from the redirect. */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) return { error: error.message };
  if (!data?.url) return { error: 'Could not start Google sign-in.' };

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { showInRecents: true });
  // If the redirect was captured here, finish from it. If Android instead delivered it as a deep
  // link (res is 'dismiss'/'cancel'), the AuthProvider's Linking listener handles it — so don't
  // treat that as an error.
  if (res.type === 'success') {
    const result = await completeSignInFromUrl(res.url);
    if (result?.error) return { error: result.error };
  }
  return { error: null };
}

/** For a freshly signed-in user with no profile: create their profile (phone is TYPED here).
 *  `userId` comes from the caller's live session — we deliberately avoid supabase.auth.getUser()
 *  here because that auth call can deadlock on the client's internal lock in React Native. */
export async function completeProfile(input: {
  userId: string;
  name: string;
  role: Exclude<Role, null>;
  precinct: string;
  serviceIds: string[];
  phone: string;
}): Promise<{ error: string | null }> {
  const name = input.name.trim();
  const precinct = input.precinct.trim();
  if (!input.userId) return { error: 'Your session expired — please sign in again.' };
  if (!name) return { error: 'Please enter your name.' };
  if (!precinct) return { error: 'Please enter your precinct.' };
  const e164 = normalizePkPhone(input.phone);
  if (!e164) return { error: 'Enter a valid Pakistani mobile number (e.g. 03001234567).' };
  if (input.role === 'provider' && input.serviceIds.length === 0) return { error: 'Pick at least one trade.' };

  const uid = input.userId;

  const { error } = await supabase.from('profiles').insert({
    id: uid,
    role: input.role,
    full_name: name,
    phone: e164,
    precinct,
    service_ids: input.role === 'provider' ? input.serviceIds : [],
  });
  if (error) {
    console.warn('completeProfile insert error:', error.message, JSON.stringify(error));
    // A primary-key clash means THIS user already has a profile row (e.g. a prior attempt's insert
    // landed server-side) — treat as already-set-up so the app can proceed.
    if (/profiles_pkey|"id"/i.test(error.message)) return { error: null };
    if (/phone/i.test(error.message)) return { error: 'This phone number already has an account.' };
    if (/duplicate key|unique/i.test(error.message)) return { error: 'This account is already set up.' };
    return { error: error.message };
  }
  return { error: null };
}
