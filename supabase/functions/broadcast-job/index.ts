// Story 2.5: broadcast-job Edge Function (service_role).
// Invoked fire-and-forget after a resident posts a job. Calls the broadcast_job() matcher
// (idempotent notification_log + tokens), sends the push via the Channel abstraction, then
// marks the delivered rows sent. PUSH-ONLY for the POC — SmsChannel is a later one-file add.
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Target = { notification_id: string; recipient_id: string; expo_push_token: string };
type Message = { notificationId: string; to: string; title: string; body: string };

// --- Channel abstraction: adding SMS post-POC = one new class + one line in pickChannel(). ---
interface Channel {
  // Returns the notificationIds that were accepted for delivery.
  send(messages: Message[]): Promise<string[]>;
}

class PushChannel implements Channel {
  async send(messages: Message[]): Promise<string[]> {
    if (messages.length === 0) return [];
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        messages.map((m) => ({
          to: m.to,
          title: m.title,
          body: m.body,
          channelId: 'default',
          priority: 'high',
        })),
      ),
    });
    if (!res.ok) return [];
    // Expo returns { data: [{status}, ...] } in request order; mark the ok ones sent.
    const json = await res.json().catch(() => null);
    const statuses: { status?: string }[] = json?.data ?? [];
    return messages
      .filter((_, i) => statuses[i]?.status === 'ok' || statuses.length === 0)
      .map((m) => m.notificationId);
  }
}

Deno.serve(async (req) => {
  try {
    const { jobId } = await req.json();
    if (!jobId) return Response.json({ error: 'jobId required' }, { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Match + log (idempotent) + get tokens for unsent rows.
    const { data: targets, error: rpcErr } = await supabase.rpc('broadcast_job', {
      p_job_id: jobId,
    });
    if (rpcErr) return Response.json({ error: rpcErr.message }, { status: 500 });
    const rows = (targets ?? []) as Target[];

    // Message content: trade + precinct so a provider can decide without opening the app.
    const { data: job } = await supabase
      .from('jobs')
      .select('precinct, service:services(display_en)')
      .eq('id', jobId)
      .single();
    const trade = (job?.service as { display_en?: string } | null)?.display_en ?? 'home';
    const precinct = job?.precinct ?? 'your area';
    const title = `New ${trade} job`;
    const body = `${precinct} · tap to bid`;

    const messages: Message[] = rows.map((r) => ({
      notificationId: r.notification_id,
      to: r.expo_push_token,
      title,
      body,
    }));

    const channel: Channel = new PushChannel();
    const sentIds = await channel.send(messages);

    if (sentIds.length > 0) {
      await supabase
        .from('notification_log')
        .update({ sent_at: new Date().toISOString() })
        .in('id', sentIds);
    }

    return Response.json({ matched: rows.length, sent: sentIds.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
