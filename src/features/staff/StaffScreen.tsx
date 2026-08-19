// @refresh reset
// Keep this screen remounted after Fast Refresh. Its form state evolves frequently,
// and preserving an older hook queue after a new state hook is added causes React's
// "Should have a queue" development error.
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Phone from 'lucide-react-native/icons/phone';
import UsersRound from 'lucide-react-native/icons/users-round';
import type { RootStackParamList } from '../../app/_layout';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SectionHeader from '../../components/SectionHeader';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';
import { loadCaregivers, loadCaregiverTransactions, saveCaregivers, saveCaregiverTransactions } from './staffStore';
import type { Caregiver, CaregiverRateType, CaregiverTransaction } from './types';

type Props = StackScreenProps<RootStackParamList, 'Staff'>;
const CAREGIVER_SERVICE_OPTIONS = [
  'Housekeeping',
  'Cooking',
  'Childcare / nanny',
  'Elderly care',
  'Patient care',
  'Companion care',
  'Driver',
  'Gardening',
  'Laundry',
  'Security',
  'Custom',
] as const;

export default function StaffScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [transactions, setTransactions] = useState<CaregiverTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [service, setService] = useState('');
  const [serviceOption, setServiceOption] = useState('');
  const [serviceOptionsVisible, setServiceOptionsVisible] = useState(false);
  const [rateType, setRateType] = useState<CaregiverRateType>('monthly');
  const [rate, setRate] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [localeVersion, setLocaleVersion] = useState(0);
  const [extraSheetVisible, setExtraSheetVisible] = useState(false);
  const [extraCaregiverId, setExtraCaregiverId] = useState<string | null>(null);
  const [editingExtraPaymentId, setEditingExtraPaymentId] = useState<string | null>(null);
  const [extraAmount, setExtraAmount] = useState('');
  const [extraReason, setExtraReason] = useState('');

  useEffect(() => {
    Promise.all([loadCaregivers(), loadCaregiverTransactions()]).then(([items, savedTransactions]) => { setCaregivers(items); setTransactions(savedTransactions); setLoading(false); });
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((version) => version + 1));
    return () => { unsubscribe(); };
  }, []);

  const persist = async (items: Caregiver[]) => {
    setCaregivers(items);
    await saveCaregivers(items);
  };

  const resetForm = () => {
    setEditingId(null); setName(''); setService(''); setServiceOption(''); setServiceOptionsVisible(false); setRateType('monthly'); setRate(''); setPhone(''); setNotes('');
  };

  const openAdd = () => { resetForm(); setSheetVisible(true); };
  const openEdit = (caregiver: Caregiver) => {
    setEditingId(caregiver.id); setName(caregiver.name); setService(caregiver.service);
    setServiceOption(CAREGIVER_SERVICE_OPTIONS.includes(caregiver.service as typeof CAREGIVER_SERVICE_OPTIONS[number]) ? caregiver.service : 'Custom');
    setServiceOptionsVisible(false);
    setRateType(caregiver.rateType); setRate(String(caregiver.rate)); setPhone(caregiver.phone); setNotes(caregiver.notes);
    setSheetVisible(true);
  };

  const save = async () => {
    const numericRate = Number(rate);
    if (!name.trim() || !service.trim() || !Number.isFinite(numericRate) || numericRate < 0) {
      Alert.alert(t('staff.incomplete_title'), t('staff.incomplete_message'));
      return;
    }
    const entry = { name: name.trim(), service: service.trim(), rateType, rate: numericRate, phone: phone.trim(), notes: notes.trim() };
    if (editingId) {
      await persist(caregivers.map((item) => item.id === editingId ? { ...item, ...entry } : item));
    } else {
      await persist([...caregivers, { id: String(Date.now()), createdAt: Date.now(), ...entry }]);
    }
    setSheetVisible(false);
  };

  const remove = () => {
    const target = caregivers.find((item) => item.id === editingId);
    if (!target) return;
    Alert.alert(t('staff.remove_title'), t('staff.remove_message', { name: target.name }), [
      { text: t('staff.cancel'), style: 'cancel' },
      { text: t('staff.remove'), style: 'destructive', onPress: async () => { await persist(caregivers.filter((item) => item.id !== target.id)); setSheetVisible(false); } },
    ]);
  };

  const openExtraPayment = () => {
    // Do not stack one BottomSheet Modal on another: Android then has two keyboard
    // avoidance and drag responders active, which makes focused fields jump/bounce.
    // Close the caregiver sheet first, then open the payment sheet after its dismiss
    // animation completes.
    const existingPayment = transactions.find((entry) => entry.caregiverId === editingId);
    setExtraCaregiverId(editingId);
    setEditingExtraPaymentId(existingPayment?.id ?? null);
    setExtraAmount(existingPayment ? String(existingPayment.amount) : '');
    setExtraReason(existingPayment?.reason ?? '');
    setSheetVisible(false);
    setTimeout(() => setExtraSheetVisible(true), 250);
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

  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('staff.back')} style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={styles.backIcon.color} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('staff.header_title')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('staff.add')} style={styles.addButton} onPress={openAdd}><Text style={styles.addButtonText}>+</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <View style={styles.heroIcon}><UsersRound size={24} color={styles.heroIconColor.color} strokeWidth={1.8} /></View>
          <Text style={styles.heroTitle}>{t('staff.hero_title')}</Text>
          <Text style={styles.heroDescription}>{t('staff.hero_description')}</Text>
          <Text style={styles.count}>{t('staff.count', { count: caregivers.length })}</Text>
        </Card>
        <SectionHeader title={t('staff.section_title')} subtitle={t('staff.section_subtitle')} />
        {!loading && caregivers.length === 0 ? (
          <Card style={styles.empty}><Text style={styles.emptyTitle}>{t('staff.empty_title')}</Text><Text style={styles.emptyText}>{t('staff.empty_text')}</Text><Button title={t('staff.add_first')} onPress={openAdd} style={styles.emptyButton} /></Card>
        ) : caregivers.map((caregiver) => (
          <Card key={caregiver.id} style={styles.caregiverCard} onPress={() => openEdit(caregiver)}>
            <View style={styles.cardTop}><View style={styles.avatar}><Text style={styles.avatarText}>{caregiver.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.cardTitleWrap}><Text style={styles.name}>{caregiver.name}</Text><Text style={styles.service}>{caregiver.service}</Text></View></View>
            <Text style={styles.rate}>{t(caregiver.rateType === 'hourly' ? 'staff.hourly_rate' : 'staff.monthly_rate', { rate: caregiver.rate.toLocaleString() })}</Text>
            {extraFor(caregiver.id) > 0 ? <View style={styles.paymentSummary}><Text style={styles.extraTotal}>{t('staff.extra_total', { amount: extraFor(caregiver.id).toLocaleString() })}</Text>{latestExtraFor(caregiver.id)?.reason ? <Text style={styles.extraReason}>{latestExtraFor(caregiver.id)?.reason}</Text> : null}<Text style={styles.totalPayable}>{t('staff.total_payable', { amount: (caregiver.rate + extraFor(caregiver.id)).toLocaleString() })}</Text></View> : null}
            {caregiver.phone ? <View style={styles.phoneRow}><Phone size={14} color={styles.phoneIcon.color} /><Text style={styles.phone}>{caregiver.phone}</Text></View> : null}
          </Card>
        ))}
      </ScrollView>
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title={t(editingId ? 'staff.edit_title' : 'staff.add_title')}>
        <Text style={styles.label}>{t('staff.name_label')}</Text><TextInput value={name} onChangeText={setName} placeholder={t('staff.name_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.service_label')}</Text>
        <Pressable style={styles.serviceSelect} onPress={() => setServiceOptionsVisible((visible) => !visible)}>
          <Text style={serviceOption ? styles.serviceValue : styles.placeholder}>
            {serviceOption || t('staff.service_placeholder')}
          </Text>
          <Text style={styles.selectCaret}>{serviceOptionsVisible ? '▴' : '▾'}</Text>
        </Pressable>
        {serviceOptionsVisible ? (
          <View style={styles.serviceOptions}>
            {CAREGIVER_SERVICE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.serviceOption, serviceOption === option && styles.serviceOptionSelected]}
                onPress={() => {
                  setServiceOption(option);
                  setService(option === 'Custom' ? '' : option);
                  setServiceOptionsVisible(false);
                }}
              >
                <Text style={[styles.serviceOptionText, serviceOption === option && styles.serviceOptionTextSelected]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {serviceOption === 'Custom' ? (
          <TextInput value={service} onChangeText={setService} placeholder={t('staff.service_placeholder')} placeholderTextColor={styles.placeholder.color} style={[styles.input, styles.customServiceInput]} />
        ) : null}
        <Text style={styles.label}>{t('staff.rate_type_label')}</Text><View style={styles.choiceRow}>{(['monthly', 'hourly'] as CaregiverRateType[]).map((type) => <Pressable key={type} onPress={() => setRateType(type)} style={[styles.choice, rateType === type && styles.choiceSelected]}><Text style={[styles.choiceText, rateType === type && styles.choiceTextSelected]}>{t(`staff.rate_type_${type}`)}</Text></Pressable>)}</View>
        <Text style={styles.label}>{t('staff.rate_label')}</Text><TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder={t('staff.rate_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.phone_label')}</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t('staff.phone_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.notes_label')}</Text><TextInput value={notes} onChangeText={setNotes} placeholder={t('staff.notes_placeholder')} placeholderTextColor={styles.placeholder.color} style={[styles.input, styles.notesInput]} multiline />
        <Button title={t('staff.save')} onPress={save} style={styles.saveButton} />
        {editingId ? <Pressable style={styles.extraButton} onPress={openExtraPayment}><Text style={styles.extraButtonText}>{t('staff.add_extra')}</Text></Pressable> : null}
        {editingId ? <Pressable style={styles.removeButton} onPress={remove}><Text style={styles.removeText}>{t('staff.remove')}</Text></Pressable> : null}
      </BottomSheet>
      <BottomSheet visible={extraSheetVisible} onClose={() => setExtraSheetVisible(false)} title={t('staff.extra_title')}>
        <Text style={styles.extraHelp}>{t('staff.extra_help')}</Text>
        <Text style={styles.label}>{t('staff.extra_amount')}</Text><TextInput value={extraAmount} onChangeText={setExtraAmount} keyboardType="decimal-pad" placeholder={t('staff.extra_amount_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.extra_reason')}</Text><View style={styles.reasonRow}>{['rainy', 'overtime', 'bonus'].map((reason) => <Pressable key={reason} onPress={() => setExtraReason(t(`staff.reason_${reason}`))} style={styles.reasonChip}><Text style={styles.reasonText}>{t(`staff.reason_${reason}`)}</Text></Pressable>)}</View>
        <TextInput value={extraReason} onChangeText={setExtraReason} placeholder={t('staff.extra_reason_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Button title={t('staff.save_extra')} onPress={saveExtraPayment} style={styles.saveButton} />
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, backIcon: { color: colors.textPrimary }, headerTitle: { flex: 1, marginLeft: spacing.md, fontFamily: fonts.serif, fontSize: 21, color: colors.textPrimary }, addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, addButtonText: { fontFamily: fonts.sansMedium, fontSize: 24, color: colors.surface },
  content: { padding: spacing.lg, gap: spacing.md }, hero: { backgroundColor: colors.surfaceElevated, marginBottom: spacing.md }, heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush, marginBottom: spacing.md }, heroIconColor: { color: colors.primary }, heroTitle: { fontFamily: fonts.serif, fontSize: 25, color: colors.textPrimary, marginBottom: 5 }, heroDescription: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary }, count: { marginTop: spacing.md, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
  empty: { alignItems: 'flex-start' }, emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary, marginBottom: 5 }, emptyText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary }, emptyButton: { marginTop: spacing.lg, alignSelf: 'stretch' }, caregiverCard: { padding: spacing.lg }, cardTop: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, avatarText: { fontFamily: fonts.serif, fontSize: 19, color: colors.primary }, cardTitleWrap: { flex: 1 }, name: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary }, service: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 2 }, rate: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.primary, marginTop: spacing.md }, paymentSummary: { marginTop: 4 }, extraTotal: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.forest }, extraReason: { marginTop: 2, fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary }, totalPayable: { marginTop: 3, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary }, phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }, phoneIcon: { color: colors.textMuted }, phone: { marginLeft: spacing.xs, fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  label: { marginTop: spacing.md, marginBottom: spacing.xs, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface }, placeholder: { color: colors.textMuted }, serviceSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface }, serviceValue: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary }, customServiceInput: { marginTop: spacing.sm }, selectCaret: { marginLeft: spacing.sm, fontSize: 15, color: colors.textMuted }, serviceOptions: { marginTop: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' }, serviceOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, serviceOptionSelected: { backgroundColor: colors.blush }, serviceOptionText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary }, serviceOptionTextSelected: { color: colors.primary }, notesInput: { minHeight: 86, textAlignVertical: 'top' }, choiceRow: { flexDirection: 'row', gap: spacing.sm }, choice: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }, choiceSelected: { backgroundColor: colors.blush, borderColor: colors.primary }, choiceText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary }, choiceTextSelected: { color: colors.primary }, saveButton: { marginTop: spacing.lg }, extraButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md }, extraButtonText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.primary }, removeButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs }, removeText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.danger }, extraHelp: { marginTop: spacing.sm, fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary }, reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }, reasonChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.blush }, reasonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
});
