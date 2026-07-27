import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import {theme} from '../theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export default function SectionHeader({title, subtitle, style}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.serif,
    fontSize: 24,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
