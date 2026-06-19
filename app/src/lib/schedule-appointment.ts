// Two-way scheduling: propose / accept a concrete appointment on an awarded job. Both go through
// SECURITY DEFINER RPCs that authorize the resident or the awarded provider.
import type { Slot } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';

export async function proposeSchedule(
  jobId: string,
  date: string,
  slot: Slot,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('propose_schedule', {
    p_job_id: jobId,
    p_date: date,
    p_slot: slot,
  });
  return { error: error ? error.message : null };
}

export async function acceptSchedule(jobId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('accept_schedule', { p_job_id: jobId });
  return { error: error ? error.message : null };
}
