import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CategoryType, PantryItem, ScreenTab } from '../types';
import { ALLERGEN_DEFINITIONS } from '../data/mockPantryData';
import { getDaysUntilExpiry } from '../services/pantryStorage';
import { PANTRY_COLORS } from '../constants/colors';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';

interface Props {
  items: PantryItem[];
  onNavigateRecipes: () => void;
}

const CATEGORY_EMOJIS: Record<CategoryType, string> = {
  produce: '🥦',
  dairy: '🥛',
  bakery: '🍞',
  beverages: '🧃',
  meat: '🥩',
  pantry: '🥫',
};

export const ExpiryRadarView: React.FC<Props> = ({ items, onNavigateRecipes }) => {
  const styles = useThemedStyles(makeStyles);

  const urgentItems = items.filter((i) => getDaysUntilExpiry(i.expiryDate) <= 2);
  const upcomingItems = items.filter((i) => getDaysUntilExpiry(i.expiryDate) > 2 && getDaysUntilExpiry(i.expiryDate) <= 7);

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
        urgentItems.map((item) => (
          <View key={item.id} style={[styles.radarItemCard, { borderLeftColor: PANTRY_COLORS.urgentRed }]}>
            <Text style={{ fontSize: 22, marginRight: 10 }}>{CATEGORY_EMOJIS[item.category] || '📦'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.radarItemName}>{item.name}</Text>
              <Text style={styles.radarItemSub}>
                Expires in {getDaysUntilExpiry(item.expiryDate)} day(s) · Qty: {item.quantity} {item.unit}
              </Text>
            </View>
            <Pressable style={styles.cookActionBtn} onPress={onNavigateRecipes}>
              <Text style={styles.cookActionBtnText}>{t('smart_pantry.cook_now')}</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={[styles.sectionHeading, { marginTop: 16 }]}>{t('smart_pantry.upcoming_exp')}</Text>
      {upcomingItems.map((item) => (
        <View key={item.id} style={[styles.radarItemCard, { borderLeftColor: PANTRY_COLORS.warningAmber }]}>
          <Text style={{ fontSize: 22, marginRight: 10 }}>{CATEGORY_EMOJIS[item.category] || '📦'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.radarItemName}>{item.name}</Text>
            <Text style={styles.radarItemSub}>
              Expires in {getDaysUntilExpiry(item.expiryDate)} days · {item.storageLocation}
            </Text>
          </View>
        </View>
      ))}

      {/* Dietary Allergen Safety Matrix */}
      <Text style={[styles.sectionHeading, { marginTop: 20 }]}>{t('smart_pantry.allergen_matrix')}</Text>
      <View style={styles.radarMatrixCard}>
        {ALLERGEN_DEFINITIONS.map((def) => {
          const safeCount = items.filter((i) => i.allergens.includes(def.tag)).length;
          return (
            <View key={def.tag} style={styles.matrixRow}>
              <Text style={{ fontSize: 18, width: 30 }}>{def.icon}</Text>
              <Text style={styles.matrixLabel}>{def.label}</Text>
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
    radarHeaderCard: { backgroundColor: '#004F63', borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md },
    radarHeaderTitle: { fontFamily: fonts.serif, fontSize: 18, color: '#FFFFFF' },
    radarHeaderSub: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    radarItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, padding: spacing.md, marginBottom: 8 },
    radarItemName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    radarItemSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    cookActionBtn: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
    cookActionBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: '#FFFFFF' },
    noUrgentText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: 8 },
    radarMatrixCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
    matrixRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    matrixLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
    matrixValue: { fontFamily: fonts.sansBold, fontSize: 12, color: '#10B981' },
  });
