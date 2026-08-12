import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import useAuth from '../../hooks/useAuth';
import { getMyPrimaryFamily, getMyProfileName, resolveMyMembership } from '../family/api';
import {
  calculateAdherence,
  isTakenToday,
  loadIntakeLog,
  loadMedicines,
  saveIntakeLog,
  saveMedicines,
} from './medicineStore';
import { SCHEDULE_SLOTS, type IntakeLogEntry, type Medicine, type ScheduleSlot } from './types';

type Props = StackScreenProps<RootStackParamList, 'Medicine'>;

export default function MedicineScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken, getUserId } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [log, setLog] = useState<IntakeLogEntry[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localeVersion, setLocaleVersion] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(['morning']);
  const [stock, setStock] = useState('30');

  useEffect(() => {
    loadMedicines().then(setMedicines);
    loadIntakeLog().then(setLog);
    // M4-T5, updated for the real Family backend: no family at all means no sharing
    // constraint applies (full access, same as before). Inside a family, the backend has
    // no per-module permission matrix (only OWNER/ADMIN/MEMBER roles) — see the "Drop the
    // matrix, gate by role only" decision in docs/DECISIONS.md — so a plain MEMBER gets
    // read-only access to the whole chest and OWNER/ADMIN get full access.
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const family = await getMyPrimaryFamily(token).catch(() => null);
      if (!family) {
        setCanEdit(true);
        return;
      }
      const [profileName, userId] = await Promise.all([getMyProfileName(), getUserId()]);
      const membership = resolveMyMembership(family, userId, profileName);
      setCanEdit(membership.isAdmin);
    })();
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adherence = useMemo(() => calculateAdherence(medicines, log), [medicines, log]);

  const persistMedicines = async (updated: Medicine[]) => {
    setMedicines(updated);
    await saveMedicines(updated);
  };

  const persistLog = async (updated: IntakeLogEntry[]) => {
    setLog(updated);
    await saveIntakeLog(updated);
  };

  const openAddSheet = () => {
    setEditingId(null);
    setName('');
    setDosage('');
    setSchedule(['morning']);
    setStock('30');
    setShowSheet(true);
  };

  const openEditSheet = (med: Medicine) => {
    if (!canEdit) {
      return;
    }
    setEditingId(med.id);
    setName(med.name);
    setDosage(med.dosage);
    setSchedule(med.schedule);
    setStock(String(med.stock));
    setShowSheet(true);
  };

  const toggleScheduleSlot = (slot: ScheduleSlot) => {
    setSchedule((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const handleSave = async () => {
    const stockNum = parseInt(stock, 10);
    if (!name.trim() || !dosage.trim() || schedule.length === 0 || Number.isNaN(stockNum)) {
      Alert.alert(t('medicine.incomplete_title'), t('medicine.incomplete_msg'));
      return;
    }

    if (editingId) {
      const updated = medicines.map((m) =>
        m.id === editingId
          ? { ...m, name: name.trim(), dosage: dosage.trim(), schedule, stock: stockNum }
          : m,
      );
      await persistMedicines(updated);
    } else {
      const newMedicine: Medicine = {
        id: Date.now().toString(),
        name: name.trim(),
        dosage: dosage.trim(),
        schedule,
        stock: stockNum,
      };
      await persistMedicines([...medicines, newMedicine]);
    }
    setShowSheet(false);
  };

  const handleRemove = () => {
    if (!editingId) {
      return;
    }
    const target = medicines.find((m) => m.id === editingId);
    Alert.alert(
      t('medicine.remove_confirm_title'),
      t('medicine.remove_confirm_msg', { name: target?.name ?? '' }),
      [
        { text: t('medicine.cancel'), style: 'cancel' },
        {
          text: t('medicine.remove'),
          style: 'destructive',
          onPress: async () => {
            await persistMedicines(medicines.filter((m) => m.id !== editingId));
            setShowSheet(false);
          },
        },
      ],
    );
  };

  const markTaken = (med: Medicine, slot: ScheduleSlot) => {
    if (!canEdit || isTakenToday(log, med.id, slot)) {
      return;
    }
    const entry: IntakeLogEntry = { id: Date.now().toString(), medicineId: med.id, slot, takenAt: Date.now() };
    persistLog([...log, entry]);
    persistMedicines(medicines.map((m) => (m.id === med.id ? { ...m, stock: Math.max(0, m.stock - 1) } : m)));
  };

  const dosesToday = medicines.reduce((sum, m) => sum + m.schedule.length, 0);
  const takenTodayCount = medicines.reduce(
    (sum, m) => sum + m.schedule.filter((slot) => isTakenToday(log, m.id, slot)).length,
    0,
  );

  return (
    <View style={styles.root} key={localeVersion}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('medicine.header_title')}</Text>
        {canEdit ? (
          <Pressable onPress={openAddSheet} style={styles.addBtn}>
            <Text style={styles.addBtnText}>{t('medicine.add_btn')}</Text>
          </Pressable>
        ) : (
          <View style={styles.addBtnPlaceholder} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{t('medicine.hero_title')}</Text>
          <Text style={styles.heroSubtitle}>{t('medicine.hero_subtitle')}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{medicines.length}</Text>
              <Text style={styles.statLabel}>{t('medicine.stat_medicines')}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>
                {takenTodayCount} / {dosesToday}
              </Text>
              <Text style={styles.statLabel}>{t('medicine.stat_today')}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>
                {adherence === null ? t('medicine.adherence_no_data') : `${adherence}%`}
              </Text>
              <Text style={styles.statLabel}>{t('medicine.stat_adherence')}</Text>
            </View>
          </View>
        </View>

        {!canEdit && (
          <View style={styles.readonlyBanner}>
            <Text style={styles.readonlyText}>{t('medicine.readonly_note')}</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('medicine.section_title')}</Text>
          <Text style={styles.sectionSub}>{t('medicine.section_sub')}</Text>
        </View>

        {medicines.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('medicine.empty_title')}</Text>
            <Text style={styles.emptySub}>{t('medicine.empty_sub')}</Text>
          </View>
        ) : (
          medicines.map((med) => (
            <Pressable key={med.id} style={styles.medCard} onPress={() => openEditSheet(med)}>
              <View style={styles.medHeaderRow}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.medStock}>{t('medicine.stock_label', { count: med.stock })}</Text>
              </View>
              <Text style={styles.medDosage}>{med.dosage}</Text>
              <View style={styles.slotRow}>
                {med.schedule.map((slot) => {
                  const taken = isTakenToday(log, med.id, slot);
                  return (
                    <Pressable
                      key={slot}
                      disabled={!canEdit || taken}
                      style={[styles.slotChip, taken && styles.slotChipTaken]}
                      onPress={(e) => {
                        e.stopPropagation();
                        markTaken(med, slot);
                      }}>
                      <Text style={[styles.slotChipText, taken && styles.slotChipTextTaken]}>
                        {t(`medicine.slot_${slot}`)}
                        {taken ? ` · ${t('medicine.taken_today')}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <BottomSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        title={editingId ? t('medicine.sheet_title_edit') : t('medicine.sheet_title_add')}>
        <Text style={styles.label}>{t('medicine.label_name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('medicine.placeholder_name')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Text style={styles.label}>{t('medicine.label_dosage')}</Text>
        <TextInput
          style={styles.input}
          value={dosage}
          onChangeText={setDosage}
          placeholder={t('medicine.placeholder_dosage')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Text style={styles.label}>{t('medicine.label_schedule')}</Text>
        <View style={styles.chipRow}>
          {SCHEDULE_SLOTS.map((slot) => (
            <Pressable
              key={slot}
              style={[styles.chip, schedule.includes(slot) && styles.chipActive]}
              onPress={() => toggleScheduleSlot(slot)}>
              <Text style={[styles.chipText, schedule.includes(slot) && styles.chipTextActive]}>
                {t(`medicine.slot_${slot}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t('medicine.label_stock')}</Text>
        <TextInput
          style={styles.input}
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
          placeholder={t('medicine.placeholder_stock')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Button
          title={editingId ? t('medicine.save_changes') : t('medicine.add_medicine')}
          onPress={handleSave}
          style={styles.modalCta}
        />

        {editingId && (
          <Pressable style={styles.modalRemoveBtn} onPress={handleRemove}>
            <Text style={styles.modalRemoveText}>{t('medicine.remove_medicine')}</Text>
          </Pressable>
        )}
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.textOnPrimary,
  },
  addBtnPlaceholder: {
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.medium,
  },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.textOnPrimary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textOnPrimaryMuted,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.textOnPrimary,
  },
  statLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textOnPrimaryMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  readonlyBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  readonlyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  sectionSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textPrimary,
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  medCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  medHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textPrimary,
  },
  medStock: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
  },
  medDosage: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  slotChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipTaken: {
    backgroundColor: colors.turmericSoft,
    borderColor: colors.turmeric,
  },
  slotChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  slotChipTextTaken: {
    color: colors.turmeric,
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
  // `placeholderTextColor` is a prop, not a style — kept here so the factory stays
  // the single place this screen reads the palette.
  placeholder: {
    color: colors.textMuted,
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
  modalCta: {
    marginTop: 24,
  },
  modalRemoveBtn: {
    marginTop: 14,
    marginBottom: 24,
    backgroundColor: colors.dangerSoft,
    paddingVertical: 12,
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  modalRemoveText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.danger,
  },
});
