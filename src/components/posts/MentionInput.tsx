import { type ComponentRef, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import {
  activeToken,
  applySuggestion,
  CAPTION_MAX,
} from '@/features/posts/caption';
import { useMentionSuggestions } from '@/features/posts/useCaptionSuggestions';
import { radius, useAppTheme } from '@/theme';

type Props = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  accessibilityLabel: string;
  inputStyle?: StyleProp<TextStyle>;
};

/**
 * Multi-line text box that offers up to five people when the user types `@`
 * and inserts the chosen @username at the cursor.
 */
export function MentionInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  maxLength = CAPTION_MAX,
  accessibilityLabel,
  inputStyle,
}: Props) {
  const { colors } = useAppTheme();
  const [cursor, setCursor] = useState(value.length);
  const [forced, setForced] = useState<{ start: number; end: number } | undefined>();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const token = activeToken(value, cursor);
  const mentions = useMentionSuggestions(token);

  const pick = (username: string) => {
    if (!token) return;
    const next = applySuggestion(value, token, username);
    onChange(next.text);
    setCursor(next.cursor);
    // Move the caret behind the inserted name, then hand control back.
    setForced({ start: next.cursor, end: next.cursor });
    setTimeout(() => setForced(undefined), 50);
    input.current?.focus();
  };

  return (
    <View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={text => {
          onChange(text);
          setCursor(c => Math.min(text.length, Math.max(c, 0)));
        }}
        onSelectionChange={e => setCursor(e.nativeEvent.selection.end)}
        selection={forced}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline
        autoFocus={autoFocus}
        maxLength={maxLength}
        textAlignVertical="top"
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { color: colors.text }, inputStyle]}
      />
      {value.length > maxLength * 0.9 ? (
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {value.length}/{maxLength}
        </Text>
      ) : null}
      {mentions.active ? (
        <View
          style={[
            styles.list,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {mentions.users === null ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : mentions.users.length === 0 ? (
            <Text style={[styles.none, { color: colors.textSecondary }]}>
              {mentions.loading ? 'Searching…' : 'No one found'}
            </Text>
          ) : (
            mentions.users.map(u => (
              <Pressable
                key={u.id}
                onPress={() => pick(u.username)}
                accessibilityRole="button"
                accessibilityLabel={`Mention ${u.username}`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Avatar uri={u.avatar_url} name={u.display_name} size={34} />
                <View style={styles.names}>
                  <Text
                    style={[styles.username, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {u.username}
                  </Text>
                  <Text
                    style={[styles.name, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {u.display_name}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 16, minHeight: 72, padding: 0 },
  count: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  list: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  loader: { paddingVertical: 14 },
  none: { paddingVertical: 14, textAlign: 'center', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  names: { flex: 1, minWidth: 0 },
  username: { fontSize: 14, fontWeight: '700' },
  name: { fontSize: 13 },
});
