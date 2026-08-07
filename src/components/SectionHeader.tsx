import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import type {ThemeTokens} from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export default function SectionHeader({title, subtitle, style}: SectionHeaderProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = ({colors, fonts, spacing}: ThemeTokens) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
  },
});
