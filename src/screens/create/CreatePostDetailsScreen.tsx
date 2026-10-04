import {
  ChevronRight,
  Hash,
  Heart,
  SlidersHorizontal,
  MapPin,
  MessageCircleOff,
  Music,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdjustSheet } from '@/components/create/AdjustSheet';
import { FilterFrame } from '@/components/create/FilterFrame';
import { LookStrip, LookTint } from '@/components/media/LookStrip';
import { LocationSheet } from '@/components/posts/LocationSheet';
import { MusicSheet } from '@/components/posts/MusicSheet';
import { TagPeopleSheet } from '@/components/posts/TagPeopleSheet';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { ZERO_ADJUSTMENTS } from '@/features/create/adjustments';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  activeToken,
  applySuggestion,
  CAPTION_MAX,
  countTokens,
  MAX_HASHTAGS,
  MAX_MENTIONS,
  parseCaption,
} from '@/features/posts/caption';
import { isSharing, sharePost } from '@/features/posts/postComposer';
import {
  getDraft,
  resetDraft,
  updateDraft,
  usePostDraft,
} from '@/features/posts/postDraft';
import { useCaptionSuggestions } from '@/features/posts/useCaptionSuggestions';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

type Selection = { start: number; end: number };

/** Step 3 of "New post": one description, location, music and settings, then Share. */
export function CreatePostDetailsScreen({
  navigation,
}: ScreenProps<'CreatePostDetails'>) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const draft = usePostDraft();
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<Selection>();
  const [locationOpen, setLocationOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lookOpen, setLookOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  useStatusBar();

  const caption = draft.caption;
  const segments = useMemo(() => parseCaption(caption), [caption]);
  const token =
    selection.start === selection.end
      ? activeToken(caption, selection.start)
      : null;
  const { active, loading, suggestions } = useCaptionSuggestions(token);

  const choose = (value: string) => {
    if (!token) return;
    const next = applySuggestion(caption, token, value);
    updateDraft({ caption: next.text.slice(0, CAPTION_MAX) });
    const cursor = Math.min(next.cursor, CAPTION_MAX);
    setForcedSelection({ start: cursor, end: cursor });
    setSelection({ start: cursor, end: cursor });
  };

  const share = () => {
    const current = getDraft();
    if (!current.items.length) return;
    const counts = countTokens(current.caption);
    if (counts.hashtags > MAX_HASHTAGS) {
      Alert.alert(`You can use up to ${MAX_HASHTAGS} hashtags.`);
      return;
    }
    if (counts.mentions > MAX_MENTIONS) {
      Alert.alert(`You can mention up to ${MAX_MENTIONS} people.`);
      return;
    }
    if (isSharing()) {
      Alert.alert(
        'Still posting',
        'Wait for your last post to finish sharing, then try again.',
      );
      return;
    }
    Keyboard.dismiss();
    sharePost(current);
    resetDraft();
    navigation.popTo('Main', { screen: 'Home' });
  };

  const photoAt = Math.min(photoIndex, Math.max(0, draft.items.length - 1));
  const photo = draft.items[photoAt];

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <AppBar
        title="New post"
        back
        actions={
          <Pressable
            onPress={share}
            disabled={!draft.items.length}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.shareBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.shareText, { color: colors.primary }]}>
              Share
            </Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {photo ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previews}
            >
              {draft.items.map((item, i) => (
                <Pressable
                  key={item.key}
                  onPress={() => setPhotoIndex(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === photoAt }}
                  accessibilityLabel={`Photo ${i + 1} of ${draft.items.length}`}
                  style={[
                    styles.preview,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor:
                        i === photoAt ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Image
                    source={{ uri: item.media.uri }}
                    style={styles.previewImage}
                  />
                  <LookTint id={item.filter} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {photo ? (
            <View style={styles.looks}>
              <LookStrip
                value={photo.filter || 'normal'}
                onChange={id =>
                  updateDraft(current => ({
                    items: current.items.map((item, i) =>
                      i === photoAt ? { ...item, filter: id } : item,
                    ),
                  }))
                }
              />
            </View>
          ) : null}

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.captionRow}>
              <Avatar
                uri={user?.avatar_url}
                name={user?.display_name ?? ''}
                size={38}
              />
              <TextInput
                multiline
                placeholder="Write a description…"
                placeholderTextColor={colors.textSecondary}
                maxLength={CAPTION_MAX}
                onChangeText={text => updateDraft({ caption: text })}
                onSelectionChange={e => {
                  setSelection(e.nativeEvent.selection);
                  setForcedSelection(undefined);
                }}
                selection={forcedSelection}
                autoCorrect
                accessibilityLabel="Description"
                style={[styles.captionInput, { color: colors.text }]}
              >
                <Text>
                  {segments.map((s, i) =>
                    s.type === 'text' ? (
                      s.text
                    ) : (
                      <Text key={i} style={{ color: colors.primary }}>
                        {s.text}
                      </Text>
                    ),
                  )}
                </Text>
              </TextInput>
            </View>
            <View
              style={[styles.captionFoot, { borderTopColor: colors.border }]}
            >
              <Text style={[styles.footText, { color: colors.textSecondary }]}>
                Add #tags and @mentions
              </Text>
              <Text style={[styles.footText, { color: colors.textSecondary }]}>
                {caption.length}/{CAPTION_MAX}
              </Text>
            </View>
          </View>

          {photo?.media.kind === 'image' ? (
            <FilterFrame adjustments={draft.adjustments} style={styles.look}>
              <Image
                source={{ uri: photo.media.uri }}
                style={styles.look}
                blurRadius={Math.round((draft.adjustments?.blur ?? 0) / 8)}
              />
              <LookTint id={photo.filter} />
            </FilterFrame>
          ) : null}

          {active ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {loading && !suggestions ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.suggestLoader}
                />
              ) : !suggestions?.items.length ? (
                <Text style={[styles.noMatch, { color: colors.textSecondary }]}>
                  {token?.trigger === '#'
                    ? 'New hashtag. Keep typing.'
                    : 'No matching people.'}
                </Text>
              ) : suggestions.type === 'users' ? (
                suggestions.items.map(u => (
                  <SuggestionRow
                    key={u.id}
                    onPress={() => choose(u.username)}
                    lead={
                      <Avatar
                        uri={u.avatar_url}
                        name={u.display_name}
                        size={36}
                      />
                    }
                    title={u.username}
                    subtitle={u.display_name}
                  />
                ))
              ) : (
                suggestions.items.map(t => (
                  <SuggestionRow
                    key={t.name}
                    onPress={() => choose(t.name)}
                    lead={
                      <View
                        style={[
                          styles.tagIcon,
                          { backgroundColor: colors.surfaceAlt },
                        ]}
                      >
                        <Hash size={18} color={colors.text} />
                      </View>
                    }
                    title={`#${t.name}`}
                    subtitle={`${t.post_count} post${
                      t.post_count === 1 ? '' : 's'
                    }`}
                  />
                ))
              )}
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <OptionRow
                  icon={<SlidersHorizontal size={20} color={colors.text} />}
                  title="Brightness and filters"
                  subtitle="Saved on the photo so everyone sees the same look"
                  onPress={() => setLookOpen(true)}
                />
                <OptionRow
                  icon={<MapPin size={20} color={colors.text} />}
                  title={draft.location || 'Add location'}
                  subtitle={
                    draft.location ? undefined : 'Show where this was taken'
                  }
                  onPress={() => setLocationOpen(true)}
                  trailing={
                    draft.location ? (
                      <Pressable
                        onPress={() =>
                          updateDraft({
                            location: '',
                            locationLat: null,
                            locationLng: null,
                          })
                        }
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Remove location"
                      >
                        <X size={18} color={colors.textSecondary} />
                      </Pressable>
                    ) : undefined
                  }
                />
                <OptionRow
                  icon={<UserPlus size={20} color={colors.text} />}
                  title="Tag people"
                  subtitle="Mentions are saved with the post"
                  onPress={() => setPeopleOpen(true)}
                />
                <OptionRow
                  icon={<Music size={20} color={colors.text} />}
                  title={draft.music || 'Add music'}
                  subtitle={
                    draft.music
                      ? 'Shown on this post'
                      : 'One song name for the post'
                  }
                  onPress={() => setMusicOpen(true)}
                  trailing={
                    draft.music ? (
                      <Pressable
                        onPress={() => updateDraft({ music: '' })}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Remove music"
                      >
                        <X size={18} color={colors.textSecondary} />
                      </Pressable>
                    ) : undefined
                  }
                />
                <OptionRow
                  icon={<Users size={20} color={colors.text} />}
                  title="Audience"
                  subtitle={
                    user?.is_private
                      ? 'Only your followers can see this post'
                      : 'Everyone can see this post'
                  }
                />
              </View>

              <Text style={[styles.section, { color: colors.textSecondary }]}>
                Advanced settings
              </Text>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <SwitchRow
                  icon={<Heart size={20} color={colors.text} />}
                  title="Hide like count"
                  subtitle="Only you will see the total number of likes."
                  value={draft.hideLikeCount}
                  onChange={v => updateDraft({ hideLikeCount: v })}
                />
                <SwitchRow
                  icon={<MessageCircleOff size={20} color={colors.text} />}
                  title="Turn off commenting"
                  subtitle="You can change this later from the post's menu."
                  value={draft.commentsDisabled}
                  onChange={v => updateDraft({ commentsDisabled: v })}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationSheet
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSelect={place =>
          updateDraft({
            location: place.name,
            locationLat: place.latitude,
            locationLng: place.longitude,
          })
        }
      />
      <AdjustSheet
        visible={lookOpen}
        value={draft.adjustments ?? ZERO_ADJUSTMENTS}
        onChange={adjustments => updateDraft({ adjustments })}
        onClose={() => setLookOpen(false)}
      />
      <MusicSheet
        visible={musicOpen}
        onClose={() => setMusicOpen(false)}
        onSelect={name => updateDraft({ music: name })}
      />
      <TagPeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onSelect={username => {
          const token = `@${username}`;
          if (draft.caption.includes(token)) return;
          const gap =
            draft.caption.length === 0 || draft.caption.endsWith(' ')
              ? ''
              : ' ';
          updateDraft({
            caption: `${draft.caption}${gap}${token} `.slice(0, CAPTION_MAX),
          });
        }}
      />
    </SafeAreaView>
  );
}

function SuggestionRow({
  lead,
  title,
  subtitle,
  onPress,
}: {
  lead: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [
        styles.suggestion,
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      {lead}
      <View style={styles.rowText}>
        <Text
          style={[styles.rowTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[styles.rowSub, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function OptionRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      {icon}
      <View style={styles.rowText}>
        <Text
          style={[styles.rowTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <ChevronRight size={18} color={colors.textSecondary} />
        ) : null)}
    </Pressable>
  );
}

function SwitchRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      {icon}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  shareBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  shareText: { fontSize: 16, fontWeight: '800' },
  content: { paddingBottom: spacing.xl },
  look: { height: 220, width: '100%' },
  previews: { gap: 8, paddingHorizontal: spacing.md, paddingVertical: 8 },
  preview: {
    width: 96,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
  },
  previewImage: { width: '100%', height: '100%' },
  looks: { paddingHorizontal: spacing.md, paddingBottom: 4 },
  card: {
    marginHorizontal: spacing.md,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  captionRow: { flexDirection: 'row', gap: 12, padding: 14 },
  captionInput: {
    flex: 1,
    minHeight: 76,
    maxHeight: 220,
    fontSize: 15.5,
    lineHeight: 22,
    paddingTop: 6,
    paddingBottom: 0,
    textAlignVertical: 'top',
  },
  captionFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footText: { fontSize: 12.5 },
  suggestLoader: { marginVertical: spacing.md },
  noMatch: { padding: 14, fontSize: 14 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: '700' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginHorizontal: spacing.md + 4,
  },
});
