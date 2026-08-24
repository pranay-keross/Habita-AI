import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Pressable } from 'react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
}

export default function SectionHeader({
  title,
  subtitle,
  actionText,
  onActionPress,
  style,
}: SectionHeaderProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionText && onActionPress ? (
        <Pressable
          hitSlop={8}
          style={styles.actionButton}
          onPress={onActionPress}>
          <Text style={styles.actionText}>{actionText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  actionButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.blush || colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
  },
  actionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.primary,
  },
});
