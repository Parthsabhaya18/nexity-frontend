import {
  ImageFormat,
  Skia,
  type SkImage,
  type SkPaint,
  TileMode,
} from '@shopify/react-native-skia';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Image as ImageCompressor } from 'react-native-compressor';

import { type ColorMatrix, isIdentity } from './filterEngine';
import { deleteFile, fileSize, tempPath } from './localFiles';
import {
  backgroundPlacement,
  canvasFor,
  defaultFitMode,
  EXPORT_MAX_WIDTH,
  EXPORT_QUALITY,
  type FitTransform,
  needsBackground,
  placement,
  type Size,
} from './mediaFit';
import { type LocalMedia, MediaError } from './pickMedia';

/** Upright JPEG working copy; twice the export width keeps zoomed crops sharp. */
const WORK_EDGE = EXPORT_MAX_WIDTH * 2;

let seq = 0;

/**
 * Decodes HEIC/PNG/WebP and applies the EXIF rotation by re-encoding to an
 * upright JPEG, so Skia always gets pixels in display order.
 */
async function uprightCopy(uri: string) {
  return ImageCompressor.compress(uri, {
    compressionMethod: 'manual',
    maxWidth: WORK_EDGE,
    maxHeight: WORK_EDGE * 2,
    quality: 0.92,
    output: 'jpg',
    disablePngTransparency: true,
  });
}

async function decode(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image)
    throw new MediaError("This photo couldn't be opened. Try a different one.");
  return image;
}

function paintFor(matrix?: ColorMatrix, blurSigma?: number): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const color =
    matrix && !isIdentity(matrix) ? Skia.ColorFilter.MakeMatrix(matrix) : null;
  if (blurSigma) {
    const blur = Skia.ImageFilter.MakeBlur(
      blurSigma,
      blurSigma,
      TileMode.Clamp,
      null,
    );
    paint.setImageFilter(
      color ? Skia.ImageFilter.MakeColorFilter(color, blur) : blur,
    );
  } else if (color) {
    paint.setColorFilter(color);
  }
  return paint;
}

export interface BakeOptions {
  /** Canvas ratio (width / height), e.g. `STORY_RATIO`. Omit to keep the photo's own ratio. */
  ratio?: number;
  /** Fit / fill, zoom and pan from `MediaFit`. Ignored without `ratio`. */
  transform?: FitTransform;
  /** From `lookMatrix(filter, intensity, adjustments)`. */
  matrix?: ColorMatrix;
  maxWidth?: number;
  quality?: number;
}

/**
 * Renders the final photo on the device: canvas ratio, fit over a blurred
 * copy (or fill), zoom/pan, filter and adjustments, at most 1080 px wide,
 * JPEG 0.8. The result is a temp file ready for `useMediaUpload()`.
 */
export async function bakeImage(
  source: Pick<LocalMedia, 'uri' | 'fileName'>,
  opts: BakeOptions = {},
): Promise<LocalMedia> {
  const maxWidth = opts.maxWidth ?? EXPORT_MAX_WIDTH;
  const quality = Math.round((opts.quality ?? EXPORT_QUALITY) * 100);
  const working = await uprightCopy(source.uri);
  try {
    const image = await decode(working);
    const src: Size = { width: image.width(), height: image.height() };
    const out: Size = opts.ratio
      ? canvasFor(opts.ratio, maxWidth)
      : (() => {
          const w = Math.min(maxWidth, src.width);
          return { width: w, height: Math.round((w * src.height) / src.width) };
        })();

    const surface =
      Skia.Surface.MakeOffscreen(out.width, out.height) ??
      Skia.Surface.Make(out.width, out.height);
    if (!surface)
      throw new MediaError("Couldn't edit this photo. Please try again.");
    const canvas = surface.getCanvas();
    const full = Skia.XYWHRect(0, 0, src.width, src.height);

    const t: FitTransform = opts.transform ?? {
      mode: opts.ratio ? defaultFitMode(src, opts.ratio) : 'fill',
      zoom: 1,
      x: 0,
      y: 0,
    };
    const fg = opts.ratio
      ? placement(src, out, t)
      : { x: 0, y: 0, width: out.width, height: out.height };

    if (opts.ratio && needsBackground(fg, out)) {
      const bg = backgroundPlacement(src, out);
      canvas.drawImageRect(
        image,
        full,
        Skia.XYWHRect(bg.x, bg.y, bg.width, bg.height),
        paintFor(opts.matrix, out.width * 0.045),
      );
    }
    canvas.drawImageRect(
      image,
      full,
      Skia.XYWHRect(fg.x, fg.y, fg.width, fg.height),
      paintFor(opts.matrix),
    );
    surface.flush();

    const base64 = surface
      .makeImageSnapshot()
      .encodeToBase64(ImageFormat.JPEG, quality);
    const name = `${(source.fileName || 'photo').replace(
      /\.[^./]+$/,
      '',
    )}-edit-${Date.now()}-${++seq}.jpg`;
    const path = await tempPath(name);
    await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
    const uri = `file://${path}`;
    return {
      uri,
      kind: 'image',
      contentType: 'image/jpeg',
      fileName: name,
      bytes: await fileSize(uri),
      width: out.width,
      height: out.height,
      isPrecompressed: true,
    };
  } finally {
    if (working !== source.uri) await deleteFile(working);
  }
}
