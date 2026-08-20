import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { AllergenTag, CategoryType, PantryItem, StorageLocation } from '../types';
import { ALLERGEN_DEFINITIONS } from '../data/mockPantryData';
import { getDaysUntilExpiry } from '../services/pantryStorage';
import { PANTRY_COLORS } from '../constants/colors';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import useTheme from '../../../../hooks/useTheme';

interface Props {
  filteredItems: PantryItem[];
  searchQuery: string;
  onSearchChange: (text: string) => void;
  selectedLocation: StorageLocation | 'All';
  onLocationSelect: (loc: StorageLocation | 'All') => void;
  selectedAllergenFilter: AllergenTag | 'all';
  onAllergenFilterSelect: (tag: AllergenTag | 'all') => void;
  sortBy: 'expiry' | 'name' | 'quantity';
  onSortBySelect: (sort: 'expiry' | 'name' | 'quantity') => void;
  onSelectItem: (item: PantryItem) => void;
  onNavigateAdd: () => void;
}

const CATEGORY_EMOJIS: Record<CategoryType, string> = {
  produce: '🥦',
  dairy: '🥛',
  bakery: '🍞',
  beverages: '🧃',
  meat: '🥩',
  pantry: '🥫',
};

const LOCATIONS: StorageLocation[] = ['Fridge', 'Freezer', 'Pantry Shelf'];

export const PantryInventoryView: React.FC<Props> = ({
  filteredItems,
  searchQuery,
  onSearchChange,
  selectedLocation,
  onLocationSelect,
  selectedAllergenFilter,
  onAllergenFilterSelect,
  sortBy,
  onSortBySelect,
  onSelectItem,
  onNavigateAdd,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const getLocLabel = (loc: StorageLocation | 'All') => {
    switch (loc) {
      case 'All':
        return `🌐 ${t('smart_pantry.loc_all')}`;
      case 'Fridge':
        return `❄️ ${t('smart_pantry.loc_fridge')}`;
      case 'Freezer':
        return `🧊 ${t('smart_pantry.loc_freezer')}`;
      case 'Pantry Shelf':
        return `🧺 ${t('smart_pantry.loc_pantry_shelf')}`;
      default:
        return loc;
    }
  };

  const getLocName = (loc: StorageLocation) => {
    switch (loc) {
      case 'Fridge':
        return t('smart_pantry.loc_fridge');
      case 'Freezer':
        return t('smart_pantry.loc_freezer');
      case 'Pantry Shelf':
        return t('smart_pantry.loc_pantry_shelf');
      default:
        return loc;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>{t('smart_pantry.inv_title')}</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('smart_pantry.search_placeholder')}
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery !== '' && (
          <Pressable onPress={() => onSearchChange('')}>
            <Text style={{ fontSize: 16, color: theme.colors.textMuted }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Location Filter Pills */}
      <View style={styles.filterChipRow}>
        {(['All', ...LOCATIONS] as (StorageLocation | 'All')[]).map((loc) => (
          <Pressable
            key={loc}
            style={[styles.pillChip, selectedLocation === loc && styles.pillChipActive]}
            onPress={() => onLocationSelect(loc)}>
            <Text style={[styles.pillChipText, selectedLocation === loc && styles.pillChipTextActive]}>
              {getLocLabel(loc)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Allergen Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allergenChipRow}>
        <Pressable
          style={[styles.allergenFilterChip, selectedAllergenFilter === 'all' && styles.allergenFilterChipActive]}
          onPress={() => onAllergenFilterSelect('all')}>
          <Text style={[styles.allergenFilterChipText, selectedAllergenFilter === 'all' && styles.allergenFilterChipTextActive]}>
            {t('smart_pantry.all_safety_tags')}
          </Text>
        </Pressable>
        {ALLERGEN_DEFINITIONS.map((def) => (
          <Pressable
            key={def.tag}
            style={[styles.allergenFilterChip, selectedAllergenFilter === def.tag && styles.allergenFilterChipActive]}
            onPress={() => onAllergenFilterSelect(def.tag)}>
            <Text style={[styles.allergenFilterChipText, selectedAllergenFilter === def.tag && styles.allergenFilterChipTextActive]}>
              {def.icon} {def.labelKey ? t(def.labelKey, { defaultValue: def.label }) : def.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Sort Options Bar */}
      <View style={styles.sortBar}>
        <Text style={styles.resultsCount}>{t('smart_pantry.items_listed', { count: filteredItems.length })}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            style={[styles.sortBtn, sortBy === 'expiry' && styles.sortBtnActive]}
            onPress={() => onSortBySelect('expiry')}>
            <Text style={[styles.sortBtnText, sortBy === 'expiry' && styles.sortBtnTextActive]}>{t('smart_pantry.sort_expiry')}</Text>
          </Pressable>
          <Pressable
            style={[styles.sortBtn, sortBy === 'quantity' && styles.sortBtnActive]}
            onPress={() => onSortBySelect('quantity')}>
            <Text style={[styles.sortBtnText, sortBy === 'quantity' && styles.sortBtnTextActive]}>{t('smart_pantry.sort_qty')}</Text>
          </Pressable>
          <Pressable
            style={[styles.sortBtn, sortBy === 'name' && styles.sortBtnActive]}
            onPress={() => onSortBySelect('name')}>
            <Text style={[styles.sortBtnText, sortBy === 'name' && styles.sortBtnTextActive]}>{t('smart_pantry.sort_name')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Inventory Item Cards */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={{ fontSize: 44, marginBottom: 8 }}>🧺</Text>
          <Text style={styles.emptyStateTitle}>{t('smart_pantry.no_items')}</Text>
          <Pressable style={styles.emptyStateBtn} onPress={onNavigateAdd}>
            <Text style={styles.emptyStateBtnText}>{t('smart_pantry.add_new_item')}</Text>
          </Pressable>
        </View>
      ) : (
        filteredItems.map((item) => {
          const daysLeft = getDaysUntilExpiry(item.expiryDate);
          const isUrgent = daysLeft <= 2;
          const isWarning = daysLeft > 2 && daysLeft <= 5;
          return (
            <Pressable
              key={item.id}
              style={styles.inventoryCard}
              onPress={() => onSelectItem(item)}>
              <View style={styles.inventoryMainRow}>
                <View style={styles.categoryCircle}>
                  <Text style={{ fontSize: 22 }}>{CATEGORY_EMOJIS[item.category] || '📦'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inventoryName}>{item.name}</Text>
                  <Text style={styles.inventorySub}>
                    {t('smart_pantry.quantity', { defaultValue: 'Qty' })}: {item.quantity} {item.unit} · {getLocName(item.storageLocation)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.expiryPill,
                    isUrgent ? styles.expiryPillUrgent : isWarning ? styles.expiryPillWarning : styles.expiryPillSafe,
                  ]}>
                  <Text
                    style={[
                      styles.expiryPillText,
                      isUrgent ? styles.expiryPillTextUrgent : isWarning ? styles.expiryPillTextWarning : styles.expiryPillTextSafe,
                    ]}>
                    {daysLeft <= 0 ? (t('doc_hub.status_expired', { defaultValue: 'Expired' })) : `${daysLeft}d left`}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm },
    sectionHeading: { fontFamily: fonts.serif, fontSize: 17, color: colors.textPrimary, marginBottom: 8 },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      marginBottom: 10,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
    filterChipRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
    pillChip: { backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    pillChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
    pillChipTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    allergenChipRow: { gap: 6, marginBottom: 10 },
    allergenFilterChip: { backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    allergenFilterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    allergenFilterChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
    allergenFilterChipTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    sortBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    resultsCount: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
    sortBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.surface },
    sortBtnActive: { backgroundColor: colors.primary },
    sortBtnText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
    sortBtnTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyStateTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary },
    emptyStateBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, marginTop: 12 },
    emptyStateBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textOnPrimary },
    inventoryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: 8,
      ...shadow.soft,
    },
    inventoryMainRow: { flexDirection: 'row', alignItems: 'center' },
    categoryCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    inventoryName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    inventorySub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    expiryPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
    expiryPillUrgent: { backgroundColor: colors.dangerSoft },
    expiryPillWarning: { backgroundColor: colors.turmericSoft },
    expiryPillSafe: { backgroundColor: colors.surfaceElevated },
    expiryPillText: { fontFamily: fonts.sansBold, fontSize: 10 },
    expiryPillTextUrgent: { color: colors.danger },
    expiryPillTextWarning: { color: colors.turmeric },
    expiryPillTextSafe: { color: colors.textSecondary },
  });
