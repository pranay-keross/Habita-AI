import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  ScrollView,
  Text,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeightPercent?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Safe Blur import fallback handling
let BlurViewComponent: any = null;
try {
  const blurPkg = require('@react-native-community/blur');
  BlurViewComponent = blurPkg.BlurView;
} catch {
  BlurViewComponent = null;
}

export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightPercent = 0.85,
}: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [scrollOffset, setScrollOffset] = useState(0);

  // PanResponder to handle drag down gestures on handle header or top scroll position
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Drag down gesture detected
        if (gestureState.dy > 5) {
          // Allow drag down if scroll position is at the very top (scrollOffset <= 2)
          return scrollOffset <= 2;
        }
        return false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.6) {
          // Dragged down past threshold - close modal
          dismissSheet();
        } else {
          // Reset back to open position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setScrollOffset(0);
      translateY.setValue(SCREEN_HEIGHT);
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 3,
          speed: 14,
        }),
      ]).start();
    }
  }, [visible]);

  const dismissSheet = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismissSheet} statusBarTranslucent>
      <View style={styles.container}>
        {/* Pure Neutral Dark Backdrop Layer with Frosted Blur */}
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <View style={[StyleSheet.absoluteFill, styles.backdropDarkDim]} />
          {BlurViewComponent && (
            <BlurViewComponent
              style={StyleSheet.absoluteFill}
              blurType="dark"
              blurAmount={12}
              reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.5)"
            />
          )}
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissSheet} />
        </Animated.View>

        {/* Draggable Sheet Surface */}
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: SCREEN_HEIGHT * maxHeightPercent,
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}>
          {/* Top Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header Bar */}
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={dismissSheet} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Scrollable Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropDarkDim: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.medium,
    elevation: 24,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  content: {
    flexGrow: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: 40,
  },
});
