// @refresh reset
// Keep this screen remounted after Fast Refresh. Its form state evolves frequently,
// and preserving an older hook queue after a new state hook is added causes React's
// "Should have a queue" development error.
import React, { useEffect, useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Phone from 'lucide-react-native/icons/phone';
import UsersRound from 'lucide-react-native/icons/users-round';
import Plus from 'lucide-react-native/icons/plus';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import type { RootStackParamList } from '../../app/_layout';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import useAuth from '../../hooks/useAuth';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';
import { getMyPrimaryFamily } from '../family/api';
import {
  createStaff,
  listAttendanceSummary,
  listServiceOptions,
  listStaff,
  markStaffAttendance,
  type AttendanceSummary,
  type RemoteAttendanceStatus,
  type RemoteStaffMember,
  type ServiceOption,
} from './api';
import {
  loadAttendanceEntries,
  loadCaregiverTransactions,
  saveAttendanceEntries,
  saveCaregiverTransactions,
} from './staffStore';
import type { AttendanceEntry, AttendanceStatus, Caregiver, CaregiverTransaction } from './types';

const CUSTOM_SERVICE_NAME = 'Custom';

// Maps the live backend shape to this screen's local `Caregiver` model — `notes` has no
// backend equivalent yet (stays blank for remote-sourced rows).
function toCaregiver(remote: RemoteStaffMember): Caregiver {
  return {
    id: remote.id,
    name: remote.name,
    service: remote.role,
    rateType: remote.rateType === 'Hourly' ? 'hourly' : 'monthly',
    rate: remote.monthlySalary,
    phone: remote.phone,
    notes: '',
    createdAt: Date.parse(remote.joiningDate) || Date.now(),
  };
}

// Local calendar day, not UTC — attendance is "today" from the caregiver's/household's
// own clock, same reasoning as medicine's `formatDob`.
function todayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const ATTENDANCE_STATUS_COLOR: Record<AttendanceStatus, { tint: string; soft: string }> = {
  present: { tint: '#2E7D5B', soft: '#E3F3EA' },
  absent: { tint: '#C0392B', soft: '#FBE7E4' },
  leave: { tint: '#C7791E', soft: '#FBEBDA' },
  halfDay: { tint: '#2E6E9E', soft: '#E1EEF7' },
};

const STATUS_TO_REMOTE: Record<AttendanceStatus, RemoteAttendanceStatus> = {
  present: 'PRESENT',
  absent: 'ABSENT',
  leave: 'LEAVE',
  halfDay: 'HALF_DAY',
};

type Props = StackScreenProps<RootStackParamList, 'Staff'>;

export default function StaffScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [transactions, setTransactions] = useState<CaregiverTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [localeVersion, setLocaleVersion] = useState(0);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [serviceOptionsError, setServiceOptionsError] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addName, setAddName] = useState('');
  const [addServiceId, setAddServiceId] = useState<number | null>(null);
  const [addServiceOptionsVisible, setAddServiceOptionsVisible] = useState(false);
  const [addCustomRole, setAddCustomRole] = useState('');
  const [addRateType, setAddRateType] = useState<'Monthly' | 'Hourly'>('Monthly');
  const [addPhone, setAddPhone] = useState('');
  const [addSalary, setAddSalary] = useState('');
  const [addJoiningDate, setAddJoiningDate] = useState(todayKey());
  const [addJoiningDatePickerVisible, setAddJoiningDatePickerVisible] = useState(false);
  const [addNotes, setAddNotes] = useState('');
  const [extraSheetVisible, setExtraSheetVisible] = useState(false);
  const [extraCaregiverId, setExtraCaregiverId] = useState<string | null>(null);
  const [editingExtraPaymentId, setEditingExtraPaymentId] = useState<string | null>(null);
  const [extraAmount, setExtraAmount] = useState('');
  const [extraReason, setExtraReason] = useState('');
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [historyCaregiverId, setHistoryCaregiverId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'caregivers'>('attendance');
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  const [hasFamily, setHasFamily] = useState(false);
  const [familyChecked, setFamilyChecked] = useState(false);

  const loadStaffList = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const family = token ? await getMyPrimaryFamily(token).catch(() => null) : null;
      if (token) setFamilyChecked(true);
      setHasFamily(!!family);
      if (token && family) {
        const remote = await listStaff(family.id, token);
        setCaregivers(remote.map(toCaregiver));
        try {
          const summary = await listAttendanceSummary(family.id, token);
          setAttendanceSummary(summary);
        } catch (err) {
          console.warn('[staff] failed to load attendance summary', err);
        }
      } else {
        setCaregivers([]);
        setAttendanceSummary([]);
      }
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    Promise.all([loadCaregiverTransactions(), loadAttendanceEntries()]).then(
      ([savedTransactions, savedAttendance]) => {
        setTransactions(savedTransactions);
        setAttendance(savedAttendance);
      },
    );
    loadStaffList();
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((version) => version + 1));
    return () => { unsubscribe(); };
  }, [loadStaffList]);

  const loadServiceOptions = React.useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const services = await listServiceOptions(token);
      setServiceOptions(services);
      setServiceOptionsError(false);
    } catch (err) {
      // Surfaced instead of silently swallowed — an empty dropdown with no error
      // previously looked identical whether the fetch failed or genuinely returned [].
      console.warn('[staff] failed to load service options', err);
      setServiceOptionsError(true);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadServiceOptions();
  }, [loadServiceOptions]);

  const persistAttendance = async (entries: AttendanceEntry[]) => {
    setAttendance(entries);
    await saveAttendanceEntries(entries);
  };

  const todaysStatus = (caregiverId: string): AttendanceStatus | null =>
    attendance.find((e) => e.caregiverId === caregiverId && e.date === todayKey())?.status ?? null;

  const markAttendance = async (caregiverId: string, status: AttendanceStatus) => {
    const date = todayKey();
    const existing = attendance.find((e) => e.caregiverId === caregiverId && e.date === date);
    if (existing && existing.status === status) {
      // Tapping the already-active status again clears it back to unmarked. No
      // unmark endpoint exists server-side, so this stays local-only.
      await persistAttendance(attendance.filter((e) => e.id !== existing.id));
      return;
    }
    if (existing) {
      await persistAttendance(attendance.map((e) => (e.id === existing.id ? { ...e, status, markedAt: Date.now() } : e)));
    } else {
      await persistAttendance([
        ...attendance,
        { id: `${caregiverId}-${date}`, caregiverId, date, status, markedAt: Date.now() },
      ]);
    }
    const token = await getAccessToken().catch(() => null);
    if (!token) return;
    try {
      await markStaffAttendance(caregiverId, { date, status: STATUS_TO_REMOTE[status] }, token);
      await loadStaffList();
    } catch (err) {
      console.warn('[staff] failed to sync attendance', err);
    }
  };

  // Present count over the last 30 calendar days, inclusive of today. Prefers the
  // server-computed summary (source of truth once attendance is synced); falls back
  // to the local tally for a caregiver the summary hasn't caught up on yet.
  const monthlyPresentCount = (caregiverId: string): number => {
    const remote = attendanceSummary.find((entry) => entry.staffId === caregiverId);
    if (remote) return remote.presentDays;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return attendance.filter((e) => e.caregiverId === caregiverId && e.status === 'present' && e.markedAt >= cutoff).length;
  };

  const historyFor = (caregiverId: string): AttendanceEntry[] =>
    attendance
      .filter((e) => e.caregiverId === caregiverId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);

  const openAddSheet = () => {
    setAddName(''); setAddServiceId(null); setAddServiceOptionsVisible(false);
    setAddCustomRole(''); setAddRateType('Monthly'); setAddPhone(''); setAddSalary('');
    setAddJoiningDate(todayKey()); setAddJoiningDatePickerVisible(false); setAddNotes('');
    setAddSheetVisible(true);
  };

  const handleJoiningDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setAddJoiningDatePickerVisible(false);
    if (event.type === 'set' && selected) {
      const year = selected.getFullYear();
      const month = String(selected.getMonth() + 1).padStart(2, '0');
      const day = String(selected.getDate()).padStart(2, '0');
      setAddJoiningDate(`${year}-${month}-${day}`);
    }
  };

  const selectedService = serviceOptions.find((service) => service.id === addServiceId) ?? null;
  const isCustomService = selectedService?.serviceName === CUSTOM_SERVICE_NAME;

  const saveNewCaregiver = async () => {
    const salary = Number(addSalary);
    if (
      !addName.trim() ||
      !addServiceId ||
      (isCustomService && !addCustomRole.trim()) ||
      !addPhone.trim() ||
      !Number.isFinite(salary) ||
      salary < 0
    ) {
      Alert.alert(t('staff.incomplete_title'), t('staff.incomplete_message'));
      return;
    }
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert(t('staff.save_failed_title'), t('staff.save_failed_no_family'));
        return;
      }
      const family = await getMyPrimaryFamily(token).catch(() => null);
      if (!family) {
        // Caregivers only exist under a family on the backend — no auto-create here;
        // the user must set up or join a family first (see the no-family banner).
        Alert.alert(t('staff.save_failed_title'), t('staff.save_failed_no_family'));
        return;
      }
      await createStaff(family.id, {
        serviceId: addServiceId,
        name: addName.trim(),
        customRole: isCustomService ? addCustomRole.trim() : undefined,
        rateType: addRateType,
        phone: addPhone.trim(),
        monthlySalary: salary,
        joiningDate: addJoiningDate,
        notes: addNotes.trim() || undefined,
      }, token);
      setAddSheetVisible(false);
      await loadStaffList();
    } catch (err) {
      console.warn('[staff] failed to create caregiver', err);
      Alert.alert(t('staff.save_failed_title'), t('staff.save_failed_message'));
    } finally {
      setSaving(false);
    }
  };

  const openExtraPayment = (caregiverId: string) => {
    const existingPayment = transactions.find((entry) => entry.caregiverId === caregiverId);
    setExtraCaregiverId(caregiverId);
    setEditingExtraPaymentId(existingPayment?.id ?? null);
    setExtraAmount(existingPayment ? String(existingPayment.amount) : '');
    setExtraReason(existingPayment?.reason ?? '');
    setExtraSheetVisible(true);
  };
  const saveExtraPayment = async () => {
    const amount = Number(extraAmount);
    if (!extraCaregiverId || !Number.isFinite(amount) || amount <= 0 || !extraReason.trim()) {
      Alert.alert(t('staff.incomplete_title'), t('staff.extra_incomplete')); return;
    }
    const next = editingExtraPaymentId
      ? transactions.map((entry) => entry.id === editingExtraPaymentId ? { ...entry, amount, reason: extraReason.trim() } : entry)
      : [{ id: String(Date.now()), caregiverId: extraCaregiverId, amount, reason: extraReason.trim(), createdAt: Date.now() }, ...transactions];
    setTransactions(next); await saveCaregiverTransactions(next); setExtraSheetVisible(false);
  };
  const extraFor = (caregiverId: string) => transactions.filter((entry) => entry.caregiverId === caregiverId).reduce((sum, entry) => sum + entry.amount, 0);
  const latestExtraFor = (caregiverId: string) => transactions.find((entry) => entry.caregiverId === caregiverId);
  const noFamily = familyChecked && !hasFamily;

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={styles.heroIconColor.color} />
      </View>
    );
  }

  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('staff.back')} style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={styles.backIcon.color} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('staff.header_title')}</Text>
        {noFamily ? (
          <View style={styles.addButtonSpacer} />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={t('staff.add')} style={styles.addButton} onPress={openAddSheet}>
            <Plus size={20} color={styles.addIcon.color} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        {noFamily ? (
          <View style={styles.noFamilyBanner}>
            <View style={styles.noFamilyIconCircle}>
              <UsersRound size={22} color={styles.heroIconColor.color} strokeWidth={1.8} />
            </View>
            <Text style={styles.noFamilyTitle}>{t('staff.no_family_title')}</Text>
            <Text style={styles.noFamilyText}>{t('staff.no_family_banner_message')}</Text>
            <Pressable style={styles.noFamilyButton} onPress={() => navigation.navigate('Family')}>
              <Text style={styles.noFamilyButtonText}>{t('staff.go_to_family')}</Text>
            </Pressable>
          </View>
        ) : (
        <>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <UsersRound size={22} color={styles.heroIconColor.color} strokeWidth={1.8} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t('staff.hero_title')}</Text>
              <Text style={styles.heroDescription}>{t('staff.hero_description')}</Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroCountRow}>
            <Text style={styles.heroCountValue}>{caregivers.length}</Text>
            <Text style={styles.heroCountLabel}>{t('staff.count', { count: caregivers.length })}</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          {(
            [
              { key: 'attendance' as const, label: 'staff.tab_attendance' },
              { key: 'caregivers' as const, label: 'staff.tab_caregivers' },
            ]
          ).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {t(tab.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'attendance' && caregivers.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('staff.attendance_title')}</Text>
              <Text style={styles.sectionSubtitle}>{t('staff.attendance_subtitle')}</Text>
            </View>
            <View style={styles.listCard}>
              {caregivers.map((caregiver, idx) => {
                const status = todaysStatus(caregiver.id);
                return (
                  <View
                    key={caregiver.id}
                    style={[styles.attendanceRow, idx === 0 && styles.rowFirst]}
                  >
                    <Pressable style={styles.attendanceIdentity} onPress={() => setHistoryCaregiverId(caregiver.id)}>
                      <View style={styles.attendanceAvatar}>
                        <Text style={styles.attendanceAvatarText}>{caregiver.name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={styles.attendanceIdentityText}>
                        <Text style={styles.attendanceName} numberOfLines={1}>{caregiver.name}</Text>
                        <View style={styles.attendanceMonthlyRow}>
                          <CalendarClock size={11} color={styles.attendanceMonthlyIcon.color} strokeWidth={2} />
                          <Text style={styles.attendanceMonthly}>
                            {t('staff.attendance_present_days', { count: monthlyPresentCount(caregiver.id) })}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    <View style={styles.attendanceActions}>
                      <Pressable
                        onPress={() => markAttendance(caregiver.id, 'present')}
                        style={[
                          styles.attendanceLeaveBtn,
                          status === 'present' && { backgroundColor: ATTENDANCE_STATUS_COLOR.present.tint, borderColor: ATTENDANCE_STATUS_COLOR.present.tint },
                        ]}
                      >
                        <Text
                          style={[
                            styles.attendanceLeaveText,
                            { color: ATTENDANCE_STATUS_COLOR.present.tint },
                            status === 'present' && styles.attendanceLeaveTextActive,
                          ]}
                        >
                          {t('staff.attendance_status_present')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => markAttendance(caregiver.id, 'absent')}
                        style={[
                          styles.attendanceLeaveBtn,
                          status === 'absent' && { backgroundColor: ATTENDANCE_STATUS_COLOR.absent.tint, borderColor: ATTENDANCE_STATUS_COLOR.absent.tint },
                        ]}
                      >
                        <Text
                          style={[
                            styles.attendanceLeaveText,
                            { color: ATTENDANCE_STATUS_COLOR.absent.tint },
                            status === 'absent' && styles.attendanceLeaveTextActive,
                          ]}
                        >
                          {t('staff.attendance_status_absent')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => markAttendance(caregiver.id, 'halfDay')}
                        style={[
                          styles.attendanceLeaveBtn,
                          status === 'halfDay' && { backgroundColor: ATTENDANCE_STATUS_COLOR.halfDay.tint, borderColor: ATTENDANCE_STATUS_COLOR.halfDay.tint },
                        ]}
                      >
                        <Text
                          style={[
                            styles.attendanceLeaveText,
                            { color: ATTENDANCE_STATUS_COLOR.halfDay.tint },
                            status === 'halfDay' && styles.attendanceLeaveTextActive,
                          ]}
                        >
                          {t('staff.attendance_half_day')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => markAttendance(caregiver.id, 'leave')}
                        style={[
                          styles.attendanceLeaveBtn,
                          status === 'leave' && { backgroundColor: ATTENDANCE_STATUS_COLOR.leave.tint, borderColor: ATTENDANCE_STATUS_COLOR.leave.tint },
                        ]}
                      >
                        <Text
                          style={[
                            styles.attendanceLeaveText,
                            status === 'leave' && styles.attendanceLeaveTextActive,
                          ]}
                        >
                          {t('staff.attendance_leave')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
        {activeTab === 'attendance' && caregivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <UsersRound size={22} color={styles.heroIconColor.color} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>{t('staff.attendance_empty_title')}</Text>
            <Text style={styles.emptyText}>{t('staff.attendance_empty_text')}</Text>
            <Button title={t('staff.add_first')} onPress={openAddSheet} style={styles.emptyButton} />
          </View>
        ) : null}

        {activeTab === 'caregivers' ? (
        <>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('staff.section_title')}</Text>
          <Text style={styles.sectionSubtitle}>{t('staff.section_subtitle')}</Text>
        </View>
        {caregivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <UsersRound size={22} color={styles.heroIconColor.color} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>{t('staff.empty_title')}</Text>
            <Text style={styles.emptyText}>{t('staff.empty_text')}</Text>
            <Button title={t('staff.add_first')} onPress={openAddSheet} style={styles.emptyButton} />
          </View>
        ) : (
          caregivers.map((caregiver) => (
            <Pressable
              key={caregiver.id}
              style={({ pressed }) => [styles.caregiverCard, pressed && styles.caregiverCardPressed]}
              onPress={() => openExtraPayment(caregiver.id)}
            >
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{caregiver.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.name} numberOfLines={1}>{caregiver.name}</Text>
                  <View style={styles.subtitleRow}>
                    {caregiver.service ? (
                      <Text style={styles.service} numberOfLines={1}>{caregiver.service}</Text>
                    ) : null}
                    {caregiver.phone ? (
                      <>
                        {caregiver.service ? <Text style={styles.subtitleDot}>·</Text> : null}
                        <Phone size={11} color={styles.phoneIcon.color} strokeWidth={1.8} />
                        <Text style={styles.phone} numberOfLines={1}>{caregiver.phone}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.rate}>
                  {t(caregiver.rateType === 'hourly' ? 'staff.hourly_rate' : 'staff.monthly_rate', { rate: caregiver.rate.toLocaleString() })}
                </Text>
              </View>
              {extraFor(caregiver.id) > 0 ? (
                <View style={styles.paymentSummary}>
                  <Text style={styles.extraTotal}>{t('staff.extra_total', { amount: extraFor(caregiver.id).toLocaleString() })}</Text>
                  {latestExtraFor(caregiver.id)?.reason ? (
                    <Text style={styles.extraReason}>{latestExtraFor(caregiver.id)?.reason}</Text>
                  ) : null}
                  <Text style={styles.totalPayable}>
                    {t('staff.total_payable', { amount: (caregiver.rate + extraFor(caregiver.id)).toLocaleString() })}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))
        )}
        </>
        ) : null}
        </>
        )}
      </ScrollView>
      <BottomSheet visible={addSheetVisible} onClose={() => setAddSheetVisible(false)} title={t('staff.add_title')}>
        <Text style={styles.label}>{t('staff.name_label')}</Text>
        <TextInput value={addName} onChangeText={setAddName} placeholder={t('staff.name_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.service_label')}</Text>
        <Pressable style={styles.serviceSelect} onPress={() => setAddServiceOptionsVisible((visible) => !visible)}>
          <Text style={selectedService ? styles.serviceValue : styles.placeholder}>
            {selectedService?.serviceName ?? t('staff.service_placeholder')}
          </Text>
          <ChevronDown
            size={16}
            color={styles.selectCaret.color}
            style={addServiceOptionsVisible ? styles.selectCaretFlipped : undefined}
          />
        </Pressable>
        {addServiceOptionsVisible ? (
          <View style={styles.serviceOptions}>
            {serviceOptions.length === 0 ? (
              serviceOptionsError ? (
                <Pressable style={styles.serviceOption} onPress={loadServiceOptions}>
                  <Text style={styles.serviceOptionText}>{t('staff.service_options_empty')}</Text>
                </Pressable>
              ) : (
                <View style={styles.serviceOption}>
                  <Text style={styles.serviceOptionText}>{t('staff.service_options_loading')}</Text>
                </View>
              )
            ) : (
              serviceOptions.map((option) => (
                <Pressable
                  key={option.id}
                  style={[styles.serviceOption, addServiceId === option.id && styles.serviceOptionSelected]}
                  onPress={() => {
                    setAddServiceId(option.id);
                    setAddServiceOptionsVisible(false);
                  }}
                >
                  <Text style={[styles.serviceOptionText, addServiceId === option.id && styles.serviceOptionTextSelected]}>{option.serviceName}</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
        {isCustomService ? (
          <>
            <Text style={styles.label}>{t('staff.custom_role_label')}</Text>
            <TextInput value={addCustomRole} onChangeText={setAddCustomRole} placeholder={t('staff.custom_role_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
          </>
        ) : null}
        <Text style={styles.label}>{t('staff.rate_type_label')}</Text>
        <View style={styles.choiceRow}>
          {(['Monthly', 'Hourly'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setAddRateType(option)}
              style={[styles.choice, addRateType === option && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, addRateType === option && styles.choiceTextSelected]}>
                {t(option === 'Monthly' ? 'staff.rate_type_monthly' : 'staff.rate_type_hourly')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>{t('staff.rate_label')}</Text>
        <TextInput value={addSalary} onChangeText={setAddSalary} keyboardType="decimal-pad" placeholder={t('staff.rate_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.phone_label')}</Text>
        <TextInput value={addPhone} onChangeText={setAddPhone} keyboardType="phone-pad" placeholder={t('staff.phone_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.joining_date_label')}</Text>
        <Pressable style={styles.input} onPress={() => setAddJoiningDatePickerVisible(true)}>
          <Text style={styles.serviceValue}>{displayDate(addJoiningDate)}</Text>
        </Pressable>
        {addJoiningDatePickerVisible ? (
          <DateTimePicker
            value={new Date(`${addJoiningDate}T00:00:00`)}
            mode="date"
            display="default"
            onChange={handleJoiningDateChange}
          />
        ) : null}
        <Text style={styles.label}>{t('staff.notes_label')}</Text>
        <TextInput value={addNotes} onChangeText={setAddNotes} placeholder={t('staff.notes_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Button title={t('staff.save')} onPress={saveNewCaregiver} loading={saving} style={styles.saveButton} />
      </BottomSheet>
      <BottomSheet visible={extraSheetVisible} onClose={() => setExtraSheetVisible(false)} title={t('staff.extra_title')}>
        <Text style={styles.extraHelp}>{t('staff.extra_help')}</Text>
        <Text style={styles.label}>{t('staff.extra_amount')}</Text>
        <TextInput value={extraAmount} onChangeText={setExtraAmount} keyboardType="decimal-pad" placeholder={t('staff.extra_amount_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.extra_reason')}</Text>
        <View style={styles.reasonRow}>
          {['rainy', 'overtime', 'bonus'].map((reason) => (
            <Pressable key={reason} onPress={() => setExtraReason(t(`staff.reason_${reason}`))} style={styles.reasonChip}>
              <Text style={styles.reasonText}>{t(`staff.reason_${reason}`)}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={extraReason} onChangeText={setExtraReason} placeholder={t('staff.extra_reason_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Button title={t('staff.save_extra')} onPress={saveExtraPayment} style={styles.saveButton} />
      </BottomSheet>
      <BottomSheet
        visible={historyCaregiverId !== null}
        onClose={() => setHistoryCaregiverId(null)}
        title={t('staff.attendance_history_title', { name: caregivers.find((c) => c.id === historyCaregiverId)?.name ?? '' })}
      >
        {historyCaregiverId && historyFor(historyCaregiverId).length === 0 ? (
          <Text style={styles.historyEmpty}>{t('staff.attendance_history_empty')}</Text>
        ) : (
          historyCaregiverId && historyFor(historyCaregiverId).map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{entry.date}</Text>
              <View style={[styles.historyBadge, { backgroundColor: ATTENDANCE_STATUS_COLOR[entry.status].soft }]}>
                <Text style={[styles.historyBadgeText, { color: ATTENDANCE_STATUS_COLOR[entry.status].tint }]}>
                  {t(`staff.attendance_status_${entry.status}`)}
                </Text>
              </View>
            </View>
          ))
        )}
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backIcon: { color: colors.textPrimary },
  headerTitle: {
    flex: 1,
    marginLeft: spacing.md,
    fontFamily: fonts.serif,
    fontSize: 21,
    color: colors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadow.soft,
  },
  addIcon: { color: colors.textOnPrimary },
  addButtonSpacer: { width: 40, height: 40 },
  content: { padding: spacing.lg },
  noFamilyBanner: {
    alignItems: 'center',
    backgroundColor: colors.glassSurface || colors.surfaceElevated,
    borderRadius: radius.card || 20,
    borderWidth: 1,
    borderColor: colors.glassBorder || colors.border,
    padding: spacing.xl,
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
  hero: {
    backgroundColor: colors.glassSurface || colors.surfaceElevated,
    borderRadius: radius.card || 20,
    borderWidth: 1,
    borderColor: colors.glassBorder || colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.soft,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blush,
    marginRight: spacing.md,
  },
  heroIconColor: { color: colors.primary },
  heroCopy: { flex: 1 },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  heroDescription: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  heroCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  heroCountValue: { fontFamily: fonts.serif, fontSize: 24, color: colors.primary },
  heroCountLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  tabButtonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    fontFamily: fonts.sansBold,
    color: colors.primary,
  },
  sectionHead: { marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary },
  sectionSubtitle: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  listCard: {
    backgroundColor: colors.glassSurface || colors.surface,
    borderRadius: radius.card || 18,
    borderWidth: 1,
    borderColor: colors.glassBorder || colors.border,
    paddingHorizontal: spacing.md,
    ...shadow.soft,
  },
  rowFirst: { borderTopWidth: 0 },
  emptyCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.card || 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.soft,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blush,
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary },
  emptyText: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  emptyButton: { alignSelf: 'stretch', marginTop: spacing.lg },
  caregiverCard: {
    backgroundColor: colors.glassSurface || colors.surface,
    borderRadius: radius.card || 18,
    borderWidth: 1,
    borderColor: colors.glassBorder || colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
    ...shadow.soft,
  },
  caregiverCardPressed: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { fontFamily: fonts.serif, fontSize: 16, color: colors.primary },
  cardTitleWrap: { flex: 1, marginRight: spacing.xs },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  subtitleDot: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  service: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  rate: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primary },
  paymentSummary: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  extraTotal: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.forest },
  extraReason: { marginTop: 2, fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  totalPayable: { marginTop: 3, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
  phoneIcon: { color: colors.textMuted },
  phone: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  placeholder: { color: colors.textMuted },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceSelected: { backgroundColor: colors.blush, borderColor: colors.primary },
  choiceText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary },
  choiceTextSelected: { color: colors.primary },
  serviceSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  serviceValue: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  selectCaret: { color: colors.textMuted },
  selectCaretFlipped: { transform: [{ rotate: '180deg' }] },
  serviceOptions: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  serviceOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceOptionSelected: { backgroundColor: colors.blush },
  serviceOptionText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
  serviceOptionTextSelected: { color: colors.primary },
  saveButton: { marginTop: spacing.lg },
  extraHelp: {
    marginTop: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  reasonChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.blush,
  },
  reasonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  attendanceRow: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attendanceIdentity: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  attendanceAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  attendanceAvatarText: { fontFamily: fonts.serif, fontSize: 15, color: colors.primary },
  attendanceIdentityText: { flex: 1 },
  attendanceName: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  attendanceMonthlyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  attendanceMonthlyIcon: { color: colors.textMuted },
  attendanceMonthly: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  attendanceActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attendanceLeaveBtn: {
    flex: 1.3,
    paddingHorizontal: 6,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attendanceLeaveText: { fontFamily: fonts.sansBold, fontSize: 11, color: ATTENDANCE_STATUS_COLOR.leave.tint },
  attendanceLeaveTextActive: { color: '#fff' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDate: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  historyBadgeText: { fontFamily: fonts.sansBold, fontSize: 12 },
  historyEmpty: {
    marginTop: spacing.md,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
