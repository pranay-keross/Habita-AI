import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import Shirt from 'lucide-react-native/icons/shirt';
import GlassCard from '../../../components/GlassCard';
import { SkeletonCircle, SkeletonText } from '../../../components/Skeleton';
import { loadClothingItems, loadCollections } from '../stylePantryStore';
import { useFocusLoad, useLocaleRerender } from '../hooks';
import { categoryLabel } from '../format';
import WardrobeHeader from '../components/WardrobeHeader';
import ItemThumb from '../components/ItemThumb';
import OfflineBanner from '../components/OfflineBanner';
import { CATEGORY_ICON_KEYS, getClothingIconComponent } from '../clothingIcons';
import { CLOTHING_CATEGORIES, type ClothingCategory, type ClothingItem } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'ClosetItems'>;

export default function ClosetItemsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();
  const { title, collectionId, seasonFilter, wishlistOnly } = route.params ?? {};

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [collectionItemIds, setCollectionItemIds] = useState<string[] | null>(null);
  const [selectedCat, setSelectedCat] = useState<ClothingCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { loading, refreshing, offline, refresh } = useFocusLoad(
    useCallback(async () => {
      const token = await getAccessToken();
      const [list, cols] = await Promise.all([
        loadClothingItems(token),
        collectionId ? loadCollections(token) : Promise.resolve(null),
      ]);
      setItems(list.data);
      if (collectionId && cols) {
        const found = cols.data.find(c => c.id === collectionId);
        setCollectionItemIds(found ? found.itemIds : []);
      }
      return { offline: list.offline || Boolean(cols?.offline) };
    }, [getAccessToken, collectionId]),
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      if (wishlistOnly) {
        if (!item.isWishlist) return false;
      } else if (item.isWishlist) {
        return false;
      }
      if (collectionId && collectionItemIds && !collectionItemIds.includes(item.id)) return false;
      if (seasonFilter && item.season !== seasonFilter) return false;
      if (selectedCat !== 'all' && item.category !== selectedCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.brand ?? '').toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q)
      );
    });
  }, [items, wishlistOnly, collectionId, collectionItemIds, seasonFilter, selectedCat, searchQuery]);

  const categories: { key: ClothingCategory | 'all'; label: string; iconKey: string }[] = [
    { key: 'all', label: t('style_pantry.cat_all'), iconKey: 'shirt' },
    ...CLOTHING_CATEGORIES.map(c => ({ key: c, label: categoryLabel(c), iconKey: CATEGORY_ICON_KEYS[c] })),
  ];

  return (
    <View style={styles.root}>
      <WardrobeHeader
        title={title || t('style_pantry.dash_title')}
        onBack={() => navigation.goBack()}
        right={{
          icon: Plus,
          primary: true,
          accessibilityLabel: t('style_pantry.add_item_btn'),
          onPress: () =>
            navigation.navigate(
              'AddEditClothing',
              collectionId || wishlistOnly
                ? { collectionId, collectionName: title, wishlist: wishlistOnly }
                : {},
            ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={styles.iconTint.color} colors={[styles.iconTint.color]} />
        }
      >
        <OfflineBanner visible={offline} />

        <View style={styles.searchBarRow}>
          <Search size={18} color={styles.placeholder.color} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('style_pantry.search_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {categories.map(cat => {
            const active = selectedCat === cat.key;
            const CatIcon = getClothingIconComponent(cat.iconKey);
            return (
              <Pressable
                key={cat.key}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setSelectedCat(cat.key)}
              >
                <CatIcon size={14} color={active ? styles.chipTextActive.color : styles.chipText.color} style={styles.chipIcon} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('style_pantry.all_items', { count: filteredItems.length })}
          </Text>
        </View>

        {loading ? (
          <View style={styles.gridWrap}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.clothingCard, styles.skeletonCard]}>
                <SkeletonCircle size={56} style={styles.skeletonThumb} />
                <SkeletonText width="80%" />
                <SkeletonText width="50%" style={styles.skeletonLine} />
              </View>
            ))}
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Shirt size={36} color={styles.placeholder.color} />
            <Text style={styles.emptyTitle}>{t('style_pantry.no_items_found')}</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? t('style_pantry.try_search_again') : t('style_pantry.add_first_item')}
            </Text>
          </View>
        ) : (
          <View style={styles.gridWrap}>
            {filteredItems.map(item => (
              <GlassCard
                key={item.id}
                variant="default"
                style={styles.clothingCard}
                onPress={() => navigation.navigate('ClothingDetails', { itemId: item.id })}
              >
                <ItemThumb item={item} size={64} style={styles.thumb} muted={item.isWishlist} />
                <Text style={styles.cardItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardSubText} numberOfLines={1}>
                  {item.color}
                  {item.brand ? ` · ${item.brand}` : ''}
                </Text>
                <View style={styles.cardFooter}>
                  {item.isWishlist ? (
                    <View style={styles.wishlistBadge}>
                      <Text style={styles.wishlistBadgeText}>{t('style_pantry.wishlist_badge')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.wearCountText}>
                      {t('style_pantry.item_worn_times', { count: item.wearCount })}
                    </Text>
                  )}
                </View>
              </GlassCard>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    iconTint: { color: colors.primary },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    searchBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary, padding: 0 },
    placeholder: { color: colors.textSecondary },
    categoriesContainer: { paddingVertical: spacing.xs, gap: spacing.xs, marginBottom: spacing.md },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
    },
    categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipIcon: { marginRight: 6 },
    chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary },
    chipTextActive: { color: colors.textOnPrimary },
    listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    sectionTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.md,
    },
    emptyTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, marginTop: spacing.md },
    emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    clothingCard: { width: '48%', marginBottom: spacing.md, padding: spacing.md },
    skeletonCard: { backgroundColor: colors.surface, borderRadius: radius.card, alignItems: 'center' },
    skeletonThumb: { marginBottom: spacing.sm },
    skeletonLine: { marginTop: spacing.xs },
    thumb: { alignSelf: 'center', marginBottom: spacing.sm },
    cardItemName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    cardSubText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    cardFooter: { marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
    wearCountText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primary },
    wishlistBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.blush,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    wishlistBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primary },
  });
