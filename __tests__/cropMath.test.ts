import { cropRect } from '@/features/posts/cropMath';
import { IDENTITY_CROP } from '@/features/posts/postDraft';

describe('cropRect', () => {
  it('center-crops a wide photo into a square frame', () => {
    const rect = cropRect(
      { width: 2000, height: 1000 },
      IDENTITY_CROP,
      1000,
      1000,
    );
    expect(rect).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it('zooms in and keeps the rectangle inside the photo', () => {
    const rect = cropRect(
      { width: 1000, height: 1000 },
      { scale: 2, x: 0, y: 0 },
      500,
      500,
    );
    expect(rect).toEqual({ x: 250, y: 250, width: 500, height: 500 });
  });
});
