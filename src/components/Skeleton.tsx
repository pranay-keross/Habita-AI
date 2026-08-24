import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export function SkeletonBox({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  dark = false,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        skeletonStyles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: dark ? '#2A2A34' : '#E8E8EE',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({
  size = 40,
  style,
  dark = false,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  return (
    <SkeletonBox
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
      dark={dark}
    />
  );
}

export function SkeletonText({
  width = '60%',
  height = 14,
  style,
  dark = false,
}: SkeletonProps) {
  return (
    <SkeletonBox
      width={width}
      height={height}
      borderRadius={4}
      style={style}
      dark={dark}
    />
  );
}

export function SkeletonCard({
  style,
  dark = false,
}: {
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        skeletonStyles.cardContainer,
        dark ? skeletonStyles.cardDark : skeletonStyles.cardLight,
        style,
      ]}>
      <View style={skeletonStyles.cardHeader}>
        <SkeletonCircle size={36} dark={dark} />
        <View style={skeletonStyles.cardHeaderText}>
          <SkeletonText width="50%" height={14} dark={dark} style={{ marginBottom: 6 }} />
          <SkeletonText width="80%" height={11} dark={dark} />
        </View>
      </View>
      <View style={skeletonStyles.cardBody}>
        <SkeletonBox width="100%" height={32} borderRadius={6} dark={dark} />
      </View>
    </View>
  );
}

export function SkeletonHeroCard() {
  return (
    <View style={skeletonStyles.heroCardDark}>
      <View style={skeletonStyles.heroTop}>
        <SkeletonText width="40%" height={18} dark={true} style={{ marginBottom: 6 }} />
        <SkeletonText width="65%" height={12} dark={true} />
      </View>
      <View style={skeletonStyles.heroStatsRow}>
        <SkeletonBox width="30%" height={52} borderRadius={12} dark={true} />
        <SkeletonBox width="30%" height={52} borderRadius={12} dark={true} />
        <SkeletonBox width="30%" height={52} borderRadius={12} dark={true} />
      </View>
      <SkeletonBox width="100%" height={10} borderRadius={5} dark={true} style={{ marginTop: 14 }} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  cardContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECECEE',
  },
  cardDark: {
    backgroundColor: '#121216',
    borderColor: '#24242A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  cardBody: {
    marginTop: 4,
  },
  heroCardDark: {
    backgroundColor: '#0D0D0D',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#24242A',
  },
  heroTop: {
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default SkeletonBox;
