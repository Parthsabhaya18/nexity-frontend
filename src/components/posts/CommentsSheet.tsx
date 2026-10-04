import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReportSheet } from '@/components/safety/ReportSheet';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { ApiError } from '@/services/api/client';
import { type Comment, type Post, postsApi } from '@/services/api/posts';
import { spacing, useAppTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

type Props = {
  post: Post | null;
  onClose: () => void;
  onCount: (count: number) => void;
};

export function CommentsSheet({ post, onClose, onCount }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!post) return;
    setLoading(true);
    try {
      const page = await postsApi.comments(post.id);
      setItems(page.items);
    } catch (err) {
      Alert.alert(
        "Couldn't load comments",
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [post]);

  const send = async () => {
    if (!post || !text.trim() || sending) return;
    setSending(true);
    try {
      const created = await postsApi.addComment(
        post.id,
        text.trim(),
        replyTo?.id,
      );
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
        onCount(post.comments_count + 1);
      }
      setText('');
      setReplyTo(null);
    } catch (err) {
      Alert.alert(
        "Couldn't comment",
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setSending(false);
    }
  };

  const onCommentMenu = (comment: Comment, parent?: Comment) => {
    if (!post) return;
    const mine = comment.author?.id === user?.id || post.is_owner;
    if (!mine) {
      setReportId(comment.id);
      return;
    }
    remove(comment, parent);
  };

  const remove = (comment: Comment, parent?: Comment) => {
    if (!post) return;
    const mine = comment.author?.id === user?.id || post.is_owner;
    if (!mine) return;
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await postsApi.deleteComment(comment.id).catch(() => {});
          if (parent) {
            setItems(prev =>
              prev.map(c =>
                c.id === parent.id
                  ? {
                      ...c,
                      replies: c.replies.filter(r => r.id !== comment.id),
                    }
                  : c,
              ),
            );
          } else {
            setItems(prev => prev.filter(c => c.id !== comment.id));
            onCount(Math.max(0, post.comments_count - 1));
          }
        },
      },
    ]);
  };

  return (
    <Modal
      visible={!!post}
      animationType="slide"
      transparent
      onShow={load}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior="padding"
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Comments</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={c => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                No comments yet. Start the conversation.
              </Text>
            }
            renderItem={({ item }) => (
              <View>
                <CommentRow
                  comment={item}
                  onReply={() => {
                    setReplyTo(item);
                    setText(`@${item.author?.username ?? ''} `);
                  }}
                  onLongPress={() => onCommentMenu(item)}
                />
                {item.replies.map(r => (
                  <View key={r.id} style={styles.reply}>
                    <CommentRow
                      comment={r}
                      onLongPress={() => onCommentMenu(r, item)}
                    />
                  </View>
                ))}
              </View>
            )}
          />
        )}
        {post?.comments_disabled ? (
          <Text style={[styles.disabled, { color: colors.textSecondary }]}>
            Comments are turned off.
          </Text>
        ) : (
          <View style={[styles.composer, { borderTopColor: colors.border }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                replyTo
                  ? `Reply to @${replyTo.author?.username}`
                  : 'Add a comment…'
              }
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.inputBackground },
              ]}
            />
            <Pressable onPress={send} disabled={!text.trim() || sending}>
              <Text
                style={{
                  color: text.trim() ? colors.primary : colors.textSecondary,
                  fontWeight: '800',
                }}
              >
                Post
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
      <ReportSheet
        visible={reportId !== null}
        targetType="comment"
        targetId={reportId ?? ''}
        onClose={() => setReportId(null)}
      />
    </Modal>
  );
}

function CommentRow({
  comment,
  onReply,
  onLongPress,
}: {
  comment: Comment;
  onReply?: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable onLongPress={onLongPress} style={styles.row}>
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
          {onReply ? (
            <Pressable onPress={onReply}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                Reply
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { height: '72%', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    paddingVertical: 12,
  },
  loader: { marginTop: spacing.lg },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  empty: { textAlign: 'center', marginTop: spacing.lg },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  body: { flex: 1 },
  meta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  reply: { marginLeft: 42 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  disabled: { textAlign: 'center', padding: spacing.md },
});
