import React from 'react';
import {Pressable, Text, ViewStyle, TextStyle, ActivityIndicator, StyleSheet} from 'react-native';
import type {ThemeTokens} from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
}: ButtonProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.base,
        disabled && styles.baseDisabled,
        {opacity: pressed ? 0.85 : 1},
        style,
      ] as any}
    >
      {loading ? (
        <ActivityIndicator color={styles.label.color} />
      ) : (
        <Text style={[styles.label, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const makeStyles = ({colors, fonts, radius, spacing}: ThemeTokens) => StyleSheet.create({
  base: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseDisabled: {
    backgroundColor: colors.border,
  },
  label: {
    fontSize: 16,
    color: colors.textOnPrimary,
    fontFamily: fonts.sansMedium,
  },
});
