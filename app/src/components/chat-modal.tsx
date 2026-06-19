// In-app chat for a (job, provider) thread: text + press-and-hold voice messages, live via Realtime.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  chatAudioUrl,
  fetchMessages,
  sendTextMessage,
  sendVoiceMessage,
  subscribeMessages,
  type ChatMessage,
} from '@/lib/chat';

export type ChatThread = {
  jobId: string;
  providerId: string; // thread key (the provider party)
  otherPartyId: string; // the recipient (the other person)
  title: string;
};

export function ChatModal({ thread, onClose }: { thread: ChatThread | null; onClose: () => void }) {
  const uid = useAuth().session?.user?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (!thread) return;
    let active = true;
    // setState in the async callback (not synchronously in the effect body) per the hooks lint.
    fetchMessages(thread.jobId, thread.providerId).then(({ messages: m }) => {
      if (active) setMessages(m);
    });
    const channel = subscribeMessages(thread.jobId, thread.providerId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, [thread]);

  async function onSendText() {
    if (!thread || !text.trim() || busy) return;
    setBusy(true);
    const body = text.trim();
    setText('');
    const { error: e } = await sendTextMessage(thread.jobId, thread.providerId, thread.otherPartyId, body);
    if (e) setError(e);
    setBusy(false);
  }

  async function onStartRecording() {
    if (!thread || recording) return;
    setError(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('Microphone permission is needed for voice messages.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }

  async function onStopRecording() {
    if (!thread || !recording) return;
    setRecording(false);
    setBusy(true);
    await recorder.stop();
    const uri = recorder.uri;
    if (uri) {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { error: e } = await sendVoiceMessage(thread.jobId, thread.providerId, thread.otherPartyId, base64);
      if (e) setError(e);
    }
    setBusy(false);
  }

  function playVoice(path: string) {
    const player = createAudioPlayer(chatAudioUrl(path));
    player.play();
    setTimeout(() => player.remove(), 120000); // release after playback window
  }

  return (
    <Modal visible={thread !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{thread?.title ?? 'Chat'}</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold" style={styles.close}>
                Close
              </ThemedText>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                No messages yet — say hello.
              </ThemedText>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === uid;
              return (
                <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                  <ThemedView
                    type="backgroundElement"
                    style={[styles.bubble, mine && styles.bubbleMine]}>
                    {item.audio_path ? (
                      <Pressable onPress={() => playVoice(item.audio_path!)} style={styles.voiceRow}>
                        <MaterialCommunityIcons
                          name="play-circle"
                          size={28}
                          color={mine ? '#ffffff' : Brand.primary}
                        />
                        <ThemedText type="small" style={mine ? styles.textMine : undefined}>
                          Voice message
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <ThemedText type="default" style={mine ? styles.textMine : undefined}>
                        {item.body}
                      </ThemedText>
                    )}
                  </ThemedView>
                </View>
              );
            }}
          />

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}
          {recording && (
            <ThemedText type="small" style={styles.recordingNote}>
              ● Recording — release to send
            </ThemedText>
          )}

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              style={styles.input}
              multiline
            />
            {text.trim() ? (
              <Pressable onPress={onSendText} disabled={busy} style={styles.iconBtn}>
                <MaterialCommunityIcons name="send" size={22} color="#ffffff" />
              </Pressable>
            ) : (
              <Pressable
                onPressIn={onStartRecording}
                onPressOut={onStopRecording}
                style={[styles.iconBtn, recording && styles.iconBtnRecording]}>
                <MaterialCommunityIcons
                  name={recording ? 'stop' : 'microphone'}
                  size={22}
                  color="#ffffff"
                />
              </Pressable>
            )}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    height: '82%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { color: Brand.primary },
  list: { paddingVertical: Spacing.two, gap: Spacing.two, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', padding: Spacing.three, borderRadius: Spacing.three },
  bubbleMine: { backgroundColor: Brand.primary },
  textMine: { color: '#ffffff' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  error: { color: '#c0392b' },
  recordingNote: { color: '#c0392b', textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 48,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnRecording: { backgroundColor: '#c0392b' },
});
