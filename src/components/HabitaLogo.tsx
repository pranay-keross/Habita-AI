import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface HabitaLogoProps {
  size?: number;
  color?: string;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function HabitaLogo({
  size = 30,
  color = '#000000',
  dark = false,
  style,
}: HabitaLogoProps) {
  const styles = useThemedStyles(makeStyles);
  const fgColor = dark ? '#FFFFFF' : color;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: dark ? '#181820' : '#FFFFFF',
          borderColor: dark ? '#2A2A32' : '#ECECEE',
        },
        style,
      ]}>
      <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none">
        {/* Minimalist Outer Hexagonal Lattice */}
        <Path
          d="M12 2L20.5 6.9V17.1L12 22L3.5 17.1V6.9L12 2Z"
          stroke={fgColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Core Neural Sparkle */}
        <Path
          d="M12 7V17M7 12H17"
          stroke={fgColor}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <Circle cx="12" cy="12" r="2" fill={fgColor} />
      </Svg>
    </View>
  );
}

const makeStyles = ({ shadow }: ThemeTokens) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      ...shadow.soft,
      elevation: 2,
    },
  });
