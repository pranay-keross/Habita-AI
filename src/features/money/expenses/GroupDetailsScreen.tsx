import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Plus from 'lucide-react-native/icons/plus';
import Receipt from 'lucide-react-native/icons/receipt';
import Users from 'lucide-react-native/icons/users';
import PieChart from 'lucide-react-native/icons/chart-pie';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import {
  getGroupSyncDetails,
} from '../expenseStore';
import type { Expense, ExpenseGroup, MemberBalance, PairwiseDebt } from '../types';

type Props = StackScreenProps<RootStackParamList, 'GroupDetails'>;

type TabKey = 'expenses' | 'balances' | 'summary';

export default function GroupDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<ExpenseGroup | undefined>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [pairwiseDebts, setPairwiseDebts] = useState<PairwiseDebt[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('expenses');

  const fetchDetail = async () => {
    setLoading(true);
    const details = await getGroupSyncDetails(groupId);
    if (details) {
      setGroup(details.group);
      setExpenses(details.expenses);
      setBalances(details.balances);
      setPairwiseDebts(details.pairwiseDebts);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDetail();
    });
    return unsubscribe;
  }, [navigation, groupId]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#004F63" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>Expense Group Not Found</Text>
      </View>
    );
  }

  const totalSpend = expenses.reduce((sum, e) => sum + e.baseAmountINR, 0);
  const myBal = balances.find((b) => b.memberId === 'usr_me');
  const myNet = myBal ? myBal.netBalanceINR : 0;

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.baseAmountINR;
  });

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{group.emoji} {group.name}</Text>
        <Pressable
          onPress={() => navigation.navigate('AddSplitExpense', { groupId: group.id })}
          style={styles.addNavBtn}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Hero Group Net Banner */}
      <View style={styles.groupHeroCard}>
        <Text style={styles.groupHeroLabel}>Group Total Spend</Text>
        <Text style={styles.groupHeroTotal}>
          ₹{totalSpend.toLocaleString('en-IN')}
        </Text>
        <View style={styles.myNetBadge}>
          {myNet > 0 ? (
            <Text style={styles.myNetGreen}>You get back ₹{myNet.toLocaleString('en-IN')}</Text>
          ) : myNet < 0 ? (
            <Text style={styles.myNetOrange}>You owe ₹{Math.abs(myNet).toLocaleString('en-IN')}</Text>
          ) : (
            <Text style={styles.myNetSettled}>You are all settled up</Text>
          )}
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.segmentedTabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'expenses' && styles.tabBtnActive]}
          onPress={() => setActiveTab('expenses')}>
          <Receipt size={16} color={activeTab === 'expenses' ? '#004F63' : styles.placeholder.color} />
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
            Expenses
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'balances' && styles.tabBtnActive]}
          onPress={() => setActiveTab('balances')}>
          <Users size={16} color={activeTab === 'balances' ? '#004F63' : styles.placeholder.color} />
          <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
            Balances
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'summary' && styles.tabBtnActive]}
          onPress={() => setActiveTab('summary')}>
          <PieChart size={16} color={activeTab === 'summary' ? '#004F63' : styles.placeholder.color} />
          <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>
            Summary
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* TAB 1: EXPENSES LOG */}
        {activeTab === 'expenses' && (
          <View>
            {expenses.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Receipt size={36} color={styles.placeholder.color} />
                <Text style={styles.emptyTitle}>No Expenses Yet</Text>
                <Text style={styles.emptySub}>Tap + to add your first split expense.</Text>
              </View>
            ) : (
              expenses.map((expense) => {
                const payerMember = group.members.find((m) => m.id === expense.paidByMemberId);
                const isPaidByMe = expense.paidByMemberId === 'usr_me';

                return (
                  <Pressable
                    key={expense.id}
                    style={styles.expenseCard}
                    onPress={() =>
                      navigation.navigate('ExpenseDetailsSettleUp', {
                        groupId: group.id,
                        expenseId: expense.id,
                      })
                    }>
                    <View style={styles.expenseRow}>
                      <View style={styles.expenseIconBadge}>
                        <Receipt size={20} color="#004F63" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.expenseTitle}>{expense.title}</Text>
                        <Text style={styles.expenseSub}>
                          {isPaidByMe ? 'You paid' : `${payerMember?.name || 'Someone'} paid`} ₹
                          {expense.baseAmountINR.toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <Text style={styles.expenseAmountText}>
                        ₹{expense.baseAmountINR.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: BALANCES & DEBT MATRIX */}
        {activeTab === 'balances' && (
          <View>
            <Text style={styles.sectionTitle}>Pairwise Debt Matrix</Text>
            {pairwiseDebts.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <HandCoins size={36} color="#16A34A" />
                <Text style={styles.emptyTitle}>All Settled Up!</Text>
                <Text style={styles.emptySub}>No member owes any money in this group.</Text>
              </View>
            ) : (
              pairwiseDebts.map((debt, index) => {
                return (
                  <View key={debt.id || index} style={styles.debtCard}>
                    <View style={styles.debtRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.debtText}>
                          <Text style={styles.boldText}>{debt.payerName}</Text> owes{' '}
                          <Text style={styles.boldText}>{debt.payeeName}</Text>
                        </Text>
                        <Text style={styles.debtAmount}>₹{debt.amountINR.toLocaleString('en-IN')}</Text>
                      </View>

                      <Pressable
                        style={styles.settleBtn}
                        onPress={() =>
                          navigation.navigate('ExpenseDetailsSettleUp', {
                            groupId: group.id,
                            settlePayerId: debt.payerId,
                            settlePayeeId: debt.payeeId,
                          })
                        }>
                        <Text style={styles.settleBtnText}>Settle Up</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: SPEND SUMMARY ANALYTICS */}
        {activeTab === 'summary' && (
          <View>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <View style={styles.card}>
              {Object.entries(categoryBreakdown).map(([cat, amt]) => (
                <View key={cat} style={styles.analyticsRow}>
                  <Text style={styles.analyticsCatName}>{cat.toUpperCase()}</Text>
                  <Text style={styles.analyticsCatAmt}>₹{amt.toLocaleString('en-IN')}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Member Net Balances</Text>
            <View style={styles.card}>
              {balances.map((b) => (
                <View key={b.memberId} style={styles.analyticsRow}>
                  <Text style={styles.analyticsCatName}>{b.memberName}</Text>
                  <Text
                    style={[
                      styles.analyticsCatAmt,
                      b.netBalanceINR > 0
                        ? { color: '#16A34A' }
                        : b.netBalanceINR < 0
                        ? { color: '#EA580C' }
                        : {},
                    ]}>
                    {b.netBalanceINR > 0
                      ? `+₹${b.netBalanceINR.toLocaleString('en-IN')}`
                      : b.netBalanceINR < 0
                      ? `-₹${Math.abs(b.netBalanceINR).toLocaleString('en-IN')}`
                      : 'Settled'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
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
    errorText: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
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
    addNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#004F63',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    groupHeroCard: {
      backgroundColor: '#004F63',
      borderRadius: 20,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      alignItems: 'center',
      ...shadow.medium,
    },
    groupHeroLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#99F6E4',
    },
    groupHeroTotal: {
      fontFamily: fonts.sansBold,
      fontSize: 26,
      color: '#FFFFFF',
      marginTop: 4,
    },
    myNetBadge: {
      marginTop: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    myNetGreen: { fontFamily: fonts.sansBold, fontSize: 12, color: '#86EFAC' },
    myNetOrange: { fontFamily: fonts.sansBold, fontSize: 12, color: '#FDBA74' },
    myNetSettled: { fontFamily: fonts.sansMedium, fontSize: 12, color: '#E2E8F0' },

    segmentedTabRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: 4,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 12,
    },
    tabBtnActive: {
      backgroundColor: '#E3F2F5',
    },
    tabText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    tabTextActive: {
      fontFamily: fonts.sansBold,
      color: '#004F63',
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    expenseCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    expenseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    expenseIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#E3F2F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    expenseTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    expenseSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    expenseAmountText: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    debtCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    debtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    debtText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
    },
    boldText: {
      fontFamily: fonts.sansBold,
    },
    debtAmount: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: '#EA580C',
      marginTop: 2,
    },
    settleBtn: {
      backgroundColor: '#004F63',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    settleBtnText: {
      color: '#FFFFFF',
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    analyticsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    analyticsCatName: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    analyticsCatAmt: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    emptyStateCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    emptyTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: 12,
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    placeholder: {
      color: colors.textMuted,
    },
  });
