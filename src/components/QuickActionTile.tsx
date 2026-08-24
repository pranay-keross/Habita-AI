import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface QuickActionTileProps {
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
  badge?: string;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  iconBg?: string;
  testID?: string;
}

export default function QuickActionTile({
  label,
  Icon,
  onPress,
  badge,
  style,
  iconColor,
  iconBg,
  testID,
}: QuickActionTileProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.tileContainer,
        style,
        pressed && styles.tilePressed,
      ]}
      onPress={onPress}>
      <View style={[styles.iconWrapper, iconBg ? { backgroundColor: iconBg } : null]}>
        <Icon
          size={20}
          color={iconColor || styles.defaultIconColor.color}
          strokeWidth={1.5}
        />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    tileContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs,
      width: '100%',
    },
    tilePressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
    iconWrapper: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
      ...shadow.soft,
    },
    defaultIconColor: {
      color: '#000000',
    },
    label: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '400',
      color: '#000000',
      textAlign: 'center',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.turmeric,
      borderRadius: radius.pill,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    badgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 8,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });
