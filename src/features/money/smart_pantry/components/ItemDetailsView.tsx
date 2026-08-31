import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { PantryItem, StorageLocation } from '../types';
import { ALLERGEN_DEFINITIONS, ALLERGEN_ICONS, PANTRY_CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from '../data/mockPantryData';
import { getDaysUntilExpiry } from '../services/pantryStorage';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import Check from 'lucide-react-native/icons/check';

interface Props {
  items: PantryItem[];
  selectedItem: PantryItem | null;
  onSelectItem: (item: PantryItem) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onDeleteItem: (id: string) => void;
}

export const ItemDetailsView: React.FC<Props> = ({
  items,
  selectedItem,
  onSelectItem,
  onUpdateQuantity,
  onDeleteItem,
}) => {
  const styles = useThemedStyles(makeStyles);

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
      <Text style={styles.sectionHeading}>{t('smart_pantry.details_title')}</Text>

      {/* Selector Row */}
      <Text style={styles.formLabel}>{t('smart_pantry.inspect_label')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 16 }}>
        {items.map((item) => {
          const CategoryIcon = PANTRY_CATEGORY_ICONS[item.category] || DEFAULT_CATEGORY_ICON;
          const active = selectedItem?.id === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.catChip, styles.catChipRow, active && styles.catChipActive]}
              onPress={() => onSelectItem(item)}>
              <CategoryIcon size={14} color={active ? styles.catChipTextActive.color : styles.catChipText.color} strokeWidth={2} style={{ marginRight: 4 }} />
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedItem ? (
        <View style={styles.itemDetailsCard}>
          <View style={styles.detailsHeaderRow}>
            <View style={styles.detailsEmojiCircle}>
              {(() => {
                const CategoryIcon = PANTRY_CATEGORY_ICONS[selectedItem.category] || DEFAULT_CATEGORY_ICON;
                return <CategoryIcon size={32} color={styles.detailsTitle.color} strokeWidth={1.5} />;
              })()}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailsTitle}>{selectedItem.name}</Text>
              <Text style={styles.detailsSub}>
                {selectedItem.category.toUpperCase()} · {t('smart_pantry.storage_location_prefix', { location: getLocName(selectedItem.storageLocation) })}
              </Text>
            </View>
          </View>

          {/* Expiry Banner */}
          <View style={styles.detailsExpiryBanner}>
            <Text style={styles.detailsExpiryTitle}>{t('smart_pantry.expiry_countdown')}</Text>
            <Text style={styles.detailsExpiryVal}>
              {t('smart_pantry.expires_on_date', {
                date: selectedItem.expiryDate,
                days: getDaysUntilExpiry(selectedItem.expiryDate),
              })}
            </Text>
          </View>

          {/* Quantity Stepper */}
          <Text style={styles.formLabel}>{t('smart_pantry.adjust_stock')}</Text>
          <View style={styles.qtyStepperRow}>
            <Pressable style={styles.qtyBtn} onPress={() => onUpdateQuantity(selectedItem.id, -1)}>
              <Text style={styles.qtyBtnText}>-</Text>
            </Pressable>
            <Text style={styles.qtyValueText}>
              {selectedItem.quantity} {selectedItem.unit}
            </Text>
            <Pressable style={styles.qtyBtn} onPress={() => onUpdateQuantity(selectedItem.id, 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>

          {/* Safety Badges */}
          <Text style={[styles.formLabel, { marginTop: 12 }]}>{t('smart_pantry.safety_badges')}</Text>
          <View style={styles.badgeRow}>
            {selectedItem.allergens.map((tag) => {
              const def = ALLERGEN_DEFINITIONS.find((a) => a.tag === tag);
              const label = def ? (def.labelKey ? t(def.labelKey, { defaultValue: def.label }) : def.label) : tag;
              return (
                <View key={tag} style={[styles.microBadge, styles.microBadgeRow]}>
                  <Check size={10} color={styles.microBadgeText.color} strokeWidth={2.5} style={{ marginRight: 3 }} />
                  <Text style={styles.microBadgeText}>{label}</Text>
                </View>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.detailsActionRow}>
            <Pressable style={styles.deleteBtn} onPress={() => onDeleteItem(selectedItem.id)}>
              <Text style={styles.deleteBtnText}>{t('smart_pantry.delete_item')}</Text>
            </Pressable>
            <Pressable style={styles.consumeBtn} onPress={() => onUpdateQuantity(selectedItem.id, -1)}>
              <Text style={styles.consumeBtnText}>{t('smart_pantry.use_consume')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.noItemText}>{t('smart_pantry.no_items')}</Text>
      )}
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm },
    sectionHeading: { fontFamily: fonts.serif, fontSize: 17, color: colors.textPrimary, marginBottom: 8 },
    formLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    catChip: { backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    catChipRow: { flexDirection: 'row', alignItems: 'center' },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
    catChipTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    itemDetailsCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
    detailsHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    detailsEmojiCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    detailsTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary },
    detailsSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
    detailsExpiryBanner: { backgroundColor: colors.background, padding: spacing.md, borderRadius: radius.md, marginBottom: 12 },
    detailsExpiryTitle: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
    detailsExpiryVal: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary, marginTop: 2 },
    qtyStepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 8 },
    qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    qtyBtnText: { fontSize: 18, fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    qtyValueText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
    microBadge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
    microBadgeRow: { flexDirection: 'row', alignItems: 'center' },
    microBadgeText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.textSecondary },
    detailsActionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    deleteBtn: { flex: 1, backgroundColor: colors.dangerSoft, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
    deleteBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.danger },
    consumeBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
    consumeBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textOnPrimary },
    noItemText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  });
