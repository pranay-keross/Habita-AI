import React from 'react';
import { View, Text, ScrollView, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sparkles from 'lucide-react-native/icons/sparkles';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import WandSparkles from 'lucide-react-native/icons/wand-sparkles';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import { SkeletonText } from '../../../components/Skeleton';
import WardrobeHeader from './WardrobeHeader';
import PhotoCard from './PhotoCard';
import { itemCategoryLabel, seasonLabel } from '../format';
import { t } from '../../../i18n';
import type { WardrobeItemSuggestion } from '../types';

export type SuggestionStatus = 'analyzing' | 'ready' | 'error';

interface Props {
  visible: boolean;
  photoUri?: string;
  status: SuggestionStatus;
  suggestion: WardrobeItemSuggestion | null;
  errorMessage?: string;
  onUseDetails: (suggestion: WardrobeItemSuggestion) => void;
  onEnterManually: () => void;
  onRetake: () => void;
  onRetry: () => void;
  onClose: () => void;
}

// Fashion colour names rarely match CSS keywords ("navy blue", "off white"…) — a small
// keyword lookup gets a believable swatch dot without needing a real colour library.
const COLOR_HEX: [string, string][] = [
  ['black', '#1A1A1A'],
  ['white', '#F5F5F0'],
  ['ivory', '#F4EFE1'],
  ['cream', '#F2E8CF'],
  ['navy', '#1B2A4A'],
  ['blue', '#2E5CA8'],
  ['sky', '#7EC8E3'],
  ['red', '#C1272D'],
  ['maroon', '#6B1D2E'],
  ['burgundy', '#6E1E2F'],
  ['pink', '#E58FA6'],
  ['rose', '#D97E9B'],
  ['orange', '#D9762B'],
  ['yellow', '#E8C547'],
  ['mustard', '#C9A227'],
  ['green', '#3A7D44'],
  ['olive', '#6B6B3A'],
  ['teal', '#2E7D74'],
  ['purple', '#6A3D9A'],
  ['lavender', '#9E8FC1'],
  ['brown', '#6B4423'],
  ['tan', '#C8A165'],
  ['beige', '#D9C7A3'],
  ['khaki', '#B7A66B'],
  ['grey', '#8B8B8B'],
  ['gray', '#8B8B8B'],
  ['charcoal', '#3A3A3F'],
  ['silver', '#BFC3C7'],
  ['gold', '#C7A253'],
];

function swatchColor(name: string | undefined): string {
  if (!name) return '#B8B8B8';
  const lower = name.toLowerCase();
  const hit = COLOR_HEX.find(([key]) => lower.includes(key));
  return hit ? hit[1] : '#B8B8B8';
}

/** Full-screen "AI Photo Scan" review step shown right after a clothing photo is picked. */
export default function PhotoSuggestionSheet({
  visible,
  photoUri,
  status,
  suggestion,
  errorMessage,
  onUseDetails,
  onEnterManually,
  onRetake,
  onRetry,
  onClose,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const heroWidth = screenWidth - 48;
  const heroHeight = Math.round(heroWidth * 0.82);

  const looksLikeClothing = suggestion?.looksLikeClothing !== false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <WardrobeHeader title={t('style_pantry.photo_scan_title')} onBack={onClose} />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.heroWrap, { width: heroWidth, height: heroHeight }]}>
            <PhotoCard
              item={{ imageUri: photoUri, emoji: 'shirt', name: suggestion?.name ?? '' }}
              width={heroWidth}
              height={heroHeight}
              radius={26}
              overlay={
                status === 'ready' && looksLikeClothing ? (
                  <View style={styles.detectedBadge}>
                    <Sparkles size={13} color={styles.onPrimary.color} />
                    <Text style={styles.detectedBadgeText}>{t('style_pantry.suggestion_ready_badge')}</Text>
                  </View>
                ) : undefined
              }
            />
          </View>

          {status === 'analyzing' ? (
            <View style={styles.statusBlock}>
              <View style={styles.analyzingIconWrap}>
                <WandSparkles size={22} color={styles.iconTint.color} />
              </View>
              <Text style={styles.statusTitle}>{t('style_pantry.analyzing_photo')}</Text>
              <Text style={styles.statusSub}>{t('style_pantry.analyzing_photo_sub')}</Text>
              <View style={styles.skeletonWrap}>
                <SkeletonText width="70%" height={16} style={styles.skeletonLine} />
                <SkeletonText width="45%" height={14} style={styles.skeletonLine} />
                <SkeletonText width="55%" height={14} />
              </View>
            </View>
          ) : null}

          {status === 'error' ? (
            <GlassCard variant="default" style={styles.warnCard}>
              <View style={styles.warnHeader}>
                <TriangleAlert size={18} color={styles.danger.color} />
                <Text style={styles.warnTitle}>{t('style_pantry.suggestion_failed_title')}</Text>
              </View>
              <Text style={styles.warnBody}>{errorMessage || t('style_pantry.err_VISION_FAILED')}</Text>
              <View style={styles.actionsCol}>
                <Button title={t('style_pantry.retry')} onPress={onRetry} />
                <Button
                  title={t('style_pantry.suggestion_edit_manually')}
                  onPress={onEnterManually}
                  variant="outline"
                  showArrow={false}
                />
              </View>
            </GlassCard>
          ) : null}

          {status === 'ready' && suggestion && !looksLikeClothing ? (
            <GlassCard variant="default" style={styles.warnCard}>
              <View style={styles.warnHeader}>
                <TriangleAlert size={18} color={styles.danger.color} />
                <Text style={styles.warnTitle}>{t('style_pantry.suggestion_not_clothing_title')}</Text>
              </View>
              <Text style={styles.warnBody}>
                {suggestion.note || t('style_pantry.suggestion_not_clothing_title')}
              </Text>
              <View style={styles.actionsCol}>
                <Button title={t('style_pantry.suggestion_retake')} onPress={onRetake} />
                <Button
                  title={t('style_pantry.suggestion_edit_manually')}
                  onPress={onEnterManually}
                  variant="outline"
                  showArrow={false}
                />
              </View>
            </GlassCard>
          ) : null}

          {status === 'ready' && suggestion && looksLikeClothing ? (
            <>
              <GlassCard variant="glow" style={styles.suggestionCard}>
                <Text style={styles.suggestionSub}>{t('style_pantry.suggestion_ready_sub')}</Text>
                <Text style={styles.suggestionName} numberOfLines={2}>
                  {suggestion.name || t('style_pantry.not_specified')}
                </Text>

                <View style={styles.chipRow}>
                  {suggestion.category ? (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{itemCategoryLabel({ category: suggestion.category, dressType: suggestion.dressType })}</Text>
                    </View>
                  ) : null}
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{seasonLabel(suggestion.season)}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('style_pantry.suggestion_color_label')}</Text>
                  <View style={styles.colorValue}>
                    <View style={[styles.swatch, { backgroundColor: swatchColor(suggestion.color) }]} />
                    <Text style={styles.metaVal}>{suggestion.color || t('style_pantry.not_specified')}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('style_pantry.material_label')}</Text>
                  <Text style={styles.metaVal}>{suggestion.material || t('style_pantry.standard_fabric')}</Text>
                </View>

                {suggestion.tags.length > 0 ? (
                  <View style={styles.tagsWrap}>
                    {suggestion.tags.map(tag => (
                      <View key={tag} style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </GlassCard>

              <View style={styles.actionsCol}>
                <Button
                  title={t('style_pantry.suggestion_use')}
                  onPress={() => onUseDetails(suggestion)}
                  showArrow={false}
                />
                <Button
                  title={t('style_pantry.suggestion_edit_manually')}
                  onPress={onEnterManually}
                  variant="outline"
                  showArrow={false}
                />
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
    heroWrap: { alignSelf: 'center' },
    onPrimary: { color: colors.textOnPrimary },
    iconTint: { color: colors.primary },
    danger: { color: colors.danger },
    detectedBadge: {
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
    detectedBadgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textOnPrimary,
    },
    statusBlock: { alignItems: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.md },
    analyzingIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    statusTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary, textAlign: 'center' },
    statusSub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: spacing.lg,
    },
    skeletonWrap: { width: '100%', alignItems: 'center' },
    skeletonLine: { marginBottom: spacing.sm },
    warnCard: { marginTop: spacing.lg },
    warnHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginBottom: spacing.sm },
    warnTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
    warnBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
    actionsCol: { gap: spacing.sm, marginTop: spacing.lg },
    suggestionCard: { marginTop: spacing.lg },
    suggestionSub: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    suggestionName: { fontFamily: fonts.serif, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: colors.blush,
    },
    pillText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
    metaLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
    metaVal: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
    colorValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
    tagBadge: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    tagBadgeText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  });
