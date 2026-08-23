import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import useAuth from '../../hooks/useAuth';
import { createFamily, getMyPrimaryFamily, getMyProfileName, resolveMyMembership } from '../family/api';
import type { FamilyMember } from '../family/types';
import {
  createFamilyProfileForMember,
  createFamilyProfileOther,
  createMedicine,
  deleteMedicine as deleteRemoteMedicine,
  extractMedchestErrorMessage,
  listFamilyProfiles,
  listMedicines,
  logIntake,
  normalizeScheduleTimes,
  normalizeStockQuantity,
  parseAdherenceRate,
  parseMedchestError,
  updateMedicine,
  type FamilyProfile,
  type FamilyProfileCategory,
  type MedchestErrorKind,
  type RemoteMedicine,
} from './api';
import {
  calculateAdherence,
  guessIsLiquid,
  isTakenToday,
  loadIntakeLog,
  loadLiquidFlags,
  loadMedicines,
  saveIntakeLog,
  saveLiquidFlags,
  saveMedicines,
} from './medicineStore';
import { SCHEDULE_SLOTS, timeToSlot, type IntakeLogEntry, type Medicine, type ScheduleSlot } from './types';

type Props = StackScreenProps<RootStackParamList, 'Medicine'>;

// Default time per slot, used when a medicine has no custom time saved for that slot
// yet (docs/DECISIONS.md D-035 — backend just wants `scheduleTimes: "HH:MM"[]`, so a
// user-picked time per slot is sent as-is).
const SLOT_TIME: Record<ScheduleSlot, string> = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '18:00',
  night: '21:00',
};

const SLOT_ICON: Record<ScheduleSlot, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌇',
  night: '🌙',
};

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function medicineSlotTimeLabel(med: Medicine, slot: ScheduleSlot): string {
  return formatTimeLabel(med.scheduleTimes?.[slot] ?? SLOT_TIME[slot]);
}

// Maps remote scheduleTimes (array or slot-keyed object) into client slots and custom times.
function remoteToLocal(remote: RemoteMedicine, liquidFlags: Record<string, boolean>): Medicine {
  const times = normalizeScheduleTimes(remote.scheduleTimes);
  const scheduleTimes: Partial<Record<ScheduleSlot, string>> = {};
  const slots: ScheduleSlot[] = [];

  if (
    remote.scheduleTimes &&
    typeof remote.scheduleTimes === 'object' &&
    !Array.isArray(remote.scheduleTimes)
  ) {
    for (const [key, val] of Object.entries(remote.scheduleTimes)) {
      if (typeof val === 'string' && val.trim().length > 0) {
        const lowerKey = key.toLowerCase() as ScheduleSlot;
        const validSlot = SCHEDULE_SLOTS.includes(lowerKey) ? lowerKey : timeToSlot(val);
        scheduleTimes[validSlot] = val;
        if (!slots.includes(validSlot)) {
          slots.push(validSlot);
        }
      }
    }
  } else {
    for (const time of times) {
      const slot = timeToSlot(time);
      if (!scheduleTimes[slot]) {
        scheduleTimes[slot] = time;
      }
      if (!slots.includes(slot)) {
        slots.push(slot);
      }
    }
  }

  return {
    id: remote.id,
    name: remote.name ?? '',
    dosage: remote.dosage ?? '',
    schedule: slots.length > 0 ? slots : ['morning'],
    scheduleTimes,
    stock: normalizeStockQuantity(remote.stockQuantity),
    isLiquid: liquidFlags[remote.id] ?? guessIsLiquid(remote.dosage ?? ''),
  };
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

const ALL_CATEGORIES: FamilyProfileCategory[] = ['SELF', 'KID', 'ELDER', 'OTHER'];

const CATEGORY_ICON: Record<FamilyProfileCategory, string> = {
  SELF: '🧑',
  KID: '🧒',
  ELDER: '👵',
  OTHER: '👤',
};

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
  // `familyProfileId` below — the profile currently selected in the switcher, one of
  // potentially several a family can now have (docs/DECISIONS.md D-038).
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [myFamilyMemberId, setMyFamilyMemberId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [familyProfileId, setFamilyProfileId] = useState<string | null>(null);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  // `lowStockThreshold` has no field in this screen's UI at all, but `PUT /medicines/{id}`
  // is a full replace, not a patch — has to be resent on every edit. Carried here,
  // keyed by medicine id, from whatever `listMedicines`/`createMedicine` last returned.
  const [lowStockThresholds, setLowStockThresholds] = useState<Record<string, number | null>>({});
  const [adherenceRates, setAdherenceRates] = useState<Record<string, number>>({});

  // "Add Profile" — a two-step sheet: pick who it's for (an existing family
  // member/dependent, or "Someone Else" with no account), then category + date of birth.
  const [showAddProfileSheet, setShowAddProfileSheet] = useState(false);
  const [addProfileStep, setAddProfileStep] = useState<'choose_who' | 'details'>('choose_who');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isOtherMode, setIsOtherMode] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [newProfileCategory, setNewProfileCategory] = useState<FamilyProfileCategory | null>(null);
  const [newProfileDob, setNewProfileDob] = useState<Date | null>(null);
  const [showNewProfileDatePicker, setShowNewProfileDatePicker] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(['morning']);
  const [scheduleTimes, setScheduleTimes] = useState<Partial<Record<ScheduleSlot, string>>>({});
  const [stock, setStock] = useState('30');
  const [isLiquid, setIsLiquid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timePickerSlot, setTimePickerSlot] = useState<ScheduleSlot | null>(null);

  // Filter out family members who already have a medicine profile created
  const availableFamilyMembers = useMemo(() => {
    return familyMembers.filter((member) => {
      const hasMemberProfile = profiles.some((p) => p.familyMemberId === member.id);
      const isSelfMember = member.id === myFamilyMemberId || (!member.managed && profiles.some((p) => p.category === 'SELF' && p.name === member.name));
      const hasSelfProfile = isSelfMember && profiles.some((p) => p.category === 'SELF');
      return !hasMemberProfile && !hasSelfProfile;
    });
  }, [familyMembers, profiles, myFamilyMemberId]);

  // Filter out 'SELF' category if a SELF profile already exists in the family
  const availableCategories = useMemo(() => {
    const hasSelfProfile = profiles.some((p) => p.category === 'SELF');
    if (hasSelfProfile) {
      return ALL_CATEGORIES.filter((cat) => cat !== 'SELF');
    }
    return ALL_CATEGORIES;
  }, [profiles]);

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
    const detail = extractMedchestErrorMessage(err);
    if (detail) {
      Alert.alert(t('onboarding.error_title'), detail);
    } else {
      Alert.alert(t('onboarding.error_title'), t(errorMessageKey(parseMedchestError(err))));
    }
  };

  const refreshRemoteMedicines = async (profileId: string, token: string) => {
    const remote = await listMedicines(profileId, token);
    const liquidFlags = await loadLiquidFlags();
    setMedicines(remote.map((m) => remoteToLocal(m, liquidFlags)));
    setLowStockThresholds(Object.fromEntries(remote.map((m) => [m.id, m.lowStockThreshold])));
    setAdherenceRates(
      Object.fromEntries(
        remote.map((m) => [m.id, parseAdherenceRate(m.adherenceRate)]).filter(([, r]) => r !== null),
      ),
    );
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
      // family, every member — creator or not — gets full add/edit/delete access; there
      // is no read-only tier on this screen at all.
      const family = await getMyPrimaryFamily(token).catch(() => null);
      if (!family) {
        setFamilyId(null);
        setCanEdit(true);
        loadMedicines().then((stored) =>
          setMedicines(stored.map((m) => ({ ...m, isLiquid: m.isLiquid ?? false }))),
        );
        setLoading(false);
        return;
      }
      const [profileName, userId] = await Promise.all([getMyProfileName(), getUserId()]);
      const membership = resolveMyMembership(family, userId, profileName);
      setCanEdit(true);
      setFamilyId(family.id);
      setFamilyMembers(family.members);
      setMyFamilyMemberId(membership.member?.id ?? null);
      try {
        const remoteProfiles = await listFamilyProfiles(family.id, token);
        setProfiles(remoteProfiles);
        // Prefer a `SELF` profile as the default view, then whatever's first — no
        // profiles at all (a brand-new family) leaves `familyProfileId` null, and the
        // empty state below prompts to create the first one via the same "Add Profile"
        // sheet the switcher's own "+" uses.
        const defaultProfile = remoteProfiles.find((p) => p.category === 'SELF') ?? remoteProfiles[0] ?? null;
        if (defaultProfile) {
          setFamilyProfileId(defaultProfile.id);
          await refreshRemoteMedicines(defaultProfile.id, token);
        }
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

  // The Prescriptions screen can auto-create or update medicines (parsing a document,
  // confirming a quantity) without this screen knowing — refresh whenever it regains
  // focus, e.g. navigating back from there, so the list/stats aren't stale. Skips the
  // very first `focus` event, which fires on initial mount alongside (and redundant
  // with) the load effect above.
  const skippedInitialFocusRef = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!skippedInitialFocusRef.current) {
        skippedInitialFocusRef.current = true;
        return;
      }
      if (!familyProfileId) {
        return;
      }
      (async () => {
        const token = await getAccessToken();
        if (!token) {
          return;
        }
        try {
          await refreshRemoteMedicines(familyProfileId, token);
        } catch (err) {
          showRemoteError(err);
        }
      })();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, familyProfileId]);

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
      if (profiles.length === 0) {
        openAddProfileSheet();
      } else {
        Alert.alert(t('medicine.no_profiles_title'), t('medicine.profiles_sub'));
      }
      return;
    }
    setEditingId(null);
    setName('');
    setDosage('');
    setSchedule(['morning']);
    setScheduleTimes({});
    setStock('30');
    setIsLiquid(false);
    setShowSheet(true);
  };

  const handleSelectProfile = async (profileId: string) => {
    if (profileId === familyProfileId) {
      return;
    }
    setFamilyProfileId(profileId);
    setSwitchingProfile(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await refreshRemoteMedicines(profileId, token);
      }
    } catch (err) {
      showRemoteError(err);
    } finally {
      setSwitchingProfile(false);
    }
  };

  const openAddProfileSheet = () => {
    // No family yet — there's no member list to choose from, and this flow is
    // "myself only" per the empty-state CTA, so skip straight to details with
    // SELF preselected.
    if (!familyId) {
      setAddProfileStep('details');
      setSelectedMemberId(null);
      setIsOtherMode(false);
      setOtherName('');
      setNewProfileCategory('SELF');
      setNewProfileDob(null);
      setShowAddProfileSheet(true);
      return;
    }
    setAddProfileStep('choose_who');
    setSelectedMemberId(null);
    setIsOtherMode(false);
    setOtherName('');
    setNewProfileCategory(null);
    setNewProfileDob(null);
    setShowAddProfileSheet(true);
  };

  const chooseMemberForProfile = (member: FamilyMember) => {
    setSelectedMemberId(member.id);
    setIsOtherMode(false);
    // A reasonable default, not a restriction — still changeable below. Anyone else
    // (including a managed member/dependent) starts with no category pre-picked, since
    // nothing about a family member reliably implies KID vs ELDER vs OTHER.
    setNewProfileCategory(member.id === myFamilyMemberId ? 'SELF' : null);
    setAddProfileStep('details');
  };

  const chooseOtherForProfile = () => {
    setSelectedMemberId(null);
    setIsOtherMode(true);
    setNewProfileCategory(null);
    setAddProfileStep('details');
  };

  const handleNewProfileDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowNewProfileDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setNewProfileDob(selectedDate);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileCategory || !newProfileDob || (isOtherMode && !otherName.trim())) {
      Alert.alert(t('medicine.incomplete_title'), t('medicine.profile_incomplete_msg'));
      return;
    }
    setCreatingProfile(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      // No family yet: profiles only exist under a family on the backend, so create
      // one behind the scenes (named after the user) before the SELF profile itself —
      // the "create my profile" CTA never exposed this as a separate family-creation
      // step to the user.
      let activeFamilyId = familyId;
      let ownerMemberId = selectedMemberId;
      if (!activeFamilyId) {
        const profileName = (await getMyProfileName()) ?? t('medicine.default_family_name');
        const family = await createFamily(profileName, token);
        const [, userId] = await Promise.all([Promise.resolve(), getUserId()]);
        const membership = resolveMyMembership(family, userId, profileName);
        activeFamilyId = family.id;
        ownerMemberId = membership.member?.id ?? null;
        setFamilyId(family.id);
        setFamilyMembers(family.members);
        setMyFamilyMemberId(membership.member?.id ?? null);
      }
      const dob = formatDob(newProfileDob);
      let profile: FamilyProfile;
      if (isOtherMode) {
        profile = await createFamilyProfileOther(activeFamilyId, otherName.trim(), newProfileCategory, dob, token);
      } else if (ownerMemberId) {
        profile = await createFamilyProfileForMember(activeFamilyId, ownerMemberId, newProfileCategory, dob, token);
      } else {
        const profileName = (await getMyProfileName()) || 'Myself';
        profile = await createFamilyProfileOther(activeFamilyId, profileName, newProfileCategory, dob, token);
      }
      const updatedProfiles = await listFamilyProfiles(activeFamilyId, token);
      setProfiles(updatedProfiles);
      setFamilyProfileId(profile.id);
      await refreshRemoteMedicines(profile.id, token);
      setShowAddProfileSheet(false);
    } catch (err) {
      showRemoteError(err);
    } finally {
      setCreatingProfile(false);
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
    setScheduleTimes(med.scheduleTimes ?? {});
    setStock(med.stock !== null ? String(med.stock) : '');
    setIsLiquid(med.isLiquid);
    setShowSheet(true);
  };

  const toggleScheduleSlot = (slot: ScheduleSlot) => {
    setSchedule((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const slotTime = (slot: ScheduleSlot): string => scheduleTimes[slot] ?? SLOT_TIME[slot];

  const slotTimeLabel = (slot: ScheduleSlot): string => formatTimeLabel(slotTime(slot));

  const handleSlotTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const slot = timePickerSlot;
    setTimePickerSlot(null);
    if (event.type === 'set' && selectedDate && slot) {
      const hh = String(selectedDate.getHours()).padStart(2, '0');
      const mm = String(selectedDate.getMinutes()).padStart(2, '0');
      setScheduleTimes((prev) => ({ ...prev, [slot]: `${hh}:${mm}` }));
    }
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
        const scheduleTimesMap: Record<string, string> = {};
        for (const slot of schedule) {
          scheduleTimesMap[slot] = slotTime(slot);
        }
        const input = {
          name: name.trim(),
          dosage: dosage.trim(),
          scheduleTimes: scheduleTimesMap,
          stockQuantity: stockNum,
          lowStockThreshold: (editingId && lowStockThresholds[editingId] != null) ? lowStockThresholds[editingId] : 3,
        };
        const saved = editingId
          ? await updateMedicine(editingId, input, token)
          : await createMedicine(familyProfileId, input, token);
        const flags = await loadLiquidFlags();
        flags[saved.id] = isLiquid;
        await saveLiquidFlags(flags);
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
          ? { ...m, name: name.trim(), dosage: dosage.trim(), schedule, scheduleTimes, stock: stockNum, isLiquid }
          : m,
      );
      await persistMedicines(updated);
    } else {
      const newMedicine: Medicine = {
        id: Date.now().toString(),
        name: name.trim(),
        dosage: dosage.trim(),
        schedule,
        scheduleTimes,
        stock: stockNum,
        isLiquid,
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
    const idToRemove = editingId;
    Alert.alert(
      t('medicine.remove_confirm_title'),
      t('medicine.remove_confirm_msg', { name: target?.name ?? '' }),
      [
        { text: t('medicine.cancel'), style: 'cancel' },
        {
          text: t('medicine.remove'),
          style: 'destructive',
          onPress: async () => {
            if (familyProfileId) {
              try {
                const token = await getAccessToken();
                if (!token) {
                  return;
                }
                await deleteRemoteMedicine(idToRemove, token);
                await refreshRemoteMedicines(familyProfileId, token);
              } catch (err) {
                showRemoteError(err);
                return;
              }
            } else {
              await persistMedicines(medicines.filter((m) => m.id !== idToRemove));
            }
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
    await persistMedicines(
      medicines.map((m) => (m.id === med.id ? { ...m, stock: Math.max(0, (m.stock ?? 0) - 1) } : m)),
    );
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

            <View style={styles.sectionMargin}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('medicine.profiles_title')}</Text>
                <Text style={styles.sectionSub}>{t('medicine.profiles_sub')}</Text>
              </View>
              {familyId ? (
                profiles.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>{t('medicine.no_profiles_title')}</Text>
                    <Text style={styles.emptySub}>{t('medicine.no_profiles_sub')}</Text>
                    <Button title={t('medicine.create_profile_btn')} onPress={openAddProfileSheet} style={styles.modalCta} />
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileRow}>
                    {profiles.map((profile) => {
                      const active = profile.id === familyProfileId;
                      return (
                        <Pressable
                          key={profile.id}
                          style={[styles.profileChip, active && styles.profileChipActive]}
                          onPress={() => handleSelectProfile(profile.id)}>
                          <Text style={styles.profileChipIcon}>{CATEGORY_ICON[profile.category] ?? '👤'}</Text>
                          <Text
                            style={[styles.profileChipText, active && styles.profileChipTextActive]}
                            numberOfLines={1}>
                            {profile.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable style={styles.addProfileChip} onPress={openAddProfileSheet}>
                      <Text style={styles.addProfileChipText}>{t('medicine.add_profile_chip')}</Text>
                    </Pressable>
                  </ScrollView>
                )
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>{t('medicine.no_profiles_title')}</Text>
                  <Text style={styles.emptySub}>{t('medicine.no_profiles_sub')}</Text>
                  <Button title={t('medicine.create_my_profile_btn')} onPress={openAddProfileSheet} style={styles.modalCta} />
                </View>
              )}
            </View>

            {familyProfileId ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('medicine.section_title')}</Text>
                  <Text style={styles.sectionSub}>{t('medicine.section_sub')}</Text>
                </View>

                {switchingProfile ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={styles.addBtnText.color} />
                  </View>
                ) : medicines.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>{t('medicine.empty_title')}</Text>
                    <Text style={styles.emptySub}>{t('medicine.empty_sub')}</Text>
                  </View>
                ) : (
                  medicines.map((med) => (
                    <Pressable key={med.id} style={styles.medCard} onPress={() => openEditSheet(med)}>
                      <View style={styles.medHeaderRow}>
                        <Text style={styles.medName}>{med.name}</Text>
                        {med.stock === null ? (
                          <View style={styles.medStockMissingBadge}>
                            <Text style={styles.medStockMissingText}>{t('medicine.stock_missing')}</Text>
                          </View>
                        ) : (
                          <Text style={styles.medStock}>
                            {t(med.isLiquid ? 'medicine.liquid_stock_label' : 'medicine.stock_label', {
                              count: med.stock,
                            })}
                          </Text>
                        )}
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
                                {t(`medicine.slot_${slot}`)} ({medicineSlotTimeLabel(med, slot)})
                                {taken ? ` · ${t('medicine.taken_today')}` : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            ) : profiles.length > 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{t('medicine.no_profiles_title')}</Text>
                <Text style={styles.emptySub}>{t('medicine.profiles_sub')}</Text>
              </View>
            ) : null}

            {familyProfileId && (
              <Pressable
                style={styles.uploadBanner}
                onPress={() => navigation.navigate('Prescriptions', { familyProfileId })}>
                <Text style={styles.uploadBannerIcon}>📎</Text>
                <View style={styles.uploadBannerContent}>
                  <Text style={styles.uploadBannerTitle}>{t('medicine.view_prescriptions_btn')}</Text>
                  <Text style={styles.uploadBannerSub}>{t('medicine.documents_sub')}</Text>
                </View>
                <Text style={styles.uploadBannerArrow}>→</Text>
              </Pressable>
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
        <View style={styles.slotList}>
          {SCHEDULE_SLOTS.map((slot) => {
            const active = schedule.includes(slot);
            return (
              <View key={slot} style={[styles.slotRow2, active && styles.slotRow2Active]}>
                <Pressable
                  style={styles.slotRow2Main}
                  onPress={() => toggleScheduleSlot(slot)}
                  hitSlop={4}>
                  <View style={[styles.slotCheckbox, active && styles.slotCheckboxActive]}>
                    {active && <Text style={styles.slotCheckboxTick}>✓</Text>}
                  </View>
                  <Text style={styles.slotIcon}>{SLOT_ICON[slot]}</Text>
                  <Text style={[styles.slotRow2Label, active && styles.slotRow2LabelActive]}>
                    {t(`medicine.slot_${slot}`)}
                  </Text>
                </Pressable>
                {active && (
                  <Pressable
                    onPress={() => setTimePickerSlot(slot)}
                    style={styles.slotTimeBtn2}
                    hitSlop={6}>
                    <Text style={styles.slotTimeBtn2Text}>{slotTimeLabel(slot)}</Text>
                    <Text style={styles.slotTimeBtn2Icon}>✎</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
        {timePickerSlot && (
          <DateTimePicker
            value={(() => {
              const [h, m] = slotTime(timePickerSlot).split(':').map(Number);
              const d = new Date();
              d.setHours(h, m, 0, 0);
              return d;
            })()}
            mode="time"
            display="default"
            onChange={handleSlotTimeChange}
          />
        )}

        <Text style={styles.label}>{t('medicine.label_medicine_type')}</Text>
        <View style={styles.chipRow}>
          <Pressable style={[styles.chip, !isLiquid && styles.chipActive]} onPress={() => setIsLiquid(false)}>
            <Text style={[styles.chipText, !isLiquid && styles.chipTextActive]}>{t('medicine.type_solid')}</Text>
          </Pressable>
          <Pressable style={[styles.chip, isLiquid && styles.chipActive]} onPress={() => setIsLiquid(true)}>
            <Text style={[styles.chipText, isLiquid && styles.chipTextActive]}>{t('medicine.type_liquid')}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t(isLiquid ? 'medicine.label_liquid_quantity' : 'medicine.label_stock')}</Text>
        <TextInput
          style={styles.input}
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
          placeholder={t(isLiquid ? 'medicine.placeholder_liquid_quantity' : 'medicine.placeholder_stock')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Button
          title={editingId ? t('medicine.save_changes') : t('medicine.add_medicine')}
          onPress={handleSave}
          loading={saving}
          style={styles.modalCta}
        />

        {editingId && (
          <Pressable style={styles.modalRemoveBtn} onPress={handleRemove}>
            <Text style={styles.modalRemoveText}>{t('medicine.remove_medicine')}</Text>
          </Pressable>
        )}
      </BottomSheet>

      <BottomSheet
        visible={showAddProfileSheet}
        onClose={() => setShowAddProfileSheet(false)}
        title={addProfileStep === 'choose_who' ? t('medicine.sheet_title_choose_who') : t('medicine.sheet_title_profile_details')}>
        {addProfileStep === 'choose_who' ? (
          <>
            <View style={styles.sheetInfoBox}>
              <Text style={styles.sheetInfoIcon}>🩺</Text>
              <Text style={styles.sheetInfoText}>{t('medicine.choose_who_helper')}</Text>
            </View>
            {availableFamilyMembers.map((member) => (
              <Pressable key={member.id} style={styles.memberRow} onPress={() => chooseMemberForProfile(member)}>
                <Text style={styles.memberRowIcon}>{member.managed ? '🧓' : '🧑'}</Text>
                <View style={styles.memberRowInfo}>
                  <Text style={styles.memberRowName}>{member.name}</Text>
                  {member.managed && <Text style={styles.memberRowSub}>{t('medicine.dependent_badge')}</Text>}
                </View>
                <Text style={styles.memberRowChevron}>›</Text>
              </Pressable>
            ))}
            <Pressable style={styles.memberRow} onPress={chooseOtherForProfile}>
              <Text style={styles.memberRowIcon}>👤</Text>
              <View style={styles.memberRowInfo}>
                <Text style={styles.memberRowName}>{t('medicine.other_option_title')}</Text>
                <Text style={styles.memberRowSub}>{t('medicine.other_option_sub')}</Text>
              </View>
              <Text style={styles.memberRowChevron}>›</Text>
            </Pressable>
          </>
        ) : (
          <>
            {familyId && (
              <Pressable onPress={() => setAddProfileStep('choose_who')}>
                <Text style={styles.backLink}>{t('medicine.back_btn')}</Text>
              </Pressable>
            )}

            {!isOtherMode && selectedMemberId && (
              <Text style={styles.forMemberText}>
                {t('medicine.for_member_label', {
                  name: familyMembers.find((m) => m.id === selectedMemberId)?.name ?? '',
                })}
              </Text>
            )}

            {isOtherMode && (
              <>
                <Text style={styles.label}>{t('medicine.label_full_name')}</Text>
                <TextInput
                  style={styles.input}
                  value={otherName}
                  onChangeText={setOtherName}
                  placeholder={t('medicine.placeholder_person_name')}
                  placeholderTextColor={styles.placeholder.color}
                />
              </>
            )}

            <Text style={styles.label}>{t('medicine.label_category')}</Text>
            <View style={styles.chipRow}>
              {availableCategories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.chip, newProfileCategory === cat && styles.chipActive]}
                  onPress={() => setNewProfileCategory(cat)}>
                  <Text style={[styles.chipText, newProfileCategory === cat && styles.chipTextActive]}>
                    {t(`medicine.category_${cat.toLowerCase()}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t('medicine.label_dob')}</Text>
            <Pressable style={styles.input} onPress={() => setShowNewProfileDatePicker(true)}>
              <Text style={newProfileDob ? styles.dobValueText : styles.placeholder}>
                {newProfileDob ? formatDob(newProfileDob) : t('medicine.placeholder_dob')}
              </Text>
            </Pressable>
            {showNewProfileDatePicker && (
              <DateTimePicker
                value={newProfileDob ?? DEFAULT_DOB}
                mode="date"
                display="default"
                maximumDate={new Date()}
                minimumDate={MIN_DOB}
                onChange={handleNewProfileDateChange}
              />
            )}

            <Button
              title={t('medicine.create_profile_btn')}
              onPress={handleCreateProfile}
              loading={creatingProfile}
              style={styles.modalCta}
            />
          </>
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
  sectionMargin: {
    marginBottom: spacing.lg,
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
  profileRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: spacing.lg,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  profileChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  profileChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  profileChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  profileChipTextActive: {
    color: colors.textOnPrimary,
  },
  addProfileChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addProfileChipText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.primary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberRowIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  memberRowInfo: {
    flex: 1,
  },
  memberRowName: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  memberRowSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  memberRowChevron: {
    fontSize: 18,
    color: colors.textMuted,
  },
  backLink: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 8,
  },
  forMemberText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
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
  medStockMissingBadge: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  medStockMissingText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.danger,
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
  slotList: {
    gap: 8,
  },
  slotRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  slotRow2Active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotRow2Main: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  slotCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  slotCheckboxActive: {
    backgroundColor: colors.textOnPrimary,
    borderColor: colors.textOnPrimary,
  },
  slotCheckboxTick: {
    fontSize: 12,
    fontFamily: fonts.sansBold,
    color: colors.primary,
  },
  slotIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  slotRow2Label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  slotRow2LabelActive: {
    color: colors.textOnPrimary,
  },
  slotTimeBtn2: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  slotTimeBtn2Text: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.textOnPrimary,
  },
  slotTimeBtn2Icon: {
    fontSize: 11,
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
