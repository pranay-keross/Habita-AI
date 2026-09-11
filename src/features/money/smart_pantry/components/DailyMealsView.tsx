import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { DailyMeal, MealIngredient } from '../types';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ChefHat from 'lucide-react-native/icons/chef-hat';
import Timer from 'lucide-react-native/icons/timer';
import Flame from 'lucide-react-native/icons/flame';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import Salad from 'lucide-react-native/icons/salad';

interface Props {
  meals: DailyMeal[];
  loading: boolean;
  refreshing: boolean;
  cookingMealId: string | null;
  error: string | null;
  stale: boolean;
  pantryEmpty: boolean;
  refreshesLeft: number;
  nutritionDisclaimer: string;
  onRefresh: () => Promise<void>;
  onReload: () => Promise<void>;
  onMarkCooked: (meal: DailyMeal) => Promise<any>;
  /** Re-fetches one meal against the latest stock when its recipe is opened. */
  onLoadMealDetail: (mealId: string) => Promise<DailyMeal | null>;
  onNavigateAdd: () => void;
}

const MEAL_SECTIONS: { key: string; labelKey: string; label: string; icon: string }[] = [
  { key: 'breakfast', labelKey: 'smart_pantry.meal_breakfast', label: 'Breakfast', icon: '🍳' },
  { key: 'lunch', labelKey: 'smart_pantry.meal_lunch', label: 'Lunch', icon: '🥗' },
  { key: 'dinner', labelKey: 'smart_pantry.meal_dinner', label: 'Dinner', icon: '🥣' },
  { key: 'snack', labelKey: 'smart_pantry.meal_snack', label: 'Snack', icon: '🍎' },
];

function formatQuantity(value: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export const DailyMealsView: React.FC<Props> = ({
  meals,
  loading,
  refreshing,
  cookingMealId,
  error,
  stale,
  pantryEmpty,
  refreshesLeft,
  nutritionDisclaimer,
  onRefresh,
  onReload,
  onMarkCooked,
  onLoadMealDetail,
  onNavigateAdd,
}) => {
  const styles = useThemedStyles(makeStyles);
  const [selectedMeal, setSelectedMeal] = useState<DailyMeal | null>(null);

  /** Opens the recipe immediately, then swaps in fresh data once it arrives. */
  const handleOpenRecipe = async (meal: DailyMeal) => {
    setSelectedMeal(meal);
    const fresh = await onLoadMealDetail(meal.id);
    if (fresh) {
      setSelectedMeal((current) => (current && current.id === fresh.id ? fresh : current));
    }
  };

  const handleCook = (meal: DailyMeal) => {
    Alert.alert(
      t('smart_pantry.mark_cooked_title', { defaultValue: 'Mark as Cooked?' }),
      t('smart_pantry.mark_cooked_msg', {
        name: meal.name,
        defaultValue: `The ingredients used by ${meal.name} will be deducted from your pantry stock.`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('smart_pantry.mark_cooked_confirm', { defaultValue: 'Yes, I cooked it' }),
          onPress: async () => {
            const result = await onMarkCooked(meal);
            setSelectedMeal(null);
            if (result) {
              const shortfall = result.insufficientItems || [];
              Alert.alert(
                t('smart_pantry.pantry_updated_title', { defaultValue: 'Pantry Updated' }),
                shortfall.length > 0
                  ? t('smart_pantry.pantry_updated_short_msg', {
                      names: shortfall.map((i: any) => i.name).join(', '),
                      defaultValue: `Stock updated. These ingredients were short and need topping up: ${shortfall
                        .map((i: any) => i.name)
                        .join(', ')}.`,
                    })
                  : result.message,
              );
            }
          },
        },
      ],
    );
  };

  const renderIngredientRow = (ingredient: MealIngredient, idx: number) => (
    <View key={`${ingredient.name}_${idx}`} style={styles.ingredientRow}>
      {ingredient.available ? (
        <Check size={13} color={styles.ingredientAvailable.color} strokeWidth={2.5} />
      ) : (
        <TriangleAlert size={13} color={styles.ingredientMissing.color} strokeWidth={2} />
      )}
      <Text
        style={[
          styles.ingredientText,
          ingredient.available ? styles.ingredientAvailable : styles.ingredientMissing,
        ]}>
        {ingredient.name} — {formatQuantity(ingredient.quantity)} {ingredient.unit}
        {!ingredient.available && ingredient.pantryItemId
          ? t('smart_pantry.ingredient_low', { defaultValue: ' (low stock)' })
          : ''}
        {!ingredient.available && !ingredient.pantryItemId
          ? t('smart_pantry.ingredient_missing', { defaultValue: ' (not in pantry)' })
          : ''}
      </Text>
    </View>
  );

  // --- Loading -----------------------------------------------------------
  if (loading && meals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color={styles.stateTitle.color} />
          <Text style={styles.stateTitle}>
            {t('smart_pantry.meals_loading', { defaultValue: 'Building today\'s healthy meals...' })}
          </Text>
          <Text style={styles.stateSub}>
            {t('smart_pantry.meals_loading_sub', {
              defaultValue: 'Checking your stock and what needs using up first.',
            })}
          </Text>
        </View>
      </View>
    );
  }

  // --- Empty pantry ------------------------------------------------------
  if (pantryEmpty && meals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.stateCard}>
          <Salad size={36} color={styles.stateSub.color} strokeWidth={1.5} />
          <Text style={styles.stateTitle}>
            {t('smart_pantry.meals_empty_pantry_title', { defaultValue: 'Your pantry is empty' })}
          </Text>
          <Text style={styles.stateSub}>
            {t('smart_pantry.meals_empty_pantry_sub', {
              defaultValue:
                'Add some ingredients to get personalized meal suggestions built from your own stock.',
            })}
          </Text>
          <Pressable style={styles.stateBtn} onPress={onNavigateAdd}>
            <Text style={styles.stateBtnText}>
              {t('smart_pantry.add_ingredients_btn', { defaultValue: 'Add Ingredients' })}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // --- Error -------------------------------------------------------------
  if (error && meals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.stateCard}>
          <TriangleAlert size={32} color={styles.ingredientMissing.color} strokeWidth={1.8} />
          <Text style={styles.stateTitle}>
            {t('smart_pantry.meals_error_title', { defaultValue: 'Suggestions unavailable' })}
          </Text>
          <Text style={styles.stateSub}>{error}</Text>
          <Pressable style={styles.stateBtn} onPress={onReload}>
            <Text style={styles.stateBtnText}>
              {t('common.try_again', { defaultValue: 'Try Again' })}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero header */}
      <View style={styles.heroHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>
            {t('smart_pantry.daily_meals_title', { defaultValue: "Today's Healthy Meals" })}
          </Text>
          <Text style={styles.heroSub}>
            {t('smart_pantry.daily_meals_sub', {
              defaultValue: 'Built from the ingredients already in your pantry.',
            })}
          </Text>
        </View>
        <Pressable
          style={[styles.refreshBtn, (refreshing || refreshesLeft <= 0) && styles.refreshBtnDisabled]}
          onPress={onRefresh}
          disabled={refreshing || refreshesLeft <= 0}>
          {refreshing ? (
            <ActivityIndicator size="small" color={styles.refreshBtnText.color} />
          ) : (
            <RefreshCw size={14} color={styles.refreshBtnText.color} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      {/* Stale stock banner */}
      {stale && (
        <Pressable style={styles.staleBanner} onPress={onRefresh} disabled={refreshing}>
          <TriangleAlert size={14} color={styles.staleBannerText.color} strokeWidth={2} />
          <Text style={styles.staleBannerText}>
            {t('smart_pantry.meals_stale', {
              defaultValue:
                'Your stock changed since these were generated. Tap to refresh suggestions.',
            })}
          </Text>
        </Pressable>
      )}

      {/* Inline error while existing meals are still shown */}
      {error && meals.length > 0 && (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      )}

      {/* Meal sections grouped by meal type */}
      {MEAL_SECTIONS.map((section) => {
        const sectionMeals = meals.filter((m) => m.mealType === section.key);
        if (sectionMeals.length === 0) {
          return null;
        }
        return (
          <View key={section.key}>
            <Text style={styles.sectionLabel}>
              {section.icon} {t(section.labelKey, { defaultValue: section.label })}
            </Text>

            {sectionMeals.map((meal) => (
              <Pressable
                key={meal.id}
                style={[styles.mealCard, meal.cooked && styles.mealCardCooked]}
                onPress={() => handleOpenRecipe(meal)}>
                <View style={styles.mealCardHeader}>
                  <Text style={styles.mealName} numberOfLines={2}>
                    {meal.name}
                  </Text>
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchBadgeText}>
                      {meal.pantryMatchPercentage}
                      {t('smart_pantry.pantry_match_short', { defaultValue: '% pantry' })}
                    </Text>
                  </View>
                </View>

                {meal.cooked && (
                  <View style={styles.cookedPill}>
                    <Check size={10} color={styles.cookedPillText.color} strokeWidth={3} />
                    <Text style={styles.cookedPillText}>
                      {t('smart_pantry.meal_cooked_badge', { defaultValue: 'Cooked' })}
                    </Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  {meal.nutrition?.calories != null && (
                    <View style={styles.statChip}>
                      <Flame size={11} color={styles.statText.color} strokeWidth={2} />
                      <Text style={styles.statText}>~{meal.nutrition.calories} kcal</Text>
                    </View>
                  )}
                  {meal.nutrition?.protein != null && (
                    <View style={styles.statChip}>
                      <Text style={styles.statText}>{meal.nutrition.protein}g protein</Text>
                    </View>
                  )}
                  <View style={styles.statChip}>
                    <Timer size={11} color={styles.statText.color} strokeWidth={2} />
                    <Text style={styles.statText}>{meal.estimatedTime} min</Text>
                  </View>
                </View>

                {meal.healthBenefits?.length > 0 && (
                  <Text style={styles.benefitText}>{meal.healthBenefits[0]}</Text>
                )}

                <Text style={styles.usesText} numberOfLines={2}>
                  {t('smart_pantry.meal_uses', { defaultValue: 'Uses' })}:{' '}
                  {meal.ingredients
                    .filter((i) => i.available)
                    .map((i) => i.name)
                    .join(' • ') ||
                    t('smart_pantry.meal_uses_none', { defaultValue: 'pantry staples' })}
                </Text>

                <View style={styles.viewRecipeRow}>
                  <Text style={styles.viewRecipeText}>
                    {t('smart_pantry.view_recipe', { defaultValue: 'View Recipe' })}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        );
      })}

      {nutritionDisclaimer ? (
        <Text style={styles.disclaimer}>{nutritionDisclaimer}</Text>
      ) : null}

      {/* MEAL DETAIL MODAL */}
      <Modal
        visible={selectedMeal !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedMeal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedMeal && (
              <>
                <View style={styles.modalHeaderRow}>
                  <ChefHat
                    size={26}
                    color={styles.modalTitle.color}
                    strokeWidth={1.8}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{selectedMeal.name}</Text>
                    <Text style={styles.modalSub}>
                      {selectedMeal.mealType} · {selectedMeal.estimatedTime} min ·{' '}
                      {selectedMeal.difficulty} · {selectedMeal.pantryMatchPercentage}
                      {t('smart_pantry.pantry_match_short', { defaultValue: '% pantry' })}
                    </Text>
                  </View>
                  <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedMeal(null)}>
                    <X size={20} color={styles.modalSub.color} strokeWidth={2} />
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}>
                  {selectedMeal.description ? (
                    <Text style={styles.modalBody}>{selectedMeal.description}</Text>
                  ) : null}

                  {selectedMeal.recommendationReason ? (
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonLabel}>
                        {t('smart_pantry.why_recommended', {
                          defaultValue: 'Why this meal is recommended',
                        })}
                      </Text>
                      <Text style={styles.reasonText}>{selectedMeal.recommendationReason}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.modalSectionLabel}>
                    {t('smart_pantry.ingredients_req', { defaultValue: 'Ingredients' })}
                  </Text>
                  {selectedMeal.ingredients.map(renderIngredientRow)}

                  {selectedMeal.missingIngredients.length > 0 && (
                    <Text style={styles.missingNote}>
                      {t('smart_pantry.missing_note', {
                        count: selectedMeal.missingIngredients.length,
                        defaultValue: `${selectedMeal.missingIngredients.length} ingredient(s) are not in your pantry yet.`,
                      })}
                    </Text>
                  )}

                  <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                    {t('smart_pantry.instructions', { defaultValue: 'Cooking Instructions' })}
                  </Text>
                  {selectedMeal.instructions.map((step, idx) => (
                    <Text key={idx} style={styles.instructionStep}>
                      {idx + 1}. {step}
                    </Text>
                  ))}

                  <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                    {t('smart_pantry.nutrition', { defaultValue: 'Nutrition (estimated)' })}
                  </Text>
                  <View style={styles.nutritionGrid}>
                    {[
                      { label: 'Calories', value: selectedMeal.nutrition?.calories, unit: 'kcal' },
                      { label: 'Protein', value: selectedMeal.nutrition?.protein, unit: 'g' },
                      { label: 'Carbs', value: selectedMeal.nutrition?.carbohydrates, unit: 'g' },
                      { label: 'Fat', value: selectedMeal.nutrition?.fat, unit: 'g' },
                      { label: 'Fibre', value: selectedMeal.nutrition?.fiber, unit: 'g' },
                    ]
                      .filter((n) => n.value != null)
                      .map((n) => (
                        <View key={n.label} style={styles.nutritionCell}>
                          <Text style={styles.nutritionValue}>
                            {n.value}
                            {n.unit}
                          </Text>
                          <Text style={styles.nutritionLabel}>{n.label}</Text>
                        </View>
                      ))}
                  </View>

                  {selectedMeal.healthBenefits.length > 0 && (
                    <>
                      <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                        {t('smart_pantry.health_benefits', { defaultValue: 'Health Benefits' })}
                      </Text>
                      {selectedMeal.healthBenefits.map((benefit, idx) => (
                        <Text key={idx} style={styles.instructionStep}>
                          • {benefit}
                        </Text>
                      ))}
                    </>
                  )}

                  <Text style={styles.modalPrepRow}>
                    {t('smart_pantry.prep_time', { defaultValue: 'Prep' })}: {selectedMeal.prepTime}{' '}
                    min · {t('smart_pantry.cook_time', { defaultValue: 'Cook' })}:{' '}
                    {selectedMeal.cookTime} min · {selectedMeal.difficulty}
                  </Text>

                  {nutritionDisclaimer ? (
                    <Text style={styles.disclaimer}>{nutritionDisclaimer}</Text>
                  ) : null}
                </ScrollView>

                <Pressable
                  style={[
                    styles.cookBtn,
                    (selectedMeal.cooked || cookingMealId === selectedMeal.id) &&
                      styles.cookBtnDisabled,
                  ]}
                  onPress={() => handleCook(selectedMeal)}
                  disabled={selectedMeal.cooked || cookingMealId === selectedMeal.id}>
                  {cookingMealId === selectedMeal.id ? (
                    <ActivityIndicator color={styles.cookBtnText.color} />
                  ) : (
                    <Text style={styles.cookBtnText}>
                      {selectedMeal.cooked
                        ? t('smart_pantry.already_cooked', { defaultValue: 'Already Cooked' })
                        : t('smart_pantry.mark_as_cooked', { defaultValue: 'Mark as Cooked' })}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    heroTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textOnPrimary },
    heroSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textOnPrimaryMuted,
      marginTop: 2,
    },
    refreshBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      marginLeft: 8,
    },
    refreshBtnDisabled: { opacity: 0.5 },
    refreshBtnText: { color: colors.primary },
    staleBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: 10,
      marginBottom: spacing.md,
    },
    staleBannerText: {
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.turmeric,
    },
    inlineError: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      padding: 10,
      marginBottom: spacing.md,
    },
    inlineErrorText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
    sectionLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 4,
    },
    mealCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    mealCardCooked: { opacity: 0.7 },
    mealCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    mealName: { flex: 1, fontFamily: fonts.serif, fontSize: 16, color: colors.textPrimary },
    matchBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    matchBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.textSecondary },
    cookedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 3,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      marginTop: 6,
    },
    cookedPillText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.textSecondary },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    statText: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.textSecondary },
    benefitText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.turmeric,
      marginTop: 8,
    },
    usesText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 4 },
    viewRecipeRow: {
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    viewRecipeText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
    disclaimer: {
      fontFamily: fonts.sans,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 8,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    stateCard: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 36,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stateTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    stateSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
    stateBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: radius.pill,
      marginTop: 6,
    },
    stateBtnText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textOnPrimary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      maxHeight: '88%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
    },
    modalScroll: { marginTop: spacing.sm },
    modalHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    modalTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary },
    modalSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    modalCloseBtn: { padding: 4 },
    modalBody: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
    reasonBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      padding: 10,
      marginTop: 10,
      marginBottom: 4,
    },
    reasonLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary },
    reasonText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary, marginTop: 3 },
    modalSectionLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 10,
    },
    ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    ingredientText: { flex: 1, fontFamily: fonts.sans, fontSize: 13 },
    ingredientAvailable: { color: colors.textPrimary },
    ingredientMissing: { color: colors.turmeric },
    missingNote: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.turmeric, marginTop: 6 },
    instructionStep: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    nutritionCell: {
      minWidth: 62,
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    nutritionValue: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
    nutritionLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, marginTop: 2 },
    modalPrepRow: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 12,
    },
    cookBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: radius.md,
      alignItems: 'center',
      marginTop: 12,
    },
    cookBtnDisabled: { opacity: 0.5 },
    cookBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textOnPrimary },
  });
