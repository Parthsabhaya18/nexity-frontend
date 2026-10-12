import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';

import { parseCaption } from '@/features/posts/caption';
import { useAppTheme } from '@/theme';

/** Caption with tappable @mentions. */
export function CaptionText({
  username,
  caption,
  color,
  onUserPress,
  numberOfLines,
}: {
  username?: string;
  caption: string;
  color?: string;
  onUserPress?: (username: string) => void;
  numberOfLines?: number;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const segments = parseCaption(caption);
  return (
    <Text
      numberOfLines={numberOfLines}
      style={{ color: color ?? colors.text, fontSize: 14.5, lineHeight: 20 }}
    >
      {username ? <Text style={{ fontWeight: '700' }}>{username} </Text> : null}
      {segments.map((s, i) =>
        s.type === 'text' ? (
          s.text
        ) : (
          <Text
            key={i}
            style={{ color: colors.primary, fontWeight: '600' }}
            onPress={() =>
              onUserPress
                ? onUserPress(s.value)
                : navigation.navigate('UserProfile', { username: s.value })
            }
          >
            {s.text}
          </Text>
        ),
      )}
    </Text>
  );
}
