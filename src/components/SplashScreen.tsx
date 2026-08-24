import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import HabitaLogo from './HabitaLogo';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number;
}

export default function SplashScreen({ onFinish, minDuration = 1800 }: SplashScreenProps) {
  const styles = useThemedStyles(makeStyles);

  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(14)).current;
  const pulseOpacity = useRef(new Animated.Value(0.3)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      if (onFinish) onFinish();
      return;
    }

    let active = true;

    // Entrance animations
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: false,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        delay: 350,
        useNativeDriver: false,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 800,
        delay: 350,
        useNativeDriver: false,
      }),
    ]).start();

    // Subtle breathing pulse for the neural core
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.9,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    );
    pulseLoop.start();

    // Minimum display timer before calling onFinish
    const timer = setTimeout(() => {
      if (!active) return;
      if (onFinish) {
        Animated.timing(fadeOutAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          if (active) {
            onFinish();
          }
        });
      }
    }, minDuration);

    return () => {
      active = false;
      pulseLoop.stop();
      clearTimeout(timer);
    };
  }, [logoScale, logoOpacity, textOpacity, textTranslateY, pulseOpacity, fadeOutAnim, onFinish, minDuration]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOutAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.centerContent}>
        {/* Glow halo behind logo */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: pulseOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        />

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}>
          <HabitaLogo size={78} dark={true} />
        </Animated.View>

        {/* Brand Text */}
        <Animated.View
          style={[
            styles.brandGroup,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}>
          <Text style={styles.brandTitle}>HABITA AI</Text>
          <View style={styles.subContainer}>
            <View style={styles.subLine} />
            <Text style={styles.brandSubtitle}>AI HOME & LIFE OS</Text>
            <View style={styles.subLine} />
          </View>
        </Animated.View>
      </View>

      {/* Bottom Loading Dots Indicator */}
      <View style={styles.bottomSection}>
        <Animated.View style={[styles.pulsePill, { opacity: pulseOpacity }]} />
      </View>
    </Animated.View>
  );
}

const makeStyles = ({ fonts, radius }: ThemeTokens) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    centerContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    glowRing: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
    },
    logoWrapper: {
      marginBottom: 24,
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 8,
    },
    brandGroup: {
      alignItems: 'center',
    },
    brandTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: 4.5,
      color: '#FFFFFF',
      textTransform: 'uppercase',
    },
    subContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    subLine: {
      width: 18,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    brandSubtitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      fontWeight: '500',
      letterSpacing: 3,
      color: '#8E8E93',
      textTransform: 'uppercase',
    },
    bottomSection: {
      position: 'absolute',
      bottom: 50,
      alignItems: 'center',
    },
    pulsePill: {
      width: 32,
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: '#FFFFFF',
    },
  });
