import ReactNativeBlobUtil from 'react-native-blob-util';

import type { LocalMedia } from '@/features/media/pickMedia';

import {
  getDraft,
  IDENTITY_CROP,
  resetDraft,
  updateDraft,
  type PostDraft,
} from './postDraft';

const DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/nexity-drafts`;
const FILE = `${DIR}/post.json`;

async function copyIntoDraft(uri: string, name: string) {
  const dest = `${DIR}/${name}`;
  await ReactNativeBlobUtil.fs.cp(uri, dest);
  return dest.startsWith('file://') ? dest : `file://${dest}`;
}

/** Writes the current post (photos copied out of the cache) so it survives leaving the app. */
export async function saveDraftToDisk() {
  const draft = getDraft();
  if (!draft.items.length) return;
  await ReactNativeBlobUtil.fs.mkdir(DIR).catch(() => {});
  const items = [];
  for (const item of draft.items) {
    let uri = item.media.uri;
    try {
      uri = await copyIntoDraft(
        item.media.uri.replace(/^file:\/\//, ''),
        `${item.key}.jpg`,
      );
    } catch {
      // Keep the picker URI if the copy fails; it still works until the cache is cleared.
    }
    items.push({ ...item, media: { ...item.media, uri } });
  }
  const saved: PostDraft = { ...draft, items };
  await ReactNativeBlobUtil.fs.writeFile(FILE, JSON.stringify(saved), 'utf8');
  updateDraft({ items });
}

export async function loadSavedDraft(): Promise<PostDraft | null> {
  const exists = await ReactNativeBlobUtil.fs.exists(FILE);
  if (!exists) return null;
  try {
    const raw = await ReactNativeBlobUtil.fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as PostDraft;
    if (!parsed.items?.length) return null;
    parsed.music = parsed.music ?? '';
    parsed.locationLat = parsed.locationLat ?? null;
    parsed.locationLng = parsed.locationLng ?? null;
    parsed.adjustments = parsed.adjustments ?? {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      fade: 0,
      sharpen: 0,
      blur: 0,
      vignette: 0,
    };
    parsed.items = parsed.items.map(item => ({
      ...item,
      crop: item.crop ?? IDENTITY_CROP,
      filter: item.filter || 'normal',
      media: item.media as LocalMedia,
    }));
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSavedDraft() {
  await ReactNativeBlobUtil.fs.unlink(DIR).catch(() => {});
}

export function discardDraft() {
  resetDraft();
  clearSavedDraft().catch(() => {});
}
