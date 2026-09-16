import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Image,
  Pressable,
  Platform,
} from 'react-native';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Cpu from 'lucide-react-native/icons/cpu';
import Receipt from 'lucide-react-native/icons/receipt';
import ScanBarcode from 'lucide-react-native/icons/scan-barcode';
import Salad from 'lucide-react-native/icons/salad';
import X from 'lucide-react-native/icons/x';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import { makePantryTokens } from '../constants/colors';

interface Props {
  visible: boolean;
  mode?: 'receipt' | 'barcode' | 'basket';
  previewUri?: string | null;
  onCancel?: () => void;
}

const VIEWFINDER_WIDTH = 220;
const VIEWFINDER_HEIGHT = 220;

const RECEIPT_STEPS = [
  'smart_pantry.ai_step_ingest',
  'smart_pantry.ai_step_ocr',
  'smart_pantry.ai_step_classify',
  'smart_pantry.ai_step_expiry',
  'smart_pantry.ai_step_finalize',
];

const RECEIPT_DEFAULT_TEXTS = [
  'Ingesting receipt image into Habita Vision AI...',
  'Neural OCR extracting grocery items & prices...',
  'Categorizing departments & safety tags...',
  'Predicting shelf life & storage zones with AI...',
  'Synthesizing itemized review list...',
];

const BARCODE_STEPS = [
  'smart_pantry.ai_step_barcode_detect',
  'smart_pantry.ai_step_barcode_query',
  'smart_pantry.ai_step_barcode_allergens',
  'smart_pantry.ai_step_barcode_shelf_life',
  'smart_pantry.ai_step_barcode_finalize',
];

const BARCODE_DEFAULT_TEXTS = [
  'Detecting universal packaging barcode...',
  'Querying global food product catalog...',
  'Resolving allergens & dietary safety tags...',
  'Calculating optimal storage & shelf life...',
  'Populating product profile...',
];

const BASKET_STEPS = [
  'smart_pantry.ai_step_basket_ingest',
  'smart_pantry.ai_step_basket_detect',
  'smart_pantry.ai_step_basket_count',
  'smart_pantry.ai_step_basket_shelf_life',
  'smart_pantry.ai_step_basket_finalize',
];

const BASKET_DEFAULT_TEXTS = [
  'Scanning your basket...',
  'Identifying fruits & vegetables...',
  'Counting pieces & estimating weights...',
  'Predicting freshness & storage zones...',
  'Preparing your pantry items...',
];

export const AiProcessingModal: React.FC<Props> = ({
  visible,
  mode = 'receipt',
  previewUri,
  onCancel,
}) => {
  const styles = useThemedStyles(makeStyles);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Animation values
  const laserAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const textOpacityAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Run looping animations when visible
  useEffect(() => {
    if (!visible) {
      setCurrentStepIndex(0);
      return;
    }

    // 1. Laser scanning beam loop (up & down)
    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    laserLoop.start();

    // 2. Glowing pulse rings
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    const pulseLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim2, {
          toValue: 1.45,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim2, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop2.start();

    // 3. Progress bar shimmer
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      }),
    );
    shimmerLoop.start();

    // 4. Dynamic step transition timer
    const totalSteps =
      mode === 'receipt'
        ? RECEIPT_STEPS.length
        : mode === 'basket'
          ? BASKET_STEPS.length
          : BARCODE_STEPS.length;
    const interval = setInterval(() => {
      // Fade out text
      Animated.timing(textOpacityAnim, {
        toValue: 0.1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStepIndex((prev) => (prev + 1) % totalSteps);
        // Fade in text
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }, 1350);

    return () => {
      laserLoop.stop();
      pulseLoop.stop();
      pulseLoop2.stop();
      shimmerLoop.stop();
      clearInterval(interval);
    };
  }, [visible, mode, laserAnim, pulseAnim, pulseAnim2, shimmerAnim, textOpacityAnim]);

  if (!visible) return null;

  const stepsList =
    mode === 'receipt' ? RECEIPT_STEPS : mode === 'basket' ? BASKET_STEPS : BARCODE_STEPS;
  const defaultTexts =
    mode === 'receipt'
      ? RECEIPT_DEFAULT_TEXTS
      : mode === 'basket'
        ? BASKET_DEFAULT_TEXTS
        : BARCODE_DEFAULT_TEXTS;
  const currentStepKey = stepsList[currentStepIndex];
  const currentStepText = t(currentStepKey, { defaultValue: defaultTexts[currentStepIndex] });

  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, VIEWFINDER_HEIGHT - 12],
  });

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 260],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Close button if user wants to cancel */}
          {onCancel && (
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <X size={18} color={styles.cancelIcon.color} />
            </Pressable>
          )}

          {/* AI Status Badge */}
          <View style={styles.aiBadgeRow}>
            <Animated.View style={[styles.aiPulsePill, { transform: [{ scale: pulseAnim }] }]}>
              <Sparkles size={13} color={styles.accentIcon.color} strokeWidth={2.4} />
            </Animated.View>
            <Text style={styles.aiBadgeText}>
              {mode === 'receipt'
                ? 'HABITA VISION AI'
                : mode === 'basket'
                  ? 'PRODUCE VISION AI'
                  : 'NEURAL BARCODE AI'}
            </Text>
            <View style={styles.liveDot} />
          </View>

          <Text style={styles.modalTitle}>
            {mode === 'receipt'
              ? 'Analyzing Receipt'
              : mode === 'basket'
                ? 'Scanning Your Basket'
                : 'Processing Barcode'}
          </Text>
          <Text style={styles.modalSubtitle}>
            {mode === 'receipt'
              ? 'Extracting grocery items & expiry predictions'
              : mode === 'basket'
                ? 'Identifying fruits & vegetables and their quantities'
                : 'Looking up product & allergen tags'}
          </Text>

          {/* Centerpiece Scanner Viewfinder */}
          <View style={styles.viewfinderBox}>
            {/* Pulsing Concentric Radar Rings in Background */}
            <Animated.View
              style={[
                styles.radarRing,
                styles.radarRing1,
                { transform: [{ scale: pulseAnim2 }] },
              ]}
            />
            <Animated.View
              style={[
                styles.radarRing,
                styles.radarRing2,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />

            {/* If a real image was captured/picked, show it inside the frame */}
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.hologramPlaceholder}>
                <View style={styles.hologramIconBox}>
                  {mode === 'receipt' ? (
                    <Receipt size={52} color={styles.accentIcon.color} strokeWidth={1.3} />
                  ) : mode === 'basket' ? (
                    <Salad size={52} color={styles.accentIcon.color} strokeWidth={1.3} />
                  ) : (
                    <ScanBarcode size={52} color={styles.accentIcon.color} strokeWidth={1.3} />
                  )}
                </View>
                <View style={styles.neuralDataLines}>
                  <Text style={styles.dataMatrixText}>[AI_OCR_SCAN_0x4F]</Text>
                  <Text style={styles.dataMatrixSub}>CONFIDENCE: 98.4%</Text>
                </View>
              </View>
            )}

            {/* Neon Reticle Brackets (4 Corners) */}
            <View style={[styles.reticleCorner, styles.reticleTopLeft]} />
            <View style={[styles.reticleCorner, styles.reticleTopRight]} />
            <View style={[styles.reticleCorner, styles.reticleBottomLeft]} />
            <View style={[styles.reticleCorner, styles.reticleBottomRight]} />

            {/* Glowing Laser Scanline Beam */}
            <Animated.View
              style={[
                styles.laserBeamContainer,
                {
                  transform: [{ translateY }],
                },
              ]}>
              <View style={styles.laserAura} />
              <View style={styles.laserLine} />
            </Animated.View>
          </View>

          {/* Step Indicator Pill */}
          <View style={styles.stepCounterRow}>
            <Cpu size={12} color={styles.stepIcon.color} style={styles.stepIconSpacing} />
            <Text style={styles.stepCounterText}>
              STAGE {currentStepIndex + 1} OF {stepsList.length}
            </Text>
          </View>

          {/* Dynamic AI Status Message */}
          <Animated.View style={[styles.messageBox, { opacity: textOpacityAnim }]}>
            <Text style={styles.statusMessageText}>{currentStepText}</Text>
          </Animated.View>

          {/* Shimmering AI Progress Bar */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressShimmerHighlight,
                {
                  transform: [{ translateX: shimmerTranslateX }],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * A colored glow, which the `shadow` tokens can't express — they only carry the
 * palette's own soft/medium elevation. Web gets a `boxShadow` branch so the glow
 * survives there too, which the previous hand-rolled Platform.select did not.
 */
function glow(color: string, blur: number, elevation: number) {
  if (Platform.OS === 'web') {
    return { boxShadow: `0px 0px ${blur}px ${color}` };
  }
  if (Platform.OS === 'android') {
    return { elevation };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: blur,
  };
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) => {
  const pantry = makePantryTokens(colors);

  return StyleSheet.create({
    // Color-only entries, read back for lucide `color` props.
    accentIcon: { color: pantry.scannerAccent },
    cancelIcon: { color: pantry.textOnDarkFaint },
    stepIcon: { color: pantry.scannerAccent },
    stepIconSpacing: { marginRight: spacing.xs },

    backdrop: {
      flex: 1,
      backgroundColor: pantry.scannerScrim,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    cardContainer: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: pantry.scannerSurface,
      borderRadius: radius.xxl,
      paddingVertical: spacing.lg + 4,
      paddingHorizontal: spacing.md + 4,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: pantry.scannerBorder,
      ...glow(pantry.scannerAccent, 18, 16),
    },
    cancelBtn: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      padding: spacing.xs + 2,
      zIndex: 10,
    },
    aiBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: pantry.scannerAccentFill,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.xs + 1,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: pantry.scannerAccentLine,
      marginBottom: spacing.sm + 4,
    },
    aiPulsePill: {
      marginRight: spacing.xs + 2,
    },
    aiBadgeText: {
      color: pantry.scannerAccent,
      fontSize: 11,
      fontFamily: fonts.sansBold,
      letterSpacing: 1.2,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: pantry.live,
      marginLeft: spacing.sm,
    },
    modalTitle: {
      color: pantry.textOnDark,
      fontSize: 19,
      fontFamily: fonts.sansBold,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    modalSubtitle: {
      color: pantry.textOnDarkMuted,
      fontSize: 12,
      fontFamily: fonts.sans,
      textAlign: 'center',
      marginBottom: spacing.md + 4,
      paddingHorizontal: spacing.sm,
    },
    viewfinderBox: {
      width: VIEWFINDER_WIDTH,
      height: VIEWFINDER_HEIGHT,
      borderRadius: radius.xl,
      backgroundColor: pantry.scannerLens,
      borderWidth: 1,
      borderColor: pantry.scannerAccentLine,
      position: 'relative',
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md + 4,
    },
    radarRing: {
      position: 'absolute',
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: pantry.scannerAccentLine,
    },
    radarRing1: {
      width: 140,
      height: 140,
    },
    radarRing2: {
      width: 190,
      height: 190,
    },
    previewImage: {
      width: '100%',
      height: '100%',
      borderRadius: radius.xl,
      opacity: 0.88,
    },
    hologramPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    hologramIconBox: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: pantry.scannerAccentFill,
      borderWidth: 1,
      borderColor: pantry.scannerAccentLine,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    neuralDataLines: {
      alignItems: 'center',
    },
    // The readout is deliberately monospace — it reads as instrument output, and
    // the theme has no mono family to draw on.
    dataMatrixText: {
      color: pantry.scannerAccent,
      fontSize: 10,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      letterSpacing: 1,
    },
    dataMatrixSub: {
      color: pantry.textOnDarkFaint,
      fontSize: 9,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      marginTop: 2,
    },
    reticleCorner: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderColor: pantry.scannerAccent,
    },
    reticleTopLeft: {
      top: 10,
      left: 10,
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderTopLeftRadius: radius.xs,
    },
    reticleTopRight: {
      top: 10,
      right: 10,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderTopRightRadius: radius.xs,
    },
    reticleBottomLeft: {
      bottom: 10,
      left: 10,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: radius.xs,
    },
    reticleBottomRight: {
      bottom: 10,
      right: 10,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: radius.xs,
    },
    laserBeamContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 10,
    },
    laserAura: {
      width: '100%',
      height: 18,
      backgroundColor: pantry.scannerAccentFill,
      borderBottomWidth: 1,
      borderBottomColor: pantry.scannerAccentLine,
    },
    laserLine: {
      width: '100%',
      height: 2.5,
      backgroundColor: pantry.scannerAccent,
      ...glow(pantry.scannerAccent, 8, 6),
    },
    stepCounterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs + 2,
    },
    stepCounterText: {
      color: pantry.scannerAccent,
      fontSize: 10,
      fontFamily: fonts.sansBold,
      letterSpacing: 0.8,
    },
    messageBox: {
      minHeight: 40,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.sm + 4,
      marginBottom: spacing.md,
    },
    statusMessageText: {
      color: pantry.textOnDark,
      fontSize: 13,
      fontFamily: fonts.sansMedium,
      textAlign: 'center',
      lineHeight: 18,
    },
    progressBarTrack: {
      width: '100%',
      height: 4,
      backgroundColor: pantry.scannerTrack,
      borderRadius: 2,
      overflow: 'hidden',
      position: 'relative',
    },
    progressShimmerHighlight: {
      width: 80,
      height: '100%',
      backgroundColor: pantry.scannerAccent,
      borderRadius: 2,
      ...glow(pantry.scannerAccent, 6, 4),
    },
  });
};
