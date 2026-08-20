import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PantryItem, ScreenTab, StorageLocation } from '../types';
import { ALLERGEN_DEFINITIONS } from '../data/mockPantryData';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';

interface Props {
  items: PantryItem[];
  totalItemsCount: number;
  expiringSoonItems: PantryItem[];
  lowStockItems: PantryItem[];
  onNavigateTab: (tab: ScreenTab) => void;
  onSelectLocation: (loc: StorageLocation) => void;
}

const LOCATIONS: StorageLocation[] = ['Fridge', 'Freezer', 'Pantry Shelf'];

export const PantryDashboardView: React.FC<Props> = ({
  items,
  totalItemsCount,
  expiringSoonItems,
  lowStockItems,
  onNavigateTab,
  onSelectLocation,
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
      {/* Hero Summary */}
      <View style={styles.heroCard}>
        <Text style={styles.heroGreeting}>{t('smart_pantry.dash_title')}</Text>
        <Text style={styles.heroSubtitle}>{t('smart_pantry.dash_sub')}</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{totalItemsCount}</Text>
            <Text style={styles.metricLabel}>{t('smart_pantry.stat_total')}</Text>
          </View>
          <View style={[styles.metricCard, styles.urgentCard]}>
            <Text style={[styles.metricVal, styles.urgentText]}>{expiringSoonItems.length}</Text>
            <Text style={styles.metricLabel}>{t('smart_pantry.stat_expiring')}</Text>
          </View>
          <View style={[styles.metricCard, styles.warningCard]}>
            <Text style={[styles.metricVal, styles.warningText]}>{lowStockItems.length}</Text>
            <Text style={styles.metricLabel}>{t('smart_pantry.stat_low_stock')}</Text>
          </View>
          <View style={[styles.metricCard, styles.safeCard]}>
            <Text style={[styles.metricVal, styles.safeText]}>{ALLERGEN_DEFINITIONS.length}</Text>
            <Text style={styles.metricLabel}>{t('smart_pantry.stat_allergen_tags')}</Text>
          </View>
        </View>
      </View>

      {/* Expiry Warning Card */}
      {expiringSoonItems.length > 0 && (
        <View style={styles.warningAlertCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginRight: 10 }}>⏰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningAlertTitle}>
                {t('smart_pantry.warning_title', { count: expiringSoonItems.length })}
              </Text>
              <Text style={styles.warningAlertSub}>
                {expiringSoonItems.map((i) => i.name).slice(0, 2).join(', ')}...
              </Text>
            </View>
            <Pressable style={styles.warningAlertBtn} onPress={() => onNavigateTab('recipes')}>
              <Text style={styles.warningAlertBtnText}>{t('smart_pantry.cook_now')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Direct Navigation Grid */}
      <Text style={styles.sectionHeading}>{t('smart_pantry.nav_screens')}</Text>
      <View style={styles.actionGrid}>
        <Pressable style={styles.actionTile} onPress={() => onNavigateTab('inventory')}>
          <Text style={styles.actionTileIcon}>📦</Text>
          <Text style={styles.actionTileTitle}>{t('smart_pantry.tab_inventory', { count: items.length })}</Text>
          <Text style={styles.actionTileSub}>{t('smart_pantry.sub_inventory')}</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={() => onNavigateTab('add')}>
          <Text style={styles.actionTileIcon}>📸</Text>
          <Text style={styles.actionTileTitle}>{t('smart_pantry.tab_add')}</Text>
          <Text style={styles.actionTileSub}>{t('smart_pantry.sub_add')}</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={() => onNavigateTab('details')}>
          <Text style={styles.actionTileIcon}>🔍</Text>
          <Text style={styles.actionTileTitle}>{t('smart_pantry.tab_details')}</Text>
          <Text style={styles.actionTileSub}>{t('smart_pantry.sub_details')}</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={() => onNavigateTab('radar')}>
          <Text style={styles.actionTileIcon}>📡</Text>
          <Text style={styles.actionTileTitle}>{t('smart_pantry.tab_radar', { count: expiringSoonItems.length })}</Text>
          <Text style={styles.actionTileSub}>{t('smart_pantry.sub_radar')}</Text>
        </Pressable>
        <Pressable style={[styles.actionTile, { width: '100%' }]} onPress={() => onNavigateTab('recipes')}>
          <Text style={styles.actionTileIcon}>🍳</Text>
          <Text style={styles.actionTileTitle}>{t('smart_pantry.tab_recipes')}</Text>
          <Text style={styles.actionTileSub}>{t('smart_pantry.sub_recipes')}</Text>
        </Pressable>
      </View>

      {/* Storage Breakdown */}
      <Text style={styles.sectionHeading}>{t('smart_pantry.storage_breakdown')}</Text>
      <View style={styles.storageBreakdownCard}>
        {LOCATIONS.map((loc) => {
          const count = items.filter((i) => i.storageLocation === loc).length;
          const emoji = loc === 'Fridge' ? '❄️' : loc === 'Freezer' ? '🧊' : '🧺';
          return (
            <Pressable
              key={loc}
              style={styles.storageRow}
              onPress={() => {
                onSelectLocation(loc);
                onNavigateTab('inventory');
              }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>{emoji}</Text>
              <Text style={styles.storageName}>{getLocName(loc)}</Text>
              <View style={styles.storageBadge}>
                <Text style={styles.storageBadgeText}>{t('smart_pantry.items_count', { count })}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm },
    heroCard: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.medium,
    },
    heroGreeting: { fontFamily: fonts.serif, fontSize: 20, color: colors.textOnPrimary },
    heroSubtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.textOnPrimaryMuted, marginTop: 4 },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
    metricCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: radius.md,
      padding: spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.textOnPrimaryAccent,
    },
    urgentCard: { borderLeftColor: colors.danger },
    urgentText: { color: colors.textOnPrimary },
    warningCard: { borderLeftColor: colors.turmeric },
    warningText: { color: colors.textOnPrimary },
    safeCard: { borderLeftColor: colors.forest },
    safeText: { color: colors.textOnPrimary },
    metricVal: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.textOnPrimary },
    metricLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.textOnPrimaryMuted },
    warningAlertCard: {
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    warningAlertTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.danger },
    warningAlertSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary, marginTop: 2 },
    warningAlertBtn: { backgroundColor: colors.danger, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
    warningAlertBtnText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textOnPrimary },
    sectionHeading: { fontFamily: fonts.serif, fontSize: 17, color: colors.textPrimary, marginBottom: 8, marginTop: 4 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
    actionTile: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    actionTileIcon: { fontSize: 24, marginBottom: 4 },
    actionTileTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
    actionTileSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    storageBreakdownCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    storageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    storageName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
    storageBadge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
    storageBadgeText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary },
  });
