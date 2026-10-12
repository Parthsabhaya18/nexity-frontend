import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  getFileSize,
  getImageMetaData,
  getVideoMetaData,
  Image as ImageCompressor,
  Video as VideoCompressor,
} from 'react-native-compressor';

import { sweepUploadCache } from '@/features/media/localFiles';
import { pendingUploads } from '@/features/media/uploadJournal';
import { resolveContentType } from '@/features/media/mediaRules';
import {
  type LocalMedia,
  MediaError,
  validateMedia,
} from '@/features/media/pickMedia';
import {
  discardUploadSession,
  UploadCancelledError,
  uploadMedia,
  type UploadSession,
} from '@/features/media/uploadMedia';
import { ApiError } from '@/services/api/client';
import { mediaApi } from '@/services/api/media';

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    wrap: jest.fn((path: string) => `ReactNativeBlobUtil-file://${path}`),
    fs: {
      dirs: { CacheDir: '/cache', DocumentDir: '/app/Documents' },
      stat: jest.fn(),
      exists: jest.fn(() => Promise.resolve(true)),
      unlink: jest.fn(() => Promise.resolve()),
      isDir: jest.fn(() => Promise.resolve(true)),
      mkdir: jest.fn(() => Promise.resolve()),
      slice: jest.fn((_src: string, dest: string) => Promise.resolve(dest)),
      lstat: jest.fn(() => Promise.resolve([])),
      readFile: jest.fn(() => Promise.resolve('[]')),
      writeFile: jest.fn(() => Promise.resolve()),
      mv: jest.fn(() => Promise.resolve()),
      cp: jest.fn(() => Promise.resolve()),
    },
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-compressor', () => ({
  Image: { compress: jest.fn() },
  Video: { compress: jest.fn(), cancelCompression: jest.fn() },
  getFileSize: jest.fn(),
  getImageMetaData: jest.fn(),
  getVideoMetaData: jest.fn(),
}));

jest.mock('@/services/api/media', () => ({
  mediaApi: {
    createUpload: jest.fn(),
    partUrls: jest.fn(),
    listParts: jest.fn(),
    complete: jest.fn(),
    remove: jest.fn(() => Promise.resolve()),
  },
}));

const api = mediaApi as jest.Mocked<typeof mediaApi>;
const blob = ReactNativeBlobUtil as unknown as {
  fetch: jest.Mock;
  fs: Record<
    'stat' | 'exists' | 'unlink' | 'slice' | 'lstat' | 'mv' | 'cp' | 'writeFile',
    jest.Mock
  >;
};
const imageCompress = ImageCompressor.compress as jest.Mock;
const videoCompress = VideoCompressor.compress as jest.Mock;

const MB = 1024 * 1024;

const photo: LocalMedia = {
  uri: 'content://media/picker/1',
  kind: 'image',
  contentType: 'image/heic',
  fileName: 'IMG_0001.HEIC',
  bytes: 40 * MB,
  width: 8000,
  height: 6000,
};

const longVideo: LocalMedia = {
  uri: 'file:///cache/clip.mov',
  kind: 'video',
  contentType: 'video/quicktime',
  fileName: 'clip.mov',
  bytes: 1200 * MB,
  width: 3840,
  height: 2160,
  durationMs: 115_000,
};

const hourLongVideo: LocalMedia = { ...longVideo, durationMs: 60 * 60 * 1000 };

describe('resolveContentType', () => {
  it('normalises picker types and falls back to the extension', () => {
    expect(resolveContentType('image/jpg')).toBe('image/jpeg');
    expect(resolveContentType('video/quicktime')).toBe('video/quicktime');
    expect(resolveContentType(undefined, 'clip.MOV')).toBe('video/quicktime');
    expect(resolveContentType('application/octet-stream', 'a.heic')).toBe(
      'image/heic',
    );
    expect(resolveContentType('image/gif', 'a.gif')).toBeNull();
  });
});

describe('validateMedia', () => {
  it('never rejects for size, only for the wrong kind or length', () => {
    expect(() => validateMedia(photo, 'avatar')).not.toThrow();
    expect(() => validateMedia(longVideo, 'reel')).not.toThrow();
    expect(() => validateMedia(photo, 'reel')).toThrow(MediaError);
  });

  it("applies Instagram's video lengths per purpose", () => {
    const at = (ms: number) => ({ ...longVideo, durationMs: ms });
    expect(() => validateMedia(at(120_400), 'reel')).not.toThrow();
    expect(() => validateMedia(at(122_000), 'reel')).toThrow(
      'Reels can be up to 2 minutes. Choose a shorter video.',
    );
    expect(() => validateMedia(at(120_000), 'story')).not.toThrow();
    expect(() => validateMedia(at(125_000), 'story')).toThrow(
      'Story videos can be up to 2 minutes.',
    );
    expect(() => validateMedia(at(120_000), 'post')).not.toThrow();
    expect(() => validateMedia(at(130_000), 'post')).toThrow(
      'Videos in a post can be up to 2 minutes.',
    );
    expect(() => validateMedia(at(120_000), 'message')).not.toThrow();
    expect(() => validateMedia(hourLongVideo, 'message')).toThrow(
      'Videos in messages can be up to 2 minutes. Choose a shorter video.',
    );
  });
});

type FakeXhr = {
  status: number;
  responseText: string;
  body?: FormData;
  upload: { onprogress?: (e: object) => void };
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  open: jest.Mock;
  abort: () => void;
  send: (body: FormData) => void;
};

let xhr: FakeXhr;
let respond: (x: FakeXhr) => void;

beforeEach(() => {
  jest.clearAllMocks();
  respond = x => {
    x.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    x.status = 204;
    x.onload?.();
  };
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest =
    jest.fn(() => {
      xhr = {
        status: 0,
        responseText: '',
        upload: {},
        open: jest.fn(),
        abort() {
          this.onabort?.();
        },
        send(body) {
          this.body = body;
          respond(this);
        },
      };
      return xhr;
    });

  const sizes: Record<string, number> = {
    '/cache/compressed.jpg': 412000,
    '/cache/compressed.mp4': 95 * MB,
    '/cache/clip.mov': 300 * MB,
  };
  blob.fs.stat.mockImplementation(async (path: string) => ({
    size: sizes[path] ?? 0,
  }));
  blob.fs.exists.mockResolvedValue(true);

  imageCompress.mockResolvedValue('file:///cache/compressed.jpg');
  (getFileSize as jest.Mock).mockResolvedValue('412000');
  (getImageMetaData as jest.Mock).mockResolvedValue({
    ImageWidth: 2048,
    ImageHeight: 1536,
    size: 412000,
  });
  videoCompress.mockImplementation(
    async (_uri: string, _opts: object, onProgress?: (p: number) => void) => {
      onProgress?.(0.5);
      return 'file:///cache/compressed.mp4';
    },
  );
  (getVideoMetaData as jest.Mock).mockResolvedValue({
    size: 95 * MB,
    duration: 1500,
    width: 1280,
    height: 720,
  });

  api.createUpload.mockResolvedValue({
    media: { id: 'm1' } as never,
    upload: {
      method: 'post',
      url: 'https://bucket.s3.amazonaws.com/',
      fields: { key: 'media/posts/u/m1.jpg', Policy: 'p' },
      expires_at: '2030-01-01T00:00:00Z',
    },
  });
  api.complete.mockResolvedValue({ id: 'm1', status: 'ready' } as never);
});

const partNames = (form: FormData) =>
  Array.from((form as unknown as { keys(): Iterable<string> }).keys());

describe('uploadMedia', () => {
  it('compresses a huge photo to JPEG, posts fields before the file, then completes', async () => {
    const progress: number[] = [];
    const phases: string[] = [];
    const asset = await uploadMedia(photo, 'post', {
      onProgress: f => progress.push(f),
      onPhase: p => phases.push(p),
    });

    expect(asset).toEqual({ id: 'm1', status: 'ready' });
    expect(imageCompress).toHaveBeenCalledWith(
      photo.uri,
      expect.objectContaining({ maxWidth: 1440, output: 'jpg' }),
    );
    expect(api.createUpload).toHaveBeenCalledWith(
      {
        purpose: 'post',
        content_type: 'image/jpeg',
        bytes: 412000,
        width: 2048,
        height: 1536,
        duration_ms: undefined,
        client_upload_id: expect.stringMatching(/^cu-[\w-]{8,}$/),
      },
      undefined,
    );
    expect(xhr.open).toHaveBeenCalledWith(
      'POST',
      'https://bucket.s3.amazonaws.com/',
    );
    expect(partNames(xhr.body!)).toEqual(['key', 'Policy', 'file']);
    expect(phases).toEqual(['processing', 'uploading']);
    expect(progress.some(p => Math.abs(p - 0.5) < 1e-9)).toBe(true);
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('compresses a 1.2 GB 4K reel to 720p without any error', async () => {
    const progress: number[] = [];
    await uploadMedia(longVideo, 'reel', { onProgress: f => progress.push(f) });

    expect(videoCompress).toHaveBeenCalledWith(
      longVideo.uri,
      expect.objectContaining({ maxSize: 1280 }),
      expect.any(Function),
    );
    expect(api.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'reel',
        content_type: 'video/mp4',
        bytes: 95 * MB,
        width: 1280,
        duration_ms: 115_000,
      }),
      undefined,
    );
    expect(progress).toContain(0.2);
  });

  it('compresses chat videos to 720p and refuses anything over 2 minutes', async () => {
    await expect(uploadMedia(hourLongVideo, 'message')).rejects.toThrow(
      'Videos in messages can be up to 2 minutes.',
    );
    expect(videoCompress).not.toHaveBeenCalled();

    await uploadMedia({ ...hourLongVideo, durationMs: 90_000 }, 'message');
    expect(videoCompress).toHaveBeenCalledWith(
      hourLongVideo.uri,
      expect.objectContaining({ maxSize: 1280 }),
      expect.any(Function),
    );
  });

  it('reads the length when the picker omits it and refuses an over-long reel before compressing', async () => {
    (getVideoMetaData as jest.Mock).mockResolvedValueOnce({ duration: 240 });
    await expect(
      uploadMedia({ ...longVideo, durationMs: undefined }, 'reel'),
    ).rejects.toThrow('Reels can be up to 2 minutes.');
    expect(videoCompress).not.toHaveBeenCalled();
    expect(api.createUpload).not.toHaveBeenCalled();
  });

  it('uploads the original when the device cannot compress it', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    videoCompress.mockRejectedValueOnce(new Error('codec not supported'));
    blob.fs.stat.mockImplementation(async () => ({ size: 150 * MB }));
    await uploadMedia(
      { ...longVideo, bytes: 150 * MB, durationMs: 45_000 },
      'story',
    );
    expect(api.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: 'video/quicktime',
        bytes: 150 * MB,
      }),
      undefined,
    );
  });

  it('refuses a file still over the limit after compressing, before any upload starts', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    videoCompress.mockRejectedValueOnce(new Error('codec not supported'));
    await expect(
      uploadMedia({ ...longVideo, bytes: 300 * MB, durationMs: 45_000 }, 'reel'),
    ).rejects.toThrow('Videos can be up to 200 MB.');
    expect(api.createUpload).not.toHaveBeenCalled();
  });

  it('maps S3 size errors and releases the reservation', async () => {
    respond = x => {
      x.status = 400;
      x.responseText = '<Error><Code>EntityTooLarge</Code></Error>';
      x.onload?.();
    };
    await expect(uploadMedia(photo, 'post')).rejects.toThrow(
      'The limit is 10 MB',
    );
    expect(api.remove).toHaveBeenCalledWith('m1');
    expect(api.complete).not.toHaveBeenCalled();
  });

  it('cancels through the AbortSignal', async () => {
    const controller = new AbortController();
    respond = () => controller.abort();
    await expect(
      uploadMedia(photo, 'post', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadCancelledError);
    expect(api.remove).toHaveBeenCalledWith('m1');
  });

  it('deletes the compressed copy after a successful upload, never the original', async () => {
    await uploadMedia(photo, 'post');
    // Kept in Documents while uploading so it survives a restart, then removed.
    expect(blob.fs.mv).toHaveBeenCalledWith(
      '/cache/compressed.jpg',
      expect.stringMatching(/^\/app\/Documents\/nexity-pending-uploads\/cu-.+\.jpg$/),
    );
    const kept = blob.fs.mv.mock.calls[0][1];
    expect(blob.fs.unlink).toHaveBeenCalledWith(kept);
    expect(blob.fs.unlink).not.toHaveBeenCalledWith(photo.uri);
    expect(blob.fs.cp).not.toHaveBeenCalled();
  });
});

describe('uploadMedia — large files in parts', () => {
  const PART = 8 * MB;
  const TOTAL = 95 * MB; // 12 parts, the last one 7 MB
  const PARTS = 12;
  let failPart: (n: number, attempt: number) => number | 'network' | null;
  const attempts = new Map<number, number>();

  const partOf = (url: string) => Number(/partNumber=(\d+)/.exec(url)![1]);

  function fakeTask(result: Promise<unknown>) {
    return Object.assign(result, {
      uploadProgress: jest.fn(),
      cancel: jest.fn(() => Promise.resolve()),
    });
  }

  beforeEach(() => {
    attempts.clear();
    failPart = () => null;
    jest.spyOn(globalThis, 'setTimeout').mockImplementation(((
      fn: () => void,
    ) => {
      fn();
      return 0;
    }) as never);

    api.createUpload.mockResolvedValue({
      media: { id: 'big1' } as never,
      upload: {
        method: 'multipart',
        part_size: PART,
        part_count: PARTS,
        expires_at: '2030-01-01T00:00:00Z',
      },
    });
    api.partUrls.mockImplementation(async (_id, numbers) => ({
      parts: numbers.map(n => ({
        part_number: n,
        url: `https://s3.test/key?partNumber=${n}`,
      })),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }));
    api.complete.mockResolvedValue({ id: 'big1', status: 'ready' } as never);
    blob.fetch.mockImplementation((_m: string, url: string) => {
      const n = partOf(url);
      const attempt = (attempts.get(n) ?? 0) + 1;
      attempts.set(n, attempt);
      const fail = failPart(n, attempt);
      if (fail === 'network') {
        return fakeTask(Promise.reject(new Error('socket closed')));
      }
      const status = fail ?? 200;
      return fakeTask(Promise.resolve({ info: () => ({ status }), data: '' }));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('slices the file natively, PUTs every part and deletes each chunk', async () => {
    const progress: number[] = [];
    const asset = await uploadMedia(longVideo, 'reel', {
      onProgress: f => progress.push(f),
    });

    expect(asset).toEqual({ id: 'big1', status: 'ready' });
    expect(api.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({ bytes: TOTAL }),
      undefined,
    );
    expect(blob.fetch).toHaveBeenCalledTimes(PARTS);
    expect(blob.fs.slice).toHaveBeenCalledWith(
      expect.stringMatching(/^\/app\/Documents\/nexity-pending-uploads\/cu-.+\.mp4$/),
      '/cache/nexity-upload/big1-12.part',
      11 * PART,
      TOTAL,
    );
    expect(api.partUrls).toHaveBeenCalledTimes(1);
    expect(blob.fs.unlink).toHaveBeenCalledWith(
      '/cache/nexity-upload/big1-1.part',
    );
    expect(blob.fs.unlink).toHaveBeenCalledWith(blob.fs.mv.mock.calls[0][1]);
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('retries a part after a dropped connection or an expired URL', async () => {
    failPart = (n, attempt) =>
      n === 3 && attempt === 1
        ? 'network'
        : n === 5 && attempt < 3
        ? 403
        : null;
    await uploadMedia(longVideo, 'reel');
    expect(attempts.get(3)).toBe(2);
    expect(attempts.get(5)).toBe(3);
    expect(api.partUrls.mock.calls.some(([, nums]) => nums[0] === 5)).toBe(
      true,
    );
    expect(api.complete).toHaveBeenCalledTimes(1);
  });

  it('keeps the upload after a long outage and resumes only missing parts', async () => {
    failPart = n => (n >= 11 ? 'network' : null);
    const session: UploadSession = {};
    await expect(
      uploadMedia(longVideo, 'reel', { session }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(api.remove).not.toHaveBeenCalled();
    expect(session.resumable).toEqual({
      mediaId: 'big1',
      partSize: PART,
      partCount: PARTS,
    });
    expect(blob.fs.unlink).not.toHaveBeenCalledWith('/cache/compressed.mp4');

    blob.fetch.mockClear();
    videoCompress.mockClear();
    failPart = () => null;
    api.listParts.mockResolvedValue({
      part_size: PART,
      part_count: PARTS,
      parts: Array.from({ length: 10 }, (_, i) => ({
        part_number: i + 1,
        bytes: PART,
      })),
    });
    await uploadMedia(longVideo, 'reel', { session });

    expect(videoCompress).not.toHaveBeenCalled();
    expect(api.createUpload).toHaveBeenCalledTimes(1);
    expect(blob.fetch.mock.calls.map(([, url]) => partOf(url)).sort()).toEqual([
      11, 12,
    ]);
    expect(session.resumable).toBeUndefined();
  });

  it('starts over when S3 no longer has the old upload', async () => {
    const session: UploadSession = {
      prepared: { ...longVideo, uri: 'file:///cache/compressed.mp4' },
      resumable: { mediaId: 'old', partSize: PART, partCount: PARTS },
    };
    api.listParts.mockRejectedValueOnce(
      new ApiError('expired', 400, 'UPLOAD_EXPIRED'),
    );
    await uploadMedia(longVideo, 'reel', { session });
    expect(api.createUpload).toHaveBeenCalledTimes(1);
    expect(api.complete).toHaveBeenCalledWith('big1', undefined);
  });

  it('cancelling releases the multipart upload', async () => {
    const controller = new AbortController();
    failPart = n => {
      if (n === 2) controller.abort();
      return null;
    };
    await expect(
      uploadMedia(longVideo, 'reel', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadCancelledError);
    expect(api.remove).toHaveBeenCalledWith('big1');
    expect(api.complete).not.toHaveBeenCalled();
  });

  it('discardUploadSession removes the reservation and the compressed copy', async () => {
    await discardUploadSession(
      {
        prepared: { ...longVideo, uri: 'file:///cache/compressed.mp4' },
        resumable: { mediaId: 'big1', partSize: PART, partCount: PARTS },
      },
      longVideo,
    );
    expect(api.remove).toHaveBeenCalledWith('big1');
    expect(blob.fs.unlink).toHaveBeenCalledWith('/cache/compressed.mp4');
  });
});

describe('sweepUploadCache', () => {
  it('removes only temp media from earlier launches', async () => {
    const old = Date.now() - 60_000;
    const entry = (dir: string, filename: string, lastModified = old) => ({
      filename,
      path: `${dir}/${filename}`,
      type: 'file',
      lastModified,
    });
    const listing: Record<string, object[]> = {
      '/cache/nexity-upload': [entry('/cache/nexity-upload', 'm1-3.part')],
      '/app/tmp': [
        entry('/app/tmp', 'IMG_0042.MOV'),
        entry('/app/tmp', 'B6F1C2D4.jpg', Date.now() + 1000),
        entry('/app/tmp', 'session.db'),
      ],
      '/cache': [
        entry('/cache', '0f8fad5b-d9cb-469f-a165-70867728950e.mp4'),
        entry(
          '/cache',
          'rn_image_picker_lib_temp_7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg',
        ),
        entry('/cache', 'http-cache.db'),
      ],
    };
    blob.fs.lstat.mockImplementation(async (dir: string) => listing[dir] ?? []);

    // Jest runs as iOS: chunk folder + the app's tmp folder.
    expect(await sweepUploadCache()).toBe(2);
    expect(blob.fs.unlink.mock.calls.map(([p]) => p)).toEqual([
      '/cache/nexity-upload/m1-3.part',
      '/app/tmp/IMG_0042.MOV',
    ]);

    blob.fs.unlink.mockClear();
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    expect(await sweepUploadCache()).toBe(3);
    expect(blob.fs.unlink).not.toHaveBeenCalledWith('/cache/http-cache.db');
    os.restore();
  });
});

describe('uploadMedia - retry and resume (client_upload_id)', () => {
  const netError = () =>
    new ApiError('Check your connection.', undefined, 'NETWORK_ERROR');

  afterEach(() => jest.useRealTimers());

  it('retries createUpload, the S3 POST and complete with backoff', async () => {
    jest.useFakeTimers();
    api.createUpload.mockRejectedValueOnce(netError());
    api.complete.mockRejectedValueOnce(netError());
    let posts = 0;
    respond = x => {
      posts += 1;
      if (posts === 1) x.onerror?.();
      else {
        x.status = 204;
        x.onload?.();
      }
    };

    const done = uploadMedia(photo, 'post');
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(done).resolves.toMatchObject({ id: 'm1', status: 'ready' });
    expect(api.createUpload).toHaveBeenCalledTimes(2);
    expect(posts).toBe(2);
    expect(api.complete).toHaveBeenCalledTimes(2);
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('keeps the journal entry when retries run out, then resumes with the same id', async () => {
    jest.useFakeTimers();
    api.createUpload.mockRejectedValue(netError());
    const session: UploadSession = {};
    const failed = uploadMedia(photo, 'post', { session }).catch(e => e);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(await failed).toMatchObject({ code: 'NETWORK_ERROR' });

    const id = session.clientUploadId!;
    const [entry] = (await pendingUploads('post')).filter(e => e.clientUploadId === id);
    expect(entry).toMatchObject({ purpose: 'post', original: { uri: photo.uri } });
    expect(entry.prepared!.uri).toMatch(/nexity-pending-uploads\/cu-.+\.jpg$/);

    // App restarted: a new session is rebuilt from the journal entry.
    jest.useRealTimers();
    imageCompress.mockClear();
    api.createUpload.mockReset();
    api.createUpload.mockResolvedValue({
      media: { id: 'm1' } as never,
      resumed: true,
      upload: {
        method: 'post',
        url: 'https://bucket.s3.amazonaws.com/',
        fields: { key: 'media/posts/u/m1.jpg', Policy: 'p' },
        expires_at: '2030-01-01T00:00:00Z',
      },
    });
    await uploadMedia(entry.original, 'post', {
      session: { clientUploadId: id, prepared: entry.prepared },
    });
    expect(imageCompress).not.toHaveBeenCalled();
    expect(api.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({ client_upload_id: id }),
      undefined,
    );
    expect((await pendingUploads('post')).some(e => e.clientUploadId === id)).toBe(false);
  });

  it('finishes at once when the server already has the file', async () => {
    api.createUpload.mockResolvedValueOnce({
      media: { id: 'm9', status: 'ready' } as never,
      upload: { method: 'complete' },
      resumed: true,
    });
    const asset = await uploadMedia(photo, 'post', {
      session: { clientUploadId: 'cu-already-done' },
    });
    expect(asset).toMatchObject({ id: 'm9', status: 'ready' });
    expect(globalThis.XMLHttpRequest).not.toHaveBeenCalled();
    expect(api.complete).not.toHaveBeenCalled();
  });

  it('lists parts S3 already has only for a resumed multipart upload', async () => {
    api.createUpload.mockResolvedValueOnce({
      media: { id: 'big1' } as never,
      resumed: true,
      upload: { method: 'multipart', part_size: 8 * MB, part_count: 12, expires_at: '2030-01-01T00:00:00Z' },
    });
    api.listParts.mockResolvedValueOnce({
      part_size: 8 * MB,
      part_count: 12,
      parts: Array.from({ length: 12 }, (_, i) => ({ part_number: i + 1, bytes: 8 * MB })),
    });
    api.complete.mockResolvedValueOnce({ id: 'big1', status: 'ready' } as never);
    await uploadMedia(longVideo, 'reel', { session: { clientUploadId: 'cu-resume-big' } });
    expect(api.listParts).toHaveBeenCalledWith('big1', undefined);
    expect(blob.fetch).not.toHaveBeenCalled();
  });

  it('cancel forgets the journal entry and starts the next try with a new id', async () => {
    const controller = new AbortController();
    respond = () => controller.abort();
    const session: UploadSession = {};
    await expect(
      uploadMedia(photo, 'post', { session, signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadCancelledError);
    expect(api.remove).toHaveBeenCalledWith('m1');
    expect(session.clientUploadId).toBeUndefined();
    expect(await pendingUploads('post')).toEqual([]);
  });
});
