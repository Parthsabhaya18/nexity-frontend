import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { dropExpired } from '@/features/stories/expiry';
import { useOwnStoriesSeen } from '@/features/stories/storyEvents';
import { type StoryGroup, storiesApi } from '@/services/api/stories';
import { useAppTheme } from '@/theme';

const RING = 2;
const GAP = 2;

/** Live stories for the people this viewer can open, keyed by user id. */
export function useStoryRings(active: boolean) {
  const [stories, setStories] = useState<Map<string, StoryGroup>>(new Map());

  const reload = useCallback(() => {
    storiesApi
      .tray()
      .then(groups => {
        setStories(new Map(dropExpired(groups).map(g => [g.user.id, g])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (active) reload();
  }, [active, reload]);

  const markSeen = useCallback((userId: string) => {
    setStories(prev => {
      const group = prev.get(userId);
      if (!group) return prev;
      const next = new Map(prev);
      next.set(userId, {
        ...group,
        seen: true,
        stories: group.stories.map(story => ({ ...story, seen: true })),
      });
      return next;
    });
  }, []);

  return { stories, reload, markSeen };
}

/**
 * The same thin story ring as the home tray. Unseen is the brand colour;
 * a watched story keeps a muted ring.
 */
export function StoryRingAvatar({
  story,
  uri,
  name,
  size,
  onPress,
  label,
}: {
  story?: StoryGroup;
  uri?: string | null;
  name: string;
  size: number;
  onPress?: () => void;
  label: string;
}) {
  const { colors } = useAppTheme();
  const ownStoriesSeen = useOwnStoriesSeen();
  const unseen =
    !!story && !story.seen && !(story.user.is_self && ownStoriesSeen(story.stories));
  const photo = <Avatar uri={uri} name={name} size={size} />;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
    >
      {story ? (
        <View
          style={[
            styles.ring,
            {
              borderColor: unseen ? colors.primary : colors.border,
              borderRadius: (size + (RING + GAP) * 2) / 2,
            },
          ]}
        >
          {photo}
        </View>
      ) : (
        photo
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: RING, padding: GAP },
});
