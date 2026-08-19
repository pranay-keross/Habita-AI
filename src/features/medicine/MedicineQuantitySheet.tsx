import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';

interface MedicineQuantitySheetProps {
  visible: boolean;
  medicineName: string;
  current: number;
  total: number;
  stock: string;
  onChangeStock: (value: string) => void;
  isLiquid: boolean;
  onChangeIsLiquid: (value: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
  onClose: () => void;
}

// Shown once per medicine just auto-created from a parsed prescription — the extraction
// step only knows what it read off the page, never how much the person actually has on
// hand, so this is where that gets confirmed before the medicine shows up in the main
// list with a real count. Deliberately a separate, minimal sheet rather than reusing
// MedicineScreen's full add/edit sheet: this only ever touches quantity + liquid-or-not
// for a medicine that already exists, not name/dosage/schedule.
export default function MedicineQuantitySheet({
  visible,
  medicineName,
  current,
  total,
  stock,
  onChangeStock,
  isLiquid,
  onChangeIsLiquid,
  saving,
  onSave,
  onSkip,
  onClose,
}: MedicineQuantitySheetProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('medicine.confirm_quantity_title')}>
      <Text style={styles.progress}>{t('medicine.confirm_quantity_progress', { current, total })}</Text>
      <Text style={styles.intro}>{t('medicine.confirm_quantity_intro', { name: medicineName })}</Text>

      <Text style={styles.label}>{t('medicine.label_medicine_type')}</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, !isLiquid && styles.chipActive]}
          onPress={() => onChangeIsLiquid(false)}>
          <Text style={[styles.chipText, !isLiquid && styles.chipTextActive]}>{t('medicine.type_solid')}</Text>
        </Pressable>
        <Pressable style={[styles.chip, isLiquid && styles.chipActive]} onPress={() => onChangeIsLiquid(true)}>
          <Text style={[styles.chipText, isLiquid && styles.chipTextActive]}>{t('medicine.type_liquid')}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>
        {t(isLiquid ? 'medicine.label_liquid_quantity' : 'medicine.label_stock')}
      </Text>
      <TextInput
        style={styles.input}
        value={stock}
        onChangeText={onChangeStock}
        keyboardType="number-pad"
        placeholder={t(isLiquid ? 'medicine.placeholder_liquid_quantity' : 'medicine.placeholder_stock')}
        placeholderTextColor={styles.placeholder.color}
      />

      <Button title={t('medicine.confirm_quantity_save')} onPress={onSave} loading={saving} style={styles.cta} />
      <Pressable style={styles.skipBtn} onPress={onSkip} disabled={saving}>
        <Text style={styles.skipText}>{t('medicine.confirm_quantity_skip')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const makeStyles = ({ colors, fonts, radius }: ThemeTokens) => StyleSheet.create({
  progress: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  intro: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  placeholder: {
    color: colors.textMuted,
  },
  cta: {
    marginTop: 24,
  },
  skipBtn: {
    marginTop: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.textMuted,
  },
});
