import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PantryItem, ScreenTab, StorageLocation } from '../types';
import {
  ALLERGEN_DEFINITIONS,
  PANTRY_CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
} from '../data/mockPantryData';
import { getDaysUntilExpiry } from '../services/pantryStorage';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import GlassCard from '../../../../components/GlassCard';
import Pagination from '../../../../components/Pagination';
import { SkeletonCard, SkeletonHeroCard } from '../../../../components/Skeleton';
import Sparkles from 'lucide-react-native/icons/sparkles';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import Package from 'lucide-react-native/icons/package';
import Plus from 'lucide-react-native/icons/plus';
import Camera from 'lucide-react-native/icons/camera';
import Receipt from 'lucide-react-native/icons/receipt';
import Radar from 'lucide-react-native/icons/radar';
import Refrigerator from 'lucide-react-native/icons/refrigerator';
import Snowflake from 'lucide-react-native/icons/snowflake';
import Archive from 'lucide-react-native/icons/archive';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ShieldCheck from 'lucide-react-native/icons/shield-check';

interface Props {
  items: PantryItem[];
  totalItemsCount: number;
  expiringSoonItems: PantryItem[];
  lowStockItems: PantryItem[];
  onNavigateTab: (tab: ScreenTab) => void;
  onSelectLocation: (loc: StorageLocation) => void;
  onSelectItem?: (item: PantryItem) => void;
  loading?: boolean;
}

const LOCATIONS: StorageLocation[] = ['Fridge', 'Freezer', 'Pantry Shelf'];
const DASHBOARD_PAGE_SIZE = 4;

type DashboardListTab = 'expiring' | 'lowStock' | 'all';

export const PantryDashboardView: React.FC<Props> = ({
  items,
  totalItemsCount,
  expiringSoonItems,
  lowStockItems,
  onNavigateTab,
  onSelectLocation,
  onSelectItem,
  loading = false,
}) => {
  const styles = useThemedStyles(makeStyles);

  const [activeListTab, setActiveListTab] = useState<DashboardListTab>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const getLocName = (loc: string) => {
    const lower = (loc || '').toLowerCase();
    if (lower.includes('fridge')) return t('smart_pantry.loc_fridge');
    if (lower.includes('freezer')) return t('smart_pantry.loc_freezer');
    if (lower.includes('pantry') || lower.includes('shelf')) return t('smart_pantry.loc_pantry_shelf');
    return loc;
  };

  const getExpiryBadgeText = (days: number) => {
    if (days < 0) return t('smart_pantry.status_expired', { defaultValue: 'Expired' });
    if (days === 0) return t('smart_pantry.status_expires_today', { defaultValue: 'Expires Today' });
    if (days === 1) return t('smart_pantry.status_expires_tomorrow', { defaultValue: 'Expires Tomorrow' });
    return t('smart_pantry.status_days_remaining', { days, defaultValue: `${days}d remaining` });
  };

  // Freshness & health breakdown
  const { freshnessPercent, urgentCount, warningCount, safeCount } = useMemo(() => {
    if (items.length === 0) {
      return { freshnessPercent: 100, urgentCount: 0, warningCount: 0, safeCount: 0 };
    }
    let urgent = 0;
    let warning = 0;
    let safe = 0;

    items.forEach((item) => {
      const days = getDaysUntilExpiry(item.expiryDate);
      if (days <= 2) {
        urgent++;
      } else if (days <= 5) {
        warning++;
      } else {
        safe++;
      }
    });

    const percent = Math.round((safe / items.length) * 100);
    return {
      freshnessPercent: percent,
      urgentCount: urgent,
      warningCount: warning,
      safeCount: safe,
    };
  }, [items]);

  // Filter items for dashboard list
  const currentFilteredList = useMemo(() => {
    if (activeListTab === 'expiring') {
      return expiringSoonItems;
    }
    if (activeListTab === 'lowStock') {
      return lowStockItems;
    }
    return items;
  }, [activeListTab, expiringSoonItems, lowStockItems, items]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(currentFilteredList.length / DASHBOARD_PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * DASHBOARD_PAGE_SIZE;
    return currentFilteredList.slice(start, start + DASHBOARD_PAGE_SIZE);
  }, [currentFilteredList, currentPage]);

  const handleTabChange = (tab: DashboardListTab) => {
    setActiveListTab(tab);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonHeroCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. AI Zero-Waste Chef Feature Card */}
      <GlassCard
        variant="default"
        style={styles.aiBannerCard}
        onPress={() => onNavigateTab('recipes')}>
        <View style={styles.aiBannerRow}>
          <View style={styles.aiBannerLeft}>
            <View style={styles.sparkleCircle}>
              <Sparkles size={20} color={styles.aiAccentIcon.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.aiBadgeRow}>
                <Text style={styles.aiBadgeText}>{t('smart_pantry.ai_badge')}</Text>
              </View>
              <Text style={styles.aiBannerTitle}>{t('smart_pantry.ai_banner_title')}</Text>
              <Text style={styles.aiBannerSub} numberOfLines={2}>
                {t('smart_pantry.ai_banner_sub')}
              </Text>
            </View>
          </View>
          <View style={styles.aiActionPill}>
            <ChevronRight size={18} color={styles.aiActionChevron.color} />
          </View>
        </View>
      </GlassCard>

      {/* 2. Hero Pantry Intelligence & Freshness Card */}
      <View style={styles.heroCard}>
        {/* Top Hub Row */}
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <ShieldCheck size={14} color={styles.heroBadgeIcon.color} strokeWidth={2} />
            <Text style={styles.heroBadgeText}>{t('smart_pantry.household_hub')}</Text>
          </View>
          <View style={styles.freshnessPill}>
            <View style={styles.freshnessDot} />
            <Text style={styles.freshnessText}>
              {t('smart_pantry.fresh_rate', { percent: freshnessPercent })}
            </Text>
          </View>
        </View>

        {/* Big Freshness Gauge & Subtitle */}
        <View style={styles.freshnessGaugeRow}>
          <View>
            <Text style={styles.gaugeNumber}>{freshnessPercent}%</Text>
            <Text style={styles.gaugeLabel}>{t('smart_pantry.stock_health')}</Text>
          </View>
          <View style={styles.gaugeMetaBlock}>
            <Text style={styles.gaugeMetaValue}>{t('smart_pantry.items_count', { count: items.length })}</Text>
            <Text style={styles.gaugeMetaUnits}>
              {t('smart_pantry.units_in_stock', { count: totalItemsCount, defaultValue: `${totalItemsCount} Units in Stock` })}
            </Text>
            <Text style={styles.gaugeMetaSub}>
              {urgentCount > 0
                ? t('smart_pantry.urgent_action_count', { count: urgentCount, defaultValue: `${urgentCount} Urgent Action` })
                : warningCount > 0
                ? t('smart_pantry.expiring_soon_count', { count: warningCount, defaultValue: `${warningCount} Expiring Soon` })
                : t('smart_pantry.optimal_status', { defaultValue: '100% Optimal' })}
            </Text>
          </View>
        </View>

        {/* Multi-Segment Visual Progress Track */}
        <View style={styles.multiTrackContainer}>
          <View
            style={[
              styles.trackSegment,
              styles.trackSafe,
              { flex: Math.max(1, safeCount) },
            ]}
          />
          {warningCount > 0 && (
            <View
              style={[
                styles.trackSegment,
                styles.trackWarning,
                { flex: Math.max(1, warningCount) },
              ]}
            />
          )}
          {urgentCount > 0 && (
            <View
              style={[
                styles.trackSegment,
                styles.trackUrgent,
                { flex: Math.max(1, urgentCount) },
              ]}
            />
          )}
        </View>

        {/* Track Legend */}
        <View style={styles.trackLegendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotSafe]} />
            <Text style={styles.legendText}>
              {t('smart_pantry.legend_fresh', { count: safeCount, defaultValue: `Fresh (${safeCount})` })}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotWarning]} />
            <Text style={styles.legendText}>
              {t('smart_pantry.legend_expiring', { count: warningCount, defaultValue: `Expiring (${warningCount})` })}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotUrgent]} />
            <Text style={styles.legendText}>
              {t('smart_pantry.legend_urgent', { count: urgentCount, defaultValue: `Urgent (${urgentCount})` })}
            </Text>
          </View>
        </View>

        {/* 4 Interactive Stat Chips */}
        <View style={styles.statsRow}>
          <Pressable
            style={[styles.statChip, activeListTab === 'all' && styles.statChipSelected]}
            onPress={() => handleTabChange('all')}>
            <Package size={15} color={styles.chipIconPrimary.color} strokeWidth={1.8} />
            <Text style={styles.statNum}>{items.length}</Text>
            <Text style={styles.statLabel}>{t('smart_pantry.stat_total')}</Text>
          </Pressable>

          <Pressable
            style={[
              styles.statChip,
              expiringSoonItems.length > 0 && styles.statChipUrgent,
              activeListTab === 'expiring' && styles.statChipSelected,
            ]}
            onPress={() => handleTabChange('expiring')}>
            <Clock size={15} color={expiringSoonItems.length > 0 ? styles.dangerIcon.color : styles.chipIconPrimary.color} strokeWidth={1.8} />
            <Text
              style={[
                styles.statNum,
                expiringSoonItems.length > 0 && styles.statNumUrgent,
              ]}>
              {expiringSoonItems.length}
            </Text>
            <Text style={styles.statLabel}>{t('smart_pantry.stat_expiring')}</Text>
          </Pressable>

          <Pressable
            style={[
              styles.statChip,
              lowStockItems.length > 0 && styles.statChipWarning,
              activeListTab === 'lowStock' && styles.statChipSelected,
            ]}
            onPress={() => handleTabChange('lowStock')}>
            <AlertTriangle size={15} color={lowStockItems.length > 0 ? styles.warningIcon.color : styles.chipIconPrimary.color} strokeWidth={1.8} />
            <Text
              style={[
                styles.statNum,
                lowStockItems.length > 0 && styles.statNumWarning,
              ]}>
              {lowStockItems.length}
            </Text>
            <Text style={styles.statLabel}>{t('smart_pantry.stat_low_stock')}</Text>
          </Pressable>

          <Pressable
            style={[
              styles.statChip,
              activeListTab === 'all' && styles.statChipSelected,
            ]}
            onPress={() => handleTabChange('all')}>
            <ShieldCheck size={15} color={styles.forestIcon.color} strokeWidth={1.8} />
            <Text style={[styles.statNum, { color: styles.forestIcon.color }]}>{safeCount}</Text>
            <Text style={styles.statLabel}>{t('smart_pantry.stat_fresh')}</Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Urgent Expiration Alert Card */}
      {expiringSoonItems.length > 0 && (
        <View style={styles.warningAlertCard}>
          <View style={styles.warningAlertRow}>
            <View style={styles.warningIconCircle}>
              <AlertTriangle size={18} color={styles.warningAlertTitle.color} strokeWidth={2} />
            </View>
            <View style={styles.warningAlertTextWrap}>
              <Text style={styles.warningAlertTitle}>
                {t('smart_pantry.warning_title', { count: expiringSoonItems.length })}
              </Text>
              <Text style={styles.warningAlertSub} numberOfLines={1}>
                {expiringSoonItems.map((i) => i.name).slice(0, 3).join(', ')}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.warningAlertBtn, pressed && styles.btnPressed]}
              onPress={() => onNavigateTab('recipes')}>
              <Text style={styles.warningAlertBtnText}>{t('smart_pantry.cook_now')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 4. Multi-Zone Storage Breakdown (Fridge, Freezer, Pantry Shelf) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t('smart_pantry.storage_breakdown')}</Text>
        <Text style={styles.sectionSubHint}>{t('smart_pantry.filter_location_sub')}</Text>
      </View>
      <View style={styles.storageGrid}>
        {LOCATIONS.map((loc) => {
          const count = items.filter((i) => {
            const norm = (i.storageLocation || '').trim().toLowerCase();
            if (loc === 'Fridge') return norm.includes('fridge');
            if (loc === 'Freezer') return norm.includes('freezer');
            if (loc === 'Pantry Shelf') return norm.includes('pantry') || norm.includes('shelf');
            return false;
          }).length;
          const LocIcon =
            loc === 'Fridge' ? Refrigerator : loc === 'Freezer' ? Snowflake : Archive;
          const subText =
            loc === 'Fridge'
              ? t('smart_pantry.chilled_temp')
              : loc === 'Freezer'
              ? t('smart_pantry.frozen_temp')
              : t('smart_pantry.ambient_temp');

          return (
            <Pressable
              key={loc}
              style={({ pressed }) => [styles.storageCard, pressed && styles.tilePressed]}
              onPress={() => {
                onSelectLocation(loc);
                onNavigateTab('inventory');
              }}>
              <View style={styles.storageCardTop}>
                <View style={styles.storageIconWrapper}>
                  <LocIcon size={18} color={styles.storageIconColor.color} strokeWidth={1.8} />
                </View>
                <View style={styles.storageBadge}>
                  <Text style={styles.storageBadgeText}>{count}</Text>
                </View>
              </View>
              <Text style={styles.storageTitle} numberOfLines={1}>
                {getLocName(loc)}
              </Text>
              <Text style={styles.storageSub} numberOfLines={1}>
                {subText}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 5. 4-Way Quick Actions Grid */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t('smart_pantry.quick_actions')}</Text>
      </View>
      <View style={styles.quickActionGrid}>
        <Pressable
          style={({ pressed }) => [styles.quickActionTile, pressed && styles.tilePressed]}
          onPress={() => onNavigateTab('add')}>
          <View style={styles.actionIconCircle}>
            <Plus size={18} color={styles.actionIconColor.color} strokeWidth={2} />
          </View>
          <Text style={styles.quickActionLabel} numberOfLines={1}>
            {t('smart_pantry.action_manual')}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.quickActionTile, pressed && styles.tilePressed]}
          onPress={() => onNavigateTab('add')}>
          <View style={styles.actionIconCircle}>
            <Camera size={18} color={styles.actionIconColor.color} strokeWidth={1.8} />
          </View>
          <Text style={styles.quickActionLabel} numberOfLines={1}>
            {t('smart_pantry.action_barcode')}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.quickActionTile, pressed && styles.tilePressed]}
          onPress={() => onNavigateTab('add')}>
          <View style={styles.actionIconCircle}>
            <Receipt size={18} color={styles.actionIconColor.color} strokeWidth={1.8} />
          </View>
          <Text style={styles.quickActionLabel} numberOfLines={1}>
            {t('smart_pantry.action_receipt')}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.quickActionTile, pressed && styles.tilePressed]}
          onPress={() => onNavigateTab('radar')}>
          <View style={styles.actionIconCircle}>
            <Radar size={18} color={styles.actionIconColor.color} strokeWidth={1.8} />
          </View>
          <Text style={styles.quickActionLabel} numberOfLines={1}>
            {t('smart_pantry.action_radar')}
          </Text>
        </Pressable>
      </View>

      {/* 6. List Type Data: Segmented Tabs & Paginated Items */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t('smart_pantry.priority_stock')}</Text>
        <Pressable hitSlop={8} onPress={() => onNavigateTab('inventory')}>
          <Text style={styles.sectionLink}>
            {t('smart_pantry.view_all_link', { count: items.length })}
          </Text>
        </Pressable>
      </View>

      {/* Segmented Filter Pills */}
      <View style={styles.segmentedTabRow}>
        <Pressable
          style={[
            styles.segmentChip,
            activeListTab === 'all' && styles.segmentChipActive,
          ]}
          onPress={() => handleTabChange('all')}>
          <Text
            style={[
              styles.segmentChipText,
              activeListTab === 'all' && styles.segmentChipTextActive,
            ]}>
            {t('smart_pantry.tab_all_items')} ({items.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentChip,
            activeListTab === 'expiring' && styles.segmentChipActive,
          ]}
          onPress={() => handleTabChange('expiring')}>
          <Text
            style={[
              styles.segmentChipText,
              activeListTab === 'expiring' && styles.segmentChipTextActive,
            ]}>
            {t('smart_pantry.tab_expiring')} ({expiringSoonItems.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentChip,
            activeListTab === 'lowStock' && styles.segmentChipActive,
          ]}
          onPress={() => handleTabChange('lowStock')}>
          <Text
            style={[
              styles.segmentChipText,
              activeListTab === 'lowStock' && styles.segmentChipTextActive,
            ]}>
            {t('smart_pantry.tab_low_stock')} ({lowStockItems.length})
          </Text>
        </Pressable>
      </View>

      {/* Paginated Items List */}
      {paginatedItems.length > 0 ? (
        <View style={styles.priorityList}>
          {paginatedItems.map((item) => {
            const CategoryIcon =
              PANTRY_CATEGORY_ICONS[item.category] || DEFAULT_CATEGORY_ICON;
            const daysLeft = getDaysUntilExpiry(item.expiryDate);
            const isUrgent = daysLeft <= 2;
            const isWarning = daysLeft > 2 && daysLeft <= 5;

            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.priorityItemCard,
                  pressed && styles.tilePressed,
                ]}
                onPress={() => {
                  if (onSelectItem) {
                    onSelectItem(item);
                  } else {
                    onNavigateTab('details');
                  }
                }}>
                <View style={styles.itemIconCircle}>
                  <CategoryIcon
                    size={20}
                    color={styles.categoryIconColor.color}
                    strokeWidth={1.8}
                  />
                </View>

                <View style={styles.itemMainInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.quantity} {item.unit} · {getLocName(item.storageLocation)}
                  </Text>
                  {item.allergens.length > 0 && (
                    <View style={styles.itemTagsRow}>
                      {item.allergens.slice(0, 2).map((tag) => (
                        <View key={tag} style={styles.itemTagBadge}>
                          <Text style={styles.itemTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.itemRightWrap}>
                  <View
                    style={[
                      styles.expiryBadge,
                      isUrgent
                        ? styles.expiryBadgeUrgent
                        : isWarning
                        ? styles.expiryBadgeWarning
                        : styles.expiryBadgeSafe,
                    ]}>
                    <Clock
                      size={10}
                      color={
                        isUrgent
                          ? styles.urgentText.color
                          : isWarning
                          ? styles.warningText.color
                          : styles.forestText.color
                      }
                      strokeWidth={2}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={[
                        styles.expiryBadgeText,
                        isUrgent
                          ? styles.urgentText
                          : isWarning
                          ? styles.warningText
                          : styles.forestText,
                      ]}>
                      {getExpiryBadgeText(daysLeft)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={styles.chevronColor.color} style={{ marginTop: 6 }} />
                </View>
              </Pressable>
            );
          })}

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </View>
      ) : (
        <View style={styles.allFreshCard}>
          <View style={styles.allFreshIconCircle}>
            <CheckCircle2 size={24} color={styles.forestText.color} strokeWidth={2} />
          </View>
          <View style={styles.allFreshTextWrap}>
            <Text style={styles.allFreshTitle}>{t('smart_pantry.empty_filter_title')}</Text>
            <Text style={styles.allFreshSub}>{t('smart_pantry.empty_filter_sub')}</Text>
          </View>
        </View>
      )}

      {/* 7. Full Inventory CTA */}
      <Pressable
        style={({ pressed }) => [styles.fullInventoryCard, pressed && styles.tilePressed]}
        onPress={() => onNavigateTab('inventory')}>
        <View style={styles.fullInventoryIconWrap}>
          <Package size={20} color={styles.actionIconColor.color} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fullInventoryTitle}>
            {t('smart_pantry.view_all_inventory', { count: totalItemsCount })}
          </Text>
          <Text style={styles.fullInventorySub}>{t('smart_pantry.sub_inventory')}</Text>
        </View>
        <ArrowRight size={18} color={styles.actionIconColor.color} />
      </Pressable>
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: {
      marginTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    tilePressed: {
      opacity: 0.75,
      transform: [{ scale: 0.98 }],
    },
    btnPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },

    // AI Banner
    aiBannerCard: {
      borderRadius: radius.card,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      ...shadow.medium,
    },
    aiBannerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      borderRadius: 14,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      ...shadow.soft,
    },
    aiBadgeRow: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 3,
    },
    aiBadgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 8.5,
      color: colors.primary,
      letterSpacing: 0.5,
    },
    aiBannerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    aiBannerSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    aiActionPill: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiAccentIcon: {
      color: colors.primary,
    },
    aiActionChevron: {
      color: colors.textSecondary,
    },

    // Hero Intelligence Card
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.medium,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    heroBadgeIcon: {
      color: colors.primary,
    },
    heroBadgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    freshnessPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 5,
    },
    freshnessDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.forest,
    },
    freshnessText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.forest,
    },

    // Freshness Gauge Block
    freshnessGaugeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginVertical: spacing.xs,
    },
    gaugeNumber: {
      fontFamily: fonts.sansBold,
      fontSize: 28,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    gaugeLabel: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    gaugeMetaBlock: {
      alignItems: 'flex-end',
    },
    gaugeMetaValue: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    gaugeMetaUnits: {
      fontFamily: fonts.sans,
      fontSize: 10.5,
      color: colors.textMuted,
      marginTop: 1,
    },
    gaugeMetaSub: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.turmeric,
      marginTop: 2,
    },

    // Multi-Segment Visual Track
    multiTrackContainer: {
      flexDirection: 'row',
      height: 6,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: spacing.sm,
      gap: 2,
    },
    trackSegment: {
      height: '100%',
      borderRadius: 2,
    },
    trackSafe: {
      backgroundColor: colors.forest,
    },
    trackWarning: {
      backgroundColor: colors.turmeric,
    },
    trackUrgent: {
      backgroundColor: colors.danger,
    },

    // Track Legend
    trackLegendRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
      marginBottom: spacing.sm,
      paddingHorizontal: 2,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    legendDotSafe: {
      backgroundColor: colors.forest,
    },
    legendDotWarning: {
      backgroundColor: colors.turmeric,
    },
    legendDotUrgent: {
      backgroundColor: colors.danger,
    },
    legendText: {
      fontFamily: fonts.sans,
      fontSize: 10,
      color: colors.textMuted,
    },

    // Stats Chips
    statsRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: spacing.xs,
    },
    statChip: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: 2,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    statChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    statChipUrgent: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
    },
    statChipWarning: {
      borderColor: colors.turmeric,
    },
    chipIconPrimary: {
      color: colors.primary,
    },
    forestIcon: {
      color: colors.forest,
    },
    dangerIcon: {
      color: colors.danger,
    },
    warningIcon: {
      color: colors.turmeric,
    },
    statNum: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    statNumUrgent: {
      color: colors.danger,
    },
    statNumWarning: {
      color: colors.turmeric,
    },
    statLabel: {
      fontFamily: fonts.sans,
      fontSize: 9.5,
      color: colors.textMuted,
      textAlign: 'center',
    },

    // Warning Alert Card
    warningAlertCard: {
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      borderRadius: radius.card,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    warningAlertRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    warningIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    warningAlertTextWrap: {
      flex: 1,
      marginRight: spacing.sm,
    },
    warningAlertTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.danger,
    },
    warningAlertSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textPrimary,
      marginTop: 2,
    },
    warningAlertBtn: {
      backgroundColor: colors.danger,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    warningAlertBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.textOnPrimary,
    },

    // Section Headings
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    sectionSubHint: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    sectionLink: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },

    // Storage Grid
    storageGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: spacing.md,
      marginTop: spacing.xs,
    },
    storageCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm + 2,
      ...shadow.soft,
    },
    storageCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    storageIconWrapper: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    storageIconColor: {
      color: colors.primary,
    },
    storageBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    storageBadgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      color: colors.textPrimary,
    },
    storageTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
      color: colors.textPrimary,
    },
    storageSub: {
      fontFamily: fonts.sans,
      fontSize: 9.5,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Quick Actions
    quickActionGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: spacing.md,
      marginTop: spacing.xs,
    },
    quickActionTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    actionIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    actionIconColor: {
      color: colors.primary,
    },
    quickActionLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textPrimary,
      textAlign: 'center',
    },

    // Segmented Tab Row
    segmentedTabRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },
    segmentChip: {
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    segmentChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    segmentChipTextActive: {
      fontFamily: fonts.sansBold,
      color: colors.textOnPrimary,
    },

    // Priority Items List
    priorityList: {
      gap: 8,
      marginBottom: spacing.md,
    },
    priorityItemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.sm + 4,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    itemIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryIconColor: {
      color: colors.primary,
    },
    itemMainInfo: {
      flex: 1,
      marginRight: spacing.xs,
    },
    itemName: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    itemMeta: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    itemTagsRow: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 4,
    },
    itemTagBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
    },
    itemTagText: {
      fontFamily: fonts.sans,
      fontSize: 9,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    itemRightWrap: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    expiryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    expiryBadgeUrgent: {
      backgroundColor: colors.dangerSoft,
    },
    expiryBadgeWarning: {
      backgroundColor: colors.turmericSoft,
    },
    expiryBadgeSafe: {
      backgroundColor: colors.surfaceElevated,
    },
    expiryBadgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
    },
    urgentText: {
      color: colors.danger,
    },
    warningText: {
      color: colors.turmeric,
    },
    forestText: {
      color: colors.forest,
    },
    chevronColor: {
      color: colors.textMuted,
    },

    // Empty state card
    allFreshCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    allFreshIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    allFreshTextWrap: {
      flex: 1,
    },
    allFreshTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    allFreshSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Full Inventory CTA
    fullInventoryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
      marginTop: spacing.xs,
    },
    fullInventoryIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fullInventoryTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    fullInventorySub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
  });
