import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALT_TEXT_MAX } from '@/features/posts/caption';
import type { DraftItem } from '@/features/posts/postDraft';
import { radius, spacing, useAppTheme } from '@/theme';

type Props = {
  visible: boolean;
  items: DraftItem[];
  onClose: () => void;
  onSave: (altTexts: Record<string, string>) => void;
};

/** Per-photo descriptions read by VoiceOver and TalkBack. */
export function AltTextSheet({ visible, items, onClose, onSave }: Props) {
  const { colors } = useAppTheme();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setValues(Object.fromEntries(items.map(i => [i.key, i.altText])));
    }
  }, [visible, items]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.headerText, { color: colors.text }]}>
              Cancel
            </Text>
          </Pressable>
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            Alt text
          </Text>
          <Pressable
            onPress={() => {
              onSave(values);
              onClose();
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.headerText,
                styles.done,
                { color: colors.primary },
              ]}
            >
              Done
            </Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.intro, { color: colors.textSecondary }]}>
              Alt text describes your photos for people with visual impairments.
              If you leave it empty, nothing is read out.
            </Text>
            {items.map((item, i) => (
              <View key={item.key} style={styles.row}>
                <Image source={{ uri: item.media.uri }} style={styles.thumb} />
                <TextInput
                  value={values[item.key] ?? ''}
                  onChangeText={text =>
                    setValues(v => ({ ...v, [item.key]: text }))
                  }
                  placeholder="Write alt text…"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={ALT_TEXT_MAX}
                  multiline
                  accessibilityLabel={`Alt text for photo ${i + 1}`}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { fontSize: 16 },
  done: { fontWeight: '800' },
  title: { fontSize: 17, fontWeight: '800' },
  content: { padding: spacing.md, gap: spacing.md },
  intro: { fontSize: 13.5, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  input: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
