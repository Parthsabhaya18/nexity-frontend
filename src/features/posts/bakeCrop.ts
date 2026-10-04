import ImageEditor from '@react-native-community/image-editor';

import type { LocalMedia } from '@/features/media/pickMedia';

import { cropRect } from './cropMath';
import type { DraftItem } from './postDraft';

/** Cuts the photo to the frame the user pinched. The original is kept if crop isn't linked yet. */
export async function bakeCrop(item: DraftItem): Promise<LocalMedia> {
  if (item.media.kind === 'video') return item.media;
  const frameWidth = item.frameWidth;
  const frameHeight = item.frameHeight;
  if (!frameWidth || !frameHeight) return item.media;
  const rect = cropRect(item.media, item.crop, frameWidth, frameHeight);
  if (!rect) return item.media;
  const full =
    item.crop.scale <= 1.01 &&
    Math.abs(item.crop.x) < 1 &&
    Math.abs(item.crop.y) < 1 &&
    item.media.width &&
    item.media.height &&
    Math.abs(item.media.width / item.media.height - frameWidth / frameHeight) < 0.02;
  if (full) return item.media;
  try {
    const result = await ImageEditor.cropImage(item.media.uri, {
      offset: { x: rect.x, y: rect.y },
      size: { width: rect.width, height: rect.height },
      format: 'jpeg',
    });
    return {
      ...item.media,
      uri: result.uri,
      width: result.width,
      height: result.height,
      contentType: 'image/jpeg',
      fileName: item.media.fileName.replace(/\.\w+$/, '.jpg'),
    };
  } catch {
    return item.media;
  }
}
