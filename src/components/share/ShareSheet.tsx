import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Check,
  CirclePlus,
  Link,
  Search,
  Share2,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  LayoutAnimation,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/ui/Avatar';
import { PeopleGridSkeleton } from '@/components/skeleton/ScreenSkeletons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { errorText } from '@/features/entities/optimistic';
import type { RootStackParamList } from '@/navigation/types';
import type { ChatUser } from '@/services/api/chat';
import { type ShareKind, shareLink, sharesApi } from '@/services/api/shares';
import { radius, spacing, useAppTheme } from '@/theme';

/** What the story preview shows: the first photo/video of a post, or the reel's video. */
export type SharePreview = {
  url: string;
  video: boolean;
  username: string;
  avatar_url: string | null;
  caption: string;
  aspect_ratio: number;
};
export type ShareTarget = {
  kind: ShareKind;
  id: string;
  /** Photo/video of a multi-photo post that was on screen; that one is shared. */
  media_index?: number;
  /** Posts and reels only; without it there is no "Add to story". */
  preview?: SharePreview;
  /** Overrides the default link (profiles use their own URL). */
  link?: string;
};

const AVATAR = 64;
const ROW_HEIGHT = 112;
const HEADER_HEIGHT = 84;
const FOOTER_HEIGHT = 112;
const SEARCH_DEBOUNCE_MS = 250;
const WHATSAPP = '#25D366';
const DRAG = 12;
/** Handle + search row, measured from the top of the sheet. */
const GRAB_HEIGHT = 76;
const FLING = 0.5;
const COPIED_MS = 3000;

/** WhatsApp's logo (white phone in a speech bubble). */
function WhatsAppLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#FFFFFF"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
      />
    </Svg>
  );
}

/**
 * Instagram-style share sheet for a post or reel: pick people to send it to in
 * their chat (with an optional note), or add it to your story, copy the link,
 * send it on WhatsApp, or use the system share.
 */
export function ShareSheet({
  target,
  onClose,
}: {
  target: ShareTarget | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ChatUser[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboard(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboard(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const visible = !!target;

  useEffect(() => {
    if (visible) return;
    setExpanded(false);
    setQuery('');
    setSelected([]);
    setNote('');
    setPeople(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        sharesApi
          .targets(query.trim(), controller.signal)
          .then(setPeople)
          .catch(() => {
            if (!controller.signal.aborted) setPeople(p => p ?? []);
          });
      },
      query ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, query]);

  const resize = (next: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(next);
  };

  const collapsedHeight =
    HEADER_HEIGHT + ROW_HEIGHT * 2 + FOOTER_HEIGHT + insets.bottom + spacing.sm;
  // With the keyboard up the sheet stays full height and pinned to the top;
  // the keyboard covers its bottom instead of pushing it off screen.
  const sheetHeight =
    expanded || keyboard > 0
      ? height - insets.top - spacing.sm
      : Math.min(collapsedHeight, height - insets.top - spacing.sm);
  const keyboardInset = Math.max(0, keyboard - insets.bottom - spacing.sm);

  const listOffset = useRef(0);
  const latest = useRef({ expanded, resize, onClose, sheetTop: height - sheetHeight });
  latest.current = { expanded, resize, onClose, sheetTop: height - sheetHeight };
  const drag = useMemo(
    () =>
      PanResponder.create({
        // Capture so the drag wins over the people list, the search box and the buttons.
        onMoveShouldSetPanResponderCapture: (evt, g) => {
          if (Math.abs(g.dy) <= DRAG || Math.abs(g.dy) <= Math.abs(g.dx)) return false;
          const now = latest.current;
          if (!now.expanded) return true;
          // Full height: the list scrolls, so only pull down from its top or from the handle/search.
          const onGrab = evt.nativeEvent.pageY - now.sheetTop < GRAB_HEIGHT;
          return g.dy > 0 && (onGrab || listOffset.current <= 0);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          const now = latest.current;
          if (g.dy < -DRAG * 2 || g.vy < -FLING) now.resize(true);
          else if (g.dy > DRAG * 3 || g.vy > FLING) {
            if (now.expanded) now.resize(false);
            else now.onClose();
          }
        },
      }),
    [],
  );

  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  useEffect(() => {
    if (visible) return;
    clearTimeout(copiedTimer.current);
    setCopied(false);
  }, [visible]);

  if (!target) return null;
  const link = target.link ?? shareLink(target.kind, target.id);

  const toggle = (id: string) =>
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const send = async () => {
    if (busy || !selected.length) return;
    setBusy(true);
    try {
      await sharesApi.send({
        kind: target.kind,
        id: target.id,
        user_ids: selected,
        body: note.trim(),
        media_index: target.media_index ?? 0,
      });
      showToast('Sent', 'success');
      onClose();
    } catch (err) {
      showToast(errorText(err, "Couldn't send. Please try again."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const storyKind = target.kind === 'profile' ? null : target.kind;
  const addToStory = () => {
    if (!storyKind || !target.preview) return;
    onClose();
    navigation.navigate('ShareStory', {
      kind: storyKind,
      id: target.id,
      media_index: target.media_index ?? 0,
      ...target.preview,
    });
  };

  const copyLink = () => {
    Clipboard.setString(link);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const whatsApp = () => {
    const text = encodeURIComponent(link);
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${text}`).catch(() =>
        showToast("WhatsApp isn't available on this phone.", 'error'),
      ),
    );
  };

  const systemShare = () => {
    Share.share({ message: link }).catch(() => {});
  };

  const actions = [
    ...(storyKind && target.preview
      ? [{ key: 'story', label: 'Add to story', icon: <CirclePlus size={21} color={colors.text} />, onPress: addToStory }]
      : []),
    {
      key: 'copy',
      label: copied ? 'Copied' : 'Copy link',
      icon: copied ? (
        <Check size={21} color={colors.text} strokeWidth={2.5} />
      ) : (
        <Link size={19} color={colors.text} />
      ),
      onPress: copyLink,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <WhatsAppLogo size={26} />,
      onPress: whatsApp,
      background: WHATSAPP,
    },
    { key: 'share', label: 'Share', icon: <Share2 size={19} color={colors.text} />, onPress: systemShare },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      hideHandle
      style={{ height: sheetHeight }}
    >
      <View style={[styles.fill, { paddingBottom: keyboardInset }]} {...drag.panHandlers}>
        <View style={styles.handleZone}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.searchRow}>
          <View style={[styles.search, { backgroundColor: colors.inputBackground }]}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => resize(true)}
              placeholder="Search"
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.text }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
        </View>

        {people === null ? (
          <PeopleGridSkeleton avatar={AVATAR} rowHeight={ROW_HEIGHT} />
        ) : (
          <FlatList
            data={people}
            keyExtractor={u => u.id}
            numColumns={3}
            scrollEnabled={expanded}
            onScroll={e => {
              listOffset.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                {query ? 'No one found.' : 'Follow people or chat with them to send them posts.'}
              </Text>
            }
            renderItem={({ item }) => {
              const on = selected.includes(item.id);
              return (
                <Pressable
                  onPress={() => toggle(item.id)}
                  style={styles.person}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={item.display_name}
                >
                  <View>
                    <Avatar uri={item.avatar_url} name={item.display_name} size={AVATAR} />
                    {on ? (
                      <View
                        style={[
                          styles.check,
                          { backgroundColor: colors.primary, borderColor: colors.surfaceElevated },
                        ]}
                      >
                        <Check size={13} color={colors.onButton} strokeWidth={3} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}

        {keyboard > 0 && !selected.length ? null : (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {selected.length ? (
            <View style={styles.compose}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Write a message..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.note, { color: colors.text }]}
                maxLength={2000}
              />
              <Button
                title={selected.length > 1 ? 'Send separately' : 'Send'}
                onPress={send}
                loading={busy}
                disabled={busy}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              {actions.map(a => (
                <Pressable
                  key={a.key}
                  onPress={a.onPress}
                  disabled={busy}
                  style={styles.action}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <View
                    style={[
                      styles.actionIcon,
                      { backgroundColor: a.background ?? colors.surfaceAlt },
                    ]}
                  >
                    {a.icon}
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={2}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  grid: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  person: { flex: 1 / 3, height: ROW_HEIGHT, alignItems: 'center', paddingTop: 6, gap: 6 },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 12.5, textAlign: 'center', paddingHorizontal: 4 },
  empty: { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
  },
  action: { width: 70, alignItems: 'center', gap: 5 },
  handleZone: { alignItems: 'center', paddingBottom: spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 11.5, textAlign: 'center' },
  compose: { paddingHorizontal: spacing.md, gap: spacing.sm },
  note: { fontSize: 15, paddingVertical: 8 },
});
