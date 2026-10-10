import { useFocusEffect } from '@react-navigation/native';
import {
  CheckCircle2,
  Clock3,
  ImageOff,
  Maximize2,
  Send,
  X,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { settingsStyles } from '@/components/settings/SettingsParts';
import { AppBar } from '@/components/ui/AppBar';
import { IconButton } from '@/components/ui/IconButton';
import { SafeAreaView } from '@/components/ui/SafeAreaView';
import type { ScreenProps } from '@/navigation/types';
import { useStatusBar } from '@/navigation/useStatusBar';
import { type SupportTicket, supportApi } from '@/services/api/support';
import { radius, spacing, useAppTheme } from '@/theme';
import { clockTime, fullDate } from '@/utils/time';

/** Portrait screenshots would otherwise fill several screens. */
const SHOT_MAX_HEIGHT = 440;
/** Shape of each cell when a request has several screenshots. */
const GRID_RATIO = 0.75;

const when = (iso: string) =>
  `${fullDate(iso)} · ${clockTime(Date.parse(iso))}`;

export function TicketStatusBadge({
  status,
}: {
  status: SupportTicket['status'];
}) {
  const { colors } = useAppTheme();
  const resolved = status === 'resolved';
  const color = resolved ? colors.success : colors.primary;
  const Icon = resolved ? CheckCircle2 : Clock3;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: resolved ? colors.successSoft : colors.primarySoft },
      ]}
    >
      <Icon size={13} color={color} strokeWidth={2.4} />
      <Text style={[styles.badgeText, { color }]}>
        {resolved ? 'Resolved' : 'In review'}
      </Text>
    </View>
  );
}

export function SupportTicketScreen({ route }: ScreenProps<'SupportTicket'>) {
  const { colors } = useAppTheme();
  const [ticket, setTicket] = useState(route.params.ticket);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  useStatusBar();

  const load = useCallback(
    () =>
      supportApi
        .ticket(route.params.ticket.id)
        .then(setTicket)
        .catch(() => {}),
    [route.params.ticket.id],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shots = ticket.screenshot_urls ?? [];
  const resolved = ticket.status === 'resolved';
  const steps = [
    {
      icon: Send,
      title: 'Request sent',
      detail: when(ticket.created_at),
      done: true,
    },
    {
      icon: Clock3,
      title: 'In review',
      detail: resolved
        ? 'Our team looked into it'
        : 'Our team is looking into it. We usually reply within 24 hours.',
      done: true,
    },
    {
      icon: CheckCircle2,
      title: 'Resolved',
      detail: resolved ? when(ticket.updated_at) : 'Not yet',
      done: resolved,
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppBar title={`Request #${ticket.reference}`} back />
      <ScrollView
        contentContainerStyle={settingsStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.headRow}>
            <Text style={[styles.subject, { color: colors.text }]}>
              {ticket.subject}
            </Text>
            <TicketStatusBadge status={ticket.status} />
          </View>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            #{ticket.reference} · {when(ticket.created_at)}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.section, { color: colors.textSecondary }]}>
            STATUS
          </Text>
          {steps.map((step, i) => {
            const Icon = step.icon;
            const last = i === steps.length - 1;
            const tone = step.done ? colors.primary : colors.textSecondary;
            return (
              <View key={step.title} style={styles.step}>
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: step.done
                          ? colors.primarySoft
                          : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <Icon size={15} color={tone} strokeWidth={2.4} />
                  </View>
                  {last ? null : (
                    <View
                      style={[
                        styles.line,
                        {
                          backgroundColor: steps[i + 1].done
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    />
                  )}
                </View>
                <View style={[styles.stepBody, last && styles.stepLast]}>
                  <Text
                    style={[
                      styles.stepTitle,
                      { color: step.done ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {step.title}
                  </Text>
                  <Text
                    style={[styles.stepDetail, { color: colors.textSecondary }]}
                  >
                    {step.detail}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.section, { color: colors.textSecondary }]}>
            YOUR MESSAGE
          </Text>
          <Text style={[styles.message, { color: colors.text }]} selectable>
            {ticket.message}
          </Text>
        </View>

        {shots.length ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              {shots.length === 1 ? 'SCREENSHOT' : `SCREENSHOTS (${shots.length})`}
            </Text>
            <View style={styles.shotGrid}>
              {shots.map((uri, i) => (
                <View
                  key={uri}
                  style={shots.length === 1 ? styles.shotSingle : styles.shotCell}
                >
                  <Screenshot
                    uri={uri}
                    fixedRatio={shots.length === 1 ? undefined : GRID_RATIO}
                    onOpen={() => setViewer(i)}
                    onRetry={load}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ImageViewer
        uris={shots}
        index={viewer}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

function Screenshot({
  uri,
  fixedRatio,
  onOpen,
  onRetry,
}: {
  uri: string;
  /** Grid cells share one shape; a single screenshot keeps its own. */
  fixedRatio?: number;
  onOpen: () => void;
  onRetry: () => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <Pressable
        onPress={async () => {
          setFailed(false);
          await onRetry();
          setAttempt(a => a + 1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Retry loading the screenshot"
        style={[styles.shotFailed, { backgroundColor: colors.surfaceAlt }]}
      >
        <ImageOff size={22} color={colors.textSecondary} />
        <Text style={[styles.stepDetail, { color: colors.textSecondary }]}>
          Couldn't load the screenshot. Tap to retry.
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="imagebutton"
      accessibilityLabel="Open screenshot"
      style={({ pressed }) => [
        styles.shotFrame,
        { backgroundColor: colors.surfaceAlt },
        { aspectRatio: fixedRatio ?? ratio ?? GRID_RATIO },
        pressed && styles.pressed,
      ]}
    >
      <Image
        key={attempt}
        source={{ uri }}
        style={styles.shotImage}
        resizeMode={fixedRatio ? 'cover' : 'contain'}
        onLoad={e => {
          const { width, height } = e.nativeEvent.source;
          if (width && height) setRatio(width / height);
        }}
        onError={() => setFailed(true)}
      />
      {ratio == null ? (
        <View style={styles.shotLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={[styles.expand, { backgroundColor: colors.overlay }]}>
          <Maximize2 size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

function ImageViewer({
  uris,
  index,
  onClose,
}: {
  uris: string[];
  /** Screenshot to open on; `null` hides the viewer. */
  index: number | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const visible = index != null && uris.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={() => setPage(index ?? 0)}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.viewer}>
        <FlatList
          data={uris}
          keyExtractor={uri => uri}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(index ?? 0, uris.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={[styles.viewerImage, { width }]}
              resizeMode="contain"
            />
          )}
        />
        {uris.length > 1 ? (
          <Text style={[styles.viewerCount, { top: insets.top + 20 }]}>
            {page + 1} / {uris.length}
          </Text>
        ) : null}
        <IconButton
          onPress={onClose}
          accessibilityLabel="Close"
          style={{ ...styles.viewerClose, top: insets.top + 8 }}
        >
          <X size={24} color="#FFFFFF" />
        </IconButton>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subject: { flex: 1, fontSize: 17, fontWeight: '800' },
  meta: { fontSize: 12.5, marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  section: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center' },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, minHeight: 14, marginVertical: 3 },
  stepBody: { flex: 1, paddingTop: 4, paddingBottom: spacing.md },
  stepLast: { paddingBottom: 0 },
  stepTitle: { fontSize: 14.5, fontWeight: '700' },
  stepDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  message: { fontSize: 14.5, lineHeight: 21 },
  shotFrame: {
    width: '100%',
    alignSelf: 'center',
    maxHeight: SHOT_MAX_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  shotImage: { width: '100%', height: '100%' },
  shotLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expand: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotFailed: {
    height: 120,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.85 },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerImage: { height: '100%' },
  viewerCount: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shotSingle: { width: '100%' },
  shotCell: { width: '48%' },
  viewerClose: { position: 'absolute', right: 8 },
});
