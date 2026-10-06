import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StoryViewer } from '@/components/stories/StoryViewer';
import { Avatar } from '@/components/ui/Avatar';
import { dropExpired, msUntilNextExpiry } from '@/features/stories/expiry';
import { onStoryShared } from '@/features/stories/storyEvents';
import { type StoryGroup, storiesApi } from '@/services/api/stories';
import { useAppTheme } from '@/theme';

type Props = {
  /** The profile's user id; `self` matches the signed-in user's own stories. */
  userId: string;
  self?: boolean;
  username: string;
  avatarUrl?: string | null;
  name: string;
  size: number;
  /** Opens the full profile photo. Used on tap when there is no story, and on long press. */
  onShowPhoto: () => void;
};

const RING = 3;
const GAP = 3;

/**
 * Profile photo with a ring while the person has a live story. Tapping opens
 * the story; long press (or tapping with no story) shows the photo.
 */
export function StoryAvatar({
  userId,
  self,
  username,
  avatarUrl,
  name,
  size,
  onShowPhoto,
}: Props) {
  const { colors } = useAppTheme();
  const [group, setGroup] = useState<StoryGroup | null>(null);
  const [viewing, setViewing] = useState(false);

  const load = useCallback(() => {
    storiesApi
      .tray()
      .then(groups => {
        const found = dropExpired(groups).find(g =>
          self ? g.user.is_self : g.user.id === userId,
        );
        setGroup(found ?? null);
      })
      .catch(() => {});
  }, [self, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => onStoryShared(load), [load]);

  // The ring goes away by itself when the last story's 24 hours end.
  useEffect(() => {
    if (!group || viewing) return;
    const wait = msUntilNextExpiry([group]);
    if (wait === null) return;
    const timer = setTimeout(() => {
      const [live] = dropExpired([group]);
      setGroup(live ?? null);
    }, wait + 500);
    return () => clearTimeout(timer);
  }, [group, viewing]);

  const unseen = !!group && (self || !group.seen);
  const ringColor = group ? (unseen ? colors.primary : colors.border) : 'transparent';

  return (
    <>
      <Pressable
        onPress={group ? () => setViewing(true) : onShowPhoto}
        onLongPress={group ? onShowPhoto : undefined}
        accessibilityRole="button"
        accessibilityLabel={
          group ? `View @${username}'s story` : `View @${username}'s profile photo`
        }
        accessibilityHint={group ? 'Long press to see the profile photo' : undefined}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View
          style={[
            styles.ring,
            {
              borderColor: ringColor,
              borderRadius: (size + 2 * (RING + GAP)) / 2,
            },
          ]}
        >
          <Avatar uri={avatarUrl} name={name} size={size} />
        </View>
      </Pressable>
      {group ? (
        <StoryViewer
          groups={[group]}
          startIndex={viewing ? 0 : null}
          onChanged={load}
          onClose={() => {
            setViewing(false);
            load();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: RING, padding: GAP },
  pressed: { opacity: 0.7 },
});
