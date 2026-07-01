-- Remove the sandbox bring-up diagnostic table. Safepay's signature scheme and payload are now known
-- and enforced in code (confirm-subscription verifies the redirect HMAC-SHA256 signature; the
-- safepay-webhook verifies the HMAC-SHA512 x-sfpy-signature), so we no longer capture raw payloads.
--
-- NOTE: if you still want to widen safepay-webhook's SUCCESS_STATES against a real captured payload,
-- pull a sample BEFORE applying this (SQL editor):
--   select received_at, headers, body from public.webhook_debug order by received_at desc limit 20;
drop table if exists public.webhook_debug;
