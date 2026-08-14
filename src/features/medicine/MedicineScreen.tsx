import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { pick, isErrorWithCode, errorCodes, types as documentTypes } from '@react-native-documents/picker';
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
  createFamilyProfile,
  createMedicine,
  listFamilyProfiles,
  listMedicalDocuments,
  listMedicines,
  logIntake,
  parseMedchestError,
  updateMedicine,
  uploadMedicalDocument,
  type MedchestErrorKind,
  type MedicalDocument,
  type RemoteMedicine,
} from './api';
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

// Maps this screen's local slot enum to/from the backend's `scheduleTimes: "HH:MM"[]`
// (docs/DECISIONS.md D-035) — a representative time per slot, not a real schedule
// picker, so the existing chip-based UI didn't need to change shape. Multiple backend
// times landing in the same bucket collapse to one slot on the way back in.
const SLOT_TIME: Record<ScheduleSlot, string> = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '18:00',
  night: '21:00',
};

function slotToTime(slot: ScheduleSlot): string {
  return SLOT_TIME[slot];
}

function timeToSlot(time: string): ScheduleSlot {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function remoteToLocal(remote: RemoteMedicine): Medicine {
  const slots = Array.from(new Set(remote.scheduleTimes.map(timeToSlot)));
  return { id: remote.id, name: remote.name, dosage: remote.dosage, schedule: slots, stock: remote.stockQuantity };
}

function formatDob(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// A reasonable starting point for the native picker's initial position — not a
// default value; nothing is sent until the user actually picks a date.
const DEFAULT_DOB = new Date(new Date().getFullYear() - 25, 0, 1);
const MIN_DOB = new Date(1900, 0, 1);

export default function MedicineScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken, getUserId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  // Only used for "was this slot marked taken today" — a purely local, display-only
  // concern in both modes. In remote mode the backend has no endpoint to query intake
  // history back (docs/DECISIONS.md D-035), so this local log is the only place that
  // information exists at all, even though stock/adherence themselves come from the
  // backend once a dose is logged there.
  const [log, setLog] = useState<IntakeLogEntry[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localeVersion, setLocaleVersion] = useState(0);

  // `null` = local-only (no family, or family lookup failed) — unchanged pre-D-035
  // behavior. Non-null once a family is found: medicines live on the backend, scoped to
  // this `familyProfileId` (a `category: SELF` `FamilyProfile`, auto-created below if
  // none exists yet).
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyProfileId, setFamilyProfileId] = useState<string | null>(null);
  // `lowStockThreshold` has no field in this screen's UI at all, but `PUT /medicines/{id}`
  // is a full replace, not a patch — has to be resent on every edit. Carried here,
  // keyed by medicine id, from whatever `listMedicines`/`createMedicine` last returned.
  const [lowStockThresholds, setLowStockThresholds] = useState<Record<string, number>>({});
  const [adherenceRates, setAdherenceRates] = useState<Record<string, number>>({});

  const [showDobSheet, setShowDobSheet] = useState(false);
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingDob, setSavingDob] = useState(false);

  // Prescriptions/documents — only reachable once `familyProfileId` exists (same
  // profile medicines attach to). No local-only equivalent: this app has no local
  // document storage of its own, so with no family there is nowhere for this to live.
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(['morning']);
  const [stock, setStock] = useState('30');
  const [saving, setSaving] = useState(false);

  const errorMessageKey = (kind: MedchestErrorKind): string => {
    const key: Record<MedchestErrorKind, string> = {
      network: 'onboarding.network_error',
      not_found: 'medicine.error_not_found',
      no_permission: 'medicine.error_no_permission',
      unknown: 'medicine.error_generic',
    };
    return key[kind];
  };

  const showRemoteError = (err: unknown) => {
    Alert.alert(t('onboarding.error_title'), t(errorMessageKey(parseMedchestError(err))));
  };

  const refreshRemoteMedicines = async (profileId: string, token: string) => {
    const remote = await listMedicines(profileId, token);
    setMedicines(remote.map(remoteToLocal));
    setLowStockThresholds(Object.fromEntries(remote.map((m) => [m.id, m.lowStockThreshold])));
    setAdherenceRates(Object.fromEntries(remote.map((m) => [m.id, m.adherenceRate])));
  };

  const refreshDocuments = async (profileId: string, token: string) => {
    setDocuments(await listMedicalDocuments(profileId, token));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      loadIntakeLog().then(setLog);
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      // M4-T5, updated for the real Family backend: no family at all means no sharing
      // constraint applies (full access, same as before, and stays local-only — there is
      // nowhere on the backend to store a medicine chest without a family). Inside a
      // family, the backend has no per-module permission matrix (only OWNER/ADMIN/MEMBER
      // roles) — a plain MEMBER gets read-only access, OWNER/ADMIN get full access.
      const family = await getMyPrimaryFamily(token).catch(() => null);
      if (!family) {
        setFamilyId(null);
        setCanEdit(true);
        loadMedicines().then(setMedicines);
        setLoading(false);
        return;
      }
      const [profileName, userId] = await Promise.all([getMyProfileName(), getUserId()]);
      const membership = resolveMyMembership(family, userId, profileName);
      setCanEdit(membership.isAdmin);
      setFamilyId(family.id);
      try {
        const profiles = await listFamilyProfiles(family.id, token);
        const selfProfile = profiles.find((p) => p.category === 'SELF') ?? null;
        if (selfProfile) {
          setFamilyProfileId(selfProfile.id);
          await refreshRemoteMedicines(selfProfile.id, token);
          await refreshDocuments(selfProfile.id, token);
        }
        // No SELF profile yet — leave `familyProfileId` null. The empty state below
        // prompts for a date of birth (needed to create one, `docs/DECISIONS.md`
        // D-035) the first time "+ Add" is tapped, rather than up front on every visit.
      } catch (err) {
        showRemoteError(err);
      }
      setLoading(false);
    })();
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adherence = useMemo(() => {
    if (familyId) {
      const rates = medicines.map((m) => adherenceRates[m.id]).filter((r): r is number => r !== undefined);
      if (rates.length === 0) return null;
      return Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
    }
    return calculateAdherence(medicines, log);
  }, [familyId, medicines, adherenceRates, log]);

  const persistMedicines = async (updated: Medicine[]) => {
    setMedicines(updated);
    await saveMedicines(updated);
  };

  const persistLog = async (updated: IntakeLogEntry[]) => {
    setLog(updated);
    await saveIntakeLog(updated);
  };

  const openAddSheet = () => {
    if (familyId && !familyProfileId) {
      // Nothing to attach a medicine to yet — collect the one-time date of birth
      // Create Profile needs before opening the medicine form at all.
      setDobDate(null);
      setShowDobSheet(true);
      return;
    }
    setEditingId(null);
    setName('');
    setDosage('');
    setSchedule(['morning']);
    setStock('30');
    setShowSheet(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setDobDate(selectedDate);
    }
  };

  const handleConfirmDob = async () => {
    if (!dobDate) {
      Alert.alert(t('medicine.incomplete_title'), t('medicine.dob_invalid'));
      return;
    }
    if (!familyId) {
      return;
    }
    setSavingDob(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const profileName = (await getMyProfileName()) || t('medicine.default_profile_name');
      const profile = await createFamilyProfile(familyId, profileName, 'SELF', formatDob(dobDate), token);
      setFamilyProfileId(profile.id);
      setShowDobSheet(false);
      openAddSheet();
    } catch (err) {
      showRemoteError(err);
    } finally {
      setSavingDob(false);
    }
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

    if (familyProfileId) {
      setSaving(true);
      try {
        const token = await getAccessToken();
        if (!token) {
          return;
        }
        const input = {
          name: name.trim(),
          dosage: dosage.trim(),
          scheduleTimes: schedule.map(slotToTime),
          stockQuantity: stockNum,
          lowStockThreshold: editingId ? (lowStockThresholds[editingId] ?? 3) : 3,
        };
        if (editingId) {
          await updateMedicine(editingId, input, token);
        } else {
          await createMedicine(familyProfileId, input, token);
        }
        await refreshRemoteMedicines(familyProfileId, token);
        setShowSheet(false);
      } catch (err) {
        showRemoteError(err);
      } finally {
        setSaving(false);
      }
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

  const markTaken = async (med: Medicine, slot: ScheduleSlot) => {
    if (!canEdit || isTakenToday(log, med.id, slot)) {
      return;
    }
    if (familyProfileId) {
      try {
        const token = await getAccessToken();
        if (!token) {
          return;
        }
        // Logged before the local "taken" marker is set — if this fails, nothing is
        // marked taken and the slot stays tappable, rather than the UI silently
        // disagreeing with what the backend actually recorded.
        await logIntake(med.id, 'TAKEN', '', token);
        const entry: IntakeLogEntry = { id: Date.now().toString(), medicineId: med.id, slot, takenAt: Date.now() };
        await persistLog([...log, entry]);
        await refreshRemoteMedicines(familyProfileId, token);
      } catch (err) {
        showRemoteError(err);
      }
      return;
    }
    const entry: IntakeLogEntry = { id: Date.now().toString(), medicineId: med.id, slot, takenAt: Date.now() };
    await persistLog([...log, entry]);
    await persistMedicines(medicines.map((m) => (m.id === med.id ? { ...m, stock: Math.max(0, m.stock - 1) } : m)));
  };

  // `documentType` is fixed to "PRESCRIPTION" — the only value that appears anywhere in
  // the collection's saved examples, so it's the only one this client can be sure the
  // backend accepts (docs/BACKEND_CONTEXT.md's Medchest subsection). Picks from images,
  // PDF, or Word docs — the file types the user asked for; `@react-native-documents/picker`
  // (new dependency, docs/DECISIONS.md) opens the system's own file browser, not the
  // photo-only picker `react-native-image-picker` already in this app provides.
  const handlePickDocument = async () => {
    if (!familyProfileId) {
      return;
    }
    try {
      const [result] = await pick({
        type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.images],
      });
      setUploadingDoc(true);
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      await uploadMedicalDocument(
        familyProfileId,
        { uri: result.uri, name: result.name ?? 'document', type: result.type ?? 'application/octet-stream' },
        'PRESCRIPTION',
        token,
      );
      await refreshDocuments(familyProfileId, token);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      showRemoteError(err);
    } finally {
      setUploadingDoc(false);
    }
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
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={styles.addBtnText.color} />
          </View>
        ) : (
          <>
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

            {familyProfileId && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('medicine.documents_title')}</Text>
                  <Text style={styles.sectionSub}>{t('medicine.documents_sub')}</Text>
                </View>

                {canEdit && (
                  <Pressable style={styles.uploadBanner} onPress={handlePickDocument} disabled={uploadingDoc}>
                    {uploadingDoc ? (
                      <ActivityIndicator color={styles.addBtnText.color} />
                    ) : (
                      <>
                        <Text style={styles.uploadBannerIcon}>📎</Text>
                        <View style={styles.uploadBannerContent}>
                          <Text style={styles.uploadBannerTitle}>{t('medicine.upload_document_btn')}</Text>
                          <Text style={styles.uploadBannerSub}>{t('medicine.upload_document_sub')}</Text>
                        </View>
                        <Text style={styles.uploadBannerArrow}>→</Text>
                      </>
                    )}
                  </Pressable>
                )}

                {documents.length === 0 ? (
                  <Text style={styles.documentsEmptyText}>{t('medicine.documents_empty')}</Text>
                ) : (
                  documents.map((doc) => (
                    <View key={doc.id} style={styles.documentRow}>
                      <Text style={styles.documentIcon}>📄</Text>
                      <View style={styles.documentInfo}>
                        <Text style={styles.documentName} numberOfLines={1}>
                          {doc.originalFilename}
                        </Text>
                        <Text style={styles.documentMeta}>
                          {new Date(doc.uploadedAt).toLocaleDateString()} · {t('medicine.ocr_status_label')}:{' '}
                          {doc.ocrStatus}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </>
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
          loading={saving}
          style={styles.modalCta}
        />

        {/* No delete endpoint exists anywhere in the Medchest domain
            (docs/DECISIONS.md D-032/D-035) — only offered in local-only mode. */}
        {editingId && !familyId && (
          <Pressable style={styles.modalRemoveBtn} onPress={handleRemove}>
            <Text style={styles.modalRemoveText}>{t('medicine.remove_medicine')}</Text>
          </Pressable>
        )}
      </BottomSheet>

      <BottomSheet visible={showDobSheet} onClose={() => setShowDobSheet(false)} title={t('medicine.dob_prompt_title')}>
        <View style={styles.sheetInfoBox}>
          <Text style={styles.sheetInfoIcon}>🩺</Text>
          <Text style={styles.sheetInfoText}>{t('medicine.dob_prompt_helper')}</Text>
        </View>
        <Text style={styles.label}>{t('medicine.label_dob')}</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={dobDate ? styles.dobValueText : styles.placeholder}>
            {dobDate ? formatDob(dobDate) : t('medicine.placeholder_dob')}
          </Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={dobDate ?? DEFAULT_DOB}
            mode="date"
            display="default"
            maximumDate={new Date()}
            minimumDate={MIN_DOB}
            onChange={handleDateChange}
          />
        )}
        <Button title={t('medicine.save_dob')} onPress={handleConfirmDob} loading={savingDob} style={styles.modalCta} />
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
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
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
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  uploadBannerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  uploadBannerContent: {
    flex: 1,
  },
  uploadBannerTitle: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  uploadBannerSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  uploadBannerArrow: {
    fontSize: 18,
    color: colors.primary,
    fontFamily: fonts.sansBold,
  },
  documentsEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  documentMeta: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
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
  // the single place this screen reads the palette. Also reused directly as a `Text`
  // style for the date-of-birth field's placeholder state (below), which is a
  // `Pressable` + `Text` pair, not a real `TextInput`.
  placeholder: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textMuted,
  },
  dobValueText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sheetInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 4,
  },
  sheetInfoIcon: {
    fontSize: 18,
  },
  sheetInfoText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
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
