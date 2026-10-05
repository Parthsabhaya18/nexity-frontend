import ReactNativeBlobUtil from 'react-native-blob-util';

import { deleteFile, toPath } from './localFiles';
import type { MediaPurpose } from './mediaRules';
import type { LocalMedia } from './pickMedia';

const { fs } = ReactNativeBlobUtil;

/**
 * Uploads that have not finished yet, kept on disk so they can resume after
 * the app is killed. The compressed copy is moved out of the cache folders
 * (which `sweepUploadCache` empties on every launch) into `PENDING_DIR`.
 */
export const PENDING_DIR = `${fs.dirs.DocumentDir}/nexity-pending-uploads`;
const JOURNAL_PATH = `${fs.dirs.DocumentDir}/nexity-upload-journal.json`;
/** Matches the server's 24 h upload reservation. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingUpload {
  clientUploadId: string;
  purpose: MediaPurpose;
  original: LocalMedia;
  /** Persistent compressed copy, once processing finished. */
  prepared?: LocalMedia;
  createdAt: number;
}

let entries: PendingUpload[] | undefined;
let queue: Promise<unknown> = Promise.resolve();

/** Serialises every read-modify-write so concurrent uploads never lose an entry. */
function locked<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function load() {
  if (entries) return entries;
  try {
    if (await fs.exists(JOURNAL_PATH)) {
      const parsed: unknown = JSON.parse(
        await fs.readFile(JOURNAL_PATH, 'utf8'),
      );
      entries = Array.isArray(parsed) ? (parsed as PendingUpload[]) : [];
    } else {
      entries = [];
    }
  } catch {
    entries = [];
  }
  return entries;
}

/** Best effort: without the file an upload still works, it just can't resume after a restart. */
async function save(next: PendingUpload[]) {
  entries = next;
  try {
    await fs.writeFile(JOURNAL_PATH, JSON.stringify(next), 'utf8');
  } catch {}
}

export function newClientUploadId() {
  const rand = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `cu-${Date.now().toString(36)}-${rand}`;
}

async function ensurePendingDir() {
  try {
    if (!(await fs.isDir(PENDING_DIR))) await fs.mkdir(PENDING_DIR);
  } catch {}
}

const isPersistent = (uri: string) => toPath(uri).startsWith(PENDING_DIR);

/**
 * Moves (or copies, when it is the user's original) the compressed file into
 * `PENDING_DIR`. Falls back to the current location if the file can't be moved.
 */
async function persistFile(
  clientUploadId: string,
  media: LocalMedia,
  original: LocalMedia,
): Promise<LocalMedia> {
  if (isPersistent(media.uri)) return media;
  await ensurePendingDir();
  const ext = /\.[a-z0-9]+$/i.exec(media.fileName)?.[0] ?? '';
  const dest = `${PENDING_DIR}/${clientUploadId}${ext}`;
  try {
    await deleteFile(dest);
    if (media.uri === original.uri) await fs.cp(toPath(media.uri), dest);
    else await fs.mv(toPath(media.uri), dest);
    return { ...media, uri: `file://${dest}` };
  } catch {
    return media;
  }
}

/** Records the file before any network work so a restart can find it. */
export function recordUpload(entry: Omit<PendingUpload, 'createdAt'>) {
  return locked(async () => {
    const list = await load();
    const existing = list.find(e => e.clientUploadId === entry.clientUploadId);
    const next = existing
      ? list.map(e => (e === existing ? { ...existing, ...entry } : e))
      : [...list, { ...entry, createdAt: Date.now() }];
    await save(next);
  });
}

/** Persists the compressed copy and returns it with its new location. */
export function recordPrepared(
  clientUploadId: string,
  prepared: LocalMedia,
  original: LocalMedia,
) {
  return locked(async () => {
    const list = await load();
    if (!list.some(e => e.clientUploadId === clientUploadId)) return prepared;
    const stored = await persistFile(clientUploadId, prepared, original);
    await save(
      list.map(e =>
        e.clientUploadId === clientUploadId ? { ...e, prepared: stored } : e,
      ),
    );
    return stored;
  });
}

/** Forgets a finished, cancelled or abandoned upload and deletes its copy. */
export function forgetUpload(clientUploadId: string) {
  return locked(async () => {
    const list = await load();
    const entry = list.find(e => e.clientUploadId === clientUploadId);
    if (!entry) return;
    if (entry.prepared && isPersistent(entry.prepared.uri)) {
      await deleteFile(entry.prepared.uri);
    }
    await save(list.filter(e => e !== entry));
  });
}

/** Unfinished uploads from this or earlier launches, oldest first. */
export function pendingUploads(purpose?: MediaPurpose) {
  return locked(async () => {
    const list = await load();
    return list.filter(e => !purpose || e.purpose === purpose);
  });
}

/**
 * Drops entries older than the server reservation or whose files are gone,
 * and deletes copies that no entry points to. Run once per launch.
 */
export function sweepUploadJournal() {
  return locked(async () => {
    const list = await load();
    const now = Date.now();
    const keep: PendingUpload[] = [];
    for (const e of list) {
      const source = e.prepared ?? e.original;
      const alive =
        now - e.createdAt < MAX_AGE_MS &&
        (await fs.exists(toPath(source.uri)).catch(() => false));
      if (alive) keep.push(e);
      else if (e.prepared && isPersistent(e.prepared.uri)) {
        await deleteFile(e.prepared.uri);
      }
    }
    if (keep.length !== list.length) await save(keep);

    const referenced = new Set(
      keep.filter(e => e.prepared).map(e => toPath(e.prepared!.uri)),
    );
    const files = await fs.lstat(PENDING_DIR).catch(() => []);
    for (const f of files) {
      if (f.type === 'file' && !referenced.has(f.path)) {
        await fs.unlink(f.path).catch(() => {});
      }
    }
    return list.length - keep.length;
  });
}

/** For tests. */
export function resetJournalMemory() {
  entries = undefined;
}
