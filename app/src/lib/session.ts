// Current user id from the cached session — NOT supabase.auth.getUser(), which makes a network call
// and can deadlock on the client's auth lock in React Native (symptom: an action hangs forever).
// getSession() reads the stored session without that network round-trip.
import { supabase } from '@/lib/supabase';

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
