import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../../i18n';
import { ArrowLeft } from 'lucide-react-native';
import UsersRound from 'lucide-react-native/icons/users-round';
import { SkeletonCard, SkeletonHeroCard } from '../../../components/Skeleton';
import useAuth from '../../../hooks/useAuth';
import { getMyPrimaryFamily } from '../../family/api';

import { ScreenTab } from './types';
import { useSmartPantry } from './hooks/useSmartPantry';
import { PantryDashboardView } from './components/PantryDashboardView';
import { PantryInventoryView } from './components/PantryInventoryView';
import { AddScanView } from './components/AddScanView';
import { ItemDetailsView } from './components/ItemDetailsView';
import { ExpiryRadarView } from './components/ExpiryRadarView';
import { ZeroWasteRecipesView } from './components/ZeroWasteRecipesView';
import { DailyMealsView } from './components/DailyMealsView';
import { useDailyMeals } from './hooks/useDailyMeals';

type Props = StackScreenProps<RootStackParamList, 'Pantry'>;

export default function PantryScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ScreenTab>('dashboard');
  const [, setLocaleVersion] = useState(0);
  const { getAccessToken } = useAuth();
  const [hasFamily, setHasFamily] = useState(false);
  const [familyChecked, setFamilyChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken().catch(() => null);
      const family = token ? await getMyPrimaryFamily(token).catch(() => null) : null;
      if (cancelled) return;
      setHasFamily(!!family);
      setFamilyChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const noFamily = familyChecked && !hasFamily;

  const {
    loading,
    items,
    recipes,
    filteredItems,
    searchQuery,
    setSearchQuery,
    selectedLocation,
    setSelectedLocation,
    selectedAllergenFilter,
    setSelectedAllergenFilter,
    sortBy,
    setSortBy,
    selectedItem,
    setSelectedItem,
    addItem,
    addItemsBulk,
    updateQuantity,
    deleteItem,
    cookRecipe,
    lookupBarcode,
    scanReceipt,
    scanBasket,
    recipeDietaryFilter,
    setRecipeDietaryFilter,
    triggerSpoilageAlerts,
    totalItemsCount,
    expiringSoonItems,
    lowStockItems,
    refresh,
  } = useSmartPantry();

  // Cooking a recommended meal deducts stock, so the pantry list reloads after it.
  const dailyMeals = useDailyMeals({ onStockChanged: refresh });

  // Changing stock — not just adding or removing an item — invalidates the plan,
  // so quantities are part of the signature the auto-refresh below dedupes on.
  const inventorySignature = useMemo(
    () => items.map((item) => `${item.id}:${item.quantity}`).join('|'),
    [items],
  );
  const autoRefreshedSignature = useRef<string | null>(null);
  const {
    plan: mealPlan,
    loading: mealsLoading,
    refreshing: mealsRefreshing,
    refreshPlan: refreshMealPlan,
  } = dailyMeals;

  // The meal plan is fetched once per mount, which can land before the pantry list
  // has loaded or against stock that has since changed — leaving "Today's Meals"
  // showing an empty-pantry or stale plan while ingredients are sitting right there.
  // Once inventory items exist and the plan is out of date, refresh it instead of
  // waiting for a tap. Recording the signature before the call keeps this to one
  // attempt per stock change, so a plan the backend still reports stale can't loop.
  useEffect(() => {
    if (activeTab !== 'meals' || items.length === 0) {
      return;
    }
    if (mealsLoading || mealsRefreshing) {
      return;
    }
    if (!mealPlan || !(mealPlan.stale || mealPlan.pantryEmpty)) {
      return;
    }
    if (autoRefreshedSignature.current === inventorySignature) {
      return;
    }
    autoRefreshedSignature.current = inventorySignature;
    refreshMealPlan();
  }, [
    activeTab,
    items.length,
    inventorySignature,
    mealPlan,
    mealsLoading,
    mealsRefreshing,
    refreshMealPlan,
  ]);

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}>
          <ArrowLeft size={22} color={styles.backIcon.color} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('smart_pantry.header_title')}
          </Text>
        </View>
        {noFamily ? (
          <View style={styles.headerAddBtnSpacer} />
        ) : (
          <Pressable
            onPress={() => setActiveTab('add')}
            style={styles.headerAddBtn}
            hitSlop={8}
            accessibilityRole="button">
            <Text style={styles.headerAddBtnText} numberOfLines={1}>
              {t('smart_pantry.add_scan_btn')}
            </Text>
          </Pressable>
        )}
      </View>

      {noFamily ? (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          <View style={styles.noFamilyBanner}>
            <View style={styles.noFamilyIconCircle}>
              <UsersRound size={22} color={styles.backIcon.color} strokeWidth={1.8} />
            </View>
            <Text style={styles.noFamilyTitle}>{t('smart_pantry.no_family_title')}</Text>
            <Text style={styles.noFamilyText}>{t('smart_pantry.no_family_banner_message')}</Text>
            <Pressable style={styles.noFamilyButton} onPress={() => navigation.navigate('Family')}>
              <Text style={styles.noFamilyButtonText}>{t('smart_pantry.go_to_family')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
      <>

      {/* 6 Top Navigation Tabs */}
      <View style={styles.topTabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topTabScroll}>
          <Pressable
            style={[styles.tabChip, activeTab === 'dashboard' && styles.tabChipActive]}
            onPress={() => setActiveTab('dashboard')}>
            <Text style={[styles.tabChipText, activeTab === 'dashboard' && styles.tabChipTextActive]}>
              {t('smart_pantry.tab_dashboard')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabChip, activeTab === 'inventory' && styles.tabChipActive]}
            onPress={() => setActiveTab('inventory')}>
            <Text style={[styles.tabChipText, activeTab === 'inventory' && styles.tabChipTextActive]}>
              {t('smart_pantry.tab_inventory', { count: items.length })}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabChip, activeTab === 'add' && styles.tabChipActive]}
            onPress={() => setActiveTab('add')}>
            <Text style={[styles.tabChipText, activeTab === 'add' && styles.tabChipTextActive]}>
              {t('smart_pantry.tab_add')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabChip, activeTab === 'details' && styles.tabChipActive]}
            onPress={() => setActiveTab('details')}>
            <Text style={[styles.tabChipText, activeTab === 'details' && styles.tabChipTextActive]}>
              {t('smart_pantry.tab_details')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabChip, activeTab === 'radar' && styles.tabChipActive]}
            onPress={() => setActiveTab('radar')}>
            <Text style={[styles.tabChipText, activeTab === 'radar' && styles.tabChipTextActive]}>
              {t('smart_pantry.tab_radar', { count: expiringSoonItems.length })}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabChip, activeTab === 'recipes' && styles.tabChipActive]}
            onPress={() => setActiveTab('recipes')}>
            <Text style={[styles.tabChipText, activeTab === 'recipes' && styles.tabChipTextActive]}>
              {t('smart_pantry.tab_recipes')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabChip, activeTab === 'meals' && styles.tabChipActive]}
            onPress={() => setActiveTab('meals')}>
            <Text style={[styles.tabChipText, activeTab === 'meals' && styles.tabChipTextActive]}>
              {t('smart_pantry.tab_meals', { defaultValue: "Today's Meals" })}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Main Screen Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.contentContainer,
          // Lets the meals tab be pulled down even when its content is shorter
          // than the viewport, which is what makes the gesture discoverable.
          activeTab === 'meals' && styles.contentContainerFill,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          // Only the meals tab refetches on pull; the other tabs have their own
          // refresh paths and no pull gesture today.
          activeTab === 'meals' ? (
            <RefreshControl
              refreshing={mealsRefreshing}
              onRefresh={refreshMealPlan}
              tintColor={styles.backIcon.color}
              colors={[styles.backIcon.color]}
            />
          ) : undefined
        }>
        {loading ? (
          <View style={{ paddingTop: 8 }}>
            <SkeletonHeroCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <PantryDashboardView
                items={items}
                totalItemsCount={totalItemsCount}
                expiringSoonItems={expiringSoonItems}
                lowStockItems={lowStockItems}
                onNavigateTab={setActiveTab}
                onSelectLocation={setSelectedLocation}
                onSelectItem={(item) => {
                  setSelectedItem(item);
                  setActiveTab('details');
                }}
              />
            )}

            {activeTab === 'inventory' && (
              <PantryInventoryView
                filteredItems={filteredItems}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedLocation={selectedLocation}
                onLocationSelect={setSelectedLocation}
                selectedAllergenFilter={selectedAllergenFilter}
                onAllergenFilterSelect={setSelectedAllergenFilter}
                sortBy={sortBy}
                onSortBySelect={setSortBy}
                onSelectItem={(item) => {
                  setSelectedItem(item);
                  setActiveTab('details');
                }}
                onNavigateAdd={() => setActiveTab('add')}
              />
            )}

            {activeTab === 'add' && (
              <AddScanView
                onAddItem={addItem}
                onAddItemsBulk={addItemsBulk}
                onLookupBarcode={lookupBarcode}
                onScanReceipt={scanReceipt}
                onScanBasket={scanBasket}
                onNavigateDetails={() => setActiveTab('details')}
              />
            )}

            {activeTab === 'details' && (
              <ItemDetailsView
                items={items}
                selectedItem={selectedItem}
                onSelectItem={setSelectedItem}
                onUpdateQuantity={updateQuantity}
                onDeleteItem={deleteItem}
              />
            )}

            {activeTab === 'radar' && (
              <ExpiryRadarView
                items={items}
                onNavigateRecipes={() => setActiveTab('recipes')}
                onTriggerSpoilageAlerts={triggerSpoilageAlerts}
              />
            )}

            {activeTab === 'recipes' && (
              <ZeroWasteRecipesView
                recipes={recipes}
                onCookRecipe={cookRecipe}
                activeDietaryFilter={recipeDietaryFilter}
                onSelectDietaryFilter={setRecipeDietaryFilter}
              />
            )}

            {activeTab === 'meals' && (
              <DailyMealsView
                meals={dailyMeals.meals}
                loading={dailyMeals.loading}
                refreshing={dailyMeals.refreshing}
                cookingMealId={dailyMeals.cookingMealId}
                error={dailyMeals.error}
                stale={dailyMeals.stale}
                pantryEmpty={dailyMeals.pantryEmpty}
                refreshesLeft={dailyMeals.refreshesLeft}
                nutritionDisclaimer={dailyMeals.nutritionDisclaimer}
                onRefresh={dailyMeals.refresh}
                onReload={dailyMeals.reload}
                onMarkCooked={dailyMeals.markCooked}
                onLoadMealDetail={dailyMeals.loadMealDetail}
                onNavigateAdd={() => setActiveTab('add')}
              />
            )}
          </>
        )}
      </ScrollView>
      </>
      )}
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: colors.navBackground || colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.navBorder || colors.border,
      ...shadow.soft,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...shadow.soft,
    },
    backIcon: { color: colors.textPrimary },
    // minWidth 0 lets the title block actually shrink instead of pushing the
    // Add & Scan button off the row on long translations.
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
      marginLeft: 12,
      marginRight: 10,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      lineHeight: 20,
      color: colors.textPrimary,
    },
    headerAddBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      flexShrink: 0,
    },
    headerAddBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textOnPrimary },
    headerAddBtnSpacer: { width: 1, height: 1 },
    noFamilyBanner: {
      alignItems: 'center',
      backgroundColor: colors.glassSurface || colors.surfaceElevated,
      borderRadius: radius.card || 20,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      padding: spacing.xl,
      marginTop: spacing.md,
      ...shadow.soft,
    },
    noFamilyIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginBottom: spacing.md,
    },
    noFamilyTitle: {
      fontFamily: fonts.serif,
      fontSize: 20,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    noFamilyText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    noFamilyButton: {
      alignSelf: 'stretch',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm + 2,
    },
    noFamilyButtonText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textOnPrimary,
    },
    topTabBar: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 6,
    },
    topTabScroll: { paddingHorizontal: spacing.md, gap: 6 },
    // Without an explicit flex:1 style (contentContainerStyle alone isn't enough),
    // the ScrollView can fail to constrain to the space left by the fixed header/tab
    // bars above it, letting the whole screen drift instead of just this content.
    scrollArea: { flex: 1 },
    tabChip: {
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    tabChipTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    contentContainer: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
    contentContainerFill: { flexGrow: 1 },
  });
