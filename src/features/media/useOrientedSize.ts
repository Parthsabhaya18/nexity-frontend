import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { getImageMetaData } from 'react-native-compressor';

import { orientedSize, type Size } from './mediaFit';

const cache = new Map<string, Size>();

/**
 * Photo size as it is displayed (EXIF rotation applied). Local files are read
 * from their metadata, because Android's `Image.getSize` may report the raw,
 * unrotated size; anything else falls back to `Image.getSize`.
 */
export async function getOrientedSize(uri: string): Promise<Size> {
  const known = cache.get(uri);
  if (known) return known;
  let size: Size | undefined;
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    const meta = await getImageMetaData(uri).catch(() => null);
    if (meta?.ImageWidth && meta.ImageHeight) {
      size = orientedSize(
        { width: meta.ImageWidth, height: meta.ImageHeight },
        Number(meta.Orientation) || undefined,
      );
    }
  }
  size ??= await new Promise<Size>((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
  cache.set(uri, size);
  return size;
}

export function useOrientedSize(uri: string | undefined) {
  const [size, setSize] = useState<Size | null>(() =>
    uri ? cache.get(uri) ?? null : null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!uri) return;
    let live = true;
    setError(false);
    setSize(cache.get(uri) ?? null);
    getOrientedSize(uri)
      .then(s => live && setSize(s))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [uri]);
  return { size, error };
}
