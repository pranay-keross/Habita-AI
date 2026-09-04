import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, RefreshControl } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import ModernBottomNav, { type BottomNavTab } from '../../components/ModernBottomNav';
import { SkeletonCard, SkeletonHeroCard } from '../../components/Skeleton';
import Avatar from '../../components/Avatar';
import useAuth from '../../hooks/useAuth';
import usePushNotifications from '../../hooks/usePushNotifications';
import AlertsCard from '../../components/AlertsCard';
import {
  ChevronRight,
  Pill,
  FileText,
  Plus,
  Check,
  Clock,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Edit2,
  UserPlus,
  HeartPulse,
} from 'lucide-react-native';
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

function SlotIcon({ slot, size = 14, color = '#000000' }: { slot: ScheduleSlot; size?: number; color?: string }) {
  switch (slot) {
    case 'morning':
      return <Sunrise size={size} color={color} strokeWidth={1.5} />;
    case 'afternoon':
      return <Sun size={size} color={color} strokeWidth={1.5} />;
    case 'evening':
      return <Sunset size={size} color={color} strokeWidth={1.5} />;
    case 'night':
      return <Moon size={size} color={color} strokeWidth={1.5} />;
    default:
      return <Clock size={size} color={color} strokeWidth={1.5} />;
  }
}

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

export default function MedicineScreen({ navigation, route }: Props) {
  // Dosage and low-stock alerts that arrived while the user was elsewhere.
  const { medchest: medchestAlerts, markAsRead, markSectionAsRead } = usePushNotifications();

  // A notification tap sets `focus`, so the screen opens on the part the alert
  // was actually about instead of at the top: 'dosage' for a dose reminder,
  // 'stock' for a low-stock alert. Without this the two click_actions the
  // backend distinguishes would look identical to the user.
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<{ dosage: number; stock: number }>({ dosage: 0, stock: 0 });
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken, getUserId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [log, setLog] = useState<IntakeLogEntry[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localeVersion, setLocaleVersion] = useState(0);

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [myFamilyMemberId, setMyFamilyMemberId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [familyProfileId, setFamilyProfileId] = useState<string | null>(null);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [lowStockThresholds, setLowStockThresholds] = useState<Record<string, number | null>>({});
  const [adherenceRates, setAdherenceRates] = useState<Record<string, number>>({});
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<'all' | ScheduleSlot>('all');

  const [showAddProfileSheet, setShowAddProfileSheet] = useState(false);
  const [addProfileStep, setAddProfileStep] = useState<'choose_who' | 'details'>('choose_who');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isOtherMode, setIsOtherMode] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [newProfileCategory, setNewProfileCategory] = useState<FamilyProfileCategory | null>(null);
  const [newProfileDob, setNewProfileDob] = useState<Date | null>(null);
  const [showNewProfileDatePicker, setShowNewProfileDatePicker] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(['morning']);
  const [scheduleTimes, setScheduleTimes] = useState<Partial<Record<ScheduleSlot, string>>>({});
  const [stock, setStock] = useState('30');
  const [isLiquid, setIsLiquid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timePickerSlot, setTimePickerSlot] = useState<ScheduleSlot | null>(null);

  const availableFamilyMembers = useMemo(() => {
    return familyMembers.filter((m) => !profiles.some((p) => p.familyMemberId === m.id));
  }, [familyMembers, profiles]);

  const availableCategories = useMemo(() => {
    if (!selectedMemberId) return ALL_CATEGORIES;
    const member = familyMembers.find((m) => m.id === selectedMemberId);
    if (!member) return ALL_CATEGORIES;
    if (member.id === myFamilyMemberId) return ['SELF' as FamilyProfileCategory];
    if (member.managed) return ['KID', 'ELDER', 'OTHER'] as FamilyProfileCategory[];
    return ['OTHER', 'ELDER'] as FamilyProfileCategory[];
  }, [selectedMemberId, familyMembers, myFamilyMemberId]);

  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.id === familyProfileId) ?? null;
  }, [profiles, familyProfileId]);

  const dosesToday = useMemo(() => {
    return medicines.reduce((sum, m) => sum + m.schedule.length, 0);
  }, [medicines]);

  const takenTodayCount = useMemo(() => {
    let count = 0;
    for (const med of medicines) {
      for (const slot of med.schedule) {
        if (isTakenToday(log, med.id, slot)) {
          count += 1;
        }
      }
    }
    return count;
  }, [medicines, log]);

  const completionPercentage = dosesToday > 0 ? Math.round((takenTodayCount / dosesToday) * 100) : 100;

  const lowStockCount = useMemo(() => {
    return medicines.filter((m) => m.stock !== null && m.stock <= (lowStockThresholds[m.id] ?? 5)).length;
  }, [medicines, lowStockThresholds]);

  const adherence = useMemo(() => {
    if (familyId && familyProfileId) {
      const rates = Object.values(adherenceRates);
      if (rates.length === 0) return null;
      return Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
    }
    return calculateAdherence(medicines, log);
  }, [familyId, familyProfileId, adherenceRates, medicines, log]);

  const filteredMedicines = useMemo(() => {
    if (selectedSlotFilter === 'all') return medicines;
    return medicines.filter((m) => m.schedule.includes(selectedSlotFilter));
  }, [medicines, selectedSlotFilter]);

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
    // The alert shows a friendly message, which is right for the user but leaves
    // nothing to debug from: a network failure, a backend 400 and a TypeError in
    // our own post-save code all surface as the same "unexpected error" string.
    // Log the real one in dev so a report like "it says unexpected error" is
    // actionable without guessing.
    if (__DEV__) {
      const e = err as { status?: number; body?: unknown; message?: string; stack?: string };
      console.warn(
        '[medchest] request failed:',
        JSON.stringify({ status: e?.status, body: e?.body, message: e?.message }),
        e?.stack ?? '',
      );
    }
    const detail = extractMedchestErrorMessage(err);
    if (detail) {
      Alert.alert(t('onboarding.error_title'), detail);
    } else {
      Alert.alert(t('onboarding.error_title'), t(errorMessageKey(parseMedchestError(err))));
    }
  };

  /**
   * Re-reads the list after a successful create/update, treating a failure here
   * as a *display* problem rather than a save problem.
   *
   * Without this split, a 500 from `GET /profiles/{id}/medicines` is caught by
   * the caller's try/catch and reported as "an unexpected error" — so the user
   * believes the save failed, tries again, and gets "medicine already exists"
   * because the first save had in fact worked. That is exactly the confusion
   * seen on 2026-09-01, where the list endpoint 500s for some accounts while
   * POST succeeds (docs/DECISIONS.md D-060).
   *
   * The write is already committed by the time this runs. So: log it, leave the
   * previously loaded list on screen, and let the next pull-to-refresh or screen
   * focus try again — rather than telling the user something false.
   */
  const refreshAfterWrite = async (profileId: string, token: string) => {
    try {
      await refreshRemoteMedicines(profileId, token);
    } catch (err) {
      if (__DEV__) {
        const e = err as { status?: number; body?: unknown };
        console.warn(
          '[medchest] save succeeded but the follow-up list failed:',
          JSON.stringify({ status: e?.status, body: e?.body }),
        );
      }
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

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      await loadIntakeLog().then(setLog);
      const token = await getAccessToken();
      if (!token) {
        const stored = await loadMedicines();
        setMedicines(stored.map((m) => ({ ...m, isLiquid: m.isLiquid ?? false })));
        return;
      }
      const family = await getMyPrimaryFamily(token).catch(() => null);
      if (!family) {
        setFamilyId(null);
        setCanEdit(true);
        const stored = await loadMedicines();
        setMedicines(stored.map((m) => ({ ...m, isLiquid: m.isLiquid ?? false })));
        return;
      }
      const [profileName, userId] = await Promise.all([getMyProfileName(), getUserId()]);
      const membership = resolveMyMembership(family, userId, profileName);
      setCanEdit(true);
      setFamilyId(family.id);
      setFamilyMembers(family.members);
      setMyFamilyMemberId(membership.member?.id ?? null);
      let remoteProfiles: FamilyProfile[] = [];
      try {
        remoteProfiles = await listFamilyProfiles(family.id, token);
      } catch {
        // Backend returns 500 when no profiles exist for this family yet
        remoteProfiles = [];
      }
      setProfiles(remoteProfiles);
      const targetProfileId = familyProfileId || (remoteProfiles.find((p) => p.category === 'SELF') ?? remoteProfiles[0])?.id;
      if (targetProfileId) {
        setFamilyProfileId(targetProfileId);
        try {
          await refreshRemoteMedicines(targetProfileId, token);
        } catch {
          const stored = await loadMedicines();
          setMedicines(stored.map((m) => ({ ...m, isLiquid: m.isLiquid ?? false })));
        }
      } else {
        // No remote profiles yet — load local medicines so the screen is immediately usable
        const stored = await loadMedicines();
        setMedicines(stored.map((m) => ({ ...m, isLiquid: m.isLiquid ?? false })));
      }
    } catch {
      // Offline fallback: load local medicines
      try {
        const stored = await loadMedicines();
        setMedicines(stored.map((m) => ({ ...m, isLiquid: m.isLiquid ?? false })));
      } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAccessToken, getUserId, familyProfileId]);

  useEffect(() => {
    loadData(false);
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  const openAddProfileSheet = useCallback(() => {
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
  }, [familyId]);

  const openAddSheet = useCallback(() => {
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
  }, [familyId, familyProfileId, profiles.length, openAddProfileSheet]);

  useEffect(() => {
    if (route.params?.focus) {
      const target = route.params.focus;
      // After layout, or the offsets are still 0 and it scrolls nowhere.
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: sectionY.current[target] ?? 0, animated: true });
      }, 350);
      navigation.setParams({ focus: undefined });
      return () => clearTimeout(timer);
    }
  }, [route.params?.focus, navigation]);

  useEffect(() => {
    if (route.params?.openAddModal) {
      navigation.setParams({ openAddModal: undefined });
      openAddSheet();
    }
  }, [route.params?.openAddModal, navigation, openAddSheet]);

  const onRefresh = () => {
    loadData(true);
  };

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
        } catch {
          // Focus re-fetch failure is non-fatal
        }
      })();
    });
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, familyProfileId]);

  const persistMedicines = async (updated: Medicine[]) => {
    setMedicines(updated);
    await saveMedicines(updated);
  };

  const persistLog = async (updated: IntakeLogEntry[]) => {
    setLog(updated);
    await saveIntakeLog(updated);
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
    setEditingId(med.id);
    setName(med.name);
    setDosage(med.dosage);
    setSchedule([...med.schedule]);
    setScheduleTimes({ ...(med.scheduleTimes ?? {}) });
    setStock(med.stock !== null ? String(med.stock) : '');
    setIsLiquid(med.isLiquid ?? false);
    setTimePickerSlot(null);
    setShowSheet(true);
  };

  const toggleScheduleSlot = (slot: ScheduleSlot) => {
    if (schedule.includes(slot)) {
      if (schedule.length === 1) {
        return;
      }
      setSchedule(schedule.filter((s) => s !== slot));
      setScheduleTimes((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
    } else {
      setSchedule([...schedule, slot]);
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    const slot = timePickerSlot;
    setTimePickerSlot(null);
    if (!slot || !selectedDate) {
      return;
    }
    const h = String(selectedDate.getHours()).padStart(2, '0');
    const m = String(selectedDate.getMinutes()).padStart(2, '0');
    setScheduleTimes((prev) => ({ ...prev, [slot]: `${h}:${m}` }));
  };

  const handleSave = async () => {
    if (!name.trim() || !dosage.trim() || schedule.length === 0) {
      Alert.alert(t('medicine.incomplete_title'), t('medicine.incomplete_msg'));
      return;
    }

    const stockNum = stock.trim() ? parseInt(stock, 10) : null;
    if (stock.trim() && (stockNum === null || Number.isNaN(stockNum) || stockNum < 0)) {
      Alert.alert(t('medicine.incomplete_title'), t('medicine.stock_invalid_msg'));
      return;
    }

    setSaving(true);
    const token = await getAccessToken();

    if (familyProfileId && token) {
      try {
        const scheduleTimesObj: Record<string, string> = {};
        for (const slot of schedule) {
          scheduleTimesObj[slot] = scheduleTimes[slot] ?? SLOT_TIME[slot];
        }

        if (editingId) {
          const updated = await updateMedicine(
            editingId,
            {
              name: name.trim(),
              dosage: dosage.trim(),
              scheduleTimes: scheduleTimesObj,
              stockQuantity: stockNum ?? 0,
              lowStockThreshold: (lowStockThresholds[editingId] != null ? lowStockThresholds[editingId] : 5) as number,
            },
            token,
          );
          const flags = await loadLiquidFlags();
          flags[updated.id] = isLiquid;
          await saveLiquidFlags(flags);
          await refreshAfterWrite(familyProfileId, token);
        } else {
          const created = await createMedicine(
            familyProfileId,
            {
              name: name.trim(),
              dosage: dosage.trim(),
              scheduleTimes: scheduleTimesObj,
              stockQuantity: stockNum ?? 0,
              lowStockThreshold: 5,
            },
            token,
          );
          const flags = await loadLiquidFlags();
          flags[created.id] = isLiquid;
          await saveLiquidFlags(flags);
          await refreshAfterWrite(familyProfileId, token);
        }
        setShowSheet(false);
      } catch (err) {
        showRemoteError(err);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (editingId) {
      const next = medicines.map((m) =>
        m.id === editingId
          ? {
              ...m,
              name: name.trim(),
              dosage: dosage.trim(),
              schedule,
              scheduleTimes,
              stock: stockNum,
              isLiquid,
            }
          : m,
      );
      await persistMedicines(next);
    } else {
      const newMed: Medicine = {
        id: Date.now().toString(),
        name: name.trim(),
        dosage: dosage.trim(),
        schedule,
        scheduleTimes,
        stock: stockNum,
        isLiquid,
      };
      await persistMedicines([...medicines, newMed]);
    }

    setSaving(false);
    setShowSheet(false);
  };

  const handleDelete = async () => {
    if (!editingId) {
      return;
    }
    Alert.alert(t('medicine.delete_title'), t('medicine.delete_msg'), [
      { text: t('family.cancel'), style: 'cancel' },
      {
        text: t('medicine.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          const token = await getAccessToken();
          if (familyProfileId && token) {
            try {
              await deleteRemoteMedicine(editingId, token);
              await refreshRemoteMedicines(familyProfileId, token);
              setShowSheet(false);
            } catch (err) {
              showRemoteError(err);
            }
            return;
          }

          const next = medicines.filter((m) => m.id !== editingId);
          await persistMedicines(next);
          setShowSheet(false);
        },
      },
    ]);
  };

  const markTaken = async (med: Medicine, slot: ScheduleSlot) => {
    if (isTakenToday(log, med.id, slot)) {
      return;
    }

    const token = await getAccessToken();
    if (familyProfileId && token) {
      try {
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

  const handleNavPress = (tab: BottomNavTab) => {
    if (tab === 'home') {
      navigation.navigate('Dashboard');
    } else if (tab === 'family') {
      navigation.navigate('Family');
    } else if (tab === 'center') {
      navigation.navigate('Voice');
    } else if (tab === 'health') {
      // already on health
    } else if (tab === 'vault') {
      navigation.navigate('DocHub');
    }
  };

  return (
    <View style={styles.root} key={localeVersion}>
      {/* Top Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('medicine.header_title')}</Text>
          <View style={styles.headerSubtitleRow}>
            <ShieldCheck size={11} color="#10B981" strokeWidth={1.8} />
            <Text style={styles.headerSubtitleText}>Encrypted Cabinet</Text>
          </View>
        </View>
        {canEdit ? (
          <Pressable onPress={openAddSheet} style={styles.addBtn}>
            <Plus size={13} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.addBtnText}>{t('medicine.add_btn')}</Text>
          </Pressable>
        ) : (
          <View style={styles.addBtnPlaceholder} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
            colors={['#000000']}
          />
        }>
        {loading ? (
          <View style={{ paddingTop: 8 }}>
            <SkeletonHeroCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <AlertsCard
              section="medchest"
              items={medchestAlerts}
              onDismiss={markAsRead}
              onMarkAllRead={() => markSectionAsRead('medchest')}
            />
            {/* Mature Hero Health Intelligence Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroProfileBadge}>
                  <Avatar name={currentProfile?.name ?? ''} size={20} />
                  <Text style={styles.heroProfileName} numberOfLines={1}>
                    {currentProfile ? `${currentProfile.name}'s Vault` : 'Personal Cabinet'}
                  </Text>
                </View>
                <View style={styles.heroAdherencePill}>
                  <Sparkles size={11} color="#10B981" strokeWidth={2} />
                  <Text style={styles.heroAdherenceText}>
                    {adherence !== null ? `${adherence}% on-time` : '94% on-time'}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statNum}>{medicines.length}</Text>
                  <Text style={styles.statLabel}>{t('medicine.stat_medicines')}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statNum}>
                    {takenTodayCount}/{dosesToday}
                  </Text>
                  <Text style={styles.statLabel}>{t('medicine.stat_today')}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={[styles.statNum, lowStockCount > 0 && styles.statNumWarning]}>
                    {lowStockCount > 0 ? `${lowStockCount} Low` : 'Optimal'}
                  </Text>
                  <Text style={styles.statLabel}>Stock Radar</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.max(5, completionPercentage)}%` }]} />
              </View>
            </View>

            {/* Prescriptions Vault Quick Banner */}
            {familyProfileId && (
              <Pressable
                style={styles.prescriptionVaultCard}
                onPress={() => navigation.navigate('Prescriptions', { familyProfileId })}>
                <View style={styles.vaultIconContainer}>
                  <FileText size={18} color="#000000" strokeWidth={1.5} />
                </View>
                <View style={styles.vaultCardContent}>
                  <Text style={styles.vaultCardTitle}>Prescriptions & Doctor Advice</Text>
                  <Text style={styles.vaultCardSubtitle}>Uploaded Rx docs, refills & automated schedules</Text>
                </View>
                <ChevronRight size={16} color="#888888" strokeWidth={1.4} />
              </Pressable>
            )}

            {/* Who's Taking Switcher */}
            <View style={styles.sectionMargin}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('medicine.profiles_title')}</Text>
                <Text style={styles.sectionSub}>Switch household member or dependent</Text>
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
                          style={[styles.profileCard, active && styles.profileCardActive]}
                          onPress={() => handleSelectProfile(profile.id)}>
                          <Avatar name={profile.name} size={36} isOwner={active} style={styles.profileAvatarMargin} />
                          <Text
                            style={[styles.profileCardName, active && styles.profileCardNameActive]}
                            numberOfLines={1}>
                            {profile.name}
                          </Text>
                          <Text style={[styles.profileCardCategory, active && styles.profileCardCategoryActive]}>
                            {profile.category}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable style={styles.addProfileButton} onPress={openAddProfileSheet}>
                      <View style={styles.addProfileIconWrap}>
                        <Plus size={16} color="#000000" strokeWidth={1.8} />
                      </View>
                      <Text style={styles.addProfileButtonText}>Add</Text>
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

            {/* Slot Filter Chips — the 'dosage' scroll target */}
            {familyProfileId && medicines.length > 0 && (
              <View
                style={styles.slotFilterContainer}
                onLayout={(e) => {
                  sectionY.current.dosage = e.nativeEvent.layout.y;
                }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotFilterRow}>
                  <Pressable
                    style={[styles.filterChip, selectedSlotFilter === 'all' && styles.filterChipActive]}
                    onPress={() => setSelectedSlotFilter('all')}>
                    <Text style={[styles.filterChipText, selectedSlotFilter === 'all' && styles.filterChipTextActive]}>
                      All ({medicines.length})
                    </Text>
                  </Pressable>
                  {SCHEDULE_SLOTS.map((slot) => {
                    const count = medicines.filter((m) => m.schedule.includes(slot)).length;
                    const active = selectedSlotFilter === slot;
                    return (
                      <Pressable
                        key={slot}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => setSelectedSlotFilter(slot)}>
                        <View style={{ marginRight: 6 }}>
                          <SlotIcon slot={slot} size={12} color={active ? '#FFFFFF' : '#000000'} />
                        </View>
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {t(`medicine.slot_${slot}`)} ({count})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Medicine Routine Cards */}
            {familyProfileId ? (
              <>
                <View
                  style={styles.sectionHeader}
                  onLayout={(e) => {
                    sectionY.current.stock = e.nativeEvent.layout.y;
                  }}>
                  <Text style={styles.sectionTitle}>{t('medicine.section_title')}</Text>
                  <Text style={styles.sectionSub}>Prescribed doses & live stock trackers</Text>
                </View>

                {switchingProfile ? (
                  <View style={{ paddingTop: 8 }}>
                    <SkeletonCard />
                    <SkeletonCard />
                  </View>
                ) : filteredMedicines.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Pill size={28} color="#999999" strokeWidth={1.4} />
                    <Text style={styles.emptyTitle}>
                      {selectedSlotFilter === 'all' ? t('medicine.empty_title') : `No ${selectedSlotFilter} medicines`}
                    </Text>
                    <Text style={styles.emptySub}>{t('medicine.empty_sub')}</Text>
                  </View>
                ) : (
                  filteredMedicines.map((med) => {
                    const isLowStock = med.stock !== null && med.stock <= 5;
                    return (
                      <Pressable key={med.id} style={styles.medicineCard} onPress={() => openEditSheet(med)}>
                        <View style={styles.medTopRow}>
                          <View style={styles.medIconWrap}>
                            <Pill size={16} color="#000000" strokeWidth={1.5} />
                          </View>
                          <View style={styles.medNameWrap}>
                            <Text style={styles.medNameText}>{med.name}</Text>
                            <Text style={styles.medDosageText}>{med.dosage || 'Prescribed dose'}</Text>
                          </View>
                          {med.stock === null ? (
                            <View style={styles.stockBadgeMissing}>
                              <Text style={styles.stockBadgeMissingText}>{t('medicine.stock_missing')}</Text>
                            </View>
                          ) : (
                            <View style={[styles.stockBadge, isLowStock && styles.stockBadgeLow]}>
                              {isLowStock && (
                                <AlertCircle size={10} color="#FF3B30" strokeWidth={2} style={{ marginRight: 3 }} />
                              )}
                              <Text style={[styles.stockBadgeText, isLowStock && styles.stockBadgeTextLow]}>
                                {med.stock} left
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.medDivider} />

                        <View style={styles.medSlotsRow}>
                          <View style={styles.slotTagsList}>
                            {med.schedule.map((slot) => {
                              const taken = isTakenToday(log, med.id, slot);
                              return (
                                <Pressable
                                  key={slot}
                                  disabled={!canEdit || taken}
                                  style={[styles.slotTag, taken && styles.slotTagTaken]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    markTaken(med, slot);
                                  }}>
                                  <View style={{ marginRight: 4 }}>
                                    <SlotIcon slot={slot} size={11} color={taken ? '#10B981' : '#666666'} />
                                  </View>
                                  <Text style={[styles.slotTagText, taken && styles.slotTagTextTaken]}>
                                    {medicineSlotTimeLabel(med, slot)}
                                  </Text>
                                  {taken && <Check size={11} color="#10B981" strokeWidth={2.5} style={{ marginLeft: 3 }} />}
                                </Pressable>
                              );
                            })}
                          </View>

                          <Pressable
                            style={[
                              styles.takeQuickBtn,
                              med.schedule.every((s) => isTakenToday(log, med.id, s)) && styles.takeQuickBtnAllDone,
                            ]}
                            onPress={(e) => {
                              e.stopPropagation();
                              const untakenSlot = med.schedule.find((s) => !isTakenToday(log, med.id, s));
                              if (untakenSlot) {
                                markTaken(med, untakenSlot);
                              } else {
                                openEditSheet(med);
                              }
                            }}>
                            {med.schedule.every((s) => isTakenToday(log, med.id, s)) ? (
                              <>
                                <Check size={12} color="#10B981" strokeWidth={2.5} />
                                <Text style={styles.takeQuickBtnDoneText}>Done</Text>
                              </>
                            ) : (
                              <Text style={styles.takeQuickBtnText}>Log Dose</Text>
                            )}
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </>
            ) : profiles.length > 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{t('medicine.no_profiles_title')}</Text>
                <Text style={styles.emptySub}>{t('medicine.profiles_sub')}</Text>
              </View>
            ) : null}
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
                    {active && <Check size={10} color="#FFFFFF" strokeWidth={2.5} />}
                  </View>
                  <View style={{ marginHorizontal: 6 }}>
                    <SlotIcon slot={slot} size={14} color={active ? '#000000' : '#888888'} />
                  </View>
                  <Text style={[styles.slotRow2Label, active && styles.slotRow2LabelActive]}>
                    {t(`medicine.slot_${slot}`)}
                  </Text>
                </Pressable>
                {active && (
                  <Pressable
                    onPress={() => setTimePickerSlot(slot)}
                    style={styles.slotTimeBtn2}
                    hitSlop={6}>
                    <Text style={styles.slotTimeBtn2Text}>
                      {formatTimeLabel(scheduleTimes[slot] ?? SLOT_TIME[slot])}
                    </Text>
                    <Edit2 size={11} color="#000000" strokeWidth={1.8} style={{ marginLeft: 4 }} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
        {timePickerSlot && (
          <DateTimePicker
            value={(() => {
              const [h, m] = (scheduleTimes[timePickerSlot] ?? SLOT_TIME[timePickerSlot]).split(':').map(Number);
              const d = new Date();
              d.setHours(h, m, 0, 0);
              return d;
            })()}
            mode="time"
            display="default"
            onChange={handleTimeChange}
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
          <Pressable style={styles.modalRemoveBtn} onPress={handleDelete} disabled={saving}>
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
              <HeartPulse size={16} color="#000000" strokeWidth={1.5} style={{ marginRight: 8 }} />
              <Text style={styles.sheetInfoText}>{t('medicine.choose_who_helper')}</Text>
            </View>
            {availableFamilyMembers.map((member) => (
              <Pressable
                key={member.id}
                style={styles.memberRow}
                onPress={() => chooseMemberForProfile(member)}>
                <Avatar name={member.name} size={32} style={styles.memberRowAvatarMargin} />
                <View style={styles.memberRowInfo}>
                  <Text style={styles.memberRowName}>{member.name}</Text>
                  {member.managed && <Text style={styles.memberRowSub}>{t('medicine.dependent_badge')}</Text>}
                </View>
                <ChevronRight size={14} color="#888888" strokeWidth={1.5} />
              </Pressable>
            ))}
            <Pressable
              style={styles.memberRow}
              onPress={chooseOtherForProfile}>
              <View style={styles.memberRowAvatar}>
                <UserPlus size={15} color="#000000" strokeWidth={1.5} />
              </View>
              <View style={styles.memberRowInfo}>
                <Text style={styles.memberRowName}>{t('medicine.other_option_title')}</Text>
                <Text style={styles.memberRowSub}>{t('medicine.other_option_sub')}</Text>
              </View>
              <ChevronRight size={14} color="#888888" strokeWidth={1.5} />
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
                minimumDate={MIN_DOB}
                maximumDate={new Date()}
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

      <ModernBottomNav activeTab="health" onTabPress={handleNavPress} />
    </View>
  );
}

const makeStyles = ({ fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEE',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  headerTitleWrap: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  headerSubtitleText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '400',
    color: '#10B981',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  addBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  addBtnPlaceholder: {
    width: 36,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + 80,
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  heroCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#24242A',
    ...shadow.soft,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  heroProfileName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  heroAdherencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  heroAdherenceText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    backgroundColor: '#18181E',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#26262E',
  },
  statNum: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statNumWarning: {
    color: '#F59E0B',
  },
  statLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '400',
    color: '#888888',
    marginTop: 2,
    textAlign: 'center',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#26262E',
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  prescriptionVaultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#ECECEE',
    ...shadow.soft,
  },
  vaultIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  vaultCardContent: {
    flex: 1,
  },
  vaultCardTitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  vaultCardSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#666666',
    marginTop: 1,
  },
  sectionMargin: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  sectionSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#888888',
    marginTop: 1,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: spacing.lg,
    paddingVertical: 2,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#ECECEE',
    minWidth: 84,
  },
  profileCardActive: {
    borderColor: '#000000',
    backgroundColor: '#F5F5F7',
  },
  profileAvatarMargin: {
    marginBottom: 4,
  },
  profileCardName: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    color: '#444444',
  },
  profileCardNameActive: {
    color: '#000000',
    fontWeight: '600',
  },
  profileCardCategory: {
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '400',
    color: '#888888',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  profileCardCategoryActive: {
    color: '#555555',
  },
  addProfileButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#ECECEE',
    borderStyle: 'dashed',
    minWidth: 70,
  },
  addProfileIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  addProfileButtonText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '500',
    color: '#000000',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#ECECEE',
  },
  memberRowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberRowAvatarMargin: {
    marginRight: 10,
  },
  memberRowInfo: {
    flex: 1,
  },
  memberRowName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  memberRowSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#888888',
    marginTop: 1,
  },
  memberRowChevron: {
    fontSize: 18,
    color: '#888888',
  },
  backLink: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  forMemberText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  slotFilterContainer: {
    marginBottom: spacing.md,
  },
  slotFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#ECECEE',
  },
  filterChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterChipIcon: {
    fontSize: 12,
  },
  filterChipText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    color: '#555555',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  medicineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#ECECEE',
    ...shadow.soft,
  },
  medTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  medNameWrap: {
    flex: 1,
  },
  medNameText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  medDosageText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '400',
    color: '#666666',
    marginTop: 1,
  },
  stockBadge: {
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  stockBadgeLow: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  stockBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '500',
    color: '#666666',
  },
  stockBadgeTextLow: {
    color: '#D97706',
    fontWeight: '600',
  },
  stockBadgeMissing: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  stockBadgeMissingText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '500',
    color: '#FF3B30',
  },
  medDivider: {
    height: 1,
    backgroundColor: '#F0F0F2',
    marginVertical: 10,
  },
  medSlotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  slotTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  slotTagTaken: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  slotTagIcon: {
    fontSize: 11,
  },
  slotTagText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '500',
    color: '#444444',
  },
  slotTagTextTaken: {
    color: '#10B981',
  },
  takeQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  takeQuickBtnAllDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  takeQuickBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  takeQuickBtnDoneText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#ECECEE',
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '300',
    color: '#888888',
    textAlign: 'center',
    marginTop: 4,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#888888',
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#ECECEE',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: '#000000',
  },
  placeholder: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: '#999999',
  },
  dobValueText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: '#000000',
  },
  sheetInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ECECEE',
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
    color: '#666666',
    lineHeight: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#ECECEE',
  },
  chipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#444444',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  slotList: {
    gap: 8,
  },
  slotRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#ECECEE',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  slotRow2Active: {
    backgroundColor: '#000000',
    borderColor: '#000000',
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
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  slotCheckboxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  slotCheckboxTick: {
    fontSize: 12,
    fontFamily: fonts.sans,
    fontWeight: '700',
    color: '#000000',
  },
  slotIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  slotRow2Label: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: '#000000',
  },
  slotRow2LabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  slotTimeBtn2Icon: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  modalCta: {
    marginTop: 24,
  },
  modalRemoveBtn: {
    marginTop: 14,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  modalRemoveText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
