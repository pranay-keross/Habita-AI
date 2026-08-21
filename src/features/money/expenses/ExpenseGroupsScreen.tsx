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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert(t('expenses.missing_group_name_title'), t('expenses.missing_group_name_msg'));
      return;
    }
    setCreating(true);
    const created = await createGroup(newGroupName.trim(), newGroupEmoji, members);
    setCreating(false);
    setShowCreateModal(false);
    setNewGroupName('');
    fetchGroups();
    navigation.navigate('GroupDetails', { groupId: created.id });
  };

  // Calculate total net balances across all groups
  const calculateTotalBalances = () => {
    let youAreOwed = 0;
    let youOwe = 0;

    groups.forEach((g) => {
      const { balances } = calculateGroupBalances(g, expenses, settlements);
      const myBal = balances.find((b) => b.memberId === 'usr_me');
      const myNet = myBal ? myBal.netBalanceINR : 0;
      if (myNet > 0) youAreOwed += myNet;
      if (myNet < 0) youOwe += Math.abs(myNet);
    });

    return { youAreOwed, youOwe, netTotal: youAreOwed - youOwe };
  };

  const totals = calculateTotalBalances();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={18} color={styles.headerTitle.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('expenses.groups_header')}</Text>
        <Pressable
          onPress={() => setShowCreateModal(true)}
          style={styles.createGroupPill}>
          <Text style={styles.createGroupPillText}>{t('expenses.create_group_btn')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Split & Track Expenses Hero Banner */}
        <View style={styles.heroBanner}>
          <Text style={styles.heroTitle}>{t('expenses.hero_title')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('expenses.hero_subtitle')}
          </Text>

          {/* 3 Stat Pills */}
          <View style={styles.heroStatsRow}>
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
          <ActivityIndicator color={styles.operatingHubSubTitle.color} style={{ marginTop: 24 }} />
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
                  <View style={{ flex: 1 }}>
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
      </ScrollView>

      {/* Create Group Bottom Sheet */}
      <BottomSheet
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('expenses.create_group_title')}>
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>{t('expenses.group_name_label')}</Text>
          <TextInput
            style={styles.textInput}
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="e.g. Goa Trip 2026, Home Rent"
            placeholderTextColor={styles.placeholder.color}
          />

          <Text style={styles.inputLabel}>{t('expenses.group_icon_label')}</Text>
          <View style={styles.emojiRow}>
            {EMOJI_OPTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                style={[
                  styles.emojiChip,
                  newGroupEmoji === emoji && styles.emojiChipActive,
                ]}
                onPress={() => setNewGroupEmoji(emoji)}>
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>{t('expenses.members_label', { count: members.length })}</Text>
          <View style={styles.memberChipsRow}>
            {members.map((m, i) => (
              <View key={i} style={styles.memberChip}>
                <Text style={styles.memberChipText}>{m}</Text>
              </View>
            ))}
          </View>

          <View style={styles.addMemberInputRow}>
            <TextInput
              style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder={t('expenses.add_member_placeholder')}
              placeholderTextColor={styles.placeholder.color}
            />
            <Pressable style={styles.addMemberBtn} onPress={handleAddMember}>
              <Plus size={18} color={styles.addMemberBtnIcon.color} />
            </Pressable>
          </View>

          <Button
            title={t('expenses.create_group_submit')}
            onPress={handleCreateGroup}
            loading={creating}
            style={{ marginTop: 20 }}
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    headerBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    createGroupPill: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createGroupPillText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textOnPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      paddingTop: spacing.xs,
    },
    heroBanner: {
      backgroundColor: colors.primaryDark,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
    },
    heroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 22,
      color: colors.textOnPrimary,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textOnPrimaryMuted,
      lineHeight: 18,
      marginBottom: 18,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    heroStatPill: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatVal: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textOnPrimary,
      marginBottom: 2,
    },
    getBackStatVal: {
      color: colors.forest,
    },
    addMemberBtnIcon: {
      color: colors.textOnPrimary,
    },
    heroStatLbl: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textOnPrimaryMuted,
    },

    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    groupCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    emojiBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiText: {
      fontSize: 20,
    },
    groupName: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
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
      color: colors.textSecondary,
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
      fontSize: 12,
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
      borderRadius: 12,
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
  });
