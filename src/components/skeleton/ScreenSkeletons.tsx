import {
  type DimensionValue,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import {
  SkeletonCircle,
  SkeletonDarkTone,
  SkeletonGroup,
  SkeletonImage,
  SkeletonListItem,
  SkeletonRect,
  SkeletonText,
} from '@/components/skeleton/Skeleton';
import { spacing } from '@/theme';

/** Varied widths so a list of bones doesn't read as a striped block. */
const TITLE_WIDTHS: DimensionValue[] = ['44%', '36%', '52%', '30%', '40%', '48%'];
const SUBTITLE_WIDTHS: DimensionValue[] = ['28%', '34%', '22%', '30%', '26%', '20%'];

/** Matches `PostCard`: header, square media, action row, likes, caption, time. */
export function PostCardSkeleton() {
  const { width } = useWindowDimensions();
  return (
    <View>
      <View style={styles.postHead}>
        <SkeletonCircle size={34} />
        <SkeletonText width={110} height={12} />
      </View>
      <SkeletonImage width={width} height={width} />
      <View style={styles.postActions}>
        <SkeletonCircle size={26} />
        <SkeletonCircle size={26} />
        <SkeletonCircle size={24} />
        <View style={styles.flex} />
        <SkeletonCircle size={26} />
      </View>
      <View style={styles.postText}>
        <SkeletonText width={90} height={12} />
        <SkeletonText width="85%" height={11} />
        <SkeletonText width={60} height={9} />
      </View>
    </View>
  );
}

export function FeedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <SkeletonGroup label="Loading posts">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </SkeletonGroup>
  );
}

/** Matches `ReelItem`: action rail on the right, author and caption bottom-left. */
export function ReelSkeleton({ bottomInset }: { bottomInset: number }) {
  return (
    <SkeletonDarkTone>
      <SkeletonGroup label="Loading reels" style={styles.fill}>
        <View style={[styles.reelSide, { bottom: bottomInset + 20 }]}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={styles.reelAction}>
              <SkeletonCircle size={30} />
              {i < 2 ? <SkeletonText width={22} height={9} /> : null}
            </View>
          ))}
        </View>
        <View style={[styles.reelInfo, { bottom: bottomInset + 20 }]}>
          <View style={styles.reelAuthor}>
            <SkeletonCircle size={34} />
            <SkeletonText width={110} height={13} />
          </View>
          <SkeletonText width="80%" height={11} />
          <SkeletonText width="55%" height={11} />
        </View>
      </SkeletonGroup>
    </SkeletonDarkTone>
  );
}

const GRID_GAP = 2;

/** Three-column tiles, as in `PostGrid` / `ReelGrid`. */
export function PostGridSkeleton({
  size,
  count = 9,
  tileHeight,
}: {
  size: number;
  count?: number;
  tileHeight?: number;
}) {
  return (
    <SkeletonGroup label="Loading posts" style={styles.grid}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonImage key={i} width={size} height={tileHeight ?? size} />
      ))}
    </SkeletonGroup>
  );
}

/** Matches the `UserProfileScreen` header, tabs and the first rows of the grid. */
export function ProfileSkeleton() {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - GRID_GAP * 2) / 3);
  return (
    <SkeletonGroup label="Loading profile">
      <View style={styles.profileHead}>
        <View style={styles.profileTop}>
          <SkeletonCircle size={84} />
          <View style={styles.profileStats}>
            {Array.from({ length: 3 }, (_, i) => (
              <View key={i} style={styles.profileStat}>
                <SkeletonText width={28} height={16} />
                <SkeletonText width={52} height={10} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.profileInfo}>
          <SkeletonText width={140} height={14} />
          <SkeletonText width="75%" height={11} />
        </View>
        <View style={styles.profileActions}>
          <SkeletonRect height={36} radius={10} style={styles.flex} />
          <SkeletonRect height={36} radius={10} style={styles.flex} />
        </View>
      </View>
      <View style={styles.profileTabs}>
        <SkeletonRect width={24} height={24} radius={6} />
        <SkeletonRect width={24} height={24} radius={6} />
      </View>
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonImage key={i} width={tile} height={tile} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

/** Matches `ChatRow` in the inbox. */
export function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonGroup label="Loading chats">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListItem
          key={i}
          avatar={54}
          titleWidth={TITLE_WIDTHS[i % TITLE_WIDTHS.length]}
          subtitleWidth={`${45 + ((i * 13) % 25)}%`}
          style={styles.chatRow}
        />
      ))}
    </SkeletonGroup>
  );
}

const BUBBLES: { mine: boolean; width: number; height: number }[] = [
  { mine: false, width: 180, height: 38 },
  { mine: false, width: 120, height: 38 },
  { mine: true, width: 200, height: 38 },
  { mine: false, width: 230, height: 58 },
  { mine: true, width: 140, height: 38 },
  { mine: true, width: 90, height: 38 },
  { mine: false, width: 160, height: 38 },
  { mine: true, width: 210, height: 58 },
];

/**
 * Left and right bubbles, newest at the bottom like the thread itself.
 * `older` is the short strip shown while scrolling back through history.
 */
export function ChatThreadSkeleton({ older = false }: { older?: boolean }) {
  return (
    <SkeletonGroup
      label={older ? 'Loading earlier messages' : 'Loading messages'}
      style={older ? styles.threadOlder : styles.thread}
    >
      {(older ? BUBBLES.slice(0, 3) : BUBBLES).map((b, i) => (
        <View
          key={i}
          style={[styles.bubbleRow, b.mine ? styles.bubbleMine : styles.bubbleTheirs]}
        >
          {!b.mine ? <SkeletonCircle size={28} /> : null}
          <SkeletonRect width={b.width} height={b.height} radius={18} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Matches `NotificationRow` under a section title. */
export function NotificationListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonGroup label="Loading notifications">
      <SkeletonText width={70} height={14} style={styles.groupTitle} />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.notifRow}>
          <SkeletonCircle size={46} />
          <View style={styles.notifBody}>
            <SkeletonText width={`${70 + ((i * 11) % 25)}%`} height={12} />
            <SkeletonText width={SUBTITLE_WIDTHS[i % SUBTITLE_WIDTHS.length]} height={10} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Rows like `UserRow`: avatar, username, display name, optional trailing button. */
export function UserListSkeleton({
  rows = 8,
  avatar = 48,
  button = false,
  rowStyle,
}: {
  rows?: number;
  avatar?: number;
  button?: boolean;
  /** The real row's padding when it differs from `UserRow`. */
  rowStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SkeletonGroup>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListItem
          key={i}
          avatar={avatar}
          titleWidth={TITLE_WIDTHS[i % TITLE_WIDTHS.length]}
          subtitleWidth={SUBTITLE_WIDTHS[i % SUBTITLE_WIDTHS.length]}
          trailing={
            button ? <SkeletonRect width={86} height={32} radius={8} /> : undefined
          }
          style={rowStyle}
        />
      ))}
    </SkeletonGroup>
  );
}

/**
 * Matches `CommentRow`: small avatar, body lines, the time/Reply meta row.
 * `inset={false}` inside the comment list, which already has the side padding.
 */
export function CommentListSkeleton({
  rows = 6,
  inset = true,
}: {
  rows?: number;
  inset?: boolean;
}) {
  return (
    <SkeletonGroup
      label={inset ? 'Loading comments' : 'Loading more comments'}
      style={inset ? styles.comments : undefined}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.commentRow}>
          <SkeletonCircle size={32} />
          <View style={styles.commentBody}>
            <SkeletonText width={`${60 + ((i * 17) % 35)}%`} height={11} />
            {i % 2 === 0 ? <SkeletonText width="45%" height={11} /> : null}
            <View style={styles.commentMeta}>
              <SkeletonText width={24} height={9} />
              <SkeletonText width={32} height={9} />
            </View>
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Three-up avatars with a name under each, as in the share sheet. */
export function PeopleGridSkeleton({
  avatar,
  rowHeight,
  rows = 2,
}: {
  avatar: number;
  rowHeight: number;
  rows?: number;
}) {
  return (
    <SkeletonGroup label="Loading people" style={styles.people}>
      {Array.from({ length: rows * 3 }, (_, i) => (
        <View key={i} style={[styles.person, { height: rowHeight }]}>
          <SkeletonCircle size={avatar} />
          <SkeletonText width={`${50 + ((i * 7) % 20)}%`} height={10} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Square tiles for photo pickers and GIF grids. */
export function MediaGridSkeleton({
  columns,
  size,
  gap,
  count,
  rounded = 0,
  captions = false,
  rowGap,
}: {
  columns: number;
  size: number;
  gap: number;
  count?: number;
  rounded?: number;
  /** Album tiles: a name and a count under each cover. */
  captions?: boolean;
  rowGap?: number;
}) {
  return (
    <SkeletonGroup
      label="Loading media"
      style={[styles.wrap, { columnGap: gap, rowGap: rowGap ?? gap }]}
    >
      {Array.from({ length: count ?? columns * 4 }, (_, i) =>
        captions ? (
          <View key={i} style={[styles.album, { width: size }]}>
            <SkeletonImage width={size} height={size} radius={rounded} />
            <SkeletonText width="70%" height={11} />
            <SkeletonText width="35%" height={9} />
          </View>
        ) : (
          <SkeletonImage key={i} width={size} height={size} radius={rounded} />
        ),
      )}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { ...StyleSheet.absoluteFill },
  postHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.sm,
    paddingTop: 8,
  },
  postText: { gap: 8, paddingHorizontal: spacing.sm, marginTop: 10, marginBottom: 14 },
  reelSide: { position: 'absolute', right: 8, alignItems: 'center', gap: 6 },
  reelAction: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 6 },
  reelInfo: { position: 'absolute', left: 12, right: 76, gap: 10 },
  reelAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  album: { gap: 7 },
  profileHead: { paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 4 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  profileStats: { flex: 1, flexDirection: 'row' },
  profileStat: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 6 },
  profileInfo: { gap: 8, marginTop: 14, marginBottom: 14 },
  profileActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: 14 },
  profileTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  chatRow: { paddingVertical: 10, paddingHorizontal: spacing.sm, minHeight: 0 },
  thread: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  threadOlder: { gap: 8, paddingVertical: spacing.sm },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleMine: { justifyContent: 'flex-end' },
  bubbleTheirs: { justifyContent: 'flex-start' },
  groupTitle: { marginTop: 14, marginBottom: 10, paddingHorizontal: spacing.sm },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  notifBody: { flex: 1, gap: 8 },
  people: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm },
  person: { width: '33.33%', alignItems: 'center', paddingTop: 6, gap: 10 },
  comments: { flex: 1, paddingHorizontal: spacing.md },
  commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  commentBody: { flex: 1, gap: 7 },
  commentMeta: { flexDirection: 'row', gap: 14, marginTop: 2 },
});
