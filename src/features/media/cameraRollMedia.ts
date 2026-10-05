import type { PhotoIdentifier } from '@react-native-camera-roll/camera-roll';

import { resolveContentType } from './mediaRules';
import type { LocalMedia } from './pickMedia';

/** A camera-roll entry as a file `uploadMedia` can take. */
export function cameraRollMedia(node: PhotoIdentifier['node']): LocalMedia {
  const image = node.image;
  const type = node.type ?? '';
  const video = type.startsWith('video') || type === 'pairedVideo';
  const fileName = image.filename ?? (video ? 'video.mp4' : 'photo.jpg');
  const contentType =
    resolveContentType(type.includes('/') ? type : undefined, fileName) ??
    (video ? 'video/mp4' : 'image/jpeg');
  return {
    uri: image.uri,
    kind: video ? 'video' : 'image',
    contentType,
    fileName,
    bytes: image.fileSize ?? 0,
    width: image.width,
    height: image.height,
    durationMs:
      video && image.playableDuration
        ? Math.round(image.playableDuration * 1000)
        : undefined,
  };
}
