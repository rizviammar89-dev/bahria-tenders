// In-app chat data layer. A thread is keyed by (jobId, providerId); the two parties are the job's
// resident and that provider. Messages are text and/or a voice note (chat-audio bucket). Live via
// Supabase Realtime (RLS-filtered to the participants).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';

import { currentUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export type ChatMessage = {
  id: string;
  job_id: string;
  provider_id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  audio_path: string | null;
  created_at: string;
};

export async function fetchMessages(
  jobId: string,
  providerId: string,
): Promise<{ messages: ChatMessage[]; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, job_id, provider_id, sender_id, recipient_id, body, audio_path, created_at')
    .eq('job_id', jobId)
    .eq('provider_id', providerId)
    .order('created_at', { ascending: true });
  if (error) return { messages: [], error: error.message };
  return { messages: (data ?? []) as ChatMessage[], error: null };
}

export async function sendTextMessage(
  jobId: string,
  providerId: string,
  recipientId: string,
  body: string,
): Promise<{ error: string | null }> {
  const text = body.trim();
  if (!text) return { error: null };
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const { data, error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, provider_id: providerId, sender_id: uid, recipient_id: recipientId, body: text })
    .select('id')
    .single();
  if (error) return { error: error.message };
  notifyRecipient(data.id);
  return { error: null };
}

/** Upload a recorded voice note (base64) to chat-audio and post it as a message. */
export async function sendVoiceMessage(
  jobId: string,
  providerId: string,
  recipientId: string,
  base64: string,
): Promise<{ error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const path = `${uid}/${jobId}/${Date.now()}.m4a`;
  const { error: upErr } = await supabase.storage
    .from('chat-audio')
    .upload(path, decode(base64), { contentType: 'audio/m4a' });
  if (upErr) return { error: upErr.message };
  const { data, error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, provider_id: providerId, sender_id: uid, recipient_id: recipientId, audio_path: path })
    .select('id')
    .single();
  if (error) return { error: error.message };
  notifyRecipient(data.id);
  return { error: null };
}

/** Fire-and-forget: ask the edge function to push a pop-up to the recipient (works app-closed). */
function notifyRecipient(messageId: string): void {
  supabase.functions.invoke('notify-message', { body: { messageId } }).catch(() => {});
}

export function chatAudioUrl(path: string): string {
  return supabase.storage.from('chat-audio').getPublicUrl(path).data.publicUrl;
}

/** Subscribe to new messages in this thread. RLS limits the stream to the participants. */
export function subscribeMessages(
  jobId: string,
  providerId: string,
  onInsert: (m: ChatMessage) => void,
): RealtimeChannel {
  return supabase
    .channel(`chat:${jobId}:${providerId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
      (payload) => {
        const m = payload.new as ChatMessage;
        if (m.provider_id === providerId) onInsert(m);
      },
    )
    .subscribe();
}
