import { useNavigation } from '@react-navigation/native';
import { EyeOff, Heart } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { showToast } from '@/components/ui/Toast';
import { useSubscription } from '@/features/secret/secretQueries';
import { ApiError } from '@/services/api/client';
import { secretCrushApi } from '@/services/api/secretCrush';
import { spacing, useAppTheme } from '@/theme';

import { openCelebration } from './celebration';
import { refreshCrush, useCrushSummary } from './crushQueries';

export type CrushTarget = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

const firstName = (u: CrushTarget) => u.display_name.trim().split(/\s+/)[0] || u.username;

function errorText(err: unknown) {
  if (err instanceof ApiError) {
    if (err.isNetworkError) return "You're offline. Try again when you're connected.";
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Every way into "Add a Secret Crush" goes through here: Free opens Plans, full spots show the
 * limit dialog, otherwise the confirm sheet. A match opens the celebration.
 */
export function useCrushActions(opts?: { replace?: boolean }) {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const sub = useSubscription().data;
  const summary = useCrushSummary().data;
  const [confirm, setConfirm] = useState<CrushTarget | null>(null);
  const [removing, setRemoving] = useState<CrushTarget | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const spots = summary?.spots.limit ?? sub?.limits.crush_spots ?? 0;
  const canAdd = spots > 0;
  const left = summary?.spots.left ?? spots;
  const premium = (summary?.plan ?? sub?.plan) === 'premium';

  const gate = useCallback(() => {
    if (!canAdd) {
      navigation.navigate('Plans', { reason: 'crush' });
      return false;
    }
    if (left <= 0) {
      setLimitOpen(true);
      return false;
    }
    return true;
  }, [canAdd, left, navigation]);

  const openPicker = useCallback(() => {
    if (gate()) navigation.navigate('SecretPeoplePicker', { intent: 'crush' });
  }, [gate, navigation]);

  const add = useCallback(
    (user: CrushTarget) => {
      if (gate()) setConfirm(user);
    },
    [gate],
  );

  const commitAdd = async () => {
    const user = confirm;
    if (!user || busy) return;
    setBusy(true);
    try {
      const res = await secretCrushApi.add(user.id);
      setConfirm(null);
      refreshCrush().catch(() => {});
      if (res.matched && res.match) {
        if (opts?.replace) navigation.goBack();
        openCelebration(res.match.id);
      } else {
        showToast('Added to Secret Crush 👀', 'success');
        if (opts?.replace) navigation.goBack();
      }
    } catch (err) {
      setConfirm(null);
      if (err instanceof ApiError && err.code === 'PLAN_REQUIRED') {
        navigation.navigate('Plans', { reason: 'crush' });
      } else if (err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED') {
        setLimitOpen(true);
      } else {
        showToast(errorText(err), 'error');
      }
      refreshCrush().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const commitRemove = async () => {
    const user = removing;
    if (!user || busy) return;
    setBusy(true);
    try {
      await secretCrushApi.remove(user.id);
      showToast('Removed from Secret Crushes', 'info');
    } catch (err) {
      showToast(errorText(err), 'error');
    } finally {
      setBusy(false);
      setRemoving(null);
      refreshCrush().catch(() => {});
    }
  };

  const element = (
    <>
      <BottomSheet visible={!!confirm} onClose={() => !busy && setConfirm(null)}>
        {confirm ? (
          <View style={styles.sheet}>
            <View style={styles.art} accessibilityElementsHidden>
              <Avatar uri={confirm.avatar_url} name={confirm.display_name} size={84} />
              <View
                style={[
                  styles.heart,
                  { backgroundColor: colors.like, borderColor: colors.surfaceElevated },
                ]}
              >
                <Heart size={15} color={colors.onButton} fill={colors.onButton} />
              </View>
            </View>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              Add {firstName(confirm)} as a Secret Crush?
            </Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              {firstName(confirm)} will get{' '}
              <Text style={styles.italic}>"Someone added you as a Secret Crush 👀"</Text>.
              They'll only find out it's you if they add you too.
            </Text>
            <View style={styles.points}>
              <View style={styles.point}>
                <EyeOff size={16} color={colors.primary} />
                <Text style={[styles.pointText, { color: colors.text }]}>
                  Your name is never shown unless it's mutual
                </Text>
              </View>
              <View style={styles.point}>
                <Heart size={16} color={colors.primary} />
                <Text style={[styles.pointText, { color: colors.text }]}>
                  Mutual? You both get a match and a love chat
                </Text>
              </View>
            </View>
            <Button
              title="Add Secret Crush 💘"
              onPress={commitAdd}
              loading={busy}
              style={styles.stretch}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setConfirm(null)}
              disabled={busy}
              style={styles.stretch}
            />
          </View>
        ) : null}
      </BottomSheet>
      <ConfirmDialog
        visible={!!removing}
        title={`Remove ${removing ? firstName(removing) : ''} from your crushes?`}
        message="They'll never know you added or removed them."
        confirmLabel="Remove"
        destructive
        loading={busy}
        onConfirm={commitRemove}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        visible={limitOpen}
        title={`You've used all ${spots} Secret Crush spots`}
        message={
          premium
            ? 'Spots free up when you remove someone.'
            : 'Go Premium for up to 10 Secret Crushes.'
        }
        confirmLabel={premium ? 'OK' : 'Upgrade to Premium'}
        cancelLabel="Not now"
        onCancel={() => setLimitOpen(false)}
        onConfirm={() => {
          setLimitOpen(false);
          if (!premium) navigation.navigate('Plans', { reason: 'limit' });
        }}
      />
    </>
  );

  return {
    canAdd,
    spots,
    left,
    openPicker,
    add,
    remove: (user: CrushTarget) => setRemoving(user),
    element,
  };
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, alignItems: 'center', gap: 10 },
  art: { marginTop: 4, marginBottom: 4 },
  heart: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  italic: { fontStyle: 'italic' },
  points: { alignSelf: 'stretch', gap: 8, marginVertical: 4 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { flex: 1, fontSize: 14 },
  stretch: { alignSelf: 'stretch' },
});
