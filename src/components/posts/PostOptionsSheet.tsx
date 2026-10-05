import {
  Eye,
  EyeOff,
  MessageCircle,
  MessageCircleOff,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { CAPTION_MAX } from '@/features/posts/caption';
import { emitPostEvent } from '@/features/posts/postEvents';
import { ApiError } from '@/services/api/client';
import { postsApi } from '@/services/api/posts';
import { reelsApi } from '@/services/api/reels';
import { spacing, useAppTheme } from '@/theme';

import { MentionInput } from './MentionInput';

export type OptionsTarget = {
  kind: 'post' | 'reel';
  id: string;
  caption: string;
  hide_like_count: boolean;
  comments_disabled: boolean;
};

type Props = {
  target: OptionsTarget | null;
  onClose: () => void;
  /** Called after the post or reel was deleted on the server. */
  onDeleted?: () => void;
};

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Please try again.';

/** Owner menu for a post or a reel, shared by the feed, viewers and Reels. */
export function PostOptionsSheet({ target, onClose, onDeleted }: Props) {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<'menu' | 'edit' | null>(null);
  // Keep the last target while the sheet slides away.
  const last = useRef<OptionsTarget | null>(target);
  if (target) last.current = target;
  const current = target ?? last.current;
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = !!target;
  useEffect(() => {
    setMode(open ? 'menu' : null);
  }, [open]);

  if (!current) return null;
  const { kind, id } = current;
  const noun = kind === 'post' ? 'post' : 'reel';

  const update = (
    body: { hide_like_count?: boolean; comments_disabled?: boolean; caption?: string },
  ) => (kind === 'post' ? postsApi.update(id, body) : reelsApi.update(id, body));

  const toggle = async (field: 'hide_like_count' | 'comments_disabled') => {
    if (busy) return;
    setBusy(true);
    const next = !current[field];
    emitPostEvent({ type: 'patch', kind, id, patch: { [field]: next } });
    onClose();
    try {
      const saved = await update({ [field]: next });
      emitPostEvent({
        type: 'patch',
        kind,
        id,
        patch: {
          hide_like_count: saved.hide_like_count,
          comments_disabled: saved.comments_disabled,
          likes_count: saved.likes_count,
        },
      });
    } catch (err) {
      emitPostEvent({ type: 'patch', kind, id, patch: { [field]: !next } });
      Alert.alert("Couldn't update", errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    setMode(null);
    onClose();
    Alert.alert(
      `Delete ${noun}?`,
      kind === 'post'
        ? 'This post and its likes and comments will be removed permanently.'
        : 'This reel and its likes and comments will be removed permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (kind === 'post') await postsApi.remove(id);
              else await reelsApi.remove(id);
              emitPostEvent({ type: 'remove', kind, id });
              onDeleted?.();
            } catch (err) {
              Alert.alert("Couldn't delete", errorText(err));
            }
          },
        },
      ],
    );
  };

  const saveCaption = async () => {
    if (saving) return;
    setSaving(true);
    setEditError(null);
    try {
      const saved = await update({ caption: caption.trim() });
      emitPostEvent({
        type: 'patch',
        kind,
        id,
        patch: { caption: saved.caption },
      });
      onClose();
    } catch (err) {
      setEditError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const row = (
    label: string,
    icon: ReactNode,
    onPress: () => void,
    destructive?: boolean,
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      {icon}
      <Text
        style={[
          styles.label,
          { color: destructive ? colors.danger : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const iconColor = colors.text;

  return (
    <>
      <BottomSheet visible={mode === 'menu'} onClose={onClose}>
        {row(
          current.hide_like_count ? 'Show like count' : 'Hide like count',
          current.hide_like_count ? (
            <Eye size={22} color={iconColor} />
          ) : (
            <EyeOff size={22} color={iconColor} />
          ),
          () => toggle('hide_like_count'),
        )}
        {row(
          current.comments_disabled ? 'Turn on commenting' : 'Turn off commenting',
          current.comments_disabled ? (
            <MessageCircle size={22} color={iconColor} />
          ) : (
            <MessageCircleOff size={22} color={iconColor} />
          ),
          () => toggle('comments_disabled'),
        )}
        {row(
          'Edit description',
          <Pencil size={22} color={iconColor} />,
          () => {
            setCaption(current.caption);
            setEditError(null);
            setMode('edit');
          },
        )}
        {row(
          `Delete ${noun}`,
          <Trash2 size={22} color={colors.danger} />,
          confirmDelete,
          true,
        )}
      </BottomSheet>

      <BottomSheet visible={mode === 'edit'} onClose={onClose} avoidKeyboard>
        <Text style={[styles.title, { color: colors.text }]}>
          Edit description
        </Text>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.editScroll}
          contentContainerStyle={styles.edit}
        >
          <MentionInput
            value={caption}
            onChange={setCaption}
            placeholder="Write a description…"
            autoFocus
            maxLength={CAPTION_MAX}
            accessibilityLabel="Description"
          />
        </ScrollView>
        {editError ? (
          <Text style={[styles.error, { color: colors.danger }]}>{editError}</Text>
        ) : null}
        <View style={styles.buttons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={saving}
            style={styles.flex}
          />
          <Button
            title="Save"
            loading={saving}
            loadingTitle="Saving…"
            onPress={saveCaption}
            disabled={caption.trim() === current.caption.trim()}
            style={styles.flex}
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.lg,
  },
  label: { fontSize: 16, fontWeight: '600' },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    paddingBottom: spacing.sm,
  },
  editScroll: { maxHeight: 340 },
  edit: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  error: { paddingHorizontal: spacing.lg, paddingBottom: 6, fontSize: 13 },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  flex: { flex: 1 },
});
