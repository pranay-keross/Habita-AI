import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Pdf from 'react-native-pdf';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { t } from '../../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'DocViewer'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

export default function DocViewerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { url, fileName, kind } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ page: number; total: number } | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, MAX_SCALE));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        resetZoom();
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        resetZoom();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, Gesture.Race(doubleTapGesture, panGesture));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {fileName || t('doc_hub.doc_attachment')}
        </Text>
        <View style={styles.pageIndicatorSlot}>
          {kind === 'pdf' && pageInfo ? (
            <Text style={styles.pageIndicator}>{`${pageInfo.page}/${pageInfo.total}`}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.viewerArea}>
        {loading && !error && (
          <ActivityIndicator size="large" color="#FFFFFF" style={StyleSheet.absoluteFill} />
        )}
        {error ? (
          <Text style={styles.errorText}>{t('doc_hub.cannot_open_msg')}</Text>
        ) : kind === 'pdf' ? (
          <Pdf
            source={{ uri: url, cache: true }}
            style={styles.pdf}
            onLoadComplete={(numberOfPages) => {
              setLoading(false);
              setPageInfo({ page: 1, total: numberOfPages });
            }}
            onPageChanged={(page, numberOfPages) => setPageInfo({ page, total: numberOfPages })}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        ) : (
          <GestureDetector gesture={composedGesture}>
            <Animated.Image
              source={{ uri: url }}
              style={[styles.image, animatedStyle]}
              resizeMode="contain"
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
          </GestureDetector>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#000000',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  pageIndicatorSlot: {
    width: 40,
    alignItems: 'center',
  },
  pageIndicator: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  viewerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pdf: { width: SCREEN_W, height: SCREEN_H },
  image: { width: SCREEN_W, height: SCREEN_H },
  errorText: { color: '#FFFFFF', fontSize: 14 },
});
