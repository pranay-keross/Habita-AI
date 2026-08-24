import React from 'react';
import {
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'primary' | 'secondary' | 'outline' | 'glass';
  showArrow?: boolean;
  testID?: string;
}

export default function Button({
  title,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
  variant = 'primary',
  showArrow = true,
  testID,
}: ButtonProps) {
  const styles = useThemedStyles(makeStyles);

  const cleanTitle = title.replace(/\s*→\s*$/, '').trim();

  const variantStyle =
    variant === 'secondary'
      ? styles.baseSecondary
      : variant === 'outline'
      ? styles.baseOutline
      : variant === 'glass'
      ? styles.baseGlass
      : styles.basePrimary;

  const variantTextStyle =
    variant === 'outline' || variant === 'glass'
      ? styles.labelOutline
      : variant === 'secondary'
      ? styles.labelSecondary
      : styles.labelPrimary;

  const arrowColor =
    variant === 'outline' || variant === 'glass'
      ? styles.labelOutline.color
      : variant === 'secondary'
      ? styles.labelSecondary.color
      : styles.labelPrimary.color;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        disabled && styles.baseDisabled,
        {
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled && !loading ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantTextStyle.color} size="small" />
      ) : (
        <View style={styles.contentRow}>
          <Text style={[variantTextStyle, textStyle]}>{cleanTitle}</Text>
          {showArrow ? (
            <ArrowRight size={15} color={arrowColor} strokeWidth={2.2} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    base: {
      height: 52,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      ...shadow.soft,
      elevation: 2,
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    basePrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    baseSecondary: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong || colors.primary,
    },
    baseOutline: {
      backgroundColor: 'transparent',
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    baseGlass: {
      backgroundColor: colors.glassSurface || 'rgba(255, 255, 255, 0.9)',
      borderColor: colors.glassBorder || colors.border,
    },
    baseDisabled: {
      backgroundColor: colors.border,
      borderColor: colors.border,
    },
    labelPrimary: {
      fontSize: 14,
      color: colors.textOnPrimary,
      fontFamily: fonts.sans,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    labelSecondary: {
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: fonts.sans,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    labelOutline: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: fonts.sans,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
  });
