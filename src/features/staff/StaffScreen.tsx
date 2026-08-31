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
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import type { RootStackParamList } from '../../app/_layout';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SectionHeader from '../../components/SectionHeader';
import useAuth from '../../hooks/useAuth';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';
import { getMyPrimaryFamily } from '../family/api';
import { createStaff, listServiceOptions, listStaff, type RemoteStaffMember, type ServiceOption } from './api';
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

  const loadStaffList = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const family = token ? await getMyPrimaryFamily(token).catch(() => null) : null;
      if (token && family) {
        const remote = await listStaff(family.id, token);
        setCaregivers(remote.map(toCaregiver));
      } else {
        setCaregivers([]);
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
    if (existing) {
      if (existing.status === status) {
        // Tapping the already-active status again clears it back to unmarked.
        await persistAttendance(attendance.filter((e) => e.id !== existing.id));
        return;
      }
      await persistAttendance(attendance.map((e) => (e.id === existing.id ? { ...e, status, markedAt: Date.now() } : e)));
      return;
    }
    await persistAttendance([
      ...attendance,
      { id: `${caregiverId}-${date}`, caregiverId, date, status, markedAt: Date.now() },
    ]);
  };

  // Present count over the last 30 calendar days, inclusive of today.
  const monthlyPresentCount = (caregiverId: string): number => {
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
      const family = token ? await getMyPrimaryFamily(token).catch(() => null) : null;
      if (!token || !family) {
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('staff.add')} style={styles.addButton} onPress={openAddSheet}><Text style={styles.addButtonText}>+</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <View style={styles.heroIcon}><UsersRound size={24} color={styles.heroIconColor.color} strokeWidth={1.8} /></View>
          <Text style={styles.heroTitle}>{t('staff.hero_title')}</Text>
          <Text style={styles.heroDescription}>{t('staff.hero_description')}</Text>
          <Text style={styles.count}>{t('staff.count', { count: caregivers.length })}</Text>
        </Card>

        {caregivers.length > 0 ? (
          <>
            <SectionHeader title={t('staff.attendance_title')} subtitle={t('staff.attendance_subtitle')} />
            <Card style={styles.attendanceCard}>
              {caregivers.map((caregiver, idx) => {
                const status = todaysStatus(caregiver.id);
                return (
                  <View
                    key={caregiver.id}
                    style={[styles.attendanceRow, idx === caregivers.length - 1 && styles.attendanceRowLast]}
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
                          styles.attendanceBtn,
                          status === 'present' && { backgroundColor: ATTENDANCE_STATUS_COLOR.present.tint },
                        ]}
                      >
                        <Check
                          size={16}
                          strokeWidth={2.6}
                          color={status === 'present' ? '#fff' : ATTENDANCE_STATUS_COLOR.present.tint}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => markAttendance(caregiver.id, 'absent')}
                        style={[
                          styles.attendanceBtn,
                          status === 'absent' && { backgroundColor: ATTENDANCE_STATUS_COLOR.absent.tint },
                        ]}
                      >
                        <X
                          size={16}
                          strokeWidth={2.6}
                          color={status === 'absent' ? '#fff' : ATTENDANCE_STATUS_COLOR.absent.tint}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => markAttendance(caregiver.id, 'leave')}
                        style={[
                          styles.attendanceLeaveBtn,
                          status === 'leave' && { backgroundColor: ATTENDANCE_STATUS_COLOR.leave.tint },
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
            </Card>
          </>
        ) : null}

        <SectionHeader title={t('staff.section_title')} subtitle={t('staff.section_subtitle')} />
        {caregivers.length === 0 ? (
          <Card style={styles.empty}><Text style={styles.emptyTitle}>{t('staff.empty_title')}</Text><Text style={styles.emptyText}>{t('staff.empty_text')}</Text><Button title={t('staff.add_first')} onPress={openAddSheet} style={styles.emptyButton} /></Card>
        ) : caregivers.map((caregiver) => (
          <Card key={caregiver.id} style={styles.caregiverCard} onPress={() => openExtraPayment(caregiver.id)}>
            <View style={styles.cardTop}><View style={styles.avatar}><Text style={styles.avatarText}>{caregiver.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.cardTitleWrap}><Text style={styles.name}>{caregiver.name}</Text><Text style={styles.service}>{caregiver.service}</Text></View></View>
            <Text style={styles.rate}>{t(caregiver.rateType === 'hourly' ? 'staff.hourly_rate' : 'staff.monthly_rate', { rate: caregiver.rate.toLocaleString() })}</Text>
            {extraFor(caregiver.id) > 0 ? <View style={styles.paymentSummary}><Text style={styles.extraTotal}>{t('staff.extra_total', { amount: extraFor(caregiver.id).toLocaleString() })}</Text>{latestExtraFor(caregiver.id)?.reason ? <Text style={styles.extraReason}>{latestExtraFor(caregiver.id)?.reason}</Text> : null}<Text style={styles.totalPayable}>{t('staff.total_payable', { amount: (caregiver.rate + extraFor(caregiver.id)).toLocaleString() })}</Text></View> : null}
            {caregiver.phone ? <View style={styles.phoneRow}><Phone size={14} color={styles.phoneIcon.color} /><Text style={styles.phone}>{caregiver.phone}</Text></View> : null}
          </Card>
        ))}
      </ScrollView>
      <BottomSheet visible={addSheetVisible} onClose={() => setAddSheetVisible(false)} title={t('staff.add_title')}>
        <Text style={styles.label}>{t('staff.name_label')}</Text>
        <TextInput value={addName} onChangeText={setAddName} placeholder={t('staff.name_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.service_label')}</Text>
        <Pressable style={styles.serviceSelect} onPress={() => setAddServiceOptionsVisible((visible) => !visible)}>
          <Text style={selectedService ? styles.serviceValue : styles.placeholder}>
            {selectedService?.serviceName ?? t('staff.service_placeholder')}
          </Text>
          <Text style={styles.selectCaret}>{addServiceOptionsVisible ? '▴' : '▾'}</Text>
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
        <Text style={styles.label}>{t('staff.extra_amount')}</Text><TextInput value={extraAmount} onChangeText={setExtraAmount} keyboardType="decimal-pad" placeholder={t('staff.extra_amount_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.extra_reason')}</Text><View style={styles.reasonRow}>{['rainy', 'overtime', 'bonus'].map((reason) => <Pressable key={reason} onPress={() => setExtraReason(t(`staff.reason_${reason}`))} style={styles.reasonChip}><Text style={styles.reasonText}>{t(`staff.reason_${reason}`)}</Text></Pressable>)}</View>
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

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, center: { alignItems: 'center', justifyContent: 'center' }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, backIcon: { color: colors.textPrimary }, headerTitle: { flex: 1, marginLeft: spacing.md, fontFamily: fonts.serif, fontSize: 21, color: colors.textPrimary }, addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, addButtonText: { fontFamily: fonts.sansMedium, fontSize: 24, color: colors.surface },
  content: { padding: spacing.lg, gap: spacing.md }, hero: { backgroundColor: colors.surfaceElevated, marginBottom: spacing.md }, heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush, marginBottom: spacing.md }, heroIconColor: { color: colors.primary }, heroTitle: { fontFamily: fonts.serif, fontSize: 25, color: colors.textPrimary, marginBottom: 5 }, heroDescription: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary }, count: { marginTop: spacing.md, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
  empty: { alignItems: 'flex-start' }, emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary, marginBottom: 5 }, emptyText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary }, emptyButton: { marginTop: spacing.lg, alignSelf: 'stretch' }, caregiverCard: { padding: spacing.lg }, cardTop: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, avatarText: { fontFamily: fonts.serif, fontSize: 19, color: colors.primary }, cardTitleWrap: { flex: 1 }, name: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary }, service: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 2 }, rate: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.primary, marginTop: spacing.md }, paymentSummary: { marginTop: 4 }, extraTotal: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.forest }, extraReason: { marginTop: 2, fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary }, totalPayable: { marginTop: 3, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary }, phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }, phoneIcon: { color: colors.textMuted }, phone: { marginLeft: spacing.xs, fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  label: { marginTop: spacing.md, marginBottom: spacing.xs, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface }, placeholder: { color: colors.textMuted },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, choiceSelected: { backgroundColor: colors.blush, borderColor: colors.primary }, choiceText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary }, choiceTextSelected: { color: colors.primary }, serviceSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface }, serviceValue: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary }, selectCaret: { marginLeft: spacing.sm, fontSize: 15, color: colors.textMuted }, serviceOptions: { marginTop: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' }, serviceOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, serviceOptionSelected: { backgroundColor: colors.blush }, serviceOptionText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary }, serviceOptionTextSelected: { color: colors.primary }, saveButton: { marginTop: spacing.lg }, extraHelp: { marginTop: spacing.sm, fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary }, reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }, reasonChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.blush }, reasonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  attendanceCard: { padding: spacing.sm },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  attendanceRowLast: { borderBottomWidth: 0 },
  attendanceIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm },
  attendanceAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  attendanceAvatarText: { fontFamily: fonts.serif, fontSize: 16, color: colors.primary },
  attendanceIdentityText: { flex: 1 },
  attendanceName: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  attendanceMonthlyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  attendanceMonthlyIcon: { color: colors.textMuted },
  attendanceMonthly: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  attendanceActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attendanceBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  attendanceLeaveBtn: { paddingHorizontal: 10, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  attendanceLeaveText: { fontFamily: fonts.sansBold, fontSize: 11, color: ATTENDANCE_STATUS_COLOR.leave.tint },
  attendanceLeaveTextActive: { color: '#fff' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyDate: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  historyBadgeText: { fontFamily: fonts.sansBold, fontSize: 12 },
  historyEmpty: { marginTop: spacing.md, fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
