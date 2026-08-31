import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
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
import { SkeletonCard, SkeletonHeroCard } from '../../../components/Skeleton';
import Pagination from '../../../components/Pagination';
import { getGroupIconComponent } from './groupIcons';
import useAuth from '../../../hooks/useAuth';
import { getItem } from '../../../utils/storage';
import {
  findCurrentUserMember,
  getGroupSyncDetails,
  groupExpensesByDate,
  loadExpensesPage,
} from '../expenseStore';
import type { Expense, ExpenseGroup, MemberBalance, PairwiseDebt, RelationshipBalance } from '../types';
import Avatar from '../../../components/Avatar';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'GroupDetails'>;

type TabKey = 'expenses' | 'balances' | 'summary';

const EXPENSES_PAGE_SIZE = 10;

export default function GroupDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('You');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<ExpenseGroup | undefined>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [pairwiseDebts, setPairwiseDebts] = useState<PairwiseDebt[]>([]);
  const [relationshipBalances, setRelationshipBalances] = useState<RelationshipBalance[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});
  const [remoteTotalSpend, setRemoteTotalSpend] = useState<number | null>(null);
  const [remoteUserNet, setRemoteUserNet] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('expenses');
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesPageItems, setExpensesPageItems] = useState<Expense[]>([]);
  const [expensesPageTotalPages, setExpensesPageTotalPages] = useState(1);
  const [expensesPageTotalElements, setExpensesPageTotalElements] = useState(0);
  const expensesPageRef = useRef(1);
  useEffect(() => {
    expensesPageRef.current = expensesPage;
  }, [expensesPage]);

  const fetchExpensesPage = async (page: number, tokenOverride?: string | null) => {
    const token = tokenOverride !== undefined ? tokenOverride : await getAccessToken().catch(() => null);
    const result = await loadExpensesPage(groupId, page, EXPENSES_PAGE_SIZE, token);
    setExpensesPageItems(result.items);
    setExpensesPageTotalPages(result.totalPages);
    setExpensesPageTotalElements(result.totalElements);
  };

  const fetchDetail = async () => {
    const token = await getAccessToken().catch(() => null);
    const prof = await getItem<{ name?: string }>('habita.user_profile', {});
    if (prof?.name) setCurrentUserName(prof.name);
    const sess = await getItem<{ userId?: string }>('habita.session', {});
    if (sess?.userId) setCurrentUserId(sess.userId);

    const details = await getGroupSyncDetails(groupId, token);
    if (details) {
      setGroup(details.group);
      setExpenses(details.expenses);
      setBalances(details.balances);
      setPairwiseDebts(details.pairwiseDebts);
      setRelationshipBalances(details.relationshipBalances || []);
      if ('totalSpendINR' in details && typeof details.totalSpendINR === 'number') {
        setRemoteTotalSpend(details.totalSpendINR);
      }
      if ('userNetBalanceINR' in details && typeof details.userNetBalanceINR === 'number') {
        setRemoteUserNet(details.userNetBalanceINR);
      }
      if ('categoryBreakdown' in details && details.categoryBreakdown && Object.keys(details.categoryBreakdown).length > 0) {
        setCategoryBreakdown(details.categoryBreakdown);
      } else {
        const computedCats: Record<string, number> = {};
        details.expenses.forEach((e) => {
          computedCats[e.category] = (computedCats[e.category] || 0) + (e.baseAmountINR || e.amount || 0);
        });
        setCategoryBreakdown(computedCats);
      }
    }
    await fetchExpensesPage(expensesPageRef.current, token);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDetail();
    setRefreshing(false);
  }, [groupId]);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDetail();
    });
    return () => {
      unsubLang();
      unsubscribe();
    };
  }, [navigation, groupId]);

  const didMountExpensesPageEffect = useRef(false);
  useEffect(() => {
    if (!didMountExpensesPageEffect.current) {
      didMountExpensesPageEffect.current = true;
      return;
    }
    fetchExpensesPage(expensesPage);
  }, [expensesPage]);

  // If deleting an expense shrinks the list below the page currently being viewed, drop
  // back to the new last page — this also re-triggers the effect above to refetch it.
  useEffect(() => {
    if (expensesPage > expensesPageTotalPages) {
      setExpensesPage(expensesPageTotalPages);
    }
  }, [expensesPageTotalPages]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ArrowLeft size={20} color={styles.headerIcon.color} />
          </Pressable>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{ paddingTop: 8 }}>
            <SkeletonHeroCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{t('expenses.group_not_found')}</Text>
      </View>
    );
  }

  const totalSpend = remoteTotalSpend ?? expenses.reduce((sum, e) => sum + (e.baseAmountINR || e.amount || 0), 0);
  const myMember = findCurrentUserMember(group.members, currentUserId, currentUserName);
  const myBal = myMember ? balances.find((b) => b.memberId === myMember.id) : null;
  const myNet = remoteUserNet !== null ? remoteUserNet : (myBal ? myBal.netBalanceINR : 0);

  const owedToYou = myMember ? relationshipBalances.filter((r) => r.payeeId === myMember.id) : [];
  const owedByYou = myMember ? relationshipBalances.filter((r) => r.payerId === myMember.id) : [];
  const settledMembers = myMember
    ? (group.members || []).filter(
        (m) =>
          m.id !== myMember.id &&
          !owedToYou.some((r) => r.payerId === m.id) &&
          !owedByYou.some((r) => r.payeeId === m.id),
      )
    : [];

  const expenseDateGroups = groupExpensesByDate(expensesPageItems);


  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <View style={styles.headerTitleRow}>
          {(() => {
            const GroupIcon = getGroupIconComponent(group.emoji);
            return <GroupIcon size={18} color={styles.headerTitle.color} />;
          })()}
          <Text style={styles.headerTitle}>{group.name}</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('AddSplitExpense', { groupId: group.id })}
          style={styles.addNavBtn}>
          <Plus size={20} color={styles.addNavBtnText.color} />
        </Pressable>
      </View>

      {/* Hero Group Net Banner */}
      <View style={styles.groupHeroCard}>
        <Text style={styles.groupHeroLabel}>{t('expenses.group_total_spend')}</Text>
        <Text style={styles.groupHeroTotal}>
          ₹{totalSpend.toLocaleString('en-IN')}
        </Text>
        <View style={styles.myNetBadge}>
          {myNet > 0 ? (
            <Text style={styles.myNetGreen}>{t('expenses.you_get_back_amount', { amount: myNet.toLocaleString('en-IN') })}</Text>
          ) : myNet < 0 ? (
            <Text style={styles.myNetOrange}>{t('expenses.you_owe_amount', { amount: Math.abs(myNet).toLocaleString('en-IN') })}</Text>
          ) : (
            <Text style={styles.myNetSettled}>{t('expenses.all_settled_up_msg')}</Text>
          )}
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.segmentedTabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'expenses' && styles.tabBtnActive]}
          onPress={() => setActiveTab('expenses')}>
          <Receipt size={16} color={activeTab === 'expenses' ? styles.tabTextActive.color : styles.placeholder.color} />
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
            {t('expenses.tab_expenses')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'balances' && styles.tabBtnActive]}
          onPress={() => setActiveTab('balances')}>
          <Users size={16} color={activeTab === 'balances' ? styles.tabTextActive.color : styles.placeholder.color} />
          <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
            {t('expenses.tab_balances')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'summary' && styles.tabBtnActive]}
          onPress={() => setActiveTab('summary')}>
          <PieChart size={16} color={activeTab === 'summary' ? styles.tabTextActive.color : styles.placeholder.color} />
          <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>
            {t('expenses.tab_summary')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={styles.tabTextActive.color}
          />
        }>
        {/* TAB 1: EXPENSES LOG */}
        {activeTab === 'expenses' && (
          <View>
            {expensesPageTotalElements === 0 ? (
              <View style={styles.emptyStateCard}>
                <Receipt size={36} color={styles.placeholder.color} />
                <Text style={styles.emptyTitle}>{t('expenses.no_expenses_title')}</Text>
                <Text style={styles.emptySub}>{t('expenses.no_expenses_sub')}</Text>
              </View>
            ) : (
              <>
                {expenseDateGroups.map((dateGroup) => (
                  <View key={dateGroup.dateKey}>
                    <Text style={styles.dateGroupLabel}>{dateGroup.label}</Text>
                    {dateGroup.expenses.map((expense) => {
                      const payerMember = (group.members || []).find((m) => m.id === expense.paidByMemberId);
                      const isPaidByMe = myMember ? expense.paidByMemberId === myMember.id : false;
                      const displayAmt = expense.baseAmountINR ?? expense.amount ?? 0;

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
                              <Receipt size={20} color={styles.tabTextActive.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.expenseTitle}>{expense.title}</Text>
                              <Text style={styles.expenseSub}>
                                {isPaidByMe
                                  ? `${t('expenses.you_paid')} ₹${displayAmt.toLocaleString('en-IN')}`
                                  : `${t('expenses.someone_paid', { name: payerMember?.name || 'Someone' })} ₹${displayAmt.toLocaleString('en-IN')}`}
                              </Text>
                            </View>
                            <Text style={styles.expenseAmountText}>
                              ₹{displayAmt.toLocaleString('en-IN')}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
                <Pagination
                  currentPage={expensesPage}
                  totalPages={expensesPageTotalPages}
                  onPageChange={setExpensesPage}
                />
              </>
            )}
          </View>
        )}

        {/* TAB 2: BALANCES & DEBT MATRIX */}
        {activeTab === 'balances' && (
          <View>
            {owedToYou.length === 0 && owedByYou.length === 0 && settledMembers.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <HandCoins size={36} color={styles.forestColor.color} />
                <Text style={styles.emptyTitle}>{t('expenses.all_settled_title')}</Text>
                <Text style={styles.emptySub}>{t('expenses.no_relationships_sub')}</Text>
              </View>
            ) : (
              <>
                {owedToYou.length > 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>{t('expenses.owed_to_you_title')}</Text>
                    {owedToYou.map((r) => (
                      <View key={r.id} style={styles.debtCard}>
                        <View style={styles.debtRow}>
                          <Avatar name={r.payerName} size={32} style={styles.relationshipAvatar} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.debtText}>{r.payerName}</Text>
                            <Text style={[styles.debtAmount, styles.netPositiveText]}>
                              ₹{r.amountINR.toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.settleBtn}
                            onPress={() =>
                              navigation.navigate('ExpenseDetailsSettleUp', {
                                groupId: group.id,
                                settlePayerId: r.payerId,
                                settlePayeeId: r.payeeId,
                                settleAmount: r.amountINR,
                              })
                            }>
                            <Text style={styles.settleBtnText}>{t('expenses.settle_up_btn')}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {owedByYou.length > 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>{t('expenses.owed_by_you_title')}</Text>
                    {owedByYou.map((r) => (
                      <View key={r.id} style={styles.debtCard}>
                        <View style={styles.debtRow}>
                          <Avatar name={r.payeeName} size={32} style={styles.relationshipAvatar} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.debtText}>{r.payeeName}</Text>
                            <Text style={[styles.debtAmount, styles.netNegativeText]}>
                              ₹{r.amountINR.toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.settleBtn}
                            onPress={() =>
                              navigation.navigate('ExpenseDetailsSettleUp', {
                                groupId: group.id,
                                settlePayerId: r.payerId,
                                settlePayeeId: r.payeeId,
                                settleAmount: r.amountINR,
                              })
                            }>
                            <Text style={styles.settleBtnText}>{t('expenses.settle_up_btn')}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {settledMembers.length > 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>{t('expenses.settled_title')}</Text>
                    {settledMembers.map((m) => (
                      <View key={m.id} style={styles.settledRow}>
                        <Avatar name={m.name} size={32} style={styles.relationshipAvatar} />
                        <Text style={styles.settledText}>{m.name}</Text>
                        <Text style={styles.settledBadge}>{t('expenses.settled_title')}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {pairwiseDebts.length > 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>{t('expenses.recommended_settlements_title')}</Text>
                    {pairwiseDebts.map((debt, index) => (
                      <View key={debt.id || index} style={styles.debtCard}>
                        <View style={styles.debtRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.debtText}>
                              {t('expenses.owes_text', { payer: debt.payerName, payee: debt.payeeName })}
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
                                settleAmount: debt.amountINR,
                              })
                            }>
                            <Text style={styles.settleBtnText}>{t('expenses.settle_up_btn')}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 3: SPEND SUMMARY ANALYTICS */}
        {activeTab === 'summary' && (
          <View>
            <Text style={styles.sectionTitle}>{t('expenses.cat_breakdown_title')}</Text>
            <View style={styles.card}>
              {Object.entries(categoryBreakdown).map(([cat, amt]) => (
                <View key={cat} style={styles.analyticsRow}>
                  <Text style={styles.analyticsCatName}>{cat.toUpperCase()}</Text>
                  <Text style={styles.analyticsCatAmt}>₹{amt.toLocaleString('en-IN')}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('expenses.member_net_balances')}</Text>
            <View style={styles.card}>
              {balances.map((b) => (
                <View key={b.memberId} style={styles.analyticsRow}>
                  <Text style={styles.analyticsCatName}>{b.memberName}</Text>
                  <Text
                    style={[
                      styles.analyticsCatAmt,
                      b.netBalanceINR > 0
                        ? styles.netPositiveText
                        : b.netBalanceINR < 0
                        ? styles.netNegativeText
                        : {},
                    ]}>
                    {b.netBalanceINR > 0
                      ? `+₹${b.netBalanceINR.toLocaleString('en-IN')}`
                      : b.netBalanceINR < 0
                      ? `-₹${Math.abs(b.netBalanceINR).toLocaleString('en-IN')}`
                      : t('expenses.settled_up')}
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
    forestColor: {
      color: colors.forest,
    },
    netPositiveText: {
      color: colors.forest,
    },
    netNegativeText: {
      color: colors.danger,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    addNavBtnText: {
      color: colors.textOnPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    groupHeroCard: {
      backgroundColor: colors.primary,
      borderRadius: 24,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      marginHorizontal: spacing.lg,
      ...shadow.soft,
    },
    groupHeroLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textOnPrimaryMuted,
    },
    groupHeroTotal: {
      fontFamily: fonts.sansBold,
      fontSize: 26,
      color: colors.textOnPrimary,
      marginTop: 4,
    },
    groupEmojiCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    groupEmojiText: {
      fontSize: 32,
    },
    groupTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 20,
      color: colors.textOnPrimary,
    },
    groupSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textOnPrimaryMuted,
      marginTop: 2,
    },
    myNetBadge: {
      marginTop: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    myNetGreen: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textOnPrimary },
    myNetOrange: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textOnPrimaryMuted },
    myNetSettled: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textOnPrimaryMuted },

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
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    tabTextActive: {
      fontFamily: fonts.sansBold,
      color: colors.primary,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    dateGroupLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textMuted,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
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
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
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
      gap: 10,
    },
    relationshipAvatar: {
      marginRight: 2,
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
      color: colors.danger,
      marginTop: 2,
    },
    settleBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
    },
    settleBtnText: {
      color: colors.textOnPrimary,
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
    },
    settledRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    settledText: {
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    settledBadge: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textMuted,
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
    greenText: {
      color: colors.forest,
    },
  });
