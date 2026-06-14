// Story 2.4: bid submit/edit. provider_id comes from auth.uid(); RLS is the backstop
// (verified provider, not own job, job open for insert; own bid + job open for update).
import { supabase } from '@/lib/supabase';

/**
 * Inserts a new bid, or updates the provider's existing bid (when existingBidId is set).
 * Not an upsert — insert and update have different RLS policies, so the operation is chosen
 * from whether a bid already exists.
 */
export async function submitBid(input: {
  jobId: string;
  pricePkr: number;
  note: string;
  existingBidId: string | null;
}): Promise<{ error: string | null }> {
  const note = input.note.trim() || null;

  if (input.existingBidId) {
    // .select() so we can tell a real update from a 0-row no-op: RLS silently skips the row
    // (no error) if the job is no longer open or the bid is gone — that must NOT read as success.
    const { data, error } = await supabase
      .from('bids')
      .update({ price_pkr: input.pricePkr, note, updated_at: new Date().toISOString() })
      .eq('id', input.existingBidId)
      .select('id');
    if (error) return { error: error.message };
    if (!data || data.length === 0) {
      return { error: 'This job is no longer open — pull down to refresh.' };
    }
    return { error: null };
  }

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { error: 'You are not signed in.' };

  const { error } = await supabase.from('bids').insert({
    job_id: input.jobId,
    provider_id: uid,
    price_pkr: input.pricePkr,
    note,
  });
  return { error: error ? error.message : null };
}
