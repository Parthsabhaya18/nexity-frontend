import { Heart, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ActionSheet } from '@/components/ui/ActionSheet';
import { showToast } from '@/components/ui/Toast';
import { useCrushStatus } from '@/features/crush/crushQueries';
import { type CrushTarget, useCrushActions } from '@/features/crush/useCrushActions';
import { radius, useAppTheme } from '@/theme';

/** Profile heart: add as a Secret Crush, or (when already added) a private remove menu. */
export function CrushHeartButton({ user }: { user: CrushTarget }) {
  const { colors } = useAppTheme();
  const status = useCrushStatus(user.id).data?.state ?? 'none';
  const actions = useCrushActions();
  const [menu, setMenu] = useState(false);
  const on = status !== 'none';

  const onPress = () => {
    if (status === 'matched') {
      showToast("You're matched 💘 To end it, delete the chat or block them.", 'info');
    } else if (on) {
      setMenu(true);
    } else {
      actions.add(user);
    }
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          status === 'matched'
            ? 'Matched via Secret Crush'
            : on
            ? 'In your Secret Crushes. Options'
            : 'Add as a Secret Crush'
        }
        accessibilityState={{ selected: on }}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: on ? colors.primarySoft : colors.surfaceAlt,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Heart
          size={20}
          color={on ? colors.like : colors.text}
          fill={on ? colors.like : 'transparent'}
        />
      </Pressable>
      <ActionSheet
        visible={menu}
        title="This stays private. They'll only know if it's mutual."
        onClose={() => setMenu(false)}
        options={[
          {
            label: 'Remove from Secret Crushes',
            icon: <X size={22} color={colors.danger} />,
            destructive: true,
            // Waits for the sheet to close; two modals can't animate at once on iOS.
            onPress: () => setTimeout(() => actions.remove(user), 250),
          },
        ]}
      />
      {actions.element}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
