import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const { fs } = ReactNativeBlobUtil;

/** Part files cut from large uploads; deleted as soon as each part is sent. */
export const CHUNK_DIR = `${fs.dirs.CacheDir}/nexity-upload`;

/** blob-util wants plain paths; `content://` URIs are passed through as-is. */
export function toPath(uri: string) {
  if (!uri.startsWith('file://')) return uri;
  const path = uri.slice('file://'.length);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export async function fileSize(uri: string): Promise<number> {
  try {
    const size = Number((await fs.stat(toPath(uri))).size);
    return Number.isFinite(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}

export async function fileExists(uri: string) {
  return fs.exists(toPath(uri)).catch(() => false);
}

/** Best effort: a file that can't be removed is left for the next sweep. */
export async function deleteFile(uri: string | undefined) {
  if (!uri || (!uri.startsWith('file://') && !uri.startsWith('/'))) return;
  await fs.unlink(toPath(uri)).catch(() => {});
}

let chunkDirReady: Promise<void> | undefined;

function ensureChunkDir() {
  chunkDirReady ??= fs
    .isDir(CHUNK_DIR)
    .then(exists => (exists ? undefined : fs.mkdir(CHUNK_DIR)))
    .catch(err => {
      chunkDirReady = undefined;
      throw err;
    });
  return chunkDirReady;
}

/** Copies bytes [start, end) of a file into its own temp file, natively (never through JS). */
export async function sliceToTemp(
  uri: string,
  start: number,
  end: number,
  name: string,
) {
  await ensureChunkDir();
  const dest = `${CHUNK_DIR}/${name}`;
  await fs.slice(toPath(uri), dest, start, end);
  return dest;
}

const MEDIA_EXT = /\.(jpe?g|png|webp|heic|heif|mp4|m4v|mov)$/i;
/** Android cache names used by react-native-compressor (UUID) and react-native-image-picker. */
const ANDROID_TEMP = new RegExp(
  `^(rn_image_picker_lib_temp_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}${MEDIA_EXT.source}`,
  'i',
);

/** iOS keeps picker and compressor output in the app's tmp folder, next to Documents. */
const iosTmpDir = () => fs.dirs.DocumentDir.replace(/\/Documents\/?$/, '/tmp');

const launchedAt = Date.now();

async function removeMatching(dir: string, match: (name: string) => boolean) {
  const entries = await fs.lstat(dir).catch(() => []);
  let removed = 0;
  for (const entry of entries) {
    const fromEarlierLaunch = Number(entry.lastModified) < launchedAt;
    if (entry.type === 'file' && fromEarlierLaunch && match(entry.filename)) {
      await fs.unlink(entry.path).catch(() => {});
      removed += 1;
    }
  }
  return removed;
}

/**
 * Deletes photos and videos copied or compressed for uploads in earlier
 * launches; files from this launch are never touched. Drafts that must survive
 * a restart have to live outside these folders.
 */
export async function sweepUploadCache() {
  let removed = await removeMatching(CHUNK_DIR, () => true);
  removed +=
    Platform.OS === 'ios'
      ? await removeMatching(iosTmpDir(), name => MEDIA_EXT.test(name))
      : await removeMatching(fs.dirs.CacheDir, name => ANDROID_TEMP.test(name));
  return removed;
}
