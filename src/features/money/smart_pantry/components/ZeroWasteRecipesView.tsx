import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Alert } from 'react-native';
import { ZeroWasteRecipe } from '../types';
import { ALLERGEN_DEFINITIONS, MOCK_ZERO_WASTE_RECIPES } from '../data/mockPantryData';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ChefHat from 'lucide-react-native/icons/chef-hat';
import Timer from 'lucide-react-native/icons/timer';
import X from 'lucide-react-native/icons/x';

interface Props {
  recipes?: ZeroWasteRecipe[];
  onCookRecipe: (recipe: ZeroWasteRecipe) => Promise<void>;
  activeDietaryFilter?: string;
  onSelectDietaryFilter?: (tag: string) => void;
}

const DIETARY_FILTERS = [
  { key: 'all', labelKey: 'smart_pantry.filter_all_recipes', label: 'All Recipes' },
  { key: 'vegan', labelKey: 'smart_pantry.filter_vegan', label: 'Vegan' },
  { key: 'gluten-free', labelKey: 'smart_pantry.filter_gluten_free', label: 'Gluten-Free' },
  { key: 'halal', labelKey: 'smart_pantry.filter_halal', label: 'Halal' },
  { key: 'dairy-free', labelKey: 'smart_pantry.filter_dairy_free', label: 'Dairy-Free' },
  { key: 'nut-free', labelKey: 'smart_pantry.filter_nut_free', label: 'Nut-Free' },
  { key: 'kosher', labelKey: 'smart_pantry.filter_kosher', label: 'Kosher' },
];

export const ZeroWasteRecipesView: React.FC<Props> = ({
  recipes,
  onCookRecipe,
  activeDietaryFilter = 'all',
  onSelectDietaryFilter,
}) => {
  const styles = useThemedStyles(makeStyles);
  const [selectedRecipe, setSelectedRecipe] = useState<ZeroWasteRecipe | null>(null);

  const allRecipes = recipes && recipes.length > 0 ? recipes : MOCK_ZERO_WASTE_RECIPES;
  const displayRecipes = allRecipes.filter((recipe) => {
    if (!activeDietaryFilter || activeDietaryFilter === 'all') return true;
    return recipe.dietaryTags && recipe.dietaryTags.includes(activeDietaryFilter as any);
  });

  const handleConfirmCook = (recipe: ZeroWasteRecipe) => {
    Alert.alert(
      t('smart_pantry.recipe_cooked_title', { defaultValue: 'Bon Appétit!' }),
      t('smart_pantry.recipe_cooked_msg', {
        title: recipe.title,
        defaultValue: `Used ingredients for ${recipe.title}. Stock updated in Pantry.`,
      }),
      [
        {
          text: t('common.ok', { defaultValue: 'OK' }),
          onPress: async () => {
            await onCookRecipe(recipe);
            setSelectedRecipe(null);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.recipeHeroHeader}>
        <Text style={styles.recipeHeroTitle}>{t('smart_pantry.recipes_title')}</Text>
        <Text style={styles.recipeHeroSub}>{t('smart_pantry.recipes_sub')}</Text>
      </View>

      {/* DIETARY FILTER CAROUSEL */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterCarousel}>
        {DIETARY_FILTERS.map((filter) => {
          const active = activeDietaryFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => onSelectDietaryFilter?.(filter.key)}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {t(filter.labelKey, { defaultValue: filter.label })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {displayRecipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ChefHat size={36} color={styles.cookTimeText.color} strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>{t('smart_pantry.no_recipes_for_filter', { defaultValue: 'No recipes matching this dietary filter.' })}</Text>
          <Text style={styles.emptySub}>{t('smart_pantry.try_all_filter', { defaultValue: 'Try selecting All Recipes or add more ingredients to pantry.' })}</Text>
        </View>
      ) : (
        displayRecipes.map((recipe) => (
          <Pressable key={recipe.id} style={styles.recipeCard} onPress={() => setSelectedRecipe(recipe)}>
            <View style={styles.recipeCardHeader}>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>{t('smart_pantry.match_rate', { rate: recipe.matchPercentage })}</Text>
              </View>
              <View style={styles.cookTimeRow}>
                <Timer size={12} color={styles.cookTimeText.color} strokeWidth={2} style={{ marginRight: 3 }} />
                <Text style={styles.cookTimeText}>{recipe.cookTime}</Text>
              </View>
            </View>

            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <Text style={styles.expiringUsedTag}>
              {t('smart_pantry.uses_expiring', { ingredient: recipe.expiringIngredientUsed })}
            </Text>

            {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
              <View style={styles.dietaryTagsRow}>
                {recipe.dietaryTags.map((tag) => (
                  <View key={tag} style={styles.dietaryBadge}>
                    <Text style={styles.dietaryBadgeText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.viewRecipeRow}>
              <Text style={styles.viewRecipeText}>{t('smart_pantry.tap_view_recipe')}</Text>
            </View>
          </Pressable>
        ))
      )}

      {/* RECIPE DETAIL MODAL */}
      <Modal visible={selectedRecipe !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalSheet}>
              {selectedRecipe && (
                <>
                  <View style={styles.modalHeaderRow}>
                    <ChefHat size={28} color={styles.modalTitle.color} strokeWidth={1.8} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>
                      <View style={styles.modalSubRow}>
                        <Timer size={12} color={styles.modalSub.color} strokeWidth={2} style={{ marginRight: 3 }} />
                        <Text style={styles.modalSub}>
                          {selectedRecipe.cookTime} · {t('smart_pantry.difficulty_label', { difficulty: selectedRecipe.difficulty, defaultValue: `Difficulty: ${selectedRecipe.difficulty}` })}
                        </Text>
                      </View>
                    </View>
                    <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedRecipe(null)}>
                      <X size={20} color={styles.modalCloseBtnIcon.color} strokeWidth={2} />
                    </Pressable>
                  </View>

                  <Text style={styles.modalSectionLabel}>{t('smart_pantry.ingredients_req')}</Text>
                  {selectedRecipe.ingredients.map((ing, idx) => (
                    <Text key={idx} style={styles.ingredientBullet}>• {ing}</Text>
                  ))}

                  <Text style={[styles.modalSectionLabel, { marginTop: 12 }]}>{t('smart_pantry.instructions')}</Text>
                  {selectedRecipe.instructions.map((inst, idx) => (
                    <Text key={idx} style={styles.instructionStep}>{idx + 1}. {inst}</Text>
                  ))}

                  <Pressable style={styles.cookCompleteBtn} onPress={() => handleConfirmCook(selectedRecipe)}>
                    <Text style={styles.cookCompleteBtnText}>{t('smart_pantry.cooked_deduct')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm },
    recipeHeroHeader: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md },
    recipeHeroTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textOnPrimary },
    recipeHeroSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textOnPrimaryMuted, marginTop: 2 },
    filterCarousel: { paddingBottom: 12, gap: 6 },
    filterChip: {
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    filterChipTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    recipeCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, ...shadow.soft },
    recipeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    matchBadge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    matchBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.textSecondary },
    cookTimeRow: { flexDirection: 'row', alignItems: 'center' },
    cookTimeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textMuted },
    recipeTitle: { fontFamily: fonts.serif, fontSize: 16, color: colors.textPrimary },
    expiringUsedTag: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.turmeric, marginTop: 4 },
    dietaryTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    dietaryBadge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    dietaryBadgeText: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.textSecondary, textTransform: 'capitalize' },
    viewRecipeRow: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    viewRecipeText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
    emptyContainer: { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
    emptyTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, textAlign: 'center' },
    emptySub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
    modalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    modalTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary },
    modalSubRow: { flexDirection: 'row', alignItems: 'center' },
    modalSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
    modalCloseBtn: { padding: 4 },
    modalCloseBtnIcon: { color: colors.textMuted },
    modalSectionLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
    ingredientBullet: { fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
    instructionStep: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
    cookCompleteBtn: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center', marginTop: 16 },
    cookCompleteBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textOnPrimary },
  });
