import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Bookmark from 'lucide-react-native/icons/bookmark';
import BookmarkCheck from 'lucide-react-native/icons/bookmark-check';
import Button from '../../../components/Button';
import { saveOutfit, unsaveOutfit, wearOutfit } from '../stylePantryStore';
import { showStoreErrorAlert } from '../errors';
import { useBusy, useLocaleRerender } from '../hooks';
import { categoryLabel, eventTypeLabel } from '../format';
import ItemThumb from '../components/ItemThumb';
import OutfitShowcase, { MatchRow, StylistQuote, orderForHero } from '../components/OutfitShowcase';
import type { OutfitRecommendation } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'OutfitDetails'>;

const PANEL_OVERLAP = 24;

export default function OutfitDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const { getAccessToken } = useAuth();
  useLocaleRerender();
  const { readOnly } = route.params;

  const [outfit, setOutfit] = useState<OutfitRecommendation>(route.params.outfit);
  const [wearing, wear] = useBusy();
  const [saving, save] = useBusy();

  const heroHeight = Math.round(screenHeight * 0.58);
  const gridGap = 12;
  const gridTile = Math.floor((width - 48 - gridGap) / 2);

  const handleWearToday = () =>
    wear(async () => {
      const token = await getAccessToken();
      const result = await wearOutfit(outfit, token);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      Alert.alert(t('style_pantry.worn_alert_title'), t('style_pantry.worn_alert_msg'));
      navigation.navigate('Wardrobe');
    });

  const handleToggleSave = () =>
    save(async () => {
      const token = await getAccessToken();
      if (outfit.isSaved) {
        const result = await unsaveOutfit(outfit.id, token);
        if (!result.ok) {
          showStoreErrorAlert(result.error);
          return;
        }
        setOutfit(prev => ({ ...prev, isSaved: false }));
        return;
      }
      const result = await saveOutfit(outfit, token);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      setOutfit(result.data);
    });

  const SaveIcon = outfit.isSaved ? BookmarkCheck : Bookmark;
  const saveLabel = outfit.isSaved ? t('style_pantry.unsave_outfit') : t('style_pantry.save_outfit');
  const actionBarHeight = readOnly ? 0 : 84 + insets.bottom;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: actionBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Full-bleed hero */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <OutfitShowcase
            outfit={outfit}
            heroOnly
            heroHeight={heroHeight}
            horizontalInset={0}
            hideHeroChips
            onItemPress={item => navigation.navigate('ClothingDetails', { itemId: item.id })}
          />
          <View style={styles.heroBottom} pointerEvents="none">
            <View style={styles.heroScrim} />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroKicker}>{eventTypeLabel(outfit.occasion)}</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {outfit.title}
              </Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {outfit.eventTitle ? `${outfit.eventTitle} · ` : ''}
                {t('style_pantry.outfit_pieces', { count: outfit.items.length })}
              </Text>
            </View>
          </View>

          {/* Header controls live inside the hero so they scroll away with it */}
          <View style={[styles.floatingHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
            <Pressable style={styles.floatBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('style_pantry.go_back')} hitSlop={8}>
              <ArrowLeft size={20} color={styles.floatIcon.color} />
            </Pressable>
            {!readOnly ? (
              <Pressable
                style={[styles.floatBtn, outfit.isSaved && styles.floatBtnOn, saving && styles.disabled]}
                onPress={handleToggleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={saveLabel}
                hitSlop={8}
              >
                <SaveIcon size={20} color={outfit.isSaved ? styles.onPrimary.color : styles.floatIcon.color} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Content panel */}
        <View style={styles.panel}>
          {outfit.weatherSuitability || outfit.occasionSuitability ? (
            <View style={styles.matchGroup}>
              <MatchRow label={t('style_pantry.match_weather')} text={outfit.weatherSuitability} />
              <MatchRow label={t('style_pantry.match_occasion')} text={outfit.occasionSuitability} />
            </View>
          ) : null}

          <Text style={styles.sectionHeading}>{t('style_pantry.details_pieces_title')}</Text>
          <View style={[styles.grid, { gap: gridGap }]}>
            {orderForHero(outfit.items).map(item => (
              <Pressable
                key={item.id}
                style={{ width: gridTile }}
                onPress={() => navigation.navigate('ClothingDetails', { itemId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <ItemThumb item={item} size={gridTile} radius={20} />
                <Text style={styles.gridName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.gridSub} numberOfLines={1}>
                  {categoryLabel(item.category)} · {item.color}
                </Text>
              </Pressable>
            ))}
          </View>

          <StylistQuote note={outfit.stylistNote} />
        </View>
      </ScrollView>

      {!readOnly ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.actionPrimary}>
            <Button title={t('style_pantry.wear_today')} onPress={handleWearToday} loading={wearing} disabled={wearing || saving} />
          </View>
          <Pressable
            style={[styles.actionSave, outfit.isSaved && styles.actionSaveOn, (saving || wearing) && styles.disabled]}
            onPress={handleToggleSave}
            disabled={saving || wearing}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
          >
            <SaveIcon size={20} color={outfit.isSaved ? styles.onPrimary.color : styles.floatIcon.color} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    disabled: { opacity: 0.55 },
    onPrimary: { color: colors.textOnPrimary },
    floatIcon: { color: colors.textPrimary },
    hero: {
      width: '100%',
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      overflow: 'hidden',
      backgroundColor: colors.blush,
    },
    heroBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 48,
    },
    heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, opacity: 0.55 },
    heroTextWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg + PANEL_OVERLAP },
    heroKicker: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textOnPrimaryMuted,
      marginBottom: 4,
    },
    heroTitle: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.textOnPrimary },
    heroSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textOnPrimaryMuted, marginTop: 4 },
    panel: {
      marginTop: -PANEL_OVERLAP,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      ...shadow.soft,
    },
    matchGroup: { gap: spacing.sm + 2, marginBottom: spacing.lg },
    sectionHeading: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    gridName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginTop: spacing.sm },
    gridSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.xs },
    floatingHeader: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    floatBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      opacity: 0.92,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    floatBtnOn: { backgroundColor: colors.primary, opacity: 1 },
    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm + 4,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionPrimary: { flex: 1 },
    actionSave: {
      width: 52,
      height: 52,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    actionSaveOn: { backgroundColor: colors.primary },
  });
