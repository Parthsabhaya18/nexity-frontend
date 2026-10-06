import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  CloudOff,
  Copy,
  Download,
  Info,
  Pencil,
  Reply,
  Undo2,
  Video,
} from 'lucide-react-native';
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/chat/ActionSheet';
import { ChatThreadSkeleton } from '@/components/skeleton/ScreenSkeletons';
import {
  ChatComposer,
  type ComposerEdit,
} from '@/components/chat/ChatComposer';
import { EmojiPickerSheet } from '@/components/chat/EmojiPickerSheet';
import {
  galleryCollapsedHeight,
  GallerySheet,
} from '@/components/chat/GallerySheet';
import { GifSheet } from '@/components/chat/GifSheet';
import {
  AlbumViewer,
  type ViewerItem,
  type ViewerTarget,
} from '@/components/chat/AlbumViewer';
import {
  MessageActionsOverlay,
  type OverlayAction,
  type OverlayTarget,
} from '@/components/chat/MessageActionsOverlay';
import {
  CHAT_LIST_PADDING_X,
  isVideoItem,
  type MeasureBubble,
  MessageBubble,
  messageSnippet,
  useTimeReveal,
} from '@/components/chat/MessageBubble';
import {
  type ReactionPerson,
  ReactionDetailsSheet,
} from '@/components/chat/ReactionDetailsSheet';
import { useToast } from '@/components/chat/Toast';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useKeyboardVisible } from '@/components/chat/useKeyboardVisible';
import { useNow } from '@/components/chat/useNow';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { chat } from '@/features/chats/chatController';
import {
  canEdit,
  type ChatMessage,
  isAtOrAfter,
  myReaction,
  presenceOf,
  useChatStore,
} from '@/features/chats/chatStore';
import { voicePlayback } from '@/features/chats/voicePlayback';
import { captureWithCamera, type LocalMedia } from '@/features/media/pickMedia';
import { saveToGallery } from '@/features/media/saveToGallery';
import { uploadErrorMessage } from '@/features/media/uploadMedia';
import { focusReelId } from '@/features/reels/reelFocus';
import type { SharedRef } from '@/services/api/chat';
import {
  loadReactionPrefs,
  reactionPrefs,
  useReactionPrefs,
} from '@/features/chats/reactionPrefs';
import { ApiError } from '@/services/api/client';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';
import { clockTime, dayLabel, presenceLabel } from '@/utils/time';

type Row =
  | { kind: 'message'; key: string; message: ChatMessage; tail: boolean }
  | { kind: 'day'; key: string; label: string };

const NO_MESSAGES: ChatMessage[] = [];
/** No scroll events for this long = the jump scroll has stopped. */
const SCROLL_SETTLE_MS = 90;
const PULSE_IF_NO_SCROLL_MS = 250;

/** Rows newest first (inverted list) with a divider before the first message of each day. */
function buildRows(newestFirst: readonly ChatMessage[]): Row[] {
  const oldestFirst = [...newestFirst].reverse();
  const rows: Row[] = [];
  let lastDay = '';
  oldestFirst.forEach((message, i) => {
    const time = Date.parse(message.created_at);
    const day = new Date(time).toDateString();
    if (day !== lastDay) {
      lastDay = day;
      rows.push({
        kind: 'day',
        key: `day:${day}`,
        label: `${dayLabel(time)} · ${clockTime(time)}`,
      });
    }
    const next = oldestFirst[i + 1];
    rows.push({
      kind: 'message',
      key: `${message.sender_id}:${message.client_message_id}`,
      message,
      tail: !next || next.sender_id !== message.sender_id,
    });
  });
  return rows.reverse();
}

/** Closes the keyboard and resolves once the layout has settled, so measurements are final. */
function dismissKeyboard() {
  if (!Keyboard.isVisible()) return Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => {
      sub.remove();
      clearTimeout(timer);
      setTimeout(resolve, 60);
    };
    const sub = Keyboard.addListener('keyboardDidHide', done);
    const timer = setTimeout(done, 450);
    Keyboard.dismiss();
  });
}

export function ChatThreadScreen({
  navigation,
  route,
}: ScreenProps<'ChatThread'>) {
  const { conversationId } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const [sheet, setSheet] = useState<'gallery' | 'gif' | null>(null);
  // The composer stays lifted above the gallery until its close animation ends.
  const [galleryLift, setGalleryLift] = useState(false);
  const galleryHeight = galleryCollapsedHeight(useWindowDimensions().height);
  const [overlay, setOverlay] = useState<OverlayTarget | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ComposerEdit | null>(null);
  const [highlight, setHighlight] = useState<{ id: string; token: number }>({
    id: '',
    token: 0,
  });
  const listRef = useRef<ComponentRef<typeof FlatList<Row>>>(null);
  const rowsRef = useRef<Row[]>([]);
  const { toast, show: showToast } = useToast();
  const { reveal, handlers: revealHandlers } = useTimeReveal();
  const { quick: quickReactions } = useReactionPrefs();
  useNow();
  useStatusBar();

  useEffect(() => {
    loadReactionPrefs();
  }, []);

  const meId = useChatStore(s => s.meId);
  const convo = useChatStore(s => s.conversations[conversationId]);
  const thread = useChatStore(s => s.threads[conversationId]);
  const typing = useChatStore(s => Boolean(s.typing[conversationId]));
  const presenceMap = useChatStore(s => s.presence);

  useFocusEffect(
    useCallback(() => {
      chat.openThread(conversationId);
      return () => {
        chat.closeThread(conversationId);
        voicePlayback.stop();
      };
    }, [conversationId]),
  );

  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  const [cameraSheet, setCameraSheet] = useState(false);

  const sendFiles = (files: LocalMedia[]) => {
    if (!files.length) return;
    chat.sendFiles(conversationId, files, replyTo);
    setReplyTo(null);
    scrollToLatest();
  };

  const capture = async (kind: 'image' | 'video') => {
    try {
      const file = await captureWithCamera('message', kind);
      if (file) sendFiles([file]);
    } catch (err) {
      showToast(uploadErrorMessage(err));
    }
  };

  const peer = convo?.peer ?? null;
  const me = useChatStore(s =>
    s.conversations[conversationId]?.participants.find(p => p.id === s.meId),
  );

  const openShared = useCallback(
    (shared: SharedRef) => {
      if (shared.kind === 'profile') {
        if (!shared.author) return;
        if (shared.id === meId) navigation.navigate('Profile');
        else navigation.navigate('UserProfile', { username: shared.author.username });
      } else if (shared.kind === 'post') {
        navigation.navigate('PostDetail', { postId: shared.id });
      } else {
        focusReelId(shared.id);
        navigation.popTo('Main', { screen: 'Reels' });
      }
    },
    [navigation, meId],
  );

  const openMedia = useCallback(
    (m: ChatMessage) => {
      const album = m.type === 'album';
      const items: ViewerItem[] = album
        ? (m.media_items ?? []).map((item, i) => ({
            uri: m.localUris?.[i] ?? item.url,
            remoteUrl: item.url,
            video: isVideoItem(item),
            width: item.width,
            height: item.height,
          }))
        : m.media
        ? [
            {
              uri: m.localUri ?? m.media.url,
              remoteUrl: m.media.url,
              video: m.type === 'video',
              width: m.media.width,
              height: m.media.height,
            },
          ]
        : [];
      if (!items.length) return;
      const mine = m.sender_id === meId;
      setViewer({
        messageId: m.id,
        items,
        album,
        sender: mine
          ? { name: 'You', avatarUrl: me?.avatar_url ?? null }
          : {
              name: peer?.display_name ?? '',
              avatarUrl: peer?.avatar_url ?? null,
            },
        createdAt: m.created_at,
        canReply: m.status === 'sent',
      });
    },
    [meId, me?.avatar_url, peer?.display_name, peer?.avatar_url],
  );

  const saveMedia = useCallback(
    async (url: string, video: boolean) => {
      try {
        await saveToGallery(url, video ? 'video' : 'image');
        showToast(video ? 'Video saved' : 'Photo saved');
      } catch {
        showToast(`Couldn't save the ${video ? 'video' : 'photo'}. Try again.`);
      }
    },
    [showToast],
  );
  const { online, lastActiveAt } = presenceOf(peer, presenceMap);
  const allMessages = thread?.messages ?? NO_MESSAGES;
  // Unsent messages disappear for both people, like Instagram.
  const messages = useMemo(
    () => allMessages.filter(m => !m.is_deleted),
    [allMessages],
  );
  const rows = useMemo(() => buildRows(messages), [messages]);
  rowsRef.current = rows;

  const latest = messages[0];
  const receipt =
    latest && latest.sender_id === meId && latest.status === 'sent'
      ? convo?.peer_last_read_message_id &&
        isAtOrAfter(convo.peer_last_read_message_id, latest.id)
        ? 'seen'
        : 'sent'
      : null;

  const status = typing
    ? 'typing…'
    : presenceLabel(online, lastActiveAt) ?? (peer ? `@${peer.username}` : '');

  const onRetry = useCallback(
    (clientId: string) => chat.retry(conversationId, clientId),
    [conversationId],
  );

  const peerUsername = peer?.username;
  const openProfile = useCallback(() => {
    if (peerUsername)
      navigation.navigate('UserProfile', { username: peerUsername });
  }, [navigation, peerUsername]);

  const onLongPress = useCallback(
    async (message: ChatMessage, measure: MeasureBubble) => {
      if (message.is_deleted) return;
      await dismissKeyboard();
      const rect = await measure();
      if (!rect.width || !rect.height) return;
      const latestRows = rowsRef.current;
      const row = latestRows.find(
        r => r.kind === 'message' && r.message.id === message.id,
      );
      setOverlay({
        message,
        mine: message.sender_id === meId,
        tail: row?.kind === 'message' ? row.tail : true,
        rect,
      });
    },
    [meId],
  );

  const react = useCallback(
    (messageId: string, emoji: string) => {
      chat
        .react(conversationId, messageId, emoji)
        .catch(() => showToast("Couldn't react. Try again."));
    },
    [conversationId, showToast],
  );

  const startReply = useCallback((m: ChatMessage) => {
    setEditing(null);
    setReplyTo(m);
  }, []);

  // The pulse starts the moment the jump scroll settles, not after a fixed guess.
  const pendingPulse = useRef<{
    id: string;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const firePulse = useCallback(() => {
    const pending = pendingPulse.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingPulse.current = null;
    setHighlight({ id: pending.id, token: Date.now() });
  }, []);
  const armPulse = useCallback(
    (delay: number) => {
      const pending = pendingPulse.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pending.timer = setTimeout(firePulse, delay);
    },
    [firePulse],
  );
  useEffect(() => () => clearTimeout(pendingPulse.current?.timer), []);

  const scrollToRow = useCallback(
    (messageId: string) => {
      const index = rowsRef.current.findIndex(
        r => r.kind === 'message' && r.message.id === messageId,
      );
      if (index < 0) return false;
      clearTimeout(pendingPulse.current?.timer);
      pendingPulse.current = { id: messageId };
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
      // Already in place → no scroll events arrive; pulse right away.
      armPulse(PULSE_IF_NO_SCROLL_MS);
      return true;
    },
    [armPulse],
  );

  // After sending from anywhere in the history, show the newest message (bottom of the inverted list).
  const scrollToLatest = useCallback(() => {
    clearTimeout(pendingPulse.current?.timer);
    pendingPulse.current = null;
    requestAnimationFrame(() =>
      listRef.current?.scrollToOffset({ offset: 0, animated: true }),
    );
  }, []);

  // "See more" / tapping a quote: bring the original into the middle of the screen and pulse it.
  const jumpTo = useCallback(
    async (messageId: string) => {
      if (scrollToRow(messageId)) return;
      const found = await chat.ensureLoaded(conversationId, messageId);
      if (!found) {
        showToast('This message is no longer available');
        return;
      }
      setTimeout(() => scrollToRow(messageId), 60);
    },
    [conversationId, scrollToRow, showToast],
  );

  const target = overlay?.message;
  const overlayActions = useMemo<OverlayAction[]>(() => {
    const m = target;
    if (!m || m.is_deleted) return [];
    const sent = m.status === 'sent';
    const isText = m.type === 'text' && Boolean(m.body);
    const list: OverlayAction[] = [];
    if (sent) {
      list.push({
        key: 'reply',
        label: 'Reply',
        Icon: Reply,
        onPress: () => startReply(m),
      });
    }
    if (canEdit(m, meId)) {
      list.push({
        key: 'edit',
        label: 'Edit',
        Icon: Pencil,
        onPress: () => {
          setReplyTo(null);
          setEditing({ id: m.id, body: m.body });
        },
      });
    }
    if (sent && (m.type === 'image' || m.type === 'video') && m.media) {
      const { url } = m.media;
      const video = m.type === 'video';
      list.push({
        key: 'save',
        label: 'Save',
        Icon: Download,
        onPress: () => saveMedia(url, video),
      });
    }
    if (isText) {
      list.push({
        key: 'copy',
        label: 'Copy',
        Icon: Copy,
        onPress: () => {
          Clipboard.setString(m.body);
          showToast('Copied');
        },
      });
    }
    if (sent && m.sender_id === meId) {
      list.push({
        key: 'unsend',
        label: 'Unsend',
        Icon: Undo2,
        destructive: true,
        onPress: () => {
          setReplyTo(r => (r?.id === m.id ? null : r));
          setEditing(e => (e?.id === m.id ? null : e));
          chat
            .unsend(conversationId, m.id)
            .catch(() => showToast("Couldn't unsend. Try again."));
        },
      });
    }
    return list;
  }, [target, meId, conversationId, showToast, startReply, saveMedia]);

  const people = useMemo(() => {
    const map: Record<string, ReactionPerson> = {};
    for (const p of convo?.participants ?? []) map[p.id] = p;
    if (peer) map[peer.id] = peer;
    return map;
  }, [convo?.participants, peer]);

  const findLive = (id: string | null) =>
    id ? messages.find(m => m.id === id) : undefined;
  const pickerTarget = findLive(pickerFor);
  const detailsTarget = findLive(detailsFor);
  if (detailsFor && !detailsTarget?.reactions?.length) setDetailsFor(null);

  // Drop the reply bar if the quoted message gets unsent while composing.
  const replyTarget = replyTo
    ? messages.find(m => m.id === replyTo.id)
    : undefined;
  if (replyTo && (!replyTarget || replyTarget.is_deleted)) setReplyTo(null);
  if (editing && !findLive(editing.id)) setEditing(null);

  const reply = replyTo
    ? {
        id: replyTo.id,
        name:
          replyTo.sender_id === meId ? 'yourself' : peer?.display_name ?? '',
        preview: messageSnippet(replyTo),
      }
    : null;

  const openDetails = useCallback((m: ChatMessage) => setDetailsFor(m.id), []);

  const renderRow = ({ item }: { item: Row }) =>
    item.kind === 'day' ? (
      <View style={styles.day}>
        <Text
          style={[
            styles.dayText,
            { color: colors.textSecondary, backgroundColor: colors.surfaceAlt },
          ]}
        >
          {item.label}
        </Text>
      </View>
    ) : (
      <MessageBubble
        message={item.message}
        mine={item.message.sender_id === meId}
        tail={item.tail}
        meId={meId}
        peer={peer}
        reveal={reveal}
        highlight={
          highlight.id === item.message.id ? highlight.token : undefined
        }
        onRetry={onRetry}
        onLongPress={onLongPress}
        onReply={startReply}
        onJumpTo={jumpTo}
        onPressReactions={openDetails}
        onPressAvatar={openProfile}
        onOpenMedia={openMedia}
        onOpenShared={openShared}
        onNotice={showToast}
      />
    );

  const loadError = thread?.error && !thread.loaded;

  return (
    // Inset from the provider (known before the first frame); the native SafeAreaView can
    // report 0 for a moment on Android while the screen slides in, pushing the header under the status bar.
    <View
      style={[
        styles.safe,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={[styles.head, { borderBottomColor: colors.border }]}>
        <IconButton
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </IconButton>
        <Pressable
          onPress={openProfile}
          disabled={!peer}
          accessibilityRole="button"
          accessibilityLabel={
            peer ? `${peer.display_name}. ${status}. Open profile` : 'Chat'
          }
          style={({ pressed }) => [
            styles.headUser,
            pressed && styles.headPressed,
          ]}
        >
          <Avatar
            uri={peer?.avatar_url}
            name={peer?.display_name ?? ''}
            size={40}
          />
          <View style={styles.headText}>
            <Text
              style={[styles.headName, { color: colors.text }]}
              numberOfLines={1}
            >
              {peer?.display_name ?? 'Chat'}
            </Text>
            {status ? (
              <Text
                style={[
                  styles.headStatus,
                  { color: typing ? colors.primary : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {status}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {peer ? (
          <IconButton onPress={openProfile} accessibilityLabel="Chat details">
            <Info size={23} color={colors.text} />
          </IconButton>
        ) : null}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {loadError ? (
          <View style={styles.center}>
            <EmptyState
              icon={<CloudOff size={34} color={colors.primary} />}
              title="Couldn't load messages"
              text={thread.error ?? undefined}
              action={
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => chat.retryThread(conversationId)}
                  style={styles.cta}
                />
              }
            />
          </View>
        ) : !thread?.loaded ? (
          <ChatThreadSkeleton />
        ) : (
          <View style={styles.flex} {...revealHandlers}>
            <FlatList
              ref={listRef}
              inverted
              data={rows}
              keyExtractor={r => r.key}
              renderItem={renderRow}
              onScroll={() => {
                if (pendingPulse.current) armPulse(SCROLL_SETTLE_MS);
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={info => {
                // Row not measured yet: get close by estimate, then retry precisely.
                listRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
                setTimeout(() => {
                  if (info.index < rowsRef.current.length) {
                    listRef.current?.scrollToIndex({
                      index: info.index,
                      animated: true,
                      viewPosition: 0.5,
                    });
                  }
                }, 300);
              }}
              onEndReached={() => chat.loadOlder(conversationId)}
              onEndReachedThreshold={0.3}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <>
                  {receipt ? (
                    <View style={styles.receipt}>
                      {receipt === 'seen' ? (
                        <CheckCheck size={14} color={colors.textSecondary} />
                      ) : (
                        <Check size={14} color={colors.textSecondary} />
                      )}
                      <Text
                        style={[
                          styles.receiptText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {receipt === 'seen' ? 'Seen' : 'Sent'}
                      </Text>
                    </View>
                  ) : null}
                  {typing && peer ? (
                    <TypingIndicator
                      name={peer.display_name}
                      avatarUrl={peer.avatar_url}
                    />
                  ) : null}
                </>
              }
              ListFooterComponent={
                thread.loadingOlder ? (
                  <ChatThreadSkeleton older />
                ) : !thread.hasMore && peer ? (
                  <View style={styles.intro}>
                    <Avatar
                      uri={peer.avatar_url}
                      name={peer.display_name}
                      size={76}
                    />
                    <Text style={[styles.introName, { color: colors.text }]}>
                      {peer.display_name}
                    </Text>
                    <Text
                      style={[
                        styles.introMeta,
                        { color: colors.textSecondary },
                      ]}
                    >
                      @{peer.username}
                    </Text>
                    <Button
                      title="View profile"
                      variant="secondary"
                      onPress={openProfile}
                      style={styles.introButton}
                    />
                    {!messages.length ? (
                      <Text
                        style={[
                          styles.introHint,
                          {
                            color: colors.primary,
                            backgroundColor: colors.primarySoft,
                          },
                        ]}
                      >
                        Say hi to start the conversation 👋
                      </Text>
                    ) : null}
                  </View>
                ) : undefined
              }
            />
          </View>
        )}
        <ChatComposer
          onSend={text => {
            chat.send(conversationId, text, replyTo);
            setReplyTo(null);
            scrollToLatest();
          }}
          onTyping={() => chat.notifyTyping(conversationId)}
          onCamera={() => {
            Keyboard.dismiss();
            setCameraSheet(true);
          }}
          onPickImage={() => {
            Keyboard.dismiss();
            setGalleryLift(true);
            setSheet('gallery');
          }}
          onInputFocus={() => {
            if (sheet !== 'gallery') return;
            setGalleryLift(false);
            setSheet(null);
          }}
          onPickGif={() => setSheet('gif')}
          onVoiceSend={file => sendFiles([file])}
          onError={showToast}
          reply={reply}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSubmitEdit={text => {
            const id = editing?.id;
            setEditing(null);
            if (!id) return;
            chat.edit(conversationId, id, text).catch(err =>
              showToast(
                err instanceof ApiError && err.code === 'EDIT_WINDOW_EXPIRED'
                  ? 'Messages can only be edited for 15 minutes'
                  : "Couldn't edit. Try again.",
              ),
            );
          }}
          bottomInset={keyboardVisible || galleryLift ? 0 : insets.bottom}
        />
        {galleryLift ? <View style={{ height: galleryHeight }} /> : null}
      </KeyboardAvoidingView>
      {toast}
      <GallerySheet
        visible={sheet === 'gallery'}
        collapsedHeight={galleryHeight}
        topInset={insets.top}
        onClose={() => setSheet(null)}
        onHidden={() => setGalleryLift(false)}
        onSend={files => {
          setSheet(null);
          sendFiles(files);
        }}
      />
      <ActionSheet
        visible={cameraSheet}
        onClose={() => setCameraSheet(false)}
        actions={[
          {
            key: 'photo',
            label: 'Take photo',
            Icon: Camera,
            onPress: () => capture('image'),
          },
          {
            key: 'video',
            label: 'Record video',
            Icon: Video,
            onPress: () => capture('video'),
          },
        ]}
      />
      <AlbumViewer
        target={viewer}
        onClose={() => setViewer(null)}
        onReply={(text, index) => {
          const original = viewer && findLive(viewer.messageId);
          if (!original) return;
          chat.send(conversationId, text, original, index);
          scrollToLatest();
        }}
        onSave={item => saveMedia(item.remoteUrl, item.video)}
      />
      <GifSheet
        visible={sheet === 'gif'}
        onClose={() => setSheet(null)}
        onPick={(gif, kind) => {
          setSheet(null);
          chat.sendGif(conversationId, gif, replyTo, kind);
          setReplyTo(null);
          scrollToLatest();
        }}
      />
      <ReactionDetailsSheet
        visible={Boolean(detailsTarget)}
        onClose={() => setDetailsFor(null)}
        reactions={detailsTarget?.reactions ?? []}
        meId={meId}
        people={people}
        onRemoveMine={() => {
          const mine = myReaction(detailsTarget?.reactions, meId);
          if (detailsTarget && mine) react(detailsTarget.id, mine);
        }}
      />
      {overlay ? (
        <MessageActionsOverlay
          key={overlay.message.id}
          target={overlay}
          quickReactions={
            overlay.message.status === 'sent' ? quickReactions : []
          }
          current={myReaction(findLive(overlay.message.id)?.reactions, meId)}
          actions={overlayActions}
          onReact={emoji => {
            if (!quickReactions.includes(emoji)) reactionPrefs.pushRecent(emoji);
            react(overlay.message.id, emoji);
          }}
          onOpenPicker={() => setPickerFor(overlay.message.id)}
          onClose={() => setOverlay(null)}
        />
      ) : null}
      <EmojiPickerSheet
        visible={Boolean(pickerTarget)}
        onClose={() => setPickerFor(null)}
        current={myReaction(pickerTarget?.reactions, meId)}
        onPick={emoji => {
          const id = pickerFor;
          setPickerFor(null);
          if (id) react(id, emoji);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  head: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headUser: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 4,
    borderRadius: radius.md,
  },
  headPressed: { opacity: 0.6 },
  introButton: { marginTop: 8, minWidth: 140 },
  headText: { flex: 1, minWidth: 0 },
  headName: { fontSize: 15, fontWeight: '800' },
  headStatus: { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cta: { minWidth: 200 },
  list: { paddingHorizontal: CHAT_LIST_PADDING_X, paddingVertical: spacing.sm },
  day: { alignItems: 'center', marginTop: 14, marginBottom: 10 },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  receipt: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -4,
    marginBottom: 6,
    marginHorizontal: 4,
  },
  receiptText: { fontSize: 12 },
  intro: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 22,
    paddingBottom: 10,
  },
  introName: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  introMeta: { fontSize: 13 },
  introHint: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
});
