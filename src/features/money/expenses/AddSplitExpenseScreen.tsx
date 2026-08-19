import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import Button from '../../../components/Button';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import IndianRupee from 'lucide-react-native/icons/indian-rupee';
import DollarSign from 'lucide-react-native/icons/dollar-sign';
import Check from 'lucide-react-native/icons/check';
import { addExpenseToGroup, getGroupById } from '../expenseStore';
import type { Currency, ExpenseGroup } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'AddSplitExpense'>;

type SplitMode = 'equal' | 'percentage' | 'shares';

const CURRENCIES: { code: Currency; symbol: string; rateToINR: number }[] = [
  { code: 'INR', symbol: '₹', rateToINR: 1 },
  { code: 'USD', symbol: '$', rateToINR: 83.5 },
  { code: 'EUR', symbol: '€', rateToINR: 90.2 },
  { code: 'AED', symbol: 'AED ', rateToINR: 22.7 },
  { code: 'GBP', symbol: '£', rateToINR: 105.8 },
];

export default function AddSplitExpenseScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<ExpenseGroup | undefined>();
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [payerId, setPayerId] = useState('m_1');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [category, setCategory] = useState('food');
  const [saving, setSaving] = useState(false);

  // Split details map
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    const fetchGroup = async () => {
      setLoading(true);
      const g = await getGroupById(groupId);
      setGroup(g);
      if (g) {
        const initPct: Record<string, string> = {};
        const initShares: Record<string, string> = {};
        const equalShare = (100 / g.members.length).toFixed(1);
        g.members.forEach((m) => {
          initPct[m.id] = equalShare;
          initShares[m.id] = '1';
        });
        setPercentages(initPct);
        setShares(initShares);
      }
      setLoading(false);
    };
    fetchGroup();
    return () => {
      unsubLang();
    };
  }, [groupId]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a description for the expense.');
      return;
    }
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }
    if (!group) return;

    // Convert amount to INR if multi-currency
    const currMeta = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
    const amountInINR = Math.round(amt * currMeta.rateToINR);

    // Compute splits map
    const splits: Record<string, number> = {};

    if (splitMode === 'equal') {
      const perHead = Math.round((amountInINR / group.members.length) * 100) / 100;
      group.members.forEach((m) => {
        splits[m.id] = perHead;
      });
    } else if (splitMode === 'percentage') {
      let totalPct = 0;
      group.members.forEach((m) => {
        const p = parseFloat(percentages[m.id] || '0');
        totalPct += p;
        splits[m.id] = Math.round((amountInINR * p) / 100);
      });
      if (Math.abs(totalPct - 100) > 1) {
        Alert.alert('Invalid Percentage', `Percentages must sum to 100%. Current sum: ${totalPct}%`);
        return;
      }
    } else if (splitMode === 'shares') {
      let totalShares = 0;
      group.members.forEach((m) => {
        const s = parseFloat(shares[m.id] || '1');
        totalShares += s;
      });
      group.members.forEach((m) => {
        const s = parseFloat(shares[m.id] || '1');
        splits[m.id] = Math.round((amountInINR * s) / (totalShares || 1));
      });
    }

    setSaving(true);
    await addExpenseToGroup(group.id, {
      title: title.trim(),
      amount: amountInINR,
      currency,
      payerId,
      splitMode,
      splits,
      category,
      date: new Date().toISOString().split('T')[0],
    });
    setSaving(false);

    Alert.alert('Expense Added!', `₹${amountInINR.toLocaleString('en-IN')} added to ${group.name}`);
    navigation.goBack();
  };

  if (loading || !group) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#004F63" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('expenses.add_expense_header')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Pill Header */}
        <View style={styles.groupPill}>
          <Text style={styles.groupPillText}>Adding to {group.emoji} {group.name}</Text>
        </View>

        {/* Amount Input */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t('expenses.amount_label')}</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencySymbolText}>
              {CURRENCIES.find((c) => c.code === currency)?.symbol}
            </Text>
            <TextInput
              style={styles.amountInput}
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={styles.placeholder.color}
            />
          </View>

          {/* Currency Multi-Select Row */}
          <View style={styles.currencyRow}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c.code}
                style={[
                  styles.currencyChip,
                  currency === c.code && styles.currencyChipActive,
                ]}
                onPress={() => setCurrency(c.code)}>
                <Text
                  style={[
                    styles.currencyChipText,
                    currency === c.code && styles.currencyChipTextActive,
                  ]}>
                  {c.code} ({c.symbol.trim()})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Title Input */}
        <Text style={styles.sectionTitle}>{t('expenses.expense_title_label')}</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder={t('expenses.expense_title_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        {/* Paid By Selector */}
        <Text style={styles.sectionTitle}>{t('expenses.paid_by_label')}</Text>
        <View style={styles.card}>
          {group.members.map((member) => (
            <Pressable
              key={member.id}
              style={[
                styles.payerRow,
                payerId === member.id && styles.payerRowActive,
              ]}
              onPress={() => setPayerId(member.id)}>
              <Text
                style={[
                  styles.payerText,
                  payerId === member.id && styles.payerTextActive,
                ]}>
                {member.name} {member.id === 'm_1' ? '(You)' : ''}
              </Text>
              {payerId === member.id && <Check size={18} color="#004F63" />}
            </Pressable>
          ))}
        </View>

        {/* Split Mode Selector */}
        <Text style={styles.sectionTitle}>{t('expenses.split_mode_label')}</Text>
        <View style={styles.segmentedRow}>
          {(['equal', 'percentage', 'shares'] as SplitMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.splitModeBtn,
                splitMode === mode && styles.splitModeBtnActive,
              ]}
              onPress={() => setSplitMode(mode)}>
              <Text
                style={[
                  styles.splitModeText,
                  splitMode === mode && styles.splitModeTextActive,
                ]}>
                {mode === 'equal' ? t('expenses.mode_equal') : mode === 'percentage' ? t('expenses.mode_percentage') : t('expenses.mode_shares')}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Mode Specific Custom Inputs */}
        {splitMode === 'percentage' && (
          <View style={styles.card}>
            <Text style={styles.splitNoticeText}>Enter percentage share per member (Sum must be 100%)</Text>
            {group.members.map((m) => (
              <View key={m.id} style={styles.splitInputRow}>
                <Text style={styles.splitMemberLabel}>{m.name}</Text>
                <TextInput
                  style={styles.splitSmallInput}
                  value={percentages[m.id] || ''}
                  onChangeText={(val) => setPercentages({ ...percentages, [m.id]: val })}
                  keyboardType="decimal-pad"
                  placeholder="%"
                />
              </View>
            ))}
          </View>
        )}

        {splitMode === 'shares' && (
          <View style={styles.card}>
            <Text style={styles.splitNoticeText}>Enter weight multiplier (e.g. 1 share, 2 shares)</Text>
            {group.members.map((m) => (
              <View key={m.id} style={styles.splitInputRow}>
                <Text style={styles.splitMemberLabel}>{m.name}</Text>
                <TextInput
                  style={styles.splitSmallInput}
                  value={shares[m.id] || '1'}
                  onChangeText={(val) => setShares({ ...shares, [m.id]: val })}
                  keyboardType="number-pad"
                  placeholder="Shares"
                />
              </View>
            ))}
          </View>
        )}

        {/* Save Action */}
        <Button
          title={t('expenses.save_expense_btn')}
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    headerIcon: {
      color: colors.textPrimary,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    groupPill: {
      backgroundColor: '#E0F2FE',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    groupPillText: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: '#0284C7',
    },
    amountCard: {
      backgroundColor: '#054E63',
      borderRadius: 20,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow.medium,
    },
    amountLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#99F6E4',
    },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    currencySymbolText: {
      fontFamily: fonts.sansBold,
      fontSize: 32,
      color: '#FFFFFF',
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontFamily: fonts.sansBold,
      fontSize: 32,
      color: '#FFFFFF',
    },
    currencyRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 14,
      flexWrap: 'wrap',
    },
    currencyChip: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    currencyChipActive: {
      backgroundColor: '#FFFFFF',
    },
    currencyChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: '#FFFFFF',
    },
    currencyChipTextActive: {
      color: '#054E63',
      fontFamily: fonts.sansBold,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    textInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: fonts.sans,
    },
    payerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    payerRowActive: {
      backgroundColor: '#E3F2F5',
    },
    payerText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    payerTextActive: {
      color: '#004F63',
      fontFamily: fonts.sansBold,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: spacing.md,
    },
    splitModeBtn: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 10,
      alignItems: 'center',
    },
    splitModeBtnActive: {
      backgroundColor: '#004F63',
      borderColor: '#004F63',
    },
    splitModeText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    splitModeTextActive: {
      fontFamily: fonts.sansBold,
      color: '#FFFFFF',
    },
    splitNoticeText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    splitInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    splitMemberLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    splitSmallInput: {
      width: 70,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 6,
      textAlign: 'center',
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    placeholder: {
      color: colors.textMuted,
    },
  });
