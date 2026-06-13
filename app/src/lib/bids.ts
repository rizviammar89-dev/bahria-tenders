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
    const { error } = await supabase
      .from('bids')
      .update({ price_pkr: input.pricePkr, note, updated_at: new Date().toISOString() })
      .eq('id', input.existingBidId);
    return { error: error ? error.message : null };
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
