import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SettingsGroup, settingsStyles } from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

const FAQ: [string, string][] = [
  [
    'How do I make my account private?',
    'Go to Settings → Privacy and turn on Private account. New followers will need your approval, and only approved followers see your posts, reels and stories. Turning it off accepts every pending request.',
  ],
  [
    'How do I control who can message me?',
    'In Settings → Privacy, under "Who can message you", choose People you follow. Others can\'t start a chat with you, but anyone you message first can reply.',
  ],
  [
    'Can I hide when I was last active?',
    'Yes. Turn off Show activity status in Settings → Privacy. Nobody will see "Active now" or when you were last active.',
  ],
  [
    'How do I report or block someone?',
    'Tap ••• on a profile, post, reel or story and choose Report or Block. They\'re never told. You can unblock people anytime in Settings → Blocked accounts.',
  ],
  [
    'I don\'t recognise a login. What should I do?',
    'Open Settings → Login & security, log out the device you don\'t recognise, then change your password. Changing your password logs out every other device.',
  ],
  [
    'How do I change the app\'s look?',
    'In Settings → Theme, pick Light, Dark or System, or choose a Mood to colour the whole app. Tap the mood again to remove it.',
  ],
  [
    'How do I delete my account?',
    'Go to Settings → Account information → Delete account and enter your password. Your profile, posts and followers are removed and this can\'t be undone.',
  ],
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen(o => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.question,
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <Text style={[styles.questionText, { color: colors.text }]}>{q}</Text>
        {open ? (
          <ChevronUp size={18} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={18} color={colors.textSecondary} />
        )}
      </Pressable>
      {open ? (
        <Text style={[styles.answer, { color: colors.textSecondary }]}>{a}</Text>
      ) : null}
    </View>
  );
}

export function HelpCenterScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  useStatusBar();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title="Help center" back />
      <ScrollView contentContainerStyle={settingsStyles.content}>
        <SettingsGroup title="Frequently asked">
          {FAQ.map(([q, a]) => (
            <FaqItem key={q} q={q} a={a} />
          ))}
        </SettingsGroup>
        <View
          style={[
            styles.cta,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.ctaTitle, { color: colors.text }]}>
            Still need help?
          </Text>
          <Text style={[styles.ctaText, { color: colors.textSecondary }]}>
            Our team usually replies within 24 hours.
          </Text>
          <Button
            title="Contact us"
            onPress={() => navigation.navigate('ContactUs')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  questionText: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  answer: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  cta: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  ctaTitle: { fontSize: 16, fontWeight: '800' },
  ctaText: { fontSize: 13.5, marginBottom: 6 },
});
