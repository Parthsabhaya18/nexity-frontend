import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  ScrollView,
  View,
  type FlatListProps,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Scrollable = {
  scrollTo?: (opts: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
};

type DragOptions = {
  onClose: () => void;
  onDragDown?: () => void;
  onDragUp?: () => void;
  /** False when the inner list must not scroll, such as a half-open share sheet. */
  contentScrolls?: boolean;
};

type Api = {
  onClose: () => void;
  onDragDown?: () => void;
  onDragUp?: () => void;
  contentScrolls: boolean;
  offset: number;
  gesturing: boolean;
  scrollTo: ((y: number) => void) | null;
};

type ScrollCtx = {
  scrollEnabled: boolean;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  bind: (scrollTo: ((y: number) => void) | null) => () => void;
  handleHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
};

const Ctx = createContext<ScrollCtx | null>(null);

/**
 * Pull-down on a sheet. A list that is not at the top keeps scrolling; once it
 * is stuck at the top, the next downward pull runs `onDragDown` or `onClose`.
 * Native scrolling is turned off at the top so the sheet can take that pull.
 */
export function useSheetDrag({
  onClose,
  onDragDown,
  onDragUp,
  contentScrolls = true,
}: DragOptions) {
  const dragY = useRef(new Animated.Value(0)).current;
  const api = useRef<Api>({
    onClose,
    onDragDown,
    onDragUp,
    contentScrolls,
    offset: 0,
    gesturing: false,
    scrollTo: null,
  });
  api.current.onClose = onClose;
  api.current.onDragDown = onDragDown;
  api.current.onDragUp = onDragUp;
  api.current.contentScrolls = contentScrolls;

  const [nativeScroll, setNativeScroll] = useState(false);
  useEffect(() => {
    if (!contentScrolls) setNativeScroll(false);
    else setNativeScroll(api.current.offset > 1);
  }, [contentScrolls]);
  const syncNative = useCallback((y: number, gesturing: boolean) => {
    api.current.offset = y;
    if (gesturing) return;
    const allow = api.current.contentScrolls && y > 1;
    setNativeScroll(prev => (prev === allow ? prev : allow));
  }, []);

  const releaseDrag = useCallback(
    (dy: number, vy: number) => {
      const now = api.current;
      now.gesturing = false;
      const pulledDown = dy > 36 || (vy > 0.55 && dy > 8);
      if (pulledDown) {
        dragY.setValue(0);
        (now.onDragDown ?? now.onClose)();
      } else {
        if ((dy < -24 || vy < -0.5) && now.onDragUp && !now.contentScrolls) now.onDragUp();
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      }
      const allow = now.contentScrolls && now.offset > 1;
      setNativeScroll(prev => (prev === allow ? prev : allow));
    },
    [dragY],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => {
          const vertical = Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx);
          if (!vertical) return false;
          const now = api.current;
          return !now.contentScrolls || now.offset <= 1;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          api.current.gesturing = true;
          dragY.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          const now = api.current;
          if (now.contentScrolls && now.scrollTo) {
            const y = Math.max(0, -g.dy);
            now.scrollTo(y);
            now.offset = y;
            dragY.setValue(g.dy > 0 ? g.dy : 0);
            return;
          }
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => releaseDrag(g.dy, g.vy),
        onPanResponderTerminate: (_, g) => releaseDrag(g.dy, g.vy),
      }),
    [dragY, releaseDrag],
  );

  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          api.current.gesturing = true;
          dragY.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => releaseDrag(g.dy, g.vy),
        onPanResponderTerminate: (_, g) => releaseDrag(g.dy, g.vy),
      }),
    [dragY, releaseDrag],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncNative(e.nativeEvent.contentOffset.y, api.current.gesturing);
    },
    [syncNative],
  );

  const bind = useCallback((scrollTo: ((y: number) => void) | null) => {
    api.current.scrollTo = scrollTo;
    return () => {
      if (api.current.scrollTo === scrollTo) api.current.scrollTo = null;
    };
  }, []);

  const value = useMemo<ScrollCtx>(
    () => ({
      scrollEnabled: nativeScroll,
      onScroll,
      bind,
      handleHandlers: handlePan.panHandlers,
    }),
    [nativeScroll, onScroll, bind, handlePan.panHandlers],
  );

  return { panHandlers: pan.panHandlers, dragY, value };
}

export function SheetScrollProvider({
  value,
  children,
}: {
  value: ScrollCtx;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Props for the one vertical list inside a sheet. */
export function useSheetScroll(ref: RefObject<Scrollable | null>) {
  const ctx = useContext(Ctx);
  useLayoutEffect(() => {
    if (!ctx) return;
    return ctx.bind(y => {
      const node = ref.current;
      if (!node) return;
      if (typeof node.scrollToOffset === 'function') {
        node.scrollToOffset({ offset: Math.max(0, y), animated: false });
      } else node.scrollTo?.({ y: Math.max(0, y), animated: false });
    });
  }, [ctx, ref]);

  if (!ctx) return { scrollEnabled: undefined, onScroll: undefined, locked: false };
  return {
    scrollEnabled: ctx.scrollEnabled,
    onScroll: ctx.onScroll,
    locked: !ctx.scrollEnabled,
  };
}

/** Grab handle. Pulling it always collapses or closes, even mid-list. */
export function useSheetHandle() {
  return useContext(Ctx)?.handleHandlers;
}

export function SheetHandle({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const handle = useSheetHandle();
  return (
    <View {...handle} style={style}>
      {children}
    </View>
  );
}

function useScrollLock(
  ref: RefObject<Scrollable | null>,
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
) {
  const sheet = useSheetScroll(ref);
  return {
    scrollEnabled: sheet.scrollEnabled,
    bounces: false as const,
    overScrollMode: 'never' as const,
    scrollEventThrottle: 16 as const,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      sheet.onScroll?.(e);
      onScroll?.(e);
    },
  };
}

type AnyListRef = { current: unknown };

/** FlatList that yields a downward pull to the sheet once it is scrolled to the top. */
export function SheetFlatList<T>({
  listRef,
  ...props
}: FlatListProps<T> & { listRef?: AnyListRef }) {
  const local = useRef<Scrollable | null>(null);
  const lock = useScrollLock(local, props.onScroll);
  return (
    <FlatList
      {...props}
      {...lock}
      ref={node => {
        local.current = node;
        if (listRef) listRef.current = node;
      }}
    />
  );
}

/** ScrollView that yields a downward pull to the sheet once it is scrolled to the top. */
export function SheetScrollView({
  listRef,
  ...props
}: ScrollViewProps & { listRef?: AnyListRef }) {
  const local = useRef<Scrollable | null>(null);
  const lock = useScrollLock(local, props.onScroll);
  return (
    <ScrollView
      {...props}
      {...lock}
      ref={node => {
        local.current = node;
        if (listRef) listRef.current = node;
      }}
    />
  );
}
