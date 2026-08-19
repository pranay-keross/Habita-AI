import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Search from 'lucide-react-native/icons/search';
import Plus from 'lucide-react-native/icons/plus';
import Sparkles from 'lucide-react-native/icons/sparkles';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Shirt from 'lucide-react-native/icons/shirt';
import { loadClothingItems } from '../stylePantryStore';
import type { ClothingCategory, ClothingItem } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StylePantryDashboard' | 'Wardrobe'>;

const CATEGORIES: { key: ClothingCategory | 'all'; labelKey: string; icon: string }[] = [
  { key: 'all', labelKey: 'style_pantry.cat_all', icon: '👔' },
  { key: 'tops', labelKey: 'style_pantry.cat_tops', icon: '👕' },
  { key: 'bottoms', labelKey: 'style_pantry.cat_bottoms', icon: '👖' },
  { key: 'shoes', labelKey: 'style_pantry.cat_shoes', icon: '👞' },
  { key: 'jackets', labelKey: 'style_pantry.cat_jackets', icon: '🧥' },
  { key: 'accessories', labelKey: 'style_pantry.cat_accessories', icon: '⌚' },
];

export default function WardrobeDashboardScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<ClothingCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    const list = await loadClothingItems();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    const unsubFocus = navigation.addListener('focus', () => {
      fetchItems();
    });
    return () => {
      unsubLang();
      unsubFocus();
    };
  }, [navigation]);

  const filteredItems = items.filter((item) => {
    const matchesCat = selectedCat === 'all' || item.category === selectedCat;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.color && item.color.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('style_pantry.dash_title')}</Text>
        <Pressable
          onPress={() => navigation.navigate('AddEditClothing', {})}
          style={styles.addNavBtn}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchBarRow}>
          <Search size={18} color={styles.placeholder.color} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('style_pantry.search_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        {/* AI Style Mirror Banner */}
        <Pressable
          style={styles.aiBannerCard}
          onPress={() => navigation.navigate('StyleMirror')}>
          <View style={styles.aiBannerLeft}>
            <View style={styles.sparkleCircle}>
              <Sparkles size={22} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiBannerTitle}>{t('style_pantry.ai_banner_title')}</Text>
              <Text style={styles.aiBannerSub}>{t('style_pantry.ai_banner_sub')}</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#7C3AED" />
        </Pressable>

        {/* Category Horizontal Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              style={[
                styles.categoryChip,
                selectedCat === cat.key && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCat(cat.key)}>
              <Text style={styles.chipEmoji}>{cat.icon}</Text>
              <Text
                style={[
                  styles.chipText,
                  selectedCat === cat.key && styles.chipTextActive,
                ]}>
                {t(cat.labelKey)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Items List Header */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('style_pantry.all_items', { count: filteredItems.length })}
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AddEditClothing', {})}
            style={styles.inlineAddBtn}>
            <Text style={styles.inlineAddBtnText}>{t('style_pantry.add_item_btn')}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color="#004F63" style={{ marginTop: 24 }} />
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
            {filteredItems.map((item) => (
              <Pressable
                key={item.id}
                style={styles.clothingCard}
                onPress={() => navigation.navigate('ClothingDetails', { itemId: item.id })}>
                <View style={styles.cardEmojiBadge}>
                  <Text style={styles.cardEmojiText}>{item.emoji || '👕'}</Text>
                </View>
                <Text style={styles.cardItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardSubText}>
                  {item.color} {item.brand ? `· ${item.brand}` : ''}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.wearCountText}>
                    {t('style_pantry.item_worn_times', { count: item.wearCount })}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    headerIcon: {
      color: colors.textPrimary,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    addNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#004F63',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
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
    searchInput: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
      padding: 0,
    },
    placeholder: {
      color: colors.textSecondary,
    },
    aiBannerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#F3E8FF',
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#DDD6FE',
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    aiBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: spacing.sm,
    },
    sparkleCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    aiBannerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: '#5B21B6',
    },
    aiBannerSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: '#6D28D9',
      marginTop: 2,
    },
    categoriesContainer: {
      paddingVertical: spacing.xs,
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
    },
    categoryChipActive: {
      backgroundColor: '#004F63',
      borderColor: '#004F63',
    },
    chipEmoji: {
      fontSize: 14,
      marginRight: 6,
    },
    chipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    listHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    inlineAddBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    inlineAddBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: '#004F63',
    },
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
    emptyTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginTop: spacing.md,
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    clothingCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    cardEmojiBadge: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      backgroundColor: '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      alignSelf: 'center',
    },
    cardEmojiText: {
      fontSize: 28,
    },
    cardItemName: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    cardSubText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cardFooter: {
      marginTop: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    wearCountText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: '#004F63',
    },
  });
