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

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  entering?: BaseAnimationBuilder | EntryExitAnimationFunction | typeof BaseAnimationBuilder;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Card({ children, style, onPress, entering, testID }: CardProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (onPress) {
    return (
      <AnimatedPressable
        testID={testID}
        style={[styles.card, style, pressStyle]}
        entering={entering}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 260 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 220 });
        }}>
        {children}
      </AnimatedPressable>
    );
  }

  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

const makeStyles = ({ colors, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card || radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
});
