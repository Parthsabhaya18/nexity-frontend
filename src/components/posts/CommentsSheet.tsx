import { Heart, SendHorizontal } from 'lucide-react-native';
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

import { PlanBadge } from '@/components/profile/PlanBadge';
import { StoryRingAvatar, useStoryRings } from '@/components/stories/StoryRingAvatar';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { ShareSheet, type ShareTarget } from '@/components/share/ShareSheet';
import { CommentListSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetFlatList } from '@/components/ui/sheetDrag';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { emitPostEvent } from '@/features/posts/postEvents';
import { ApiError } from '@/services/api/client';
import { type Comment, postsApi } from '@/services/api/posts';
import type { StoryGroup } from '@/services/api/stories';
import { reelsApi } from '@/services/api/reels';
import { safetyApi } from '@/services/api/safety';
import { spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

/** Matches the API's comment limit. */
const MAX_COMMENT = 1000;

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
  const [menu, setMenu] = useState<Comment | null>(null);
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  const sendingRef = useRef(false);
  const count = useRef(0);
  const list = useRef<FlatList<Comment>>(null);
  const { stories, reload: reloadStories, markSeen } = useStoryRings(!!target);
  const [watching, setWatching] = useState<StoryGroup | null>(null);
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

  const patchComment = (id: string, patch: (c: Comment) => Comment) => {
    const walk = (c: Comment): Comment =>
      c.id === id ? patch(c) : { ...c, replies: c.replies.map(walk) };
    setItems(prev => prev.map(walk));
  };

  const toggleLike = async (comment: Comment) => {
    const next = !comment.liked_by_me;
    patchComment(comment.id, c => ({
      ...c,
      liked_by_me: next,
      likes_count: Math.max(0, (c.likes_count ?? 0) + (next ? 1 : -1)),
    }));
    try {
      const saved = await postsApi.setCommentLike(comment.id, next);
      patchComment(comment.id, c => ({
        ...c,
        liked_by_me: saved.liked,
        likes_count: saved.likes_count,
      }));
    } catch (err) {
      patchComment(comment.id, () => comment);
      Alert.alert("Couldn't update like", errorText(err));
    }
  };

  const blockAuthor = (comment: Comment) => {
    const author = comment.author;
    if (!author || author.id === user?.id) return;
    Alert.alert(`Block @${author.username}?`, 'They will not be able to see you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await safetyApi.block(author.id);
          } catch (err) {
            Alert.alert("Couldn't block", errorText(err));
          }
        },
      },
    ]);
  };

  const ready = !!text.trim() && !sending;

  return (
    <>
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
        <SheetFlatList
          listRef={list}
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
                story={item.author ? stories.get(item.author.id) : undefined}
                onOpenStory={setWatching}
                onLike={() => toggleLike(item)}
                onReply={
                  target?.kind === 'post' && !target.commentsDisabled
                    ? () => {
                        setReplyTo(item);
                        setText(`@${item.author?.username ?? ''} `);
                      }
                    : undefined
                }
                onMenu={() => setMenu(item)}
              />
              {item.replies.map(r => (
                <View key={r.id} style={styles.reply}>
                  <CommentRow
                    comment={r}
                    story={r.author ? stories.get(r.author.id) : undefined}
                    onOpenStory={setWatching}
                    onLike={() => toggleLike(r)}
                    onMenu={() => setMenu(r)}
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
      <ActionSheet
        visible={menu !== null}
        title={menu?.author ? `@${menu.author.username}` : 'Comment'}
        options={[
          ...(menu && target?.kind === 'post' && !target.commentsDisabled
            ? [
                {
                  label: 'Reply',
                  onPress: () => {
                    const picked = menu;
                    setMenu(null);
                    setReplyTo(picked);
                    setText(`@${picked.author?.username ?? ''} `);
                  },
                },
              ]
            : []),
          {
            label: 'Share',
            onPress: () => {
              setMenu(null);
              if (target) setSharing({ kind: target.kind, id: target.id });
            },
          },
          ...(menu && !canDelete(menu)
            ? [
                {
                  label: 'Report',
                  destructive: true,
                  onPress: () => {
                    const picked = menu;
                    setMenu(null);
                    setReportId(picked.id);
                  },
                },
              ]
            : []),
          ...(menu?.author && menu.author.id !== user?.id
            ? [
                {
                  label: 'Block',
                  destructive: true,
                  onPress: () => {
                    const picked = menu;
                    setMenu(null);
                    blockAuthor(picked);
                  },
                },
              ]
            : []),
          ...(menu && canDelete(menu)
            ? [
                {
                  label: 'Delete',
                  destructive: true,
                  onPress: () => {
                    const picked = menu;
                    setMenu(null);
                    const parent = items.find(c =>
                      c.replies.some(r => r.id === picked.id),
                    );
                    remove(picked, parent);
                  },
                },
              ]
            : []),
        ]}
        onClose={() => setMenu(null)}
      />
      <ShareSheet target={sharing} onClose={() => setSharing(null)} />
    </BottomSheet>
    <StoryViewer
      groups={watching ? [watching] : []}
      startIndex={watching ? 0 : null}
      onClose={() => {
        const id = watching?.user.id;
        setWatching(null);
        if (id) markSeen(id);
        reloadStories();
      }}
    />
    </>
  );
}

function CommentRow({
  comment,
  story,
  onOpenStory,
  onLike,
  onReply,
  onMenu,
}: {
  comment: Comment;
  story?: StoryGroup;
  onOpenStory: (group: StoryGroup) => void;
  onLike: () => void;
  onReply?: () => void;
  onMenu: () => void;
}) {
  const { colors } = useAppTheme();
  const likes = comment.likes_count ?? 0;
  const authorName = comment.author?.display_name ?? '?';
  return (
    <Pressable style={styles.row} onLongPress={onMenu} delayLongPress={280}>
      <StoryRingAvatar
        story={story}
        uri={comment.author?.avatar_url}
        name={authorName}
        size={36}
        onPress={story ? () => onOpenStory(story) : undefined}
        label={
          story
            ? `View @${comment.author?.username ?? 'user'}'s story`
            : `${authorName}'s profile photo`
        }
      />
      <View style={styles.body}>
        <View style={styles.commentLine}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
            {comment.author?.username ?? 'user'}
          </Text>
          <PlanBadge plan={comment.author?.plan_badge} />
          {comment.body ? (
            <Text style={{ color: colors.text, fontSize: 14 }}>{comment.body}</Text>
          ) : null}
        </View>
        <View style={styles.meta}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {timeAgo(new Date(comment.created_at).getTime())}
          </Text>
          {onReply ? (
            <Pressable onPress={onReply} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                Reply
              </Text>
            </Pressable>
          ) : null}
          {likes > 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {likes} like{likes === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={onLike}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={comment.liked_by_me ? 'Unlike comment' : 'Like comment'}
        style={styles.heart}
      >
        <Heart
          size={14}
          color={comment.liked_by_me ? colors.like : colors.textSecondary}
          fill={comment.liked_by_me ? colors.like : 'transparent'}
        />
      </Pressable>
    </Pressable>
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
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8, alignItems: 'flex-start' },
  body: { flex: 1 },
  commentLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  heart: { paddingTop: 4 },
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
