import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import { getClothingIconComponent } from '../clothingIcons';
import type { ClothingItem } from '../types';

interface Props {
  item: Pick<ClothingItem, 'imageUri' | 'emoji' | 'name'>;
  size?: number;
  /** Corner radius; defaults to a rounded square. */
  radius?: number;
  /** Fill the parent instead of a fixed square (for large hero images). */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Dim the thumbnail (e.g. wishlist / unowned). */
  muted?: boolean;
}

// Presigned S3 URLs change their query string on every re-sign. The object path is the
// image's real identity: keep serving the URL we already loaded for that path (while it
// is still valid) so re-fetches don't make React Native reload — and flash — the photo.
const URL_REUSE_MS = 8 * 60 * 1000;
const loadedByPath = new Map<string, { uri: string; at: number }>();

function pathOf(uri: string): string {
  const q = uri.indexOf('?');
  return q === -1 ? uri : uri.slice(0, q);
}

export function stableImageUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const path = pathOf(uri);
  const known = loadedByPath.get(path);
  if (known && Date.now() - known.at < URL_REUSE_MS) return known.uri;
  return uri;
}

function rememberLoaded(uri: string): void {
  loadedByPath.set(pathOf(uri), { uri, at: Date.now() });
}

/**
 * The item's uploaded photo, falling back to its category icon when there is no
 * photo or the presigned URL has expired and fails to load.
 */
export default function ItemThumb({ item, size = 56, radius, fill, style, muted }: Props) {
  const styles = useThemedStyles(makeStyles);
  const uri = useMemo(() => stableImageUri(item.imageUri), [item.imageUri]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const Icon = getClothingIconComponent(item.emoji);
  const r = radius ?? Math.round(size * 0.28);
  const showImage = Boolean(uri) && !failed;
  const box = fill ? styles.fill : { width: size, height: size };

  return (
    <View style={[styles.box, box, { borderRadius: r }, muted && styles.muted, style]} accessibilityLabel={item.name}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={[fill ? styles.fill : { width: size, height: size }, { borderRadius: r }]}
          resizeMode="cover"
          onLoad={() => uri && rememberLoaded(uri)}
          onError={() => {
            if (uri) loadedByPath.delete(pathOf(uri));
            setFailed(true);
          }}
        />
      ) : (
        <Icon size={Math.round((fill ? 96 : size) * 0.5)} color={styles.icon.color} />
      )}
    </View>
  );
}

const makeStyles = ({ colors }: ThemeTokens) =>
  StyleSheet.create({
    box: {
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    fill: { width: '100%', height: '100%' },
    muted: { opacity: 0.55 },
    icon: { color: colors.primary },
  });
