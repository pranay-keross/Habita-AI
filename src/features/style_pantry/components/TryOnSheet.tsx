import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal, Pressable, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Sparkles from 'lucide-react-native/icons/sparkles';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import WardrobeHeader from './WardrobeHeader';
import { tryOnOutfit } from '../stylePantryStore';
import { describeStoreError } from '../errors';
import { resolveLocalUri } from '../photo';
import { t } from '../../../i18n';
import type { OutfitRecommendation, PickedFile } from '../types';

type Status = 'idle' | 'loading' | 'result' | 'error';

interface Props {
  visible: boolean;
  outfit: OutfitRecommendation | null;
  onClose: () => void;
}

/** Full-screen flow: pick a photo of yourself, then show the AI-generated result wearing the given outfit. */
export default function TryOnSheet({ visible, outfit, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const heroWidth = screenWidth - 48;
  const heroHeight = Math.round(heroWidth * 1.3);

  const [status, setStatus] = useState<Status>('idle');
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = () => {
    setStatus('idle');
    setResultUri(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const runTryOn = async (photo: PickedFile) => {
    if (!outfit) return;
    setStatus('loading');
    setErrorMessage(null);
    const token = await getAccessToken();
    const result = await tryOnOutfit(photo, outfit.items.map(i => i.id), token);
    if (!result.ok) {
      setErrorMessage(describeStoreError(result.error));
      setStatus('error');
      return;
    }
    setResultUri(result.data.imageDataUri);
    setStatus('result');
  };

  const handleTakePhoto = async () => {
    const res = await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.8, saveToPhotos: false });
    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    const fileName = asset.fileName || 'photo.jpg';
    const uri = await resolveLocalUri(asset.uri, fileName);
    await runTryOn({ uri, name: fileName, type: asset.type || 'image/jpeg' });
  };

  const handlePickFromGallery = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    const fileName = asset.fileName || 'photo.jpg';
    const uri = await resolveLocalUri(asset.uri, fileName);
    await runTryOn({ uri, name: fileName, type: asset.type || 'image/jpeg' });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.root}>
        <WardrobeHeader title={t('style_pantry.try_on_title')} onBack={handleClose} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {status === 'idle' ? (
            <>
              <Text style={styles.intro}>{t('style_pantry.try_on_intro')}</Text>
              <Pressable style={styles.photoOption} onPress={handleTakePhoto} accessibilityRole="button">
                <Camera size={18} color={styles.iconTint.color} style={styles.photoOptionIcon} />
                <Text style={styles.photoOptionText}>{t('style_pantry.try_on_take_photo')}</Text>
              </Pressable>
              <Pressable style={styles.photoOption} onPress={handlePickFromGallery} accessibilityRole="button">
                <ImageIcon size={18} color={styles.iconTint.color} style={styles.photoOptionIcon} />
                <Text style={styles.photoOptionText}>{t('style_pantry.try_on_choose_gallery')}</Text>
              </Pressable>
            </>
          ) : null}

          {status === 'loading' ? (
            <View style={styles.statusBlock}>
              <View style={styles.loadingIconWrap}>
                <ActivityIndicator color={styles.iconTint.color} size="large" />
              </View>
              <Text style={styles.statusTitle}>{t('style_pantry.try_on_generating')}</Text>
            </View>
          ) : null}

          {status === 'error' ? (
            <GlassCard variant="default" style={styles.warnCard}>
              <View style={styles.warnHeader}>
                <TriangleAlert size={18} color={styles.danger.color} />
                <Text style={styles.warnTitle}>{t('style_pantry.error_title')}</Text>
              </View>
              <Text style={styles.warnBody}>{errorMessage}</Text>
              <View style={styles.actionsCol}>
                <Button title={t('style_pantry.try_on_try_again')} onPress={reset} showArrow={false} />
              </View>
            </GlassCard>
          ) : null}

          {status === 'result' && resultUri ? (
            <>
              <View style={[styles.heroWrap, { width: heroWidth, height: heroHeight }]}>
                <Image source={{ uri: resultUri }} style={styles.resultImage} resizeMode="cover" />
                <View style={styles.resultBadge}>
                  <Sparkles size={13} color={styles.onPrimary.color} />
                  <Text style={styles.resultBadgeText}>{t('style_pantry.try_on_result_title')}</Text>
                </View>
              </View>
              <View style={styles.actionsCol}>
                <Button title={t('style_pantry.try_on_try_again')} onPress={reset} variant="outline" showArrow={false} />
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    onPrimary: { color: colors.textOnPrimary },
    iconTint: { color: colors.primary },
    danger: { color: colors.danger },
    intro: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg },
    photoOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    photoOptionIcon: { marginRight: 10 },
    photoOptionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
    statusBlock: { alignItems: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.md },
    loadingIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    statusTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary, textAlign: 'center' },
    warnCard: { marginTop: spacing.lg },
    warnHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginBottom: spacing.sm },
    warnTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
    warnBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
    actionsCol: { gap: spacing.sm, marginTop: spacing.lg },
    heroWrap: { alignSelf: 'center', borderRadius: 26, overflow: 'hidden' },
    resultImage: { width: '100%', height: '100%' },
    resultBadge: {
      position: 'absolute',
      top: spacing.sm + 4,
      left: spacing.sm + 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    resultBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.4, color: colors.textOnPrimary },
  });
