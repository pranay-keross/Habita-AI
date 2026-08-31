import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import User from 'lucide-react-native/icons/user';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  isOwner?: boolean;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? '';
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function Avatar({ name, avatarUrl, size = 42, isOwner, style }: AvatarProps) {
  const styles = useThemedStyles(makeStyles);
  const initials = getInitials(name);

  const circleStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (avatarUrl) {
    return (
      <View style={[styles.circle, circleStyle, isOwner && styles.ownerRing, style]}>
        <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }

  if (initials) {
    const palette = styles.initialPalette;
    const bg = palette[hashString(name) % palette.length];
    return (
      <View
        style={[
          styles.circle,
          circleStyle,
          { backgroundColor: bg },
          isOwner && styles.ownerRing,
          style,
        ]}>
        <Text style={[styles.initialsText, { fontSize: size * 0.38 }]}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.circle, styles.iconCircle, circleStyle, isOwner && styles.ownerRing, style]}>
      <User size={size * 0.55} color={styles.iconColor.color} strokeWidth={1.5} />
    </View>
  );
}

const makeStyles = ({ colors }: ThemeTokens) => ({
  ...StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    ownerRing: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    iconCircle: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconColor: {
      color: colors.textMuted,
    },
    initialsText: {
      color: '#FFFFFF',
      fontWeight: '700' as const,
    },
  }),
  initialPalette: [
    colors.primary,
    colors.accentCyan,
    colors.accentIndigo,
    colors.forest,
    colors.turmeric,
    colors.deepMaroon,
  ],
});
