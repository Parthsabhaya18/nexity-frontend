import { SendHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ReportSheet } from '@/components/safety/ReportSheet';
import { CommentListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { emitPostEvent } from '@/features/posts/postEvents';
import { ApiError } from '@/services/api/client';
import { type Comment, postsApi } from '@/services/api/posts';
import { reelsApi } from '@/services/api/reels';
import { spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

const MAX_COMMENT = 500;

export type CommentTarget = {
  kind: 'post' | 'reel';
  id: string;
  commentsDisabled: boolean;
  /** The post or reel's owner can delete anyone's comment. */
  isOwner: boolean;
  commentsCount: number;
};

type Props = {
  target: CommentTarget | null;
  onClose: () => void;
};

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Please try again.';

/** Comments for a post or a reel. Updates the count on every open screen. */
export function CommentsSheet({ target, onClose }: Props) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const count = useRef(0);
  const list = useRef<FlatList<Comment>>(null);
  const key = target ? `${target.kind}:${target.id}` : null;
  const kind = target?.kind;
  const id = target?.id;

  const load = useCallback(async () => {
    if (!kind || !id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const page =
        kind === 'post'
          ? await postsApi.comments(id)
          : await reelsApi.comments(id);
      setItems(page.items);
      setCursor(page.next_cursor);
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  // Start clean every time a different post/reel is opened.
  useEffect(() => {
    if (!key) return;
    count.current = target?.commentsCount ?? 0;
    setItems([]);
    setCursor(null);
    setText('');
    setReplyTo(null);
    setSendError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load]);

  const loadMore = async () => {
    if (!cursor || loadingMore || loading || !kind || !id) return;
    setLoadingMore(true);
    try {
      const page =
        kind === 'post'
          ? await postsApi.comments(id, cursor)
          : await reelsApi.comments(id, cursor);
      setItems(prev => [
        ...prev,
        ...page.items.filter(n => !prev.some(p => p.id === n.id)),
      ]);
      setCursor(page.next_cursor);
    } catch {
      // Scrolling to the end again retries.
    } finally {
      setLoadingMore(false);
    }
  };

  const bumpCount = (delta: number) => {
    if (!kind || !id) return;
    count.current = Math.max(0, count.current + delta);
    emitPostEvent({
      type: 'patch',
      kind,
      id,
      patch: { comments_count: count.current },
    });
  };

  const send = async () => {
    const body = text.trim();
    if (!kind || !id || !body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      const created =
        kind === 'post'
          ? await postsApi.addComment(id, body, replyTo?.id)
          : await reelsApi.addComment(id, body);
      if (replyTo) {
        setItems(prev =>
          prev.map(c =>
            c.id === replyTo.id
              ? { ...c, replies: [...c.replies, created] }
              : c,
          ),
        );
      } else {
        setItems(prev => [created, ...prev]);
        list.current?.scrollToOffset({ offset: 0, animated: true });
      }
      bumpCount(1);
      setText('');
      setReplyTo(null);
    } catch (err) {
      // Keep the text so nothing the user typed is lost.
      setSendError(errorText(err));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const canDelete = (comment: Comment) =>
    comment.author?.id === user?.id || !!target?.isOwner;

  const remove = (comment: Comment, parent?: Comment) => {
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postsApi.deleteComment(comment.id);
          } catch (err) {
            Alert.alert("Couldn't delete", errorText(err));
            return;
          }
          if (parent) {
            setItems(prev =>
              prev.map(c =>
                c.id === parent.id
                  ? { ...c, replies: c.replies.filter(r => r.id !== comment.id) }
                  : c,
              ),
            );
            bumpCount(-1);
          } else {
            setItems(prev => prev.filter(c => c.id !== comment.id));
            bumpCount(-(1 + comment.replies.length));
          }
        },
      },
    ]);
  };

  const ready = !!text.trim() && !sending;

  return (
    <BottomSheet
      visible={!!target}
      onClose={onClose}
      avoidKeyboard
      style={styles.sheet}
    >
      <Text style={[styles.title, { color: colors.text }]}>Comments</Text>
      {loading ? (
        <CommentListSkeleton />
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            {loadError}
          </Text>
          <Button
            title="Try again"
            variant="secondary"
            onPress={load}
            style={styles.retry}
          />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={items}
          keyExtractor={c => c.id}
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <CommentListSkeleton rows={2} inset={false} /> : undefined
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {target?.commentsDisabled
                ? 'Comments are turned off.'
                : 'No comments yet. Start the conversation.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View>
              <CommentRow
                comment={item}
                onReply={
                  target?.kind === 'post' && !target.commentsDisabled
                    ? () => {
                        setReplyTo(item);
                        setText(`@${item.author?.username ?? ''} `);
                      }
                    : undefined
                }
                onDelete={canDelete(item) ? () => remove(item) : undefined}
                onReport={canDelete(item) ? undefined : () => setReportId(item.id)}
              />
              {item.replies.map(r => (
                <View key={r.id} style={styles.reply}>
                  <CommentRow
                    comment={r}
                    onDelete={canDelete(r) ? () => remove(r, item) : undefined}
                    onReport={canDelete(r) ? undefined : () => setReportId(r.id)}
                  />
                </View>
              ))}
            </View>
          )}
        />
      )}
      {target?.commentsDisabled ? (
        <Text style={[styles.disabled, { color: colors.textSecondary }]}>
          Comments are turned off for this {target.kind}.
        </Text>
      ) : (
        <View style={[styles.composerWrap, { borderTopColor: colors.border }]}>
          {replyTo ? (
            <View style={styles.replying}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Replying to @{replyTo.author?.username}
              </Text>
              <Pressable
                onPress={() => {
                  setReplyTo(null);
                  setText('');
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          ) : null}
          {sendError ? (
            <Text style={[styles.error, { color: colors.danger }]}>
              {sendError}
            </Text>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={t => {
                setText(t);
                if (sendError) setSendError(null);
              }}
              placeholder="Add a comment…"
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_COMMENT}
              multiline
              editable={!sending}
              accessibilityLabel="Add a comment"
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.inputBackground },
              ]}
            />
            <Pressable
              onPress={send}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel={sending ? 'Sending comment' : 'Send comment'}
              accessibilityState={{ disabled: !ready, busy: sending }}
              style={[
                styles.send,
                { backgroundColor: ready || sending ? colors.primary : colors.surfaceAlt },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.onButton} />
              ) : (
                <SendHorizontal
                  size={20}
                  color={ready ? colors.onButton : colors.textSecondary}
                />
              )}
            </Pressable>
          </View>
        </View>
      )}
      <ReportSheet
        visible={reportId !== null}
        targetType="comment"
        targetId={reportId ?? ''}
        onClose={() => setReportId(null)}
      />
    </BottomSheet>
  );
}

function CommentRow({
  comment,
  onReply,
  onDelete,
  onReport,
}: {
  comment: Comment;
  onReply?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}) {
  const { colors } = useAppTheme();
  const action = (label: string, onPress: () => void, danger?: boolean) => (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${label} comment`}
    >
      <Text
        style={{
          color: danger ? colors.danger : colors.textSecondary,
          fontSize: 12,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Avatar
        uri={comment.author?.avatar_url}
        name={comment.author?.display_name ?? '?'}
        size={32}
      />
      <View style={styles.body}>
        <Text style={{ color: colors.text, fontSize: 14 }}>
          <Text style={{ fontWeight: '700' }}>
            {comment.author?.username ?? 'user'}{' '}
          </Text>
          {comment.body}
        </Text>
        <View style={styles.meta}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {timeAgo(new Date(comment.created_at).getTime())}
          </Text>
          {onReply ? action('Reply', onReply) : null}
          {onDelete ? action('Delete', onDelete, true) : null}
          {onReport ? action('Report', onReport) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { height: '72%' },
  flex: { flex: 1 },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    paddingVertical: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retry: { minWidth: 160 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  body: { flex: 1 },
  meta: { flexDirection: 'row', gap: 14, marginTop: 4, alignItems: 'center' },
  reply: { marginLeft: 42 },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
  },
  replying: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  error: { fontSize: 12, paddingBottom: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { textAlign: 'center', padding: spacing.md },
});
