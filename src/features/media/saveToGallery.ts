import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { deleteFile } from './localFiles';

const ALBUM = 'Nexity';

/**
 * Saves a chat photo or video to the phone's gallery. Remote files are
 * downloaded to the cache first; local ones are saved as they are.
 */
export async function saveToGallery(url: string, kind: 'image' | 'video') {
  const type = kind === 'video' ? 'video' : 'photo';
  if (!/^https?:\/\//i.test(url)) {
    await CameraRoll.saveAsset(url, { type, album: ALBUM });
    return;
  }
  const res = await ReactNativeBlobUtil.config({
    fileCache: true,
    appendExt: kind === 'video' ? 'mp4' : 'jpg',
  }).fetch('GET', url);
  const status = res.info().status;
  const local = `file://${res.path()}`;
  try {
    if (status < 200 || status >= 300) throw new Error(`Download failed (${status})`);
    await CameraRoll.saveAsset(local, { type, album: ALBUM });
  } finally {
    deleteFile(local).catch(() => {});
  }
}
