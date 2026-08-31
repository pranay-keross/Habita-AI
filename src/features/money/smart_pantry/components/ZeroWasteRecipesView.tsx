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
  onCookRecipe: (recipe: ZeroWasteRecipe) => Promise<void>;
}

export const ZeroWasteRecipesView: React.FC<Props> = ({ onCookRecipe }) => {
  const styles = useThemedStyles(makeStyles);
  const [selectedRecipe, setSelectedRecipe] = useState<ZeroWasteRecipe | null>(null);

  const handleConfirmCook = (recipe: ZeroWasteRecipe) => {
    Alert.alert('Bon Appétit!', `Used ingredients for ${recipe.title}. Stock updated in Pantry.`, [
      {
        text: 'OK',
        onPress: async () => {
          await onCookRecipe(recipe);
          setSelectedRecipe(null);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.recipeHeroHeader}>
        <Text style={styles.recipeHeroTitle}>{t('smart_pantry.recipes_title')}</Text>
        <Text style={styles.recipeHeroSub}>{t('smart_pantry.recipes_sub')}</Text>
      </View>

      {MOCK_ZERO_WASTE_RECIPES.map((recipe) => (
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

          <View style={styles.viewRecipeRow}>
            <Text style={styles.viewRecipeText}>{t('smart_pantry.tap_view_recipe')}</Text>
          </View>
        </Pressable>
      ))}

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
                          {selectedRecipe.cookTime} · Difficulty: {selectedRecipe.difficulty}
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
    recipeCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, ...shadow.soft },
    recipeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    matchBadge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    matchBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.textSecondary },
    cookTimeRow: { flexDirection: 'row', alignItems: 'center' },
    cookTimeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textMuted },
    recipeTitle: { fontFamily: fonts.serif, fontSize: 16, color: colors.textPrimary },
    expiringUsedTag: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.turmeric, marginTop: 4 },
    viewRecipeRow: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    viewRecipeText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
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
