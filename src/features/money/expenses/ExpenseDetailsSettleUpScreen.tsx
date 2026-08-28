import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import Button from '../../../components/Button';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Receipt from 'lucide-react-native/icons/receipt';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import Calendar from 'lucide-react-native/icons/calendar';
import User from 'lucide-react-native/icons/user';
import Trash2 from 'lucide-react-native/icons/trash-2';
import useAuth from '../../../hooks/useAuth';
import {
  calculateGroupBalances,
  deleteExpenseFromGroup,
  getGroupById,
  loadExpenses,
  loadSettlements,
  settlePairwiseDebt,
} from '../expenseStore';
import type { Expense, ExpenseGroup } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'ExpenseDetailsSettleUp'>;

type PaymentMethod = 'upi' | 'cash' | 'bank_transfer';

const PAYMENT_METHODS: { key: PaymentMethod; labelKey: string; icon: string }[] = [
  { key: 'upi', labelKey: 'expenses.method_upi', icon: '💳' },
  { key: 'cash', labelKey: 'expenses.method_cash', icon: '💵' },
  { key: 'bank_transfer', labelKey: 'expenses.method_bank_transfer', icon: '🏦' },
];

export default function ExpenseDetailsSettleUpScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { groupId, expenseId, settlePayerId, settlePayeeId, settleAmount: routeAmount } = route.params;
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<ExpenseGroup | undefined>();
  const [expense, setExpense] = useState<Expense | undefined>();
  const [settleAmountStr, setSettleAmountStr] = useState<string>(routeAmount ? String(routeAmount) : '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [settling, setSettling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSettleMode = !!(settlePayerId && settlePayeeId);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    const fetchData = async () => {
      setLoading(true);
      const token = await getAccessToken().catch(() => null);
      const g = await getGroupById(groupId, token);
      setGroup(g);
      if (expenseId) {
        const exps = await loadExpenses(groupId);
        const e = exps.find((item) => item.id === expenseId);
        setExpense(e);
      }
      if (isSettleMode && !routeAmount && g) {
        const exps = await loadExpenses(groupId);
        const sets = await loadSettlements(groupId);
        const { pairwiseDebts } = calculateGroupBalances(g, exps, sets);
        const debt = pairwiseDebts.find((d) => d.payerId === settlePayerId && d.payeeId === settlePayeeId);
        if (debt) setSettleAmountStr(String(debt.amountINR));
      }
      setLoading(false);
    };
    fetchData();
    return () => {
      unsubLang();
    };
  }, [groupId, expenseId, isSettleMode, routeAmount, settlePayerId, settlePayeeId, getAccessToken]);

  if (loading || !group) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={styles.settleHeroTitle.color} />
      </View>
    );
  }

  const payerMember = settlePayerId ? group.members.find((m) => m.id === settlePayerId) : null;
  const payeeMember = settlePayeeId ? group.members.find((m) => m.id === settlePayeeId) : null;

  const handleConfirmSettleUp = async () => {
    if (!settlePayerId || !settlePayeeId) return;

    const amt = parseFloat(settleAmountStr);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert(t('expenses.invalid_settle_amount'), t('expenses.invalid_settle_amount_msg'));
      return;
    }

    setSettling(true);
    const token = await getAccessToken().catch(() => null);
    await settlePairwiseDebt(group.id, settlePayerId, settlePayeeId, amt, paymentMethod, token);
    setSettling(false);

    const pmMeta = PAYMENT_METHODS.find((p) => p.key === paymentMethod);
    const methodStr = pmMeta ? t(pmMeta.labelKey) : paymentMethod.toUpperCase();

    Alert.alert(
      t('expenses.settlement_recorded_title'),
      t('expenses.settlement_recorded_msg', {
        payer: payerMember?.name,
        payee: payeeMember?.name,
        method: methodStr,
      }),
    );
    navigation.goBack();
  };

  const handleDeleteExpense = () => {
    if (!expense) return;
    Alert.alert(
      t('expenses.delete_expense_title'),
      t('expenses.delete_expense_confirm', { title: expense.title }),
      [
        { text: t('expenses.cancel_btn'), style: 'cancel' },
        {
          text: t('expenses.delete_btn'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const token = await getAccessToken().catch(() => null);
            await deleteExpenseFromGroup(groupId, expense.id, token);
            setDeleting(false);
            navigation.goBack();
          },
        },
      ],
    );
  };


  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isSettleMode ? t('expenses.record_settlement') : t('expenses.expense_details')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isSettleMode ? (
          /* SETTLE UP MODE */
          <View>
            <View style={styles.settleHeroCard}>
              <HandCoins size={36} color={styles.settleHeroTitle.color} />
              <Text style={styles.settleHeroTitle}>{t('expenses.debt_settlement_title')}</Text>
              <Text style={styles.settleHeroSub}>
                {t('expenses.is_paying_text', { payer: payerMember?.name, payee: payeeMember?.name })}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>{t('expenses.settlement_amount_inr')}</Text>
            <View style={styles.card}>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.amountTextInput}
                  value={settleAmountStr}
                  onChangeText={setSettleAmountStr}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={styles.placeholder.color}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>{t('expenses.select_payment_method')}</Text>
            <View style={styles.card}>
              {PAYMENT_METHODS.map((pm) => (
                <Pressable
                  key={pm.key}
                  style={[
                    styles.methodRow,
                    paymentMethod === pm.key && styles.methodRowActive,
                  ]}
                  onPress={() => setPaymentMethod(pm.key)}>
                  <Text style={{ fontSize: 18 }}>{pm.icon}</Text>
                  <Text
                    style={[
                      styles.methodText,
                      paymentMethod === pm.key && styles.methodTextActive,
                    ]}>
                    {t(pm.labelKey)}
                  </Text>
                  {paymentMethod === pm.key && <CheckCircle2 size={18} color={styles.settleHeroTitle.color} />}
                </Pressable>
              ))}
            </View>

            <Button
              title={t('expenses.record_payment_btn')}
              onPress={handleConfirmSettleUp}
              loading={settling}
              style={{ marginTop: 24 }}
            />
          </View>
        ) : (
          /* EXPENSE DETAILS ITEMIZATION */
          expense && (
            <View>
              {/* Expense Hero Card */}
              <View style={styles.expenseHeroCard}>
                <View style={styles.iconBadge}>
                  <Receipt size={28} color={styles.settleHeroTitle.color} />
                </View>
                <Text style={styles.expenseTitle}>{expense.title}</Text>
                <Text style={styles.expenseAmountText}>
                  {expense.currency !== 'INR'
                    ? `${expense.currency} ${expense.amount.toLocaleString()} (~₹${(expense.baseAmountINR || expense.amount).toLocaleString('en-IN')})`
                    : `₹${expense.amount.toLocaleString('en-IN')}`}
                </Text>
                <Text style={styles.expenseCategoryPill}>{expense.category.toUpperCase()}</Text>
              </View>

              {/* Meta Card */}
              <Text style={styles.sectionTitle}>{t('expenses.metadata_title')}</Text>
              <View style={styles.card}>
                <View style={styles.metaRow}>
                  <User size={16} color={styles.placeholder.color} />
                  <Text style={styles.metaKey}>{t('expenses.paid_by')}</Text>
                  <Text style={styles.metaVal}>
                    {group.members.find((m) => m.id === expense.paidByMemberId)?.name || 'Member'}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <Calendar size={16} color={styles.placeholder.color} />
                  <Text style={styles.metaKey}>{t('expenses.date_logged')}</Text>
                  <Text style={styles.metaVal}>{expense.date}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <Receipt size={16} color={styles.placeholder.color} />
                  <Text style={styles.metaKey}>{t('expenses.split_mode')}</Text>
                  <Text style={styles.metaVal}>{expense.splitType.toUpperCase()}</Text>
                </View>
              </View>

              {/* Itemized Splits Card */}
              <Text style={styles.sectionTitle}>{t('expenses.itemized_shares')}</Text>
              <View style={styles.card}>
                {expense.shares.map((share) => {
                  const member = group.members.find((m) => m.id === share.memberId);
                  return (
                    <View key={share.memberId} style={styles.splitShareRow}>
                      <Text style={styles.splitMemberName}>{member?.name || share.memberId}</Text>
                      <Text style={styles.splitMemberShare}>₹{share.amount.toLocaleString('en-IN')}</Text>
                    </View>
                  );
                })}
              </View>

              <Button
                title={t('expenses.delete_expense_btn')}
                variant="outline"
                onPress={handleDeleteExpense}
                loading={deleting}
                style={{ marginTop: 24, borderColor: '#EF4444' }}
              />
            </View>
          )
        )}
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
    settleHeroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    settleHeroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.primary,
      marginTop: 8,
    },
    boldText: {
      fontFamily: fonts.sansBold,
    },
    settleHeroSub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
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
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    currencyPrefix: {
      fontFamily: fonts.sansBold,
      fontSize: 24,
      color: colors.textPrimary,
      marginRight: 8,
    },
    amountTextInput: {
      flex: 1,
      fontFamily: fonts.sansBold,
      fontSize: 24,
      color: colors.textPrimary,
      padding: 0,
    },
    methodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    methodRowActive: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    methodText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1,
    },
    methodTextActive: {
      fontFamily: fonts.sansBold,
      color: colors.primary,
    },
    expenseHeroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      ...shadow.soft,
    },
    iconBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    expenseTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    expenseAmountText: {
      fontFamily: fonts.sansBold,
      fontSize: 26,
      color: colors.textPrimary,
      marginTop: 4,
    },
    expenseCategoryPill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      color: colors.primary,
      fontFamily: fonts.sansBold,
      fontSize: 11,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginTop: 8,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 10,
    },
    metaKey: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    metaVal: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    splitShareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    splitMemberName: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    splitMemberShare: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    placeholder: {
      color: colors.textMuted,
    },
  });
