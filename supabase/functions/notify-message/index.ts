// Edge Function: send a push notification to a chat message's recipient.
// Invoked fire-and-forget by the sender's app right after a message row is inserted. Looks up the
// recipient's Expo push token and sends the push via Expo — so the recipient sees a pop-up even when
// the app is closed/backgrounded (the OS delivers it). No-op if the recipient has no token.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { messageId } = await req.json().catch(() => ({}) as Record<string, unknown>);
    if (!messageId) return json({ error: 'messageId required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Look the message up server-side (don't trust client-supplied content).
    const { data: msg } = await admin
      .from('messages')
      .select('sender_id, recipient_id, body, audio_path, job_id, provider_id')
      .eq('id', messageId)
      .maybeSingle();
    if (!msg) return json({ ok: true, skipped: 'message not found' });

    // Recipient's push token (service role — push_tokens is RLS-protected).
    const { data: tokenRow } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', msg.recipient_id)
      .maybeSingle();
    const to = tokenRow?.expo_push_token as string | undefined;
    if (!to) return json({ ok: true, skipped: 'no push token' });

    // Sender's name for the notification title.
    const { data: sender } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', msg.sender_id)
      .maybeSingle();
    const title = (sender?.full_name as string | undefined)?.trim() || 'New message';
    const body = msg.audio_path
      ? '🎤 Voice message'
      : ((msg.body as string | null) ?? '').slice(0, 140) || 'New message';

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          to,
          title,
          body,
          channelId: 'default',
          priority: 'high',
          // Carried through so the app can deep-link to this thread when the notification is tapped.
          data: { jobId: msg.job_id, providerId: msg.provider_id },
        },
      ]),
    });
    const result = await res.json().catch(() => null);
    return json({ ok: true, sent: res.ok, result });
  } catch (e) {
    console.error('notify-message error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
