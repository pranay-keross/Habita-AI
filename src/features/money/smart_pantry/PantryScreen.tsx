import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../../i18n';

import { ScreenTab } from './types';
import { useSmartPantry } from './hooks/useSmartPantry';
import { PantryDashboardView } from './components/PantryDashboardView';
import { PantryInventoryView } from './components/PantryInventoryView';
import { AddScanView } from './components/AddScanView';
import { ItemDetailsView } from './components/ItemDetailsView';
import { ExpiryRadarView } from './components/ExpiryRadarView';
import { ZeroWasteRecipesView } from './components/ZeroWasteRecipesView';

type Props = StackScreenProps<RootStackParamList, 'Pantry'>;

export default function PantryScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ScreenTab>('dashboard');
  const [, setLocaleVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const {
    loading,
    items,
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
    updateQuantity,
    deleteItem,
    cookRecipe,
    totalItemsCount,
    expiringSoonItems,
    lowStockItems,
  } = useSmartPantry();

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>{t('smart_pantry.header_title')}</Text>
          <Text style={styles.headerSub}>{t('smart_pantry.header_sub')}</Text>
        </View>
        <Pressable onPress={() => setActiveTab('add')} style={styles.headerAddBtn}>
          <Text style={styles.headerAddBtnText}>{t('smart_pantry.add_scan_btn')}</Text>
        </Pressable>
      </View>

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
        </ScrollView>
      </View>

      {/* Main Screen Content */}
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={styles.headerAddBtn.backgroundColor} style={{ marginTop: 60 }} size="large" />
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
              />
            )}

            {activeTab === 'recipes' && (
              <ZeroWasteRecipesView onCookRecipe={cookRecipe} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    backIcon: { fontSize: 18, color: colors.textPrimary },
    headerTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.textPrimary },
    headerSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
    headerAddBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
    },
    headerAddBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textOnPrimary },
    topTabBar: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 6,
    },
    topTabScroll: { paddingHorizontal: spacing.md, gap: 6 },
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
  });
