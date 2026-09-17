import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Luggage from 'lucide-react-native/icons/luggage';
import WandSparkles from 'lucide-react-native/icons/wand-sparkles';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Palette from 'lucide-react-native/icons/palette';
import Ruler from 'lucide-react-native/icons/ruler';
import Star from 'lucide-react-native/icons/star';
import Camera from 'lucide-react-native/icons/camera';
import Plus from 'lucide-react-native/icons/plus';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Shirt from 'lucide-react-native/icons/shirt';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import {
  loadClothingItems,
  loadSavedOutfits,
  loadStyleHistory,
  loadTodaysOutfit,
  loadWeather,
  ownedItems,
  wearOutfit,
} from '../stylePantryStore';
import { showStoreErrorAlert, type StoreError } from '../errors';
import { useBusy, useFocusLoad, useLocaleRerender } from '../hooks';
import { itemCategoryLabel } from '../format';
import { getWeatherIconComponent } from '../clothingIcons';
import WardrobeHeader from '../components/WardrobeHeader';
import ItemThumb from '../components/ItemThumb';
import PhotoCard from '../components/PhotoCard';
import OfflineBanner from '../components/OfflineBanner';
import { addDays, todayString } from '../../../utils/date';
import type {
  ClothingItem,
  OutfitRecommendation,
  WeatherContext,
} from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'AiStylistHome'>;

const HERO_ORDER = ['tops', 'dresses', 'jackets', 'bottoms', 'shoes', 'accessories'];

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'ai_stylist.greeting_morning';
  if (hour < 17) return 'ai_stylist.greeting_afternoon';
  return 'ai_stylist.greeting_evening';
}

function heroItems(outfit: OutfitRecommendation): ClothingItem[] {
  return [...outfit.items].sort(
    (a, b) => HERO_ORDER.indexOf(a.category) - HERO_ORDER.indexOf(b.category),
  );
}

export default function AiStylistHomeScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  const { width } = useWindowDimensions();
  useLocaleRerender();

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [wornThisWeek, setWornThisWeek] = useState(0);
  const [recommendation, setRecommendation] =
    useState<OutfitRecommendation | null>(null);
  const [outfitError, setOutfitError] = useState<StoreError | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [regenerating, regenerate] = useBusy();
  const [wearing, wear] = useBusy();

  const load = useCallback(async () => {
    const token = await getAccessToken();
    const [list, w, saved, history] = await Promise.all([
      loadClothingItems(token),
      loadWeather(token),
      loadSavedOutfits(token),
      loadStyleHistory(token),
    ]);
    setItems(list.data);
    setWeather(w.data);
    setSavedCount(saved.data.length);
    const weekAgo = addDays(todayString(), -6);
    setWornThisWeek(history.data.filter(e => e.date >= weekAgo).length);

    if (ownedItems(list.data).length > 0) {
      const outfit = await loadTodaysOutfit(token);
      if (outfit.ok) {
        setRecommendation(outfit.data);
        setOutfitError(null);
      } else {
        setRecommendation(null);
        setOutfitError(outfit.error);
      }
    } else {
      setRecommendation(null);
      setOutfitError(null);
    }
    return { offline: list.offline };
  }, [getAccessToken]);

  const { loading, refreshing, offline, refresh } = useFocusLoad(load);

  const handleRegenerate = () =>
    regenerate(async () => {
      const token = await getAccessToken();
      const outfit = await loadTodaysOutfit(token, { regenerate: true });
      if (outfit.ok) {
        setRecommendation(outfit.data);
        setOutfitError(null);
      } else if (outfit.error.code === 'INSUFFICIENT_WARDROBE') {
        setRecommendation(null);
        setOutfitError(outfit.error);
      } else {
        showStoreErrorAlert(outfit.error);
      }
    });

  const handleWear = () =>
    wear(async () => {
      if (!recommendation) return;
      const token = await getAccessToken();
      const result = await wearOutfit(recommendation, token);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      setWornThisWeek(n => n + 1);
      Alert.alert(
        t('style_pantry.worn_alert_title'),
        t('style_pantry.worn_alert_msg'),
      );
    });

  const owned = ownedItems(items);
  const recentItems = owned
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const hasOwnedItems = owned.length > 0;
  const WeatherIcon = getWeatherIconComponent(weather?.condition);
  const heroWidth = width - 2 * 24;
  const heroCardHeight = Math.min(440, Math.round(heroWidth * 1.15));
  const heroStripHeight = Math.round(heroCardHeight * 0.46);

  const renderHero = () => {
    if (loading || regenerating) {
      return (
        <View style={styles.hero}>
          <SkeletonText width="40%" height={12} dark />
          <SkeletonBox height={180} borderRadius={20} style={styles.heroSkeleton} dark />
        </View>
      );
    }

    const weatherPill = weather ? (
      <View style={styles.weatherPill}>
        <WeatherIcon size={14} color={styles.heroMuted.color} />
        <Text style={styles.weatherPillText} numberOfLines={1}>
          {weather.description.includes('°')
            ? weather.description
            : `${weather.temperature}° · ${weather.description}`}
          {weather.city ? ` · ${weather.city}` : ''}
        </Text>
      </View>
    ) : null;

    if (recommendation) {
      const ordered = heroItems(recommendation);
      const [main, ...others] = ordered;
      if (main) {
        return (
          <View style={styles.heroPhotoCardWrap}>
            <PhotoCard
              item={main}
              width={heroWidth}
              height={heroCardHeight}
              radius={28}
              stripHeight={heroStripHeight}
              onPress={() =>
                navigation.navigate('OutfitDetails', { outfit: recommendation })
              }
              accessibilityLabel={recommendation.title}
              overlay={
                <View style={styles.heroOverlayTop} pointerEvents="box-none">
                  <View style={styles.heroKickerPill}>
                    <Text style={styles.heroKicker}>{t('ai_stylist.hero_kicker')}</Text>
                  </View>
                  {weatherPill}
                </View>
              }
            >
              <Text style={styles.heroTitle} numberOfLines={2}>
                {recommendation.title}
              </Text>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMeta}>
                  {t('style_pantry.outfit_pieces', {
                    count: recommendation.items.length,
                  })}
                </Text>
                {others.length > 0 ? (
                  <View style={styles.heroThumbRow}>
                    {others.slice(0, 4).map((item, i) => (
                      <View
                        key={item.id}
                        style={[styles.heroThumbWrap, i > 0 && styles.heroThumbOverlap]}
                      >
                        <ItemThumb item={item} size={32} radius={16} />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={styles.heroActions}>
                <Pressable
                  style={[styles.heroPrimaryBtn, styles.heroBtnFlex]}
                  onPress={handleWear}
                  disabled={wearing}
                  accessibilityRole="button"
                  accessibilityLabel={t('style_pantry.wear_today')}
                >
                  <Text style={styles.heroPrimaryBtnText}>
                    {t('style_pantry.wear_today')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.heroGhostBtn, styles.heroBtnFlex]}
                  onPress={handleRegenerate}
                  disabled={regenerating}
                  accessibilityRole="button"
                  accessibilityLabel={t('ai_stylist.regenerate')}
                >
                  <RefreshCw size={14} color={styles.heroOnPrimary.color} />
                  <Text style={styles.heroGhostBtnText} numberOfLines={1}>
                    {t('ai_stylist.regenerate')}
                  </Text>
                </Pressable>
              </View>
            </PhotoCard>
          </View>
        );
      }
    }

    if (!hasOwnedItems || outfitError?.code === 'INSUFFICIENT_WARDROBE') {
      return (
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroKicker}>{t('ai_stylist.hero_kicker')}</Text>
            {weatherPill}
          </View>
          <View style={styles.heroEmptyIcon}>
            <Shirt size={26} color={styles.heroOnPrimary.color} />
          </View>
          <Text style={styles.heroTitle}>{t('ai_stylist.hero_empty_title')}</Text>
          <Text style={styles.heroEmptySub}>{t('ai_stylist.hero_empty_sub')}</Text>
          <Pressable
            style={[styles.heroPrimaryBtn, styles.heroBtnSelf]}
            onPress={() => navigation.navigate('AddEditClothing', {})}
            accessibilityRole="button"
            accessibilityLabel={t('style_pantry.add_item_btn')}
          >
            <Text style={styles.heroPrimaryBtnText}>
              {t('style_pantry.add_item_btn')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroKicker}>{t('ai_stylist.hero_kicker')}</Text>
          {weatherPill}
        </View>
        <Text style={styles.heroTitle}>{t('style_pantry.generate_failed')}</Text>
        <Pressable
          style={[styles.heroPrimaryBtn, styles.heroBtnSelf]}
          onPress={handleRegenerate}
          disabled={regenerating}
          accessibilityRole="button"
          accessibilityLabel={t('style_pantry.retry')}
        >
          <Text style={styles.heroPrimaryBtnText}>{t('style_pantry.retry')}</Text>
        </Pressable>
      </View>
    );
  };

  const labs = [
    { key: 'qa_find_color', Icon: Palette },
    { key: 'qa_find_fit', Icon: Ruler },
    { key: 'qa_rate_style', Icon: Star },
    { key: 'qa_try_on', Icon: Camera },
  ];

  return (
    <View style={styles.root}>
      <WardrobeHeader
        title={t('ai_stylist.hub_title')}
        onBack={() => navigation.goBack()}
        right={[
          {
            icon: Luggage,
            onPress: () => navigation.navigate('Trips'),
            accessibilityLabel: t('trip.list_title'),
          },
          {
            icon: FolderOpen,
            onPress: () => navigation.navigate('Wardrobe'),
            accessibilityLabel: t('closet.title'),
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={styles.iconTint.color}
            colors={[styles.iconTint.color]}
          />
        }
      >
        <Text style={styles.greeting}>{t(greetingKey())}</Text>
        <Text style={styles.subGreeting}>{t('ai_stylist.hub_subtitle')}</Text>

        <OfflineBanner visible={offline} />

        {renderHero()}

        <View style={styles.purposeRow}>
          <Pressable
            style={[styles.purposeCard, styles.purposeCardOutline]}
            onPress={() => navigation.navigate('StyleMirror')}
            accessibilityRole="button"
            accessibilityLabel={t('ai_stylist.action_outfit_title')}
          >
            <View style={styles.purposeIconCircle}>
              <WandSparkles size={20} color={styles.iconTint.color} />
            </View>
            <View style={styles.purposeTextBlock}>
              <Text style={styles.purposeTitle}>
                {t('ai_stylist.action_outfit_title')}
              </Text>
              <Text style={styles.purposeSub} numberOfLines={3}>
                {t('ai_stylist.action_outfit_sub')}
              </Text>
            </View>
            <View style={styles.purposeArrow}>
              <ArrowRight size={16} color={styles.iconTint.color} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.purposeCard, styles.purposeCardBlush]}
            onPress={() => navigation.navigate('StyleChat')}
            accessibilityRole="button"
            accessibilityLabel={t('ai_stylist.action_chat_title')}
          >
            <View style={[styles.purposeIconCircle, styles.purposeIconCircleDark]}>
              <MessageCircle size={20} color={styles.heroOnPrimary.color} />
            </View>
            <View style={styles.purposeTextBlock}>
              <Text style={styles.purposeTitle}>
                {t('ai_stylist.action_chat_title')}
              </Text>
              <Text style={styles.purposeSub} numberOfLines={3}>
                {t('ai_stylist.action_chat_sub')}
              </Text>
            </View>
            <View style={styles.purposeArrow}>
              <ArrowRight size={16} color={styles.iconTint.color} />
            </View>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          {[
            { key: 'stat_items', value: owned.length, onPress: () => navigation.navigate('Wardrobe') },
            { key: 'stat_saved', value: savedCount, onPress: () => navigation.navigate('SavedOutfits') },
            { key: 'stat_worn_week', value: wornThisWeek, onPress: () => navigation.navigate('StyleLog') },
          ].map((s, i) => (
            <Pressable
              key={s.key}
              style={[styles.statTile, i > 0 && styles.statTileSpaced]}
              onPress={s.onPress}
              accessibilityRole="button"
              accessibilityLabel={t(`ai_stylist.${s.key}`)}
            >
              {loading ? (
                <SkeletonText width="40%" height={20} />
              ) : (
                <Text style={styles.statValue}>{s.value}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                {t(`ai_stylist.${s.key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>{t('ai_stylist.recently_added')}</Text>
          <Pressable
            onPress={() => navigation.navigate('Wardrobe')}
            accessibilityRole="button"
            accessibilityLabel={t('ai_stylist.see_all')}
            style={styles.seeAllRow}
          >
            <Text style={styles.seeAllText}>{t('ai_stylist.see_all')}</Text>
            <ArrowRight size={14} color={styles.iconTint.color} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentScroll}
        >
          {loading
            ? [0, 1, 2].map(i => (
                <SkeletonBox key={i} width={150} height={200} borderRadius={20} />
              ))
            : recentItems.map(item => (
                <PhotoCard
                  key={item.id}
                  item={item}
                  width={150}
                  height={200}
                  radius={20}
                  stripHeight={64}
                  onPress={() =>
                    navigation.navigate('ClothingDetails', { itemId: item.id })
                  }
                  accessibilityLabel={item.name}
                >
                  <Text style={styles.recentName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.recentCategory} numberOfLines={1}>
                    {itemCategoryLabel(item)}
                  </Text>
                </PhotoCard>
              ))}
          {!loading ? (
            <Pressable
              style={styles.addRecentCard}
              onPress={() => navigation.navigate('AddEditClothing', {})}
              accessibilityRole="button"
              accessibilityLabel={t('style_pantry.add_item_btn')}
            >
              <View style={styles.addRecentCircle}>
                <Plus size={20} color={styles.iconTint.color} />
              </View>
              <Text style={styles.addRecentText}>{t('style_pantry.add_item_btn')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <Text style={[styles.sectionTitle, styles.labsTitle]}>
          {t('ai_stylist.labs_title')}
        </Text>
        <View style={styles.labsRow}>
          {labs.map(({ key, Icon }) => (
            <Pressable
              key={key}
              style={styles.labChip}
              onPress={() => setComingSoon(t(`ai_stylist.${key}`))}
              accessibilityRole="button"
              accessibilityLabel={t(`ai_stylist.${key}`)}
            >
              <Icon size={14} color={styles.labChipText.color} />
              <Text style={styles.labChipText}>{t(`ai_stylist.${key}`)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <BottomSheet
        visible={!!comingSoon}
        onClose={() => setComingSoon(null)}
        title={comingSoon || ''}
      >
        <Text style={styles.comingSoonText}>{t('ai_stylist.coming_soon')}</Text>
        <Button
          title={t('ai_stylist.coming_soon_ok')}
          onPress={() => setComingSoon(null)}
          style={styles.comingSoonBtn}
        />
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing, shadow }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    iconTint: { color: colors.primary },
    heroOnPrimary: { color: colors.textOnPrimary },
    heroMuted: { color: colors.textOnPrimaryMuted },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    greeting: {
      fontFamily: fonts.serif,
      fontSize: 30,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    subGreeting: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: spacing.lg,
    },

    // Hero
    hero: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      padding: spacing.lg - 4,
      marginBottom: spacing.lg,
      ...shadow.medium,
    },
    heroSkeleton: { marginTop: spacing.md },
    // Elevation needs a rounded, opaque background of its own, otherwise Android
    // paints a square shadow behind the rounded card.
    heroPhotoCardWrap: { marginBottom: spacing.lg, borderRadius: 28, backgroundColor: colors.surface, ...shadow.medium },
    heroOverlayTop: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    heroKickerPill: {
      backgroundColor: colors.primary,
      opacity: 0.75,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 6,
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    heroBtnFlex: { flex: 1 },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    heroKicker: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.textOnPrimaryMuted,
    },
    weatherPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      opacity: 0.75,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 6,
      flexShrink: 1,
    },
    weatherPillText: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textOnPrimaryMuted,
      flexShrink: 1,
    },
    heroBody: { flexDirection: 'row', gap: spacing.md },
    heroTextCol: { flex: 1, justifyContent: 'space-between' },
    heroTitle: {
      fontFamily: fonts.serif,
      fontSize: 22,
      lineHeight: 28,
      color: colors.textOnPrimary,
    },
    heroMeta: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textOnPrimaryMuted,
      marginTop: spacing.xs,
    },
    heroActions: { marginTop: spacing.sm + 4, flexDirection: 'row', gap: spacing.sm },
    heroPrimaryBtn: {
      backgroundColor: colors.textOnPrimary,
      borderRadius: radius.pill,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    heroBtnSelf: { alignSelf: 'flex-start', marginTop: spacing.md },
    heroPrimaryBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.primary,
    },
    heroGhostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.textOnPrimaryMuted,
      paddingVertical: 9,
      paddingHorizontal: spacing.md,
    },
    heroGhostBtnText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textOnPrimary,
    },
    heroThumbRow: {
      flexDirection: 'row',
      paddingLeft: 8,
    },
    heroThumbWrap: {
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.textOnPrimary,
    },
    heroThumbOverlap: { marginLeft: -8 },
    heroEmptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    heroEmptySub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textOnPrimaryMuted,
      marginTop: spacing.xs,
    },

    // Purpose cards
    purposeRow: { flexDirection: 'row', gap: spacing.sm + 4, marginBottom: spacing.lg },
    purposeCard: {
      flex: 1,
      minHeight: 150,
      borderRadius: radius.xxl,
      padding: spacing.md,
      borderWidth: 1,
    },
    purposeCardOutline: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    purposeCardBlush: {
      backgroundColor: colors.blush,
      borderColor: colors.border,
    },
    purposeIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm + 4,
    },
    purposeIconCircleDark: { backgroundColor: colors.primary },
    purposeTextBlock: { flex: 1 },
    purposeTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    purposeSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
      marginTop: 4,
    },
    purposeArrow: {
      alignSelf: 'flex-end',
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },

    // Stats
    statsRow: { flexDirection: 'row', marginBottom: spacing.lg },
    statTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
    },
    statTileSpaced: { marginLeft: spacing.sm },
    statValue: {
      fontFamily: fonts.serif,
      fontSize: 24,
      color: colors.textPrimary,
    },
    statLabel: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },

    // Recently added
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    listHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm + 4,
    },
    seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    seeAllText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },
    recentScroll: { gap: spacing.sm + 4, paddingBottom: spacing.xs },
    recentName: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textOnPrimary,
    },
    recentCategory: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textOnPrimaryMuted,
      marginTop: 1,
    },
    addRecentCard: {
      width: 150,
      height: 200,
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    addRecentCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addRecentText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },

    // Labs
    labsTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
    labsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    labChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: spacing.sm + 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    labChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    comingSoonText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
    comingSoonBtn: { marginTop: spacing.sm },
  });
