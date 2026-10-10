import {
  Ellipsis,
  Eye,
  Lock,
  Mail,
  MailOpen,
  MessageCircle,
  Send,
  VenetianMask,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSecretSafety } from '@/components/secret/SecretSafety';
import { GhostAvatar, GhostName, NearbyChip, SealTrack } from '@/components/secret/SecretUI';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GradientFill } from '@/components/ui/GradientFill';
import { IconButton } from '@/components/ui/IconButton';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { showToast } from '@/components/ui/Toast';
import { chat } from '@/features/chats/chatController';
import { dayLabel, nearText, newClientId } from '@/features/secret/format';
import {
  refreshSecret,
  useSecretMessages,
  useSecretThread,
} from '@/features/secret/secretQueries';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { ApiError } from '@/services/api/client';
import {
  isReveal,
  type SecretMessage,
  type SecretThread,
  type SecretUser,
  secretMessagesApi,
} from '@/services/api/secretMessages';
import { radius, spacing, useAppTheme } from '@/theme';

const QUICK = ['Who is this? 👀', 'Hi! 👋', 'Tell me more 🙈', 'You made me curious 😄'];
/** Fixed per position, so a placeholder never hints at the real length. */
const SEAL_W: [number, number][] = [
  [168, 112],
  [190, 92],
  [146, 120],
];
const MAX = 500;

type Reveal = { sender: SecretUser | null; messages: SecretMessage[]; conversationId: string | null };

function SealedBubble({ index }: { index: number }) {
  const { colors } = useAppTheme();
  const [a, b] = SEAL_W[index % SEAL_W.length]!;
  return (
    <View
      style={[styles.bubble, styles.in, { backgroundColor: colors.bubbleIncoming }]}
      accessible
      accessibilityLabel="Sealed message. It unseals after your second reply."
    >
      <View style={[styles.sealLine, { width: a, backgroundColor: colors.skeleton }]} />
      <View style={[styles.sealLine, { width: b, backgroundColor: colors.skeleton }]} />
      <View style={styles.sealTag}>
        <Lock size={12} color={colors.textSecondary} />
        <Text style={[styles.sealTagText, { color: colors.textSecondary }]}>Sealed</Text>
      </View>
    </View>
  );
}

function Bubble({ m }: { m: Extract<SecretMessage, { sealed: false }> }) {
  const { colors } = useAppTheme();
  const mine = m.from === 'me';
  return (
    <View
      style={[
        styles.bubble,
        mine ? styles.out : styles.in,
        { backgroundColor: mine ? colors.bubbleOutgoing : colors.bubbleIncoming },
      ]}
    >
      <Text style={[styles.bubbleText, { color: mine ? colors.onButton : colors.text }]}>
        {m.body}
      </Text>
    </View>
  );
}

function RevealOverlay({
  reveal,
  hintText,
  onOpenChat,
  onProfile,
}: {
  reveal: Reveal;
  hintText: string | null;
  onOpenChat: () => void;
  onProfile: () => void;
}) {
  const { colors, gradient } = useAppTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(r => {
        if (!alive) return;
        setReduced(r);
        if (r) progress.setValue(1);
        else {
          Animated.timing(progress, {
            toValue: 1,
            duration: 1100,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }).start();
        }
      })
      .catch(() => progress.setValue(1));
    AccessibilityInfo.announceForAccessibility(
      `Unsealed. It's ${reveal.sender?.display_name ?? 'them'}.`,
    );
    return () => {
      alive = false;
    };
  }, [progress, reveal.sender?.display_name]);

  const u = reveal.sender;
  const theirs = reveal.messages
    .filter((m): m is Extract<SecretMessage, { sealed: false }> => !m.sealed)
    .slice(0, 3);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Modal visible animationType={reduced ? 'none' : 'fade'} onRequestClose={onOpenChat}>
      <View style={styles.revealWrap}>
        <GradientFill colors={gradient} />
        <ScrollView
          contentContainerStyle={[
            styles.reveal,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.onButton }]}>Unsealed ✨</Text>
          <Animated.View style={{ opacity: progress, transform: [{ scale }] }}>
            <View style={[styles.revealRing, { borderColor: colors.onButton }]}>
              <Avatar uri={u?.avatar_url} name={u?.display_name ?? '?'} size={120} />
            </View>
          </Animated.View>
          <Text style={[styles.revealName, { color: colors.onButton }]} accessibilityRole="header">
            It's {u?.display_name ?? 'them'}!
          </Text>
          {u ? (
            <Text style={[styles.revealSub, { color: colors.onButton }]}>@{u.username}</Text>
          ) : null}
          {hintText ? (
            <Text style={[styles.revealSub, { color: colors.onButton }]}>{hintText}</Text>
          ) : null}
          {theirs.length ? (
            <View style={styles.um}>
              <View style={styles.inline}>
                <Mail size={14} color={colors.onButton} />
                <Text style={[styles.umLabel, { color: colors.onButton }]}>What they wrote</Text>
              </View>
              {theirs.map(m => (
                <Animated.View
                  key={m.id}
                  style={[styles.umBubble, { backgroundColor: colors.surface, opacity: progress }]}
                >
                  <Text style={[styles.bubbleText, { color: colors.text }]}>{m.body}</Text>
                </Animated.View>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={onOpenChat}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.revealBtn,
              { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MessageCircle size={18} color={colors.text} />
            <Text style={[styles.revealBtnText, { color: colors.text }]}>Open chat</Text>
          </Pressable>
          {u ? (
            <Pressable
              onPress={onProfile}
              accessibilityRole="button"
              style={({ pressed }) => [styles.revealGhost, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.revealBtnText, { color: colors.onButton }]}>View profile</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function SecretThreadScreen({ navigation, route }: ScreenProps<'SecretThread'>) {
  const { colors } = useAppTheme();
  const { threadId } = route.params;
  useStatusBar();
  const threadQ = useSecretThread(threadId);
  const thread = threadQ.data;
  const readable = !!thread && thread.status === 'sealed';
  const messagesQ = useSecretMessages(threadId, readable);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const clientId = useRef(newClientId());
  const safety = useSecretSafety({ onBlocked: () => navigation.goBack() });

  const err = threadQ.error instanceof ApiError ? threadQ.error : null;
  const locked = err?.code === 'PLAN_REQUIRED';

  const unread = thread?.has_unread;
  useEffect(() => {
    if (!readable || !unread) return;
    secretMessagesApi
      .markRead(threadId)
      .then(() => refreshSecret())
      .catch(() => {});
  }, [readable, unread, threadId]);

  const messages = useMemo(() => messagesQ.data?.data ?? [], [messagesQ.data]);

  const openChat = (conversationId: string | null) => {
    if (!conversationId) return navigation.goBack();
    chat.refreshInbox();
    navigation.replace('ChatThread', { conversationId });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !thread) return;
    setSending(true);
    try {
      const result = await secretMessagesApi.send(threadId, body, clientId.current);
      clientId.current = newClientId();
      setText('');
      if (isReveal(result)) {
        setReveal({
          sender: result.sender,
          messages: result.revealed_messages,
          conversationId: result.thread.conversation_id,
        });
        refreshSecret().catch(() => {});
        return;
      }
      await Promise.all([threadQ.refetch(), messagesQ.refetch()]);
      refreshSecret().catch(() => {});
    } catch (e) {
      const apiErr = e instanceof ApiError ? e : null;
      if (!apiErr || apiErr.isNetworkError) {
        showToast('No connection. Try again.', 'error');
        return;
      }
      clientId.current = newClientId();
      if (apiErr.code === 'SECRET_THREAD_REVEALED') {
        const id = (apiErr.details as { conversation_id?: string } | undefined)?.conversation_id;
        return openChat(id ?? null);
      }
      if (apiErr.code === 'PLAN_REQUIRED') {
        return navigation.navigate('Plans', { reason: 'secret-read' });
      }
      showToast(apiErr.message, 'error');
      threadQ.refetch();
    } finally {
      setSending(false);
    }
  };

  const scrollEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

  if (reveal) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <RevealOverlay
          reveal={reveal}
          hintText={nearText(thread?.nearby_hint)}
          onOpenChat={() => {
            setReveal(null);
            openChat(reveal.conversationId);
          }}
          onProfile={() => {
            const username = reveal.sender?.username;
            setReveal(null);
            if (username) navigation.replace('UserProfile', { username });
          }}
        />
      </View>
    );
  }

  /* ---------- Locked (Free receiver) ---------- */
  if (locked) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <AppBar
          back
          left={
            <View style={styles.who}>
              <GhostAvatar size={40} />
              <View style={styles.flex}>
                <GhostName width={96} />
                <View style={styles.inline}>
                  <Lock size={11} color={colors.textSecondary} />
                  <Text style={[styles.whoSub, { color: colors.textSecondary }]}>
                    Name sealed until the reveal
                  </Text>
                </View>
              </View>
            </View>
          }
          actions={
            <IconButton onPress={() => safety.open(threadId)} accessibilityLabel="Options">
              <Ellipsis size={22} color={colors.text} />
            </IconButton>
          }
        />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.sealbox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.wax, { backgroundColor: colors.primarySoft }]}>
              <Lock size={26} color={colors.primary} />
            </View>
            <Text style={[styles.sealTitle, { color: colors.text }]}>
              Someone has something to tell you
            </Text>
            <Text style={[styles.sealText, { color: colors.textSecondary }]}>
              Upgrade to reply. After your 2nd reply, their name, photo and message unseal
              together.
            </Text>
            <Button
              title="Unlock Secret Messages"
              onPress={() => navigation.navigate('Plans', { reason: 'secret-read' })}
              style={styles.stretch}
            />
          </View>
          <SealedBubble index={0} />
        </ScrollView>
        {safety.element}
      </SafeAreaView>
    );
  }

  if (threadQ.isPending) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <AppBar title="Secret Message" back />
        <View style={styles.content}>
          <SkeletonLoader variant="rect" height={170} radius={radius.lg} />
          <SkeletonLoader variant="rect" width="60%" height={56} radius={18} />
        </View>
      </SafeAreaView>
    );
  }

  if (!thread) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <AppBar title="Secret Message" back />
        {err?.status === 404 ? (
          <EmptyState
            icon={<Mail size={34} color={colors.primary} />}
            title="Message unavailable"
            text="This secret message is no longer available."
          />
        ) : (
          <EmptyState
            icon={<Mail size={34} color={colors.primary} />}
            title="Couldn't load this message"
            text="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => threadQ.refetch()}
          />
        )}
      </SafeAreaView>
    );
  }

  if (thread.status === 'revealed') {
    const sentSide = thread.role === 'sent';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <AppBar title={sentSide ? 'Revealed' : 'Unsealed'} back />
        <EmptyState
          icon={<MailOpen size={34} color={colors.primary} />}
          title={sentSide ? "You've been revealed" : 'This secret was unsealed'}
          text={
            sentSide
              ? 'They replied twice, so your conversation is now a regular chat.'
              : 'Your conversation continues as a regular chat.'
          }
          actionLabel="Open chat"
          onAction={() => openChat(thread.conversation_id)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {thread.role === 'received' ? (
        <ReceivedHeader thread={thread} onMenu={() => safety.open(threadId)} />
      ) : (
        <AppBar
          back
          left={
            <Pressable
              onPress={() =>
                thread.recipient &&
                navigation.navigate('UserProfile', { username: thread.recipient.username })
              }
              accessibilityRole="button"
              style={styles.who}
            >
              <Avatar
                uri={thread.recipient?.avatar_url}
                name={thread.recipient?.display_name ?? '?'}
                size={40}
              />
              <View style={styles.flex}>
                <Text style={[styles.whoName, { color: colors.text }]} numberOfLines={1}>
                  {thread.recipient?.display_name ?? 'Nexity user'}
                </Text>
                <View style={styles.inline}>
                  <VenetianMask size={11} color={colors.textSecondary} />
                  <Text style={[styles.whoSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    You're "Someone" to them
                  </Text>
                </View>
              </View>
            </Pressable>
          }
        />
      )}
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={scrollEnd}
        >
          <SealBox thread={thread} />
          {thread.role === 'sent' ? <NearbyChip hint={thread.nearby_hint} /> : null}
          <View style={[styles.divider]}>
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
              {dayLabel(thread.day)}
            </Text>
          </View>
          {messagesQ.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <MessageList messages={messages} />
          )}
        </ScrollView>
        <Composer
          thread={thread}
          text={text}
          setText={setText}
          sending={sending}
          onSend={send}
        />
      </KeyboardAvoidingView>
      {safety.element}
    </SafeAreaView>
  );
}

function ReceivedHeader({ thread, onMenu }: { thread: SecretThread; onMenu: () => void }) {
  const { colors } = useAppTheme();
  const near = nearText(thread.nearby_hint);
  return (
    <AppBar
      back
      left={
        <View style={styles.who}>
          <GhostAvatar size={40} />
          <View style={styles.flex}>
            <GhostName width={96} />
            {near ? (
              <Text style={[styles.whoSub, { color: colors.primary }]} numberOfLines={1}>
                {near}
              </Text>
            ) : thread.nearby_hint?.state === 'locked' ? (
              <NearbyChip hint={thread.nearby_hint} style={styles.chipTight} />
            ) : (
              <View style={styles.inline}>
                <Lock size={11} color={colors.textSecondary} />
                <Text style={[styles.whoSub, { color: colors.textSecondary }]}>
                  Name sealed until the reveal
                </Text>
              </View>
            )}
          </View>
        </View>
      }
      actions={
        <IconButton onPress={onMenu} accessibilityLabel="Options">
          <Ellipsis size={22} color={colors.text} />
        </IconButton>
      }
    />
  );
}

function SealBox({ thread }: { thread: SecretThread }) {
  const { colors } = useAppTheme();
  let icon = <Mail size={26} color={colors.primary} />;
  let title: string;
  let text: string;
  let count: number;
  let label: string;
  if (thread.role === 'received') {
    count = thread.replies_used;
    title = count === 0 ? 'This message is sealed' : 'One more reply to unseal';
    text =
      count === 0
        ? "Reply twice and the sender's name, photo and message are revealed together."
        : 'Your next reply reveals who sent this — and what they wrote.';
    label = `Reveal progress: ${count} of 2 replies`;
  } else {
    icon = <VenetianMask size={26} color={colors.primary} />;
    count = thread.replies_received;
    const first = thread.recipient?.display_name.split(' ')[0] ?? 'They';
    title = count === 0 ? 'Waiting for their first reply' : "One more reply and you're revealed";
    text = `${first} sees your message sealed. After their 2nd reply, your name and message are revealed.`;
    label = `Their replies: ${count} of 2`;
  }
  return (
    <View style={[styles.sealbox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.wax, { backgroundColor: colors.primarySoft }]}>{icon}</View>
      <Text style={[styles.sealTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sealText, { color: colors.textSecondary }]}>{text}</Text>
      <SealTrack count={count} label={label} />
    </View>
  );
}

function MessageList({ messages }: { messages: SecretMessage[] }) {
  let sealedIndex = 0;
  return (
    <View style={styles.messages}>
      {messages.map(m =>
        m.sealed ? <SealedBubble key={m.id} index={sealedIndex++} /> : <Bubble key={m.id} m={m} />,
      )}
    </View>
  );
}

function Composer({
  thread,
  text,
  setText,
  sending,
  onSend,
}: {
  thread: SecretThread;
  text: string;
  setText: (t: string) => void;
  sending: boolean;
  onSend: () => void;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const received = thread.role === 'received';
  const used = received ? thread.replies_used : 0;
  const followupsLeft = thread.role === 'sent' ? thread.followups_left : 1;
  const disabled = !received && followupsLeft <= 0;
  const hint = received
    ? used === 1
      ? 'Reply 2 of 2 — this unseals their name & message'
      : 'Reply 1 of 2 · everything stays sealed until your 2nd reply'
    : disabled
    ? 'Wait for their reply · you can add up to 3 messages in a row'
    : null;
  const placeholder = received
    ? used === 1
      ? 'Send your 2nd reply to unseal…'
      : 'Write a reply…'
    : disabled
    ? 'Wait for their reply'
    : 'Add to your message (still anonymous)…';
  const canSend = !!text.trim() && !sending && !disabled;

  return (
    <View
      style={[
        styles.composer,
        {
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {received ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.quick}
        >
          {QUICK.map(q => (
            <Pressable
              key={q}
              onPress={() => setText(q)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.quickChip,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.quickText, { color: colors.text }]}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {hint ? (
        <View style={styles.inline}>
          {received && used === 1 ? <Eye size={13} color={colors.primary} /> : null}
          <Text
            style={[
              styles.hint,
              { color: received && used === 1 ? colors.primary : colors.textSecondary },
            ]}
          >
            {hint}
          </Text>
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!disabled}
          maxLength={MAX}
          multiline
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          style={[
            styles.composerInput,
            { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border },
          ]}
          accessibilityLabel={received ? 'Write a reply' : 'Write a message'}
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={received ? 'Send reply' : 'Send'}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={[
            styles.sendBtn,
            { backgroundColor: colors.button, opacity: canSend ? 1 : 0.45 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.onButton} size="small" />
          ) : (
            <Send size={19} color={colors.onButton} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stretch: { alignSelf: 'stretch', marginTop: 4 },
  chipTight: { marginTop: 2 },
  content: { padding: spacing.md, gap: 12, flexGrow: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whoName: { fontSize: 15.5, fontWeight: '800' },
  whoSub: { fontSize: 12 },
  sealbox: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  wax: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  sealTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  sealText: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  divider: { alignItems: 'center', marginVertical: 4 },
  dividerText: { fontSize: 12, fontWeight: '700' },
  messages: { gap: 6 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  in: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  out: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  sealLine: { height: 9, borderRadius: 5, marginVertical: 3, maxWidth: '100%' },
  sealTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  sealTagText: { fontSize: 11.5, fontWeight: '700' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: spacing.sm, gap: 6 },
  quick: { gap: 8, paddingHorizontal: 4 },
  quickChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  quickText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  revealWrap: { flex: 1 },
  reveal: { alignItems: 'center', paddingHorizontal: spacing.lg, gap: 10, flexGrow: 1, justifyContent: 'center' },
  eyebrow: { fontSize: 14, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  revealRing: { borderWidth: 3, borderRadius: 70, padding: 6, marginVertical: 8 },
  revealName: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  revealSub: { fontSize: 14, opacity: 0.9, textAlign: 'center' },
  um: { alignSelf: 'stretch', gap: 8, marginTop: 12 },
  umLabel: { fontSize: 13, fontWeight: '700' },
  umBubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', maxWidth: '90%' },
  revealBtn: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  revealGhost: { alignSelf: 'stretch', height: 48, alignItems: 'center', justifyContent: 'center' },
  revealBtnText: { fontSize: 16, fontWeight: '800' },
});
