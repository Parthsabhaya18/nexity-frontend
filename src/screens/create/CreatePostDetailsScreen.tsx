import {
  ChevronRight,
  Heart,
  MapPin,
  MessageCircleOff,
  UserPlus,
  X,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';

import { FilterFrame } from '@/components/create/FilterFrame';
import { LocationSheet } from '@/components/posts/LocationSheet';
import { MentionInput } from '@/components/posts/MentionInput';
import { TagPeopleSheet } from '@/components/posts/TagPeopleSheet';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { useAuth } from '@/features/auth/AuthProvider';
import { CAPTION_MAX, countMentions, MAX_MENTIONS } from '@/features/posts/caption';
import { isSharing, sharePost } from '@/features/posts/postComposer';
import {
  aspectRatioOf,
  getDraft,
  resetDraft,
  updateDraft,
  usePostDraft,
} from '@/features/posts/postDraft';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

/** Step 2 of "New post": description, location, tagged people and settings. */
export function CreatePostDetailsScreen({
  navigation,
}: ScreenProps<'CreatePostDetails'>) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const draft = usePostDraft();
  const [locationOpen, setLocationOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [page, setPage] = useState(0);
  useStatusBar();

  const ratio = aspectRatioOf(draft.aspect, draft.items[0]?.media);
  // Full width; very tall frames are capped so the form stays in view.
  const previewHeight = Math.min(width / ratio, width);

  const share = () => {
    const current = getDraft();
    if (!current.items.length) return;
    if (countMentions(current.caption) > MAX_MENTIONS) {
      Alert.alert(`You can mention up to ${MAX_MENTIONS} people.`);
      return;
    }
    if (isSharing()) {
      Alert.alert('Still posting', 'Wait for your last post to finish sharing, then try again.');
      return;
    }
    Keyboard.dismiss();
    sharePost(current);
    resetDraft();
    navigation.popTo('Main', { screen: 'Home' });
  };

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
            style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
          >
            <Text style={[styles.shareText, { color: colors.primary }]}>Share</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ height: previewHeight, backgroundColor: colors.surfaceAlt }}>
            <FlatList
              data={draft.items}
              keyExtractor={i => i.key}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e =>
                setPage(Math.round(e.nativeEvent.contentOffset.x / width))
              }
              renderItem={({ item, index }) => (
                <FilterFrame
                  adjustments={draft.adjustments}
                  style={{ width, height: previewHeight }}
                >
                  {item.media.kind === 'video' ? (
                    <Video
                      source={{ uri: item.media.uri }}
                      style={{ width, height: previewHeight }}
                      resizeMode="cover"
                      repeat
                      muted
                      paused={index !== page}
                    />
                  ) : (
                    <Image
                      source={{ uri: item.media.uri }}
                      style={{ width, height: previewHeight }}
                      resizeMode="cover"
                      blurRadius={Math.round((draft.adjustments?.blur ?? 0) / 8)}
                      accessibilityLabel={`Photo ${index + 1}`}
                    />
                  )}
                </FilterFrame>
              )}
            />
            {draft.items.length > 1 ? (
              <View style={styles.counter} pointerEvents="none">
                <Text style={styles.counterText}>
                  {page + 1}/{draft.items.length}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.captionRow, { borderBottomColor: colors.border }]}>
            <Avatar uri={user?.avatar_url} name={user?.display_name ?? ''} size={36} />
            <View style={styles.flex}>
              <MentionInput
                value={draft.caption}
                onChange={text => updateDraft({ caption: text })}
                placeholder="Write a description… Type @ to mention someone"
                maxLength={CAPTION_MAX}
                accessibilityLabel="Description"
              />
            </View>
          </View>

          <Row
            icon={<MapPin size={22} color={colors.text} />}
            title="Add location"
            onPress={() => setLocationOpen(true)}
          >
            {draft.location ? (
              <Chip
                label={draft.location}
                onPress={() => setLocationOpen(true)}
                onRemove={() =>
                  updateDraft({ location: '', locationLat: null, locationLng: null })
                }
                removeLabel="Remove location"
              />
            ) : null}
          </Row>

          <Row
            icon={<UserPlus size={22} color={colors.text} />}
            title="Tag people"
            onPress={() => setPeopleOpen(true)}
          >
            {draft.tagged.length ? (
              <View style={styles.chips}>
                {draft.tagged.map(u => (
                  <Chip
                    key={u.id}
                    label={u.username}
                    avatar={u.avatar_url}
                    name={u.display_name}
                    onRemove={() =>
                      updateDraft(d => ({ tagged: d.tagged.filter(t => t.id !== u.id) }))
                    }
                    removeLabel={`Remove ${u.username}`}
                  />
                ))}
              </View>
            ) : null}
          </Row>

          <Text style={[styles.section, { color: colors.textSecondary }]}>
            Settings
          </Text>
          <ToggleRow
            icon={<Heart size={22} color={colors.text} />}
            title="Hide like count"
            subtitle="No one, including you, will see the number of likes on this post."
            value={draft.hideLikeCount}
            onChange={v => updateDraft({ hideLikeCount: v })}
          />
          <ToggleRow
            icon={<MessageCircleOff size={22} color={colors.text} />}
            title="Turn off commenting"
            subtitle="You can change this later from the post's ⋯ menu."
            value={draft.commentsDisabled}
            onChange={v => updateDraft({ commentsDisabled: v })}
          />
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
      <TagPeopleSheet
        visible={peopleOpen}
        selected={draft.tagged}
        onClose={() => setPeopleOpen(false)}
        onDone={people => updateDraft({ tagged: people })}
      />
    </SafeAreaView>
  );
}

function Row({
  icon,
  title,
  onPress,
  children,
}: {
  icon: ReactNode;
  title: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.rowWrap, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        {icon}
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <ChevronRight size={18} color={colors.textSecondary} />
      </Pressable>
      {children ? <View style={styles.rowExtra}>{children}</View> : null}
    </View>
  );
}

function Chip({
  label,
  avatar,
  name,
  onPress,
  onRemove,
  removeLabel,
}: {
  label: string;
  avatar?: string | null;
  name?: string;
  onPress?: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={styles.chipBody}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Change ${label}` : label}
      >
        {name !== undefined ? <Avatar uri={avatar} name={name} size={22} /> : null}
        <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        style={[styles.chipX, { backgroundColor: colors.border }]}
      >
        <X size={12} color={colors.text} />
      </Pressable>
    </View>
  );
}

function ToggleRow({
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
    <View style={styles.toggleRow}>
      {icon}
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Toggle value={value} onChange={onChange} accessibilityLabel={title} />
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
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  counterText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  captionRow: {
    flexDirection: 'row',
    gap: 12,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
  },
  rowTitle: { flex: 1, fontSize: 15.5, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  rowExtra: { paddingHorizontal: spacing.md, paddingBottom: 12, paddingLeft: spacing.md + 36 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius.full,
    paddingLeft: 10,
    paddingRight: 6,
    height: 34,
    gap: 6,
  },
  chipBody: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  chipText: { fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
  chipX: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: 4,
    marginHorizontal: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
});
