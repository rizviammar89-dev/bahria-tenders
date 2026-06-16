-- Fix (found in 6.2/6.3 device testing): client upserts into push_tokens (Story 2.5) and
-- provider_locations (Story 6.1) failed with "permission denied" because PostgREST's
-- ON CONFLICT DO UPDATE sets ALL payload columns — including the primary key — but the
-- column-scoped UPDATE grant omitted the key column (user_id / provider_id).
-- Grant full UPDATE; RLS keeps it safe: the own-row policies' WITH CHECK (user_id = auth.uid()
-- / provider_id = auth.uid()) still prevents writing or re-keying another user's row.
grant update on public.push_tokens to authenticated;
grant update on public.provider_locations to authenticated;
