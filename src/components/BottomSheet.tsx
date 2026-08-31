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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import X from 'lucide-react-native/icons/x';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeightPercent?: number;
  dark?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightPercent = 0.85,
  dark = false,
}: BottomSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [scrollOffset, setScrollOffset] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Android's Modal is its own Dialog window that never inherits the Activity's
  // `windowSoftInputMode`, so `KeyboardAvoidingView`'s height-shrink math (which
  // assumes it's shrinking a normal in-tree view) doesn't reliably free up room
  // inside a `justifyContent: 'flex-end'` sheet — shrinking the *sheet's own*
  // `maxHeight` directly by the actual keyboard height is what makes every field,
  // including one at the very bottom, end up above the keyboard.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
          duration: 200,
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
    // translateY and opacity are useRef(...).current — stable across renders.
  }, [visible, translateY, opacity]);

  const dismissSheet = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
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

  const sheetContent = (
    <>
      {/* Backdrop overlay */}
      <Animated.View style={[styles.backdrop, styles.backdropDarkDim, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissSheet} />
      </Animated.View>

      {/* Draggable Sheet Surface */}
      <Animated.View
        style={[
          styles.sheet,
          dark && styles.sheetDark,
          {
            maxHeight: SCREEN_HEIGHT * maxHeightPercent - keyboardHeight,
            transform: [{ translateY }],
          },
        ]}>
        {/* Top Handle Bar */}
        <View style={styles.handleContainer} {...panResponder.panHandlers}>
          <View style={[styles.handle, dark && styles.handleDark]} />
        </View>

        {/* Header Bar */}
        {title ? (
          <View style={[styles.header, dark && styles.headerDark]}>
            <Text style={[styles.title, dark && styles.titleDark]}>{title}</Text>
            <Pressable onPress={dismissSheet} style={[styles.closeBtn, dark && styles.closeBtnDark]}>
              <X size={14} color={dark ? styles.closeTextDark.color : styles.closeText.color} />
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
          {children}
        </ScrollView>
      </Animated.View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismissSheet} statusBarTranslucent>
      {/* RN's Modal renders as its own native Dialog window on Android, which never
          inherits the Activity's `windowSoftInputMode` — `KeyboardAvoidingView`'s
          height-shrink math doesn't reliably free up room inside a
          `justifyContent: 'flex-end'` sheet there, so Android instead pads the
          container by the tracked keyboard height directly (see the `keyboardHeight`
          effect above) while the sheet's own `maxHeight` shrinks by the same amount.
          iOS keeps the standard `KeyboardAvoidingView` `padding` behavior. */}
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" style={styles.container}>
          {sheetContent}
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
          {sheetContent}
        </View>
      )}
    </Modal>
  );
}

const makeStyles = ({ colors, fonts, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropDarkDim: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
  sheetDark: {
    backgroundColor: '#121216',
    borderTopColor: '#24242A',
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
  handleDark: {
    backgroundColor: '#32323E',
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
  headerDark: {
    borderBottomColor: '#24242A',
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDark: {
    backgroundColor: '#1E1E26',
  },
  closeText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  closeTextDark: {
    color: '#A0A0B0',
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
