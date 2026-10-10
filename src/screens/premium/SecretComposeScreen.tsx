import { useQuery } from '@tanstack/react-query';
import { Check, CloudOff, Crown, Send, VenetianMask } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { queryClient } from '@/features/entities/entityCache';
import { newClientId } from '@/features/secret/format';
import { refreshSecret, secretKeys, useSubscription } from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import { followsApi } from '@/services/api/follows';
import { secretMessagesApi } from '@/services/api/secretMessages';
import { radius, spacing, useAppTheme } from '@/theme';

const MAX = 300;
const MIN = 3;
const PROMPTS = [
  "I've always wanted to tell you…",
  'You made my day when…',
  'Honestly, I admire how you…',
  'Can I be honest? 🙈',
];
const NOTICE = 'Someone is trying to reach you with a Secret Message 💌';

export function SecretComposeScreen({ navigation, route }: ScreenProps<'SecretCompose'>) {
  const { colors } = useAppTheme();
  const { username } = route.params;
  useStatusBar();
  const profileQ = useQuery({
    queryKey: ['profile', username],
    queryFn: ({ signal }) => followsApi.profile(username, signal),
  });
  const sub = useSubscription().data;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const clientId = useRef(newClientId());
  const inputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const user = profileQ.data;
  const firstName = user?.display_name.split(' ')[0] ?? 'They';
  const left = sub?.usage.secret_messages_left ?? null;

  const send = async () => {
    if (!user || sending) return;
    const body = text.trim();
    if (body.length < MIN) {
      setError('Write at least a few words.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const thread = await secretMessagesApi.start({
        recipient_id: user.id,
        body,
        client_message_id: clientId.current,
      });
      queryClient.setQueryData(secretKeys.subscription, (old: typeof sub) =>
        old ? { ...old, usage: thread.usage } : old,
      );
      refreshSecret().catch(() => {});
      setSentId(thread.id);
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      if (!e || e.isNetworkError) {
        showToast('No connection. Try again.', 'error');
        return;
      }
      clientId.current = newClientId();
      switch (e.code) {
        case 'PLAN_REQUIRED':
          navigation.replace('Plans', { reason: 'secret-send' });
          return;
        case 'PLAN_LIMIT_REACHED':
          navigation.replace('Plans', { reason: 'limit' });
          return;
        case 'SECRET_THREAD_EXISTS': {
          const id = (e.details as { thread_id?: string } | undefined)?.thread_id;
          showToast('You already have a secret conversation going with them.', 'info');
          if (id) navigation.replace('SecretThread', { threadId: id });
          return;
        }
        case 'CANNOT_SEND_SECRET':
          setError("You can't send a Secret Message to this person.");
          return;
        case 'LINKS_NOT_ALLOWED':
          setError("Links aren't allowed in Secret Messages.");
          return;
        default:
          setError(e.message);
      }
    } finally {
      setSending(false);
    }
  };

  if (sentId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.done}>
          <View style={[styles.check, { backgroundColor: colors.successSoft }]}>
            <Check size={44} color={colors.success} strokeWidth={3} />
          </View>
          <Text style={[styles.doneTitle, { color: colors.text }]} accessibilityRole="header">
            Sealed & sent
          </Text>
          <Text style={[styles.doneText, { color: colors.textSecondary }]}>
            {firstName} will see "Someone is trying to reach you…". Your name and message stay
            sealed until they reply twice.
          </Text>
          <Button
            title="View conversation"
            onPress={() => navigation.replace('SecretThread', { threadId: sentId })}
            style={styles.stretch}
          />
          <Button
            title="Done"
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={styles.stretch}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="New secret message" back />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {profileQ.isError ? (
          <EmptyState
            icon={<CloudOff size={34} color={colors.primary} />}
            title="Couldn't load this person"
            text="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => profileQ.refetch()}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.to, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {user ? (
                <Avatar uri={user.avatar_url} name={user.display_name} size={46} />
              ) : (
                <SkeletonLoader variant="circle" size={46} />
              )}
              <View style={styles.flex}>
                <Text style={[styles.small, { color: colors.textSecondary }]}>To</Text>
                <Text style={[styles.toName, { color: colors.text }]} numberOfLines={1}>
                  {user?.display_name ?? ' '}
                </Text>
                <Text style={[styles.small, { color: colors.textSecondary }]} numberOfLines={1}>
                  @{username}
                </Text>
              </View>
              <View
                style={[styles.mask, { backgroundColor: colors.primarySoft }]}
                accessible
                accessibilityLabel="You're anonymous"
              >
                <VenetianMask size={18} color={colors.primary} />
              </View>
            </View>

            <View
              style={[
                styles.letter,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.danger : colors.border,
                },
              ]}
            >
              <View style={styles.letterTop}>
                <View style={styles.inline}>
                  <VenetianMask size={15} color={colors.textSecondary} />
                  <Text style={[styles.small, { color: colors.textSecondary }]}>
                    From: <Text style={[styles.bold, { color: colors.text }]}>Someone</Text>
                  </Text>
                </View>
                <Text style={[styles.small, { color: colors.textSecondary }]}>
                  {text.length}/{MAX}
                </Text>
              </View>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={v => {
                  setText(v);
                  if (error) setError(null);
                }}
                maxLength={MAX}
                multiline
                placeholder="Write something kind, honest or brave…"
                placeholderTextColor={colors.textSecondary}
                selectionColor={colors.primary}
                style={[styles.input, { color: colors.text }]}
                accessibilityLabel="Your secret message"
                textAlignVertical="top"
              />
            </View>
            {error ? (
              <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <View style={styles.prompts} accessibilityLabel="Need a start?">
              {PROMPTS.map(p => (
                <Pressable
                  key={p}
                  onPress={() => {
                    setText(`${p} `);
                    setError(null);
                    inputRef.current?.focus();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.prompt,
                    { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.promptText, { color: colors.text }]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.how}>
              {[
                `${firstName} gets "${NOTICE}".`,
                'Your name and message stay sealed while they reply.',
                'After their 2nd reply, both are revealed and you chat normally.',
              ].map((line, i) => (
                <View key={line} style={styles.howRow}>
                  <View style={[styles.howNum, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.howNumText, { color: colors.primary }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.howText, { color: colors.textSecondary }]}>{line}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.inline, styles.center]}>
              {left === null ? <Crown size={14} color={colors.primary} /> : null}
              <Text style={[styles.small, { color: colors.textSecondary }]}>
                {left === null
                  ? 'Unlimited with Premium'
                  : `Uses 1 of your ${left} remaining Secret Messages this month.`}
              </Text>
            </View>

            <Pressable
              onPress={send}
              disabled={sending || !user}
              accessibilityRole="button"
              accessibilityState={{ busy: sending, disabled: sending || !user }}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: colors.button, opacity: pressed || sending || !user ? 0.75 : 1 },
              ]}
            >
              <Send size={18} color={colors.onButton} />
              <Text style={[styles.sendText, { color: colors.onButton }]}>
                {sending ? 'Sealing…' : 'Send secretly'}
              </Text>
            </Pressable>
            <Text style={[styles.fine, { color: colors.textSecondary }]}>
              Be kind. Recipients can report and block anonymously, and abuse gets accounts
              removed.
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: '800' },
  content: { padding: spacing.md, gap: 14, paddingBottom: spacing.xl },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { justifyContent: 'center' },
  small: { fontSize: 12.5 },
  to: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  toName: { fontSize: 15.5, fontWeight: '800' },
  mask: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  letter: { borderWidth: 1.5, borderRadius: radius.lg, padding: 14 },
  letterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { minHeight: 140, fontSize: 16, lineHeight: 22, marginTop: 8, padding: 0 },
  error: { fontSize: 13, fontWeight: '600', marginTop: -6 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prompt: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  promptText: { fontSize: 13, fontWeight: '600' },
  how: { gap: 10 },
  howRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  howNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  howNumText: { fontSize: 12, fontWeight: '800' },
  howText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  sendBtn: {
    height: 52,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendText: { fontSize: 16, fontWeight: '800' },
  fine: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 12 },
  check: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  doneText: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginBottom: 8 },
  stretch: { alignSelf: 'stretch' },
});
