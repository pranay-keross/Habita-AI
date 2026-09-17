import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl, useWindowDimensions } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Pencil from 'lucide-react-native/icons/pencil';
import Trash2 from 'lucide-react-native/icons/trash';
import Tag from 'lucide-react-native/icons/tag';
import Clock from 'lucide-react-native/icons/clock';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import { SkeletonBox } from '../../../components/Skeleton';
import { getClothingItem, deleteClothingItem } from '../stylePantryStore';
import { showStoreErrorAlert } from '../errors';
import { useBusy, useFocusLoad, useLocaleRerender } from '../hooks';
import { dateLabel, itemCategoryLabel, priceLabel, seasonLabel } from '../format';
import WardrobeHeader from '../components/WardrobeHeader';
import PhotoCard from '../components/PhotoCard';
import OfflineBanner from '../components/OfflineBanner';
import type { ClothingItem } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'ClothingDetails'>;

// Matches this screen's `content` horizontal padding (spacing.lg).
const HERO_HORIZONTAL_INSET = 24;

export default function ClothingDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  const { itemId } = route.params;
  const { width: screenWidth } = useWindowDimensions();
  useLocaleRerender();

  const [item, setItem] = useState<ClothingItem | undefined>();
  const [busy, run] = useBusy();

  const { loading, refreshing, offline, refresh } = useFocusLoad(
    useCallback(async () => {
      const token = await getAccessToken();
      const r = await getClothingItem(itemId, token);
      setItem(r.data);
      return { offline: r.offline };
    }, [getAccessToken, itemId]),
  );

  const handleDelete = () => {
    if (!item) return;
    Alert.alert(
      t('style_pantry.delete_confirm_title'),
      t('style_pantry.delete_confirm_msg', { name: item.name }),
      [
        { text: t('style_pantry.cancel'), style: 'cancel' },
        {
          text: t('style_pantry.delete'),
          style: 'destructive',
          onPress: () =>
            run(async () => {
              const token = await getAccessToken();
              const result = await deleteClothingItem(item.id, token);
              if (!result.ok) {
                showStoreErrorAlert(result.error);
                return;
              }
              navigation.goBack();
            }),
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <WardrobeHeader title={t('style_pantry.item_details_title')} onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <SkeletonBox width="100%" height={180} borderRadius={16} style={styles.skeletonGap} />
          <SkeletonBox width="100%" height={100} borderRadius={16} />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.root}>
        <WardrobeHeader title={t('style_pantry.item_details_title')} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('style_pantry.item_not_found')}</Text>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>{t('style_pantry.go_back')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WardrobeHeader
        title={t('style_pantry.item_details_title')}
        onBack={() => navigation.goBack()}
        right={[
          {
            icon: Pencil,
            accessibilityLabel: t('style_pantry.edit_item'),
            onPress: () => navigation.navigate('AddEditClothing', { itemId: item.id }),
          },
          {
            icon: Trash2,
            accessibilityLabel: t('style_pantry.delete_item'),
            onPress: handleDelete,
            disabled: busy,
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={styles.iconTint.color} colors={[styles.iconTint.color]} />
        }
      >
        <OfflineBanner visible={offline} />

        {(() => {
          const heroWidth = screenWidth - HERO_HORIZONTAL_INSET * 2;
          const heroHeight = Math.round(heroWidth * 0.92);
          return (
            <View style={[styles.heroWrap, { width: heroWidth, height: heroHeight }]}>
              <PhotoCard
                item={item}
                width={heroWidth}
                height={heroHeight}
                radius={28}
                stripHeight={Math.round(heroHeight * 0.3)}
                overlay={
                  item.isWishlist ? (
                    <View style={styles.wishlistBadge}>
                      <Bookmark size={12} color={styles.onPrimary.color} />
                      <Text style={styles.wishlistBadgeText}>{t('style_pantry.wishlist_badge')}</Text>
                    </View>
                  ) : undefined
                }
              >
                <View>
                  <Text style={styles.heroKicker}>{itemCategoryLabel(item)}</Text>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.heroSub}>{item.color}</Text>
                </View>
              </PhotoCard>
            </View>
          );
        })()}

        <Text style={styles.sectionTitle}>{t('style_pantry.clothing_info')}</Text>
        <GlassCard variant="elevated" style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('style_pantry.brand_label')}</Text>
            <Text style={styles.metaVal}>{item.brand || t('style_pantry.not_specified')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('style_pantry.season_label')}</Text>
            <Text style={styles.metaVal}>{seasonLabel(item.season)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('style_pantry.material_label')}</Text>
            <Text style={styles.metaVal}>{item.material || t('style_pantry.standard_fabric')}</Text>
          </View>
          {item.purchasePrice != null ? (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('style_pantry.purchase_price_label')}</Text>
                <Text style={styles.metaVal}>{priceLabel(item.purchasePrice)}</Text>
              </View>
            </>
          ) : null}
        </GlassCard>

        {item.tags.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('style_pantry.tags_label')}</Text>
            <GlassCard variant="default" style={styles.card}>
              <View style={styles.tagsWrap}>
                {item.tags.map(tag => (
                  <View key={tag} style={styles.tagBadge}>
                    <Tag size={12} color={styles.iconTint.color} style={styles.tagIcon} />
                    <Text style={styles.tagBadgeText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </>
        )}

        {!item.isWishlist ? (
          <>
            <Text style={styles.sectionTitle}>{t('style_pantry.usage_history')}</Text>
            <GlassCard variant="default" style={styles.card}>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{item.wearCount}</Text>
                  <Text style={styles.statLabel}>{t('style_pantry.times_worn')}</Text>
                </View>
                <View style={styles.vDivider} />
                <View style={styles.statBox}>
                  <View style={styles.statDateRow}>
                    <Clock size={16} color={styles.iconTint.color} />
                    <Text style={styles.statDateVal}>
                      {item.lastWornDate ? dateLabel(item.lastWornDate) : t('style_pantry.not_worn_yet')}
                    </Text>
                  </View>
                  <Text style={styles.statLabel}>{t('style_pantry.last_worn_date')}</Text>
                </View>
              </View>
            </GlassCard>
          </>
        ) : null}

        <Button title={t('style_pantry.add_to_outfit')} onPress={() => navigation.navigate('StyleMirror')} />
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    iconTint: { color: colors.primary },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    skeletonGap: { marginBottom: spacing.md },
    onPrimary: { color: colors.textOnPrimary },
    heroWrap: { alignSelf: 'center', marginBottom: spacing.md },
    heroKicker: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.textOnPrimaryMuted,
    },
    heroTitle: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 27, color: colors.textOnPrimary, marginTop: 2 },
    heroSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textOnPrimaryMuted, marginTop: 3 },
    wishlistBadge: {
      position: 'absolute',
      top: spacing.sm + 4,
      right: spacing.sm + 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    wishlistBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textOnPrimary },
    sectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.xs },
    card: { marginBottom: spacing.md },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
    metaLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
    metaVal: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    tagBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.blush,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    tagIcon: { marginRight: 4 },
    tagBadgeText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.xs },
    statBox: { alignItems: 'center', flex: 1 },
    vDivider: { width: 1, height: 40, backgroundColor: colors.border },
    statNumber: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.primary },
    statDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statDateVal: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    statLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    errorText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md },
    backBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  });
