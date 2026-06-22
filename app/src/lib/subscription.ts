// Provider subscription: Rs 2500/month after a 2-month free trial. Access is gated server-side by
// profiles.provider_access_until; a confirmed Safepay payment extends it.
//
// Flow: create-subscription-checkout returns a hosted-checkout URL + tracker → open it in an in-app
// browser → when the user returns, confirm-subscription extends access for that tracker. We confirm
// on the browser result AND from the deep-link listener (Android may deliver the redirect either way).
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

export const SUBSCRIPTION_PKR = 2500;

let pendingTracker: string | null = null;

export async function startSubscriptionCheckout(): Promise<{ error: string | null }> {
  const redirectTo = Linking.createURL('subscription-callback');

  const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
    body: { redirectTo },
  });
  if (error) return { error: error.message };
  const payload = data as { url?: string; tracker?: string; error?: string };
  if (!payload?.url) return { error: payload?.error ?? 'Could not start checkout.' };

  pendingTracker = payload.tracker ?? null;

  const res = await WebBrowser.openAuthSessionAsync(payload.url, redirectTo, { showInRecents: true });
  if (res.type === 'success') {
    await confirmPendingSubscription(res.url);
  }
  // If Android delivered the redirect as a deep link instead, the AuthProvider listener calls
  // confirmPendingSubscription. Either path extends access; the caller refreshes auth afterward.
  return { error: null };
}

/** Confirm the most recent checkout's payment (idempotent; no-op if there's nothing pending). */
export async function confirmPendingSubscription(redirectUrl?: string): Promise<void> {
  if (!pendingTracker) return;
  const tracker = pendingTracker;
  pendingTracker = null;
  await supabase.functions
    .invoke('confirm-subscription', { body: { tracker, redirectUrl: redirectUrl ?? null } })
    .catch(() => {});
}
