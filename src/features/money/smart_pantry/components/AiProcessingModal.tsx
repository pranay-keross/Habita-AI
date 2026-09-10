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
import X from 'lucide-react-native/icons/x';
import { t } from '../../../../i18n';

interface Props {
  visible: boolean;
  mode?: 'receipt' | 'barcode';
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

export const AiProcessingModal: React.FC<Props> = ({
  visible,
  mode = 'receipt',
  previewUri,
  onCancel,
}) => {
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
    const totalSteps = mode === 'receipt' ? RECEIPT_STEPS.length : BARCODE_STEPS.length;
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

  const stepsList = mode === 'receipt' ? RECEIPT_STEPS : BARCODE_STEPS;
  const defaultTexts = mode === 'receipt' ? RECEIPT_DEFAULT_TEXTS : BARCODE_DEFAULT_TEXTS;
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
              <X size={18} color="#94A3B8" />
            </Pressable>
          )}

          {/* AI Status Badge */}
          <View style={styles.aiBadgeRow}>
            <Animated.View style={[styles.aiPulsePill, { transform: [{ scale: pulseAnim }] }]}>
              <Sparkles size={13} color="#00F0FF" strokeWidth={2.4} />
            </Animated.View>
            <Text style={styles.aiBadgeText}>
              {mode === 'receipt' ? 'HABITA VISION AI' : 'NEURAL BARCODE AI'}
            </Text>
            <View style={styles.liveDot} />
          </View>

          <Text style={styles.modalTitle}>
            {mode === 'receipt' ? 'Analyzing Receipt' : 'Processing Barcode'}
          </Text>
          <Text style={styles.modalSubtitle}>
            {mode === 'receipt'
              ? 'Extracting grocery items & expiry predictions'
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
                    <Receipt size={52} color="#00F0FF" strokeWidth={1.3} />
                  ) : (
                    <ScanBarcode size={52} color="#00F0FF" strokeWidth={1.3} />
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
            <Cpu size={12} color="#38BDF8" style={{ marginRight: 4 }} />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0A1124',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  cancelBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    zIndex: 10,
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    marginBottom: 12,
  },
  aiPulsePill: {
    marginRight: 6,
  },
  aiBadgeText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 8,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  viewfinderBox: {
    width: VIEWFINDER_WIDTH,
    height: VIEWFINDER_HEIGHT,
    borderRadius: 18,
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.22)',
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
    borderRadius: 18,
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
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  neuralDataLines: {
    alignItems: 'center',
  },
  dataMatrixText: {
    color: '#38BDF8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  dataMatrixSub: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  reticleCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#00F0FF',
  },
  reticleTopLeft: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  reticleTopRight: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  reticleBottomLeft: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  reticleBottomRight: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
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
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 240, 255, 0.5)',
  },
  laserLine: {
    width: '100%',
    height: 2.5,
    backgroundColor: '#00F0FF',
    ...Platform.select({
      ios: {
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  stepCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCounterText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  messageBox: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statusMessageText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  progressShimmerHighlight: {
    width: 80,
    height: '100%',
    backgroundColor: '#00F0FF',
    borderRadius: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
    }),
  },
});
