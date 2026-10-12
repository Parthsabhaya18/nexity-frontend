import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { settingsStyles } from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { radius, spacing, useAppTheme } from '@/theme';

const LEGAL: Record<
  'terms' | 'privacy',
  { title: string; body: [string, string][] }
> = {
  terms: {
    title: 'Terms of Service',
    body: [
      [
        'Who can use Nexity',
        'One person, one account. You must give accurate details when you sign up and keep your login details safe.',
      ],
      [
        'Be respectful',
        'Harassment, threats, hate speech, spam, or sexual content sent to someone who didn’t ask for it isn’t allowed and can lead to removal of your content or account.',
      ],
      [
        'Your content',
        'You own what you post. You give Nexity permission to store and display it to the audience you choose, such as your followers when your account is private.',
      ],
      [
        'Safety & enforcement',
        'We review reports and may remove content or disable accounts that break these terms. You can report posts, reels, stories, comments and profiles at any time.',
      ],
      [
        'Ending your account',
        'You can delete your account anytime from Settings → Account information. We may suspend accounts that put others at risk.',
      ],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      [
        'What we collect',
        'Your profile details, the content you share, your messages, and basic device information (platform and app version) needed to run the app and keep your account secure.',
      ],
      [
        'Who sees your content',
        'Public accounts are visible to everyone on Nexity. Private accounts are visible only to approved followers. People you block can’t find your profile, posts or stories.',
      ],
      [
        'Activity status',
        'People can see when you’re active or were last active. Turn this off anytime in Settings → Privacy.',
      ],
      [
        'Messages',
        'Your chats are visible only to the people in them. You choose who can message you in Settings → Privacy.',
      ],
      [
        'Your choices',
        'Change your privacy settings, see where you’re logged in, or delete your account at any time from Settings.',
      ],
    ],
  },
};

export function LegalScreen({ route }: ScreenProps<'Legal'>) {
  const { colors } = useAppTheme();
  const doc = LEGAL[route.params.doc] ?? LEGAL.terms;
  useStatusBar();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title={doc.title} back />
      <ScrollView contentContainerStyle={settingsStyles.content}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {doc.body.map(([heading, text]) => (
            <View key={heading} style={styles.section}>
              <Text
                style={[styles.heading, { color: colors.text }]}
                accessibilityRole="header"
              >
                {heading}
              </Text>
              <Text style={[styles.text, { color: colors.textSecondary }]}>
                {text}
              </Text>
            </View>
          ))}
          <Text style={[settingsStyles.fine, { color: colors.textSecondary }]}>
            Last updated 1 October 2026.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  section: { gap: 4 },
  heading: { fontSize: 15.5, fontWeight: '800' },
  text: { fontSize: 14, lineHeight: 21 },
});
