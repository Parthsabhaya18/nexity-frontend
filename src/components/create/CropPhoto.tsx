import { useRef } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';

import type { CropTransform } from '@/features/posts/postDraft';

type Props = {
  uri: string;
  imageWidth?: number;
  imageHeight?: number;
  frameWidth: number;
  frameHeight: number;
  crop: CropTransform;
  onCrop: (crop: CropTransform) => void;
};

function clampCrop(
  crop: CropTransform,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): CropTransform {
  const scale = Math.min(4, Math.max(1, crop.scale));
  const base = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const displayedW = imageWidth * base * scale;
  const displayedH = imageHeight * base * scale;
  const maxX = Math.max(0, (displayedW - frameWidth) / 2);
  const maxY = Math.max(0, (displayedH - frameHeight) / 2);
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, crop.x)),
    y: Math.min(maxY, Math.max(-maxY, crop.y)),
  };
}

/** Pinch to zoom and drag to position a photo inside the post frame. */
export function CropPhoto({
  uri,
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  crop,
  onCrop,
}: Props) {
  const iw = imageWidth && imageWidth > 0 ? imageWidth : frameWidth;
  const ih = imageHeight && imageHeight > 0 ? imageHeight : frameHeight;
  const base = Math.max(frameWidth / iw, frameHeight / ih);
  const start = useRef({ ...crop, distance: 0 });
  const cropRef = useRef(crop);
  cropRef.current = crop;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        const touches = evt.nativeEvent.touches;
        start.current = {
          ...cropRef.current,
          distance:
            touches.length >= 2
              ? Math.hypot(
                  touches[0]!.pageX - touches[1]!.pageX,
                  touches[0]!.pageY - touches[1]!.pageY,
                )
              : 0,
        };
      },
      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const distance = Math.hypot(
            touches[0]!.pageX - touches[1]!.pageX,
            touches[0]!.pageY - touches[1]!.pageY,
          );
          const origin = start.current.distance || distance;
          onCrop(
            clampCrop(
              { ...start.current, scale: start.current.scale * (distance / origin) },
              iw,
              ih,
              frameWidth,
              frameHeight,
            ),
          );
          return;
        }
        onCrop(
          clampCrop(
            {
              scale: start.current.scale,
              x: start.current.x + gesture.dx,
              y: start.current.y + gesture.dy,
            },
            iw,
            ih,
            frameWidth,
            frameHeight,
          ),
        );
      },
    }),
  ).current;

  const fitted = clampCrop(crop, iw, ih, frameWidth, frameHeight);
  const imgW = iw * base;
  const imgH = ih * base;

  return (
    <View
      style={{ width: frameWidth, height: frameHeight, overflow: 'hidden' }}
      accessibilityLabel="Pinch to zoom, drag to reposition"
      {...pan.panHandlers}
    >
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: imgW,
            height: imgH,
            left: (frameWidth - imgW) / 2,
            top: (frameHeight - imgH) / 2,
            transform: [
              { scale: fitted.scale },
              { translateX: fitted.x },
              { translateY: fitted.y },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { position: 'absolute', left: 0, top: 0 },
});
