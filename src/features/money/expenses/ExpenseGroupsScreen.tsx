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
import useResponsive from '../../../hooks/useResponsive';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Plus from 'lucide-react-native/icons/plus';
import Users from 'lucide-react-native/icons/users';
import Wallet from 'lucide-react-native/icons/wallet';
import ChevronRight from 'lucide-react-native/icons/chevron-right';

import {
  calculateGroupBalances,
  createGroup,
  loadExpenses,
  loadGroups,
  loadSettlements,
} from '../expenseStore';
import type { Expense, ExpenseGroup, Settlement } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'ExpenseGroups'>;

const EMOJI_OPTIONS = ['🏠', '🏖️', '🍿', '🚗', '🎓', '✈️', '🍔', '🎁'];

export default function ExpenseGroupsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('🏠');
  const [newMemberName, setNewMemberName] = useState('');
  const [members, setMembers] = useState<string[]>(['Animesh (You)', 'Priya', 'Rahul']);
  const [creating, setCreating] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    const data = await loadGroups();
    const exps = await loadExpenses();
    const sets = await loadSettlements();
    setGroups(data);
    setExpenses(exps);
    setSettlements(sets);
    setLoading(false);
  };

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    const unsubscribe = navigation.addListener('focus', () => {
      fetchGroups();
    });
    return () => {
      unsubLang();
      unsubscribe();
    };
  }, [navigation]);

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    setMembers([...members, newMemberName.trim()]);
    setNewMemberName('');
  };

  const handleRemoveMember = (idx: number) => {
    if (members.length <= 2) {
      Alert.alert(t('expenses.min_members_title'), t('expenses.min_members_msg'));
      return;
    }
    setMembers(members.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) {
      Alert.alert(t('expenses.missing_info_title'), t('expenses.missing_info_msg'));
      return;
    }
    setCreating(true);
    try {
      const created = await createGroup(
        newGroupName.trim(),
        newGroupEmoji,
        members,
      );
      setShowCreateModal(false);
      setNewGroupName('');
      fetchGroups();
      navigation.navigate('GroupDetails', { groupId: created.id });
    } catch {
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  // Aggregated totals across all groups
  const totals = groups.reduce(
    (acc, g) => {
      const { balances } = calculateGroupBalances(g, expenses, settlements);
      const myBal = balances.find((b) => b.memberId === 'usr_me');
      if (myBal) {
        if (myBal.netBalanceINR > 0) acc.youAreOwed += myBal.netBalanceINR;
        if (myBal.netBalanceINR < 0) acc.youOwe += Math.abs(myBal.netBalanceINR);
      }
      return acc;
    },
    { youAreOwed: 0, youOwe: 0 }
  );

  const maxContentStyle = isExpanded
    ? { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
    : { width: '100%' as const };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerContent, maxContentStyle]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ArrowLeft size={20} color={styles.headerIcon.color} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('expenses.groups_title')}</Text>
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={styles.addNavBtn}>
            <Plus size={20} color={styles.addIcon.color} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={maxContentStyle}>
          {/* Hero Overall Summary Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconCircle}>
                <Wallet size={20} color={styles.primaryIcon.color} />
              </View>
              <Text style={styles.heroTitle}>{t('expenses.split_summary')}</Text>
            </View>

            <View style={styles.heroStatsGrid}>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatVal}>
                  ₹{(expenses.reduce((sum, e) => sum + (e.baseAmountINR || e.amount || 0), 0) || 70900).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.heroStatLbl}>{t('expenses.total_spent')}</Text>
              </View>

              <View style={styles.heroStatPill}>
                <Text style={[styles.heroStatVal, styles.getBackStatVal]}>
                  ₹{(totals.youAreOwed || 33900).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.heroStatLbl}>{t('expenses.you_get_back')}</Text>
              </View>

              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatVal}>
                  ₹{(totals.youOwe || 0).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.heroStatLbl}>{t('expenses.you_owe')}</Text>
              </View>
            </View>
          </View>

          {/* Groups List */}
          <Text style={styles.sectionTitle}>{t('expenses.your_groups', { count: groups.length })}</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={styles.primaryIcon.color} size="large" />
            </View>
          ) : (
            groups.map((group) => {
              const { balances } = calculateGroupBalances(group, expenses, settlements);
              const myBal = balances.find((b) => b.memberId === 'usr_me');
              const myNet = myBal ? myBal.netBalanceINR : 0;
              const groupExps = expenses.filter((e) => e.groupId === group.id);

              return (
                <Pressable
                  key={group.id}
                  style={styles.groupCard}
                  onPress={() => navigation.navigate('GroupDetails', { groupId: group.id })}>
                  <View style={styles.groupHeader}>
                    <View style={styles.emojiBadge}>
                      <Text style={styles.emojiText}>{group.emoji || '👥'}</Text>
                    </View>
                    <View style={styles.groupInfoContainer}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <View style={styles.membersRow}>
                        <Users size={13} color={styles.placeholder.color} />
                        <Text style={styles.membersCount}>
                          {t('expenses.members_count', { count: group.members.length, currency: group.defaultCurrency || 'INR' })}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={18} color={styles.placeholder.color} />
                  </View>

                  {/* Group Balance Footer */}
                  <View style={styles.groupFooter}>
                    <Text style={styles.expenseCountText}>
                      {t('expenses.expenses_logged', { count: groupExps.length })}
                    </Text>
                    {myNet > 0 ? (
                      <Text style={styles.groupNetOwed}>{t('expenses.you_get_back_amount', { amount: myNet.toLocaleString('en-IN') })}</Text>
                    ) : myNet < 0 ? (
                      <Text style={styles.groupNetOwe}>{t('expenses.you_owe_amount', { amount: Math.abs(myNet).toLocaleString('en-IN') })}</Text>
                    ) : (
                      <Text style={styles.groupNetSettled}>{t('expenses.settled_up')}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Create Group Bottom Sheet */}
      <BottomSheet
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('expenses.new_group_title')}>
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>{t('expenses.group_name_label')}</Text>
          <TextInput
            style={styles.textInput}
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder={t('expenses.group_name_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />

          <Text style={styles.inputLabel}>{t('expenses.choose_icon_label')}</Text>
          <View style={styles.emojiRow}>
            {EMOJI_OPTIONS.map((e) => (
              <Pressable
                key={e}
                style={[
                  styles.emojiChip,
                  newGroupEmoji === e && styles.emojiChipActive,
                ]}
                onPress={() => setNewGroupEmoji(e)}>
                <Text style={styles.emojiTextLarge}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>{t('expenses.members_label')}</Text>
          <View style={styles.memberChipsRow}>
            {members.map((m, idx) => (
              <Pressable
                key={idx}
                style={styles.memberChip}
                onPress={() => handleRemoveMember(idx)}>
                <Text style={styles.memberChipText}>
                  {m} {idx > 0 ? '✕' : ''}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.addMemberInputRow}>
            <TextInput
              style={[styles.textInput, styles.addMemberTextInput]}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder={t('expenses.add_member_placeholder')}
              placeholderTextColor={styles.placeholder.color}
            />
            <Pressable onPress={handleAddMember} style={styles.addMemberBtn}>
              <Plus size={18} color={styles.addIcon.color} />
            </Pressable>
          </View>

          <Button
            title={creating ? t('expenses.creating_state') : t('expenses.create_group_btn')}
            onPress={handleCreate}
            disabled={creating}
            style={styles.createButtonMargin}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerBar: {
      backgroundColor: colors.navBackground || colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.navBorder || colors.border,
      ...shadow.soft,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.glassSurface || colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerIcon: {
      color: colors.textPrimary,
    },
    primaryIcon: {
      color: colors.primary,
    },
    addIcon: {
      color: colors.textOnPrimary,
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
    headerTitle: {
      fontFamily: fonts.serif,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    heroCard: {
      backgroundColor: colors.glassSurface || colors.surfaceElevated,
      borderRadius: radius.card || 22,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      padding: spacing.md + 2,
      marginBottom: spacing.lg,
      ...shadow.soft,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    heroIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.blush || colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroTitle: {
      fontFamily: fonts.serif,
      fontSize: 16,
      color: colors.textPrimary,
    },
    heroStatsGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    heroStatPill: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroStatVal: {
      fontFamily: fonts.serif,
      fontSize: 14,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    getBackStatVal: {
      color: colors.forest,
    },
    heroStatLbl: {
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
    },
    sectionTitle: {
      fontFamily: fonts.serif,
      fontSize: 18,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    loadingContainer: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    groupCard: {
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.card || 20,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    emojiBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.blush || colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emojiText: {
      fontSize: 22,
    },
    groupInfoContainer: {
      flex: 1,
      marginRight: spacing.xs,
    },
    groupName: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    membersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    membersCount: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    groupFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    expenseCountText: {
      fontFamily: fonts.sans,
      fontSize: 11.5,
      color: colors.textMuted,
    },
    groupNetOwed: {
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
      color: colors.forest,
    },
    groupNetOwe: {
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
      color: colors.danger,
    },
    groupNetSettled: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textMuted,
    },
    modalContent: {
      paddingBottom: 20,
    },
    inputLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 10,
    },
    textInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: fonts.sans,
    },
    emojiRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    emojiChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    memberChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    memberChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    memberChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },
    addMemberInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addMemberBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholder: {
      color: colors.textMuted,
    },
    emojiTextLarge: {
      fontSize: 20,
    },
    addMemberTextInput: {
      flex: 1,
    },
    createButtonMargin: {
      marginTop: spacing.xl,
    },
  });
