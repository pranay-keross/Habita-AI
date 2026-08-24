import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type BaseAnimationBuilder,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'glow' | 'accent';
  entering?: BaseAnimationBuilder | EntryExitAnimationFunction | typeof BaseAnimationBuilder;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function GlassCard({
  children,
  style,
  onPress,
  variant = 'default',
  entering,
  testID,
}: GlassCardProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantStyle =
    variant === 'elevated'
      ? styles.cardElevated
      : variant === 'glow'
      ? styles.cardGlow
      : variant === 'accent'
      ? styles.cardAccent
      : styles.cardDefault;

  if (onPress) {
    return (
      <AnimatedPressable
        testID={testID}
        style={[styles.baseCard, variantStyle, style, pressStyle]}
        entering={entering}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 240 });
        }}>
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View testID={testID} style={[styles.baseCard, variantStyle, style]}>
      {children}
    </View>
  );
}

const makeStyles = ({ colors, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    baseCard: {
      borderRadius: radius.card || 22,
      padding: spacing.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    cardDefault: {
      backgroundColor: colors.glassSurface || colors.surface,
      borderColor: colors.glassBorder || colors.border,
      ...shadow.soft,
    },
    cardElevated: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderStrong || colors.border,
      ...shadow.medium,
    },
    cardGlow: {
      backgroundColor: colors.glassSurface || colors.surface,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 6,
    },
    cardAccent: {
      backgroundColor: colors.surface,
      borderColor: colors.accentCyan || colors.primary,
      ...shadow.soft,
    },
  });
