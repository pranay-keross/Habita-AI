import React, { useEffect, useId, useMemo, useState } from 'react';
import { View, Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, FeGaussianBlur, Filter, Image as SvgImage, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import { getClothingIconComponent } from '../clothingIcons';
import { stableImageUri, rememberLoaded, forgetLoaded } from './ItemThumb';
import type { ClothingItem } from '../types';

interface Props {
  item: Pick<ClothingItem, 'imageUri' | 'emoji' | 'name'>;
  width: number;
  height: number;
  radius?: number;
  /** Rendered on top of the frosted strip at the bottom of the photo. */
  children?: React.ReactNode;
  /** Height of the frosted info strip; defaults to a third of the card. */
  stripHeight?: number;
  /** Extra overlays drawn above the photo but outside the strip (chips, buttons). */
  overlay?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
}

// Progressive blur: each band starts a little higher than the last and is a little
// softer, so the eye never meets a sharp→frosted edge — only sharp→2px, 2→5, 5→9,
// 9→16, each of which is imperceptible. (Android's react-native-svg can't gradient-
// mask a filtered image, which is why this isn't a single masked blur.)
const BLUR_LEVELS = [2, 5, 9, 16];

/**
 * A card whose entire surface is the item's photo, with its info sitting on a
 * frosted-glass band that dissolves into the picture. Falls back to the category
 * icon on a soft background when there is no photo.
 */
export default function PhotoCard({
  item,
  width,
  height,
  radius = 20,
  children,
  stripHeight,
  overlay,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  muted,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const ids = useId().replace(/[^a-zA-Z0-9]/g, '');
  const uri = useMemo(() => stableImageUri(item.imageUri), [item.imageUri]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const showImage = Boolean(uri) && !failed;
  const strip = stripHeight ?? Math.round(height / 3);
  const fade = Math.min(Math.round(strip * 0.55), Math.max(0, height - strip));
  const Icon = getClothingIconComponent(item.emoji);
  const photoStyle = { width, height };

  // Band k covers the strip plus a share of the fade zone; softer bands sit lower.
  const bands = BLUR_LEVELS.map((blur, i) => {
    const extra = Math.round((fade * (BLUR_LEVELS.length - i)) / BLUR_LEVELS.length);
    const top = height - strip - extra;
    return { blur, top, h: strip + extra };
  });
  const tintTop = height - strip - fade;

  const body = (
    <View style={[styles.card, { width, height, borderRadius: radius }, muted && styles.muted, style]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={photoStyle}
          resizeMode="cover"
          onLoad={() => uri && rememberLoaded(uri)}
          onError={() => {
            if (uri) forgetLoaded(uri);
            setFailed(true);
          }}
        />
      ) : (
        <View style={[styles.fallback, photoStyle]}>
          <Icon size={Math.round(Math.min(width, height) * 0.34)} color={styles.icon.color} />
        </View>
      )}

      {overlay}

      {children ? (
        <>
          {showImage ? (
            <>
              {bands.map(b => (
                <View key={b.blur} style={[styles.band, { top: b.top, height: b.h }]} pointerEvents="none">
                  <Svg width={width} height={b.h}>
                    <Defs>
                      <Filter id={`blur${b.blur}${ids}`} x="-10%" y="-10%" width="120%" height="120%">
                        <FeGaussianBlur stdDeviation={String(b.blur)} />
                      </Filter>
                    </Defs>
                    {/* Same photo, same `cover` crop, shifted up so it lines up with the card. */}
                    <SvgImage
                      href={{ uri }}
                      x="0"
                      y={-b.top}
                      width={width}
                      height={height}
                      preserveAspectRatio="xMidYMid slice"
                      filter={`url(#blur${b.blur}${ids})`}
                    />
                  </Svg>
                </View>
              ))}
              <View style={[styles.band, { top: tintTop, height: strip + fade }]} pointerEvents="none">
                <Svg width={width} height={strip + fade}>
                  <Defs>
                    <LinearGradient id={`tint${ids}`} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={styles.tintColor.color} stopOpacity="0" />
                      <Stop offset={String(fade / (strip + fade))} stopColor={styles.tintColor.color} stopOpacity="0.36" />
                      <Stop offset="1" stopColor={styles.tintColor.color} stopOpacity="0.58" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width={width} height={strip + fade} fill={`url(#tint${ids})`} />
                </Svg>
              </View>
            </>
          ) : (
            <View style={[styles.band, styles.plainBand, { top: height - strip, height: strip }]} pointerEvents="none" />
          )}
          <View style={[styles.stripContent, { height: strip }]} pointerEvents="box-none">
            {children}
          </View>
        </>
      ) : null}
    </View>
  );

  if (!onPress && !onLongPress) return body;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? item.name}>
      {body}
    </Pressable>
  );
}

const makeStyles = ({ colors, spacing }: ThemeTokens) =>
  StyleSheet.create({
    card: {
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
    },
    muted: { opacity: 0.6 },
    fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
    icon: { color: colors.primary },
    band: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
    plainBand: { backgroundColor: colors.primary, opacity: 0.55 },
    tintColor: { color: colors.primary },
    stripContent: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
  });
