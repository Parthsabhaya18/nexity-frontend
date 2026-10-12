import type { Album } from '@react-native-camera-roll/camera-roll';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@react-native-camera-roll/camera-roll', () => ({ CameraRoll: {} }));
jest.mock('react-native-video', () => () => null);
jest.mock('../src/services/media/photoPermission', () => ({}));

const { mediaQuery, previewSize, settleSheet, toAlbumOptions } =
  require('../src/components/chat/GallerySheet') as typeof import('../src/components/chat/GallerySheet');
const { formatDuration } =
  require('../src/components/chat/MediaPreview') as typeof import('../src/components/chat/MediaPreview');

const album = (over: Partial<Album>): Album => ({
  id: over.title ?? 'x',
  title: 'x',
  count: 1,
  type: 'Album',
  ...over,
});

describe('toAlbumOptions', () => {
  it('keeps non-empty albums, biggest first, without duplicates', () => {
    const options = toAlbumOptions([
      album({ title: 'WhatsApp Images', count: 40 }),
      album({ title: 'Camera', count: 300 }),
      album({ title: 'Empty', count: 0 }),
      album({ title: 'Camera', count: 300 }),
      album({ title: 'Screenshots', count: 75 }),
    ]);
    expect(options.map(o => o.title)).toEqual(['Camera', 'Screenshots', 'WhatsApp Images']);
  });

  it('keeps iOS smart albums openable', () => {
    const options = toAlbumOptions([
      album({ id: '1', title: 'Favorites', count: 12, type: 'SmartAlbum' }),
      album({ id: '2', title: 'Trip', count: 30, type: 'Album' }),
    ]);
    expect(options.find(o => o.title === 'Favorites')?.groupType).toBe('SmartAlbum');
    expect(options.find(o => o.title === 'Trip')?.groupType).toBe('Album');
  });
});

describe('mediaQuery', () => {
  const camera = { key: 'c', title: 'Camera', count: 3, groupType: 'Album' as const };

  it('filters by media type for Recents, Photos and Videos', () => {
    expect(mediaQuery({ kind: 'recents' })).toEqual({ assetType: 'All' });
    expect(mediaQuery({ kind: 'photos' })).toEqual({ assetType: 'Photos' });
    expect(mediaQuery({ kind: 'videos' })).toEqual({ assetType: 'Videos' });
  });

  it('matches Android albums by folder name only, iOS by type and name', () => {
    expect(mediaQuery({ kind: 'album', album: camera }, 'android')).toEqual({
      assetType: 'All',
      groupName: 'Camera',
    });
    expect(mediaQuery({ kind: 'album', album: camera }, 'ios')).toEqual({
      assetType: 'All',
      groupTypes: 'Album',
      groupName: 'Camera',
    });
  });
});

describe('settleSheet', () => {
  const g = { collapsedY: 400, full: 800 };

  it('snaps to the nearest resting point on a slow release', () => {
    expect(settleSheet({ ...g, position: 120, velocity: 0 })).toBe('expanded');
    expect(settleSheet({ ...g, position: 300, velocity: 0 })).toBe('collapsed');
    expect(settleSheet({ ...g, position: 460, velocity: 0 })).toBe('collapsed');
    expect(settleSheet({ ...g, position: 560, velocity: 0 })).toBe('hidden');
  });

  it('follows a fling: up expands, down steps toward closed', () => {
    expect(settleSheet({ ...g, position: 380, velocity: -2 })).toBe('expanded');
    expect(settleSheet({ ...g, position: 100, velocity: 2 })).toBe('collapsed');
    expect(settleSheet({ ...g, position: 420, velocity: 2 })).toBe('hidden');
  });
});

describe('formatDuration', () => {
  it('formats short and long videos', () => {
    expect(formatDuration(7)).toBe('0:07');
    expect(formatDuration(62.9)).toBe('1:02');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
});

describe('previewSize', () => {
  it('fits a portrait photo by height and a landscape photo by width, keeping the shape', () => {
    const portrait = previewSize({ width: 1000, height: 3000 }, 400, 800);
    expect(portrait.height).toBe(640);
    expect(portrait.width / portrait.height).toBeCloseTo(1 / 3, 2);

    const landscape = previewSize({ width: 4000, height: 3000 }, 400, 800);
    expect(landscape.width).toBe(376);
    expect(landscape.width / landscape.height).toBeCloseTo(4 / 3, 1);
  });

  it('falls back to the screen box when the size is unknown', () => {
    expect(previewSize({ width: 0, height: 0 }, 400, 800)).toEqual({ width: 376, height: 640 });
  });
});
