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
import { loadCaregivers, saveCaregivers } from './staffStore';
import type { Caregiver, CaregiverRateType } from './types';

type Props = StackScreenProps<RootStackParamList, 'Staff'>;

export default function StaffScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [service, setService] = useState('');
  const [rateType, setRateType] = useState<CaregiverRateType>('monthly');
  const [rate, setRate] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [localeVersion, setLocaleVersion] = useState(0);

  useEffect(() => {
    loadCaregivers().then((items) => { setCaregivers(items); setLoading(false); });
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((version) => version + 1));
    return () => { unsubscribe(); };
  }, []);

  const persist = async (items: Caregiver[]) => {
    setCaregivers(items);
    await saveCaregivers(items);
  };

  const resetForm = () => {
    setEditingId(null); setName(''); setService(''); setRateType('monthly'); setRate(''); setPhone(''); setNotes('');
  };

  const openAdd = () => { resetForm(); setSheetVisible(true); };
  const openEdit = (caregiver: Caregiver) => {
    setEditingId(caregiver.id); setName(caregiver.name); setService(caregiver.service);
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
            {caregiver.phone ? <View style={styles.phoneRow}><Phone size={14} color={styles.phoneIcon.color} /><Text style={styles.phone}>{caregiver.phone}</Text></View> : null}
          </Card>
        ))}
      </ScrollView>
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title={t(editingId ? 'staff.edit_title' : 'staff.add_title')}>
        <Text style={styles.label}>{t('staff.name_label')}</Text><TextInput value={name} onChangeText={setName} placeholder={t('staff.name_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.service_label')}</Text><TextInput value={service} onChangeText={setService} placeholder={t('staff.service_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.rate_type_label')}</Text><View style={styles.choiceRow}>{(['monthly', 'hourly'] as CaregiverRateType[]).map((type) => <Pressable key={type} onPress={() => setRateType(type)} style={[styles.choice, rateType === type && styles.choiceSelected]}><Text style={[styles.choiceText, rateType === type && styles.choiceTextSelected]}>{t(`staff.rate_type_${type}`)}</Text></Pressable>)}</View>
        <Text style={styles.label}>{t('staff.rate_label')}</Text><TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder={t('staff.rate_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.phone_label')}</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t('staff.phone_placeholder')} placeholderTextColor={styles.placeholder.color} style={styles.input} />
        <Text style={styles.label}>{t('staff.notes_label')}</Text><TextInput value={notes} onChangeText={setNotes} placeholder={t('staff.notes_placeholder')} placeholderTextColor={styles.placeholder.color} style={[styles.input, styles.notesInput]} multiline />
        <Button title={t('staff.save')} onPress={save} />
        {editingId ? <Pressable style={styles.removeButton} onPress={remove}><Text style={styles.removeText}>{t('staff.remove')}</Text></Pressable> : null}
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, backIcon: { color: colors.textPrimary }, headerTitle: { flex: 1, marginLeft: spacing.md, fontFamily: fonts.serif, fontSize: 21, color: colors.textPrimary }, addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, addButtonText: { fontFamily: fonts.sansMedium, fontSize: 24, color: colors.surface },
  content: { padding: spacing.lg, gap: spacing.md }, hero: { backgroundColor: colors.surfaceElevated, marginBottom: spacing.md }, heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush, marginBottom: spacing.md }, heroIconColor: { color: colors.primary }, heroTitle: { fontFamily: fonts.serif, fontSize: 25, color: colors.textPrimary, marginBottom: 5 }, heroDescription: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary }, count: { marginTop: spacing.md, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
  empty: { alignItems: 'flex-start' }, emptyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary, marginBottom: 5 }, emptyText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary }, emptyButton: { marginTop: spacing.lg, alignSelf: 'stretch' }, caregiverCard: { padding: spacing.lg }, cardTop: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, avatarText: { fontFamily: fonts.serif, fontSize: 19, color: colors.primary }, cardTitleWrap: { flex: 1 }, name: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary }, service: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 2 }, rate: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.primary, marginTop: spacing.md }, phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }, phoneIcon: { color: colors.textMuted }, phone: { marginLeft: spacing.xs, fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  label: { marginTop: spacing.md, marginBottom: spacing.xs, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.surface }, placeholder: { color: colors.textMuted }, notesInput: { minHeight: 86, textAlignVertical: 'top' }, choiceRow: { flexDirection: 'row', gap: spacing.sm }, choice: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }, choiceSelected: { backgroundColor: colors.blush, borderColor: colors.primary }, choiceText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary }, choiceTextSelected: { color: colors.primary }, removeButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs }, removeText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.danger },
});
