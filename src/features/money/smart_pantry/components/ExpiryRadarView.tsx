import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PantryItem, StorageLocation } from '../types';
import { ALLERGEN_DEFINITIONS, ALLERGEN_ICONS, PANTRY_CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from '../data/mockPantryData';
import { getDaysUntilExpiry } from '../services/pantryStorage';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';

interface Props {
  items: PantryItem[];
  onNavigateRecipes: () => void;
}

export const ExpiryRadarView: React.FC<Props> = ({ items, onNavigateRecipes }) => {
  const styles = useThemedStyles(makeStyles);

  const urgentItems = items.filter((i) => getDaysUntilExpiry(i.expiryDate) <= 2);
  const upcomingItems = items.filter((i) => getDaysUntilExpiry(i.expiryDate) > 2 && getDaysUntilExpiry(i.expiryDate) <= 7);

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
      <View style={styles.radarHeaderCard}>
        <Text style={styles.radarHeaderTitle}>{t('smart_pantry.radar_title')}</Text>
        <Text style={styles.radarHeaderSub}>{t('smart_pantry.radar_sub')}</Text>
      </View>

      {/* Expiry Urgency Sections */}
      <Text style={styles.sectionHeading}>{t('smart_pantry.urgent_exp')}</Text>
      {urgentItems.length === 0 ? (
        <Text style={styles.noUrgentText}>{t('smart_pantry.no_urgent')}</Text>
      ) : (
        urgentItems.map((item) => {
          const CategoryIcon = PANTRY_CATEGORY_ICONS[item.category] || DEFAULT_CATEGORY_ICON;
          return (
          <View key={item.id} style={[styles.radarItemCard, styles.radarItemCardUrgent]}>
            <CategoryIcon size={22} color={styles.radarItemName.color} strokeWidth={1.8} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.radarItemName}>{item.name}</Text>
              <Text style={styles.radarItemSub}>
                {t('smart_pantry.expires_in_days', {
                  days: getDaysUntilExpiry(item.expiryDate),
                  qty: item.quantity,
                  unit: item.unit,
                })}
              </Text>
            </View>
            <Pressable style={styles.cookActionBtn} onPress={onNavigateRecipes}>
              <Text style={styles.cookActionBtnText}>{t('smart_pantry.cook_now')}</Text>
            </Pressable>
          </View>
          );
        })
      )}

      <Text style={[styles.sectionHeading, { marginTop: 16 }]}>{t('smart_pantry.upcoming_exp')}</Text>
      {upcomingItems.map((item) => {
        const CategoryIcon = PANTRY_CATEGORY_ICONS[item.category] || DEFAULT_CATEGORY_ICON;
        return (
        <View key={item.id} style={[styles.radarItemCard, styles.radarItemCardWarning]}>
          <CategoryIcon size={22} color={styles.radarItemName.color} strokeWidth={1.8} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.radarItemName}>{item.name}</Text>
            <Text style={styles.radarItemSub}>
              {t('smart_pantry.expires_in_days_loc', {
                days: getDaysUntilExpiry(item.expiryDate),
                location: getLocName(item.storageLocation),
              })}
            </Text>
          </View>
        </View>
        );
      })}

      {/* Dietary Allergen Safety Matrix */}
      <Text style={[styles.sectionHeading, { marginTop: 20 }]}>{t('smart_pantry.allergen_matrix')}</Text>
      <View style={styles.radarMatrixCard}>
        {ALLERGEN_DEFINITIONS.map((def) => {
          const safeCount = items.filter((i) => i.allergens.includes(def.tag)).length;
          const AllergenIcon = ALLERGEN_ICONS[def.tag];
          return (
            <View key={def.tag} style={styles.matrixRow}>
              <View style={{ width: 30 }}>
                <AllergenIcon size={18} color={styles.matrixLabel.color} strokeWidth={1.8} />
              </View>
              <Text style={styles.matrixLabel}>{def.labelKey ? t(def.labelKey, { defaultValue: def.label }) : def.label}</Text>
              <Text style={styles.matrixValue}>{t('smart_pantry.items_safe', { safe: safeCount, total: items.length })}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm },
    sectionHeading: { fontFamily: fonts.serif, fontSize: 17, color: colors.textPrimary, marginBottom: 8 },
    radarHeaderCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md },
    radarHeaderTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textOnPrimary },
    radarHeaderSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textOnPrimaryMuted, marginTop: 2 },
    radarItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, padding: spacing.md, marginBottom: 8 },
    radarItemCardUrgent: { borderLeftColor: colors.danger },
    radarItemCardWarning: { borderLeftColor: colors.turmeric },
    radarItemName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    radarItemSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    cookActionBtn: { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
    cookActionBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textOnPrimary },
    noUrgentText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: 8 },
    radarMatrixCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
    matrixRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    matrixLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
    matrixValue: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.forest },
  });
