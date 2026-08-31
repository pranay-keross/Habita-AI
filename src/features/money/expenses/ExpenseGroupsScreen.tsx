import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
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
import Trash2 from 'lucide-react-native/icons/trash-2';
import X from 'lucide-react-native/icons/x';
import Check from 'lucide-react-native/icons/check';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Phone from 'lucide-react-native/icons/phone';
import User from 'lucide-react-native/icons/user';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Zap from 'lucide-react-native/icons/zap';
import { SkeletonCard, SkeletonHeroCard } from '../../../components/Skeleton';
import Avatar from '../../../components/Avatar';
import Pagination from '../../../components/Pagination';

import useAuth from '../../../hooks/useAuth';
import { ApiError } from '../../auth/api';
import { getItem, setItem } from '../../../utils/storage';
import { showNetworkUnavailableAlert } from '../../../utils/networkStatus';
import { listMyFamilies } from '../../family/api';
import type { FamilyMember } from '../../family/types';
import {
  calculateGroupBalances,
  createGroup,
  deleteGroup,
  findCurrentUserMember,
  loadExpenses,
  loadExpenseSummary,
  loadGroupsPage,
  loadSettlements,
  verifyMemberByPhone,
} from '../expenseStore';
import type { CreateGroupMemberInput, Expense, ExpenseGroup, ExpenseSummaryStats, Settlement } from '../types';
import { GROUP_ICON_KEYS, getGroupIconComponent } from './groupIcons';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'ExpenseGroups'>;

const ICON_KEY_OPTIONS = GROUP_ICON_KEYS;
const GROUPS_PAGE_SIZE = 8;

export default function ExpenseGroupsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('You');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [remoteSummary, setRemoteSummary] = useState<ExpenseSummaryStats | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState<string>(ICON_KEY_OPTIONS[0]);
  const [newMemberName, setNewMemberName] = useState('');
  const [members, setMembers] = useState<CreateGroupMemberInput[]>([{ name: 'You (You)' }]);
  const [creating, setCreating] = useState(false);
  const [availableFamilyMembers, setAvailableFamilyMembers] = useState<FamilyMember[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherMemberName, setOtherMemberName] = useState('');
  const [otherMemberPhone, setOtherMemberPhone] = useState('');
  const [phoneVerifyStatus, setPhoneVerifyStatus] = useState<'idle' | 'checking' | 'verified' | 'not_found'>('idle');
  const [verifiedMemberInfo, setVerifiedMemberInfo] = useState<{ userId: string; avatarUrl?: string | null } | null>(null);
  const [manualNameMode, setManualNameMode] = useState(false);
  const [groupsPage, setGroupsPage] = useState(1);
  const [groupsTotalPages, setGroupsTotalPages] = useState(1);
  const [groupsTotalElements, setGroupsTotalElements] = useState(0);
  const groupsPageRef = useRef(1);
  useEffect(() => {
    groupsPageRef.current = groupsPage;
  }, [groupsPage]);

  const fetchGroupsPage = async (page: number, tokenOverride?: string | null) => {
    const token = tokenOverride !== undefined ? tokenOverride : await getAccessToken().catch(() => null);
    const result = await loadGroupsPage(page, GROUPS_PAGE_SIZE, token);
    setGroups(result.groups);
    setGroupsTotalPages(result.totalPages);
    setGroupsTotalElements(result.totalElements);
  };

  const fetchGroups = async () => {
    const token = await getAccessToken().catch(() => null);
    const prof = await getItem<{ name?: string }>('habita.user_profile', {});
    const myName = prof?.name || 'You';
    setCurrentUserName(myName);
    const sess = await getItem<{ userId?: string }>('habita.session', {});
    if (sess?.userId) setCurrentUserId(sess.userId);

    const summary = await loadExpenseSummary(token);
    const exps = await loadExpenses(undefined, token);
    const sets = await loadSettlements(undefined, token);
    setRemoteSummary(summary);
    setExpenses(exps);
    setSettlements(sets);
    await fetchGroupsPage(groupsPageRef.current, token);
    setLoading(false);
  };

  const fetchFamilyMembers = async () => {
    setLoadingFamily(true);
    try {
      const token = await getAccessToken().catch(() => null);
      let familyMembers: FamilyMember[] = [];
      if (token) {
        try {
          const families = await listMyFamilies(token);
          if (families && families[0]?.members) {
            familyMembers = families[0].members;
            await setItem('habita.families_cache', familyMembers);
          }
        } catch {
          // fallback to cache
        }
      }
      if (familyMembers.length === 0) {
        const cached = await getItem<FamilyMember[] | null>('habita.families_cache', null);
        if (cached) familyMembers = cached;
      }
      const myNameLower = currentUserName.toLowerCase().trim();
      const filtered = familyMembers.filter((m) => {
        const mName = m.name?.toLowerCase().trim();
        return mName !== myNameLower && m.id !== currentUserId;
      });
      setAvailableFamilyMembers(filtered);
    } finally {
      setLoadingFamily(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  }, []);

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

  const didMountGroupsPageEffect = useRef(false);
  useEffect(() => {
    if (!didMountGroupsPageEffect.current) {
      didMountGroupsPageEffect.current = true;
      return;
    }
    fetchGroupsPage(groupsPage);
  }, [groupsPage]);

  // If a deletion shrinks the list below the page currently being viewed, drop back to
  // the new last page — this also re-triggers the effect above to refetch it.
  useEffect(() => {
    if (groupsPage > groupsTotalPages) {
      setGroupsPage(groupsTotalPages);
    }
  }, [groupsTotalPages]);

  const handleOpenCreate = () => {
    setMembers([{ name: `${currentUserName} (You)` }]);
    setNewGroupName('');
    setNewMemberName('');
    resetOtherMemberInput();
    setShowOtherInput(false);
    setShowCreateModal(true);
    fetchFamilyMembers();
  };

  const resetOtherMemberInput = () => {
    setOtherMemberName('');
    setOtherMemberPhone('');
    setPhoneVerifyStatus('idle');
    setVerifiedMemberInfo(null);
    setManualNameMode(false);
  };

  const handleOtherPhoneChange = (text: string) => {
    setOtherMemberPhone(text);
    if (phoneVerifyStatus !== 'idle') {
      setPhoneVerifyStatus('idle');
      setVerifiedMemberInfo(null);
    }
  };

  const handleToggleManualMode = (manual: boolean) => {
    setManualNameMode(manual);
    setOtherMemberName('');
    setOtherMemberPhone('');
    setPhoneVerifyStatus('idle');
    setVerifiedMemberInfo(null);
  };

  const handleVerifyPhone = async () => {
    const trimmedPhone = otherMemberPhone.trim();
    const digits = trimmedPhone.replace(/[\s-]+/g, '');
    if (!/^\+?[0-9]{10,13}$/.test(digits)) {
      Alert.alert(t('onboarding.error_title'), t('expenses.invalid_phone_msg'));
      return;
    }
    const cleanPhone = digits.startsWith('+') ? digits : `+91${digits}`;

    if (members.some((m) => m.phone === cleanPhone)) {
      Alert.alert(t('onboarding.error_title'), t('expenses.already_added'));
      return;
    }

    const token = await getAccessToken().catch(() => null);
    if (!token) {
      Alert.alert(t('onboarding.error_title'), t('expenses.phone_verify_offline_msg'));
      return;
    }

    setPhoneVerifyStatus('checking');
    try {
      const result = await verifyMemberByPhone(cleanPhone, token);
      if (result) {
        setVerifiedMemberInfo({ userId: result.userId, avatarUrl: result.avatarUrl });
        setOtherMemberName(result.name);
        setPhoneVerifyStatus('verified');
      } else {
        setVerifiedMemberInfo(null);
        setPhoneVerifyStatus('not_found');
      }
    } catch (err) {
      setPhoneVerifyStatus('idle');
      const errorBody =
        err instanceof ApiError && err.body && typeof err.body === 'object'
          ? (err.body as { code?: string; message?: string })
          : undefined;
      if (errorBody?.code === 'CANNOT_ADD_SELF') {
        Alert.alert(t('onboarding.error_title'), t('expenses.phone_is_self_msg'));
      } else if (err instanceof ApiError && err.status === 400 && errorBody?.message) {
        Alert.alert(t('onboarding.error_title'), errorBody.message);
      } else {
        Alert.alert(t('onboarding.error_title'), t('expenses.phone_verify_error'));
      }
    }
  };

  const handleToggleFamilyMember = (fm: FamilyMember) => {
    const isSelected = members.some((m) => m.name.toLowerCase() === fm.name.toLowerCase());
    if (isSelected) {
      setMembers(members.filter((m) => m.name.toLowerCase() !== fm.name.toLowerCase()));
    } else {
      setMembers([...members, { name: fm.name }]);
    }
  };

  const handleAddOtherMember = () => {
    if (manualNameMode) {
      const trimmedName = otherMemberName.trim();
      if (!trimmedName) return;

      if (members.some((m) => m.name.toLowerCase() === trimmedName.toLowerCase())) {
        Alert.alert(t('onboarding.error_title'), t('expenses.already_added'));
        return;
      }

      setMembers([...members, { name: trimmedName }]);
      resetOtherMemberInput();
      return;
    }

    if (phoneVerifyStatus !== 'verified' || !verifiedMemberInfo) {
      Alert.alert(t('onboarding.error_title'), t('expenses.verify_phone_first'));
      return;
    }

    const digits = otherMemberPhone.trim().replace(/[\s-]+/g, '');
    const cleanPhone = digits.startsWith('+') ? digits : `+91${digits}`;
    const memberName = otherMemberName.trim() || cleanPhone;

    if (
      members.some(
        (m) => m.phone === cleanPhone || m.name.toLowerCase() === memberName.toLowerCase(),
      )
    ) {
      Alert.alert(t('onboarding.error_title'), t('expenses.already_added'));
      return;
    }

    setMembers([
      ...members,
      {
        name: memberName,
        phone: cleanPhone,
        userId: verifiedMemberInfo.userId,
      },
    ]);
    resetOtherMemberInput();
  };

  const handleRemoveMember = (idx: number) => {
    if (idx === 0) return;
    setMembers(members.filter((_, i) => i !== idx));
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    Alert.alert(
      t('expenses.delete_group_title'),
      t('expenses.delete_group_confirm', { name: groupName }),
      [
        { text: t('expenses.cancel_btn'), style: 'cancel' },
        {
          text: t('expenses.delete_btn'),
          style: 'destructive',
          onPress: async () => {
            const token = await getAccessToken().catch(() => null);
            const { offline } = await deleteGroup(groupId, token);
            if (offline) showNetworkUnavailableAlert();
            fetchGroups();
          },
        },
      ],
    );
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) {
      Alert.alert(t('expenses.missing_info_title'), t('expenses.missing_info_msg'));
      return;
    }
    setCreating(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const { group: created, offline } = await createGroup(
        newGroupName.trim(),
        newGroupEmoji,
        members,
        token,
        currentUserId,
        currentUserName,
      );
      setShowCreateModal(false);
      setNewGroupName('');
      fetchGroups();
      if (offline) showNetworkUnavailableAlert();
      navigation.navigate('GroupDetails', { groupId: created.id });
    } catch {
      Alert.alert(t('onboarding.error_title'), t('expenses.error_create_group'));
    } finally {
      setCreating(false);
    }
  };

  // Aggregated totals across all groups calculated dynamically
  const computedTotals = groups.reduce(
    (acc, g) => {
      const { balances } = calculateGroupBalances(g, expenses, settlements);
      const myMember = findCurrentUserMember(g.members, currentUserId, currentUserName);
      const myBal = myMember ? balances.find((b) => b.memberId === myMember.id) : null;
      if (myBal) {
        if (myBal.netBalanceINR > 0) acc.youAreOwed += myBal.netBalanceINR;
        if (myBal.netBalanceINR < 0) acc.youOwe += Math.abs(myBal.netBalanceINR);
      }
      return acc;
    },
    { youAreOwed: 0, youOwe: 0 }
  );

  const totals = remoteSummary
    ? { youAreOwed: remoteSummary.youAreOwedINR, youOwe: remoteSummary.youOweINR }
    : computedTotals;

  const totalSpentVal = remoteSummary
    ? remoteSummary.totalSpentINR
    : expenses.reduce((sum, e) => sum + (e.baseAmountINR || e.amount || 0), 0);

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('expenses.screen_title') || t('expenses.groups_header') || 'Expenses'}
          </Text>
          <Pressable onPress={handleOpenCreate} style={styles.addNavBtn}>
            <Plus size={20} color={styles.addIcon.color} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={styles.primaryIcon.color}
          />
        }>
        <View style={maxContentStyle}>
          {loading ? (
            <View style={{ paddingTop: 8 }}>
              <SkeletonHeroCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : groupsTotalElements === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Users size={36} color={styles.primaryIcon.color} />
              </View>
              <Text style={styles.emptyTitle}>{t('expenses.no_groups_title')}</Text>
              <Text style={styles.emptySub}>{t('expenses.no_groups_sub')}</Text>

              <View style={styles.emptyBenefitsCard}>
                <View style={styles.benefitRow}>
                  <Sparkles size={14} color={styles.primaryIcon.color} style={styles.benefitIcon} />
                  <Text style={styles.benefitText}>{t('expenses.benefit_split')}</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Users size={14} color={styles.primaryIcon.color} style={styles.benefitIcon} />
                  <Text style={styles.benefitText}>{t('expenses.benefit_family')}</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Zap size={14} color={styles.primaryIcon.color} style={styles.benefitIcon} />
                  <Text style={styles.benefitText}>{t('expenses.benefit_settle')}</Text>
                </View>
              </View>

              <Button
                title={t('expenses.create_first_group')}
                onPress={handleOpenCreate}
                style={styles.emptyButton}
              />
            </View>
          ) : (
            <>
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
                      ₹{totalSpentVal.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.heroStatLbl}>{t('expenses.total_spent')}</Text>
                  </View>

                  <View style={styles.heroStatPill}>
                    <Text style={[styles.heroStatVal, styles.getBackStatVal]}>
                      ₹{totals.youAreOwed.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.heroStatLbl}>{t('expenses.you_get_back')}</Text>
                  </View>

                  <View style={styles.heroStatPill}>
                    <Text style={[styles.heroStatVal, styles.oweStatVal]}>
                      ₹{totals.youOwe.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.heroStatLbl}>{t('expenses.you_owe')}</Text>
                  </View>
                </View>
              </View>

              {/* Groups List */}
              <Text style={styles.sectionTitle}>{t('expenses.your_groups', { count: groupsTotalElements })}</Text>

              {groups.map((group) => {
                const { balances } = calculateGroupBalances(group, expenses, settlements);
                const myMember = findCurrentUserMember(group.members, currentUserId, currentUserName);
                const myBal = myMember ? balances.find((b) => b.memberId === myMember.id) : null;
                const myNet = group.userNetBalanceINR !== undefined
                  ? group.userNetBalanceINR
                  : (myBal ? myBal.netBalanceINR : 0);
                const memberCount = group.memberCount !== undefined ? group.memberCount : (group.members?.length || 0);
                const expenseCount = group.expenseCount !== undefined ? group.expenseCount : expenses.filter((e) => e.groupId === group.id).length;

                const GroupIcon = getGroupIconComponent(group.emoji);

                return (
                  <Pressable
                    key={group.id}
                    style={styles.groupCard}
                    onPress={() => navigation.navigate('GroupDetails', { groupId: group.id })}>
                    <View style={styles.groupHeader}>
                      <View style={styles.emojiBadge}>
                        <GroupIcon size={22} color={styles.primaryIcon.color} />
                      </View>
                      <View style={styles.groupInfoContainer}>
                        <Text style={styles.groupName}>{group.name}</Text>
                        <View style={styles.membersRow}>
                          <Users size={13} color={styles.placeholder.color} />
                          <Text style={styles.membersCount}>
                            {t('expenses.members_count', { count: memberCount, currency: group.defaultCurrency || 'INR' })}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id, group.name);
                        }}
                        style={{ padding: 6, marginRight: 4 }}>
                        <Trash2 size={16} color={styles.placeholder.color} />
                      </Pressable>
                      <ChevronRight size={18} color={styles.placeholder.color} />
                    </View>

                    {/* Group Balance Footer */}
                    <View style={styles.groupFooter}>
                      <Text style={styles.expenseCountText}>
                        {t('expenses.expenses_logged', { count: expenseCount })}
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
              })}

              <Pagination
                currentPage={groupsPage}
                totalPages={groupsTotalPages}
                onPageChange={setGroupsPage}
              />
            </>
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
            {ICON_KEY_OPTIONS.map((key) => {
              const OptionIcon = getGroupIconComponent(key);
              const isActive = newGroupEmoji === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.emojiChip, isActive && styles.emojiChipActive]}
                  onPress={() => setNewGroupEmoji(key)}>
                  <OptionIcon size={20} color={isActive ? styles.primaryIcon.color : styles.placeholder.color} />
                </Pressable>
              );
            })}
          </View>

          {/* Group Members Section */}
          <Text style={styles.inputLabel}>{t('expenses.members_label')} ({members.length})</Text>

          {/* Currently Selected Member Chips */}
          <View style={styles.memberChipsRow}>
            {members.map((m, idx) => (
              <View key={idx} style={styles.memberChip}>
                <Avatar name={m.name} size={18} style={{ marginRight: 5 }} />
                {m.phone ? (
                  <Phone size={11} color={styles.primaryIcon.color} style={{ marginRight: 4 }} />
                ) : null}
                <Text style={styles.memberChipText}>
                  {m.name}{m.phone && m.name !== m.phone ? ` (${m.phone})` : ''}
                </Text>
                {idx > 0 && (
                  <Pressable
                    onPress={() => handleRemoveMember(idx)}
                    hitSlop={8}
                    style={{ marginLeft: 6 }}>
                    <X size={12} color={styles.memberChipText.color} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Family Members Selection */}
          <Text style={styles.inputSubLabel}>{t('expenses.select_family_members')}</Text>
          {loadingFamily ? (
            <ActivityIndicator size="small" color={styles.primaryIcon.color} style={{ marginVertical: 8 }} />
          ) : availableFamilyMembers.length > 0 ? (
            <View style={styles.familyGrid}>
              {availableFamilyMembers.map((fm) => {
                const isSelected = members.some((m) => m.name.toLowerCase() === fm.name.toLowerCase());
                return (
                  <Pressable
                    key={fm.id}
                    onPress={() => handleToggleFamilyMember(fm)}
                    style={[styles.familyChip, isSelected && styles.familyChipActive]}>
                    <Avatar name={fm.name} size={18} style={{ marginRight: 2 }} />
                    <Text style={[styles.familyChipName, isSelected && styles.familyChipNameActive]}>
                      {fm.name}
                    </Text>
                    {fm.relation && (
                      <Text style={styles.familyChipRelation}>
                        ({fm.relation.toLowerCase()})
                      </Text>
                    )}
                    {isSelected ? (
                      <Check size={14} color={styles.primaryIcon.color} />
                    ) : (
                      <Plus size={14} color={styles.placeholder.color} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.familyHintText}>{t('expenses.no_family_members_hint')}</Text>
          )}

          {/* Other / Manual Add Option */}
          <Pressable
            onPress={() => setShowOtherInput((prev) => !prev)}
            style={[styles.otherToggleBtn, showOtherInput && styles.otherToggleBtnActive]}>
            <UserPlus size={15} color={showOtherInput ? styles.primaryIcon.color : styles.placeholder.color} />
            <Text style={[styles.otherToggleText, showOtherInput && styles.otherToggleTextActive]}>
              {t('expenses.other_member_btn')}
            </Text>
          </Pressable>

          {showOtherInput && !manualNameMode && (
            <View style={styles.otherInputCard}>
              <View style={styles.otherInputFieldRow}>
                <Phone size={15} color={styles.placeholder.color} style={styles.otherInputIcon} />
                <TextInput
                  style={[styles.textInput, styles.otherTextInput]}
                  value={otherMemberPhone}
                  onChangeText={handleOtherPhoneChange}
                  placeholder={t('expenses.other_phone_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                  keyboardType="phone-pad"
                  editable={phoneVerifyStatus !== 'verified' && phoneVerifyStatus !== 'checking'}
                  autoFocus={true}
                />
                <Pressable
                  onPress={handleVerifyPhone}
                  disabled={
                    phoneVerifyStatus === 'checking' ||
                    phoneVerifyStatus === 'verified' ||
                    !otherMemberPhone.trim()
                  }
                  style={[
                    styles.verifyBtn,
                    phoneVerifyStatus === 'verified' && styles.verifyBtnDone,
                    (!otherMemberPhone.trim() || phoneVerifyStatus === 'checking') && styles.verifyBtnDisabled,
                  ]}>
                  {phoneVerifyStatus === 'checking' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : phoneVerifyStatus === 'verified' ? (
                    <Check size={16} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyBtnText}>{t('expenses.verify_btn')}</Text>
                  )}
                </Pressable>
              </View>

              {phoneVerifyStatus === 'verified' && (
                <View style={styles.verifiedBadgeRow}>
                  <Check size={13} color={styles.getBackStatVal.color} />
                  <Text style={styles.verifiedBadgeText}>{t('expenses.phone_verified_msg')}</Text>
                </View>
              )}
              {phoneVerifyStatus === 'not_found' && (
                <View style={styles.verifiedBadgeRow}>
                  <AlertCircle size={13} color={styles.oweStatVal.color} />
                  <Text style={styles.notFoundText}>{t('expenses.phone_not_found_msg')}</Text>
                </View>
              )}

              <View style={styles.otherInputFieldRow}>
                <User size={15} color={styles.placeholder.color} style={styles.otherInputIcon} />
                <TextInput
                  style={[styles.textInput, styles.otherTextInput]}
                  value={otherMemberName}
                  onChangeText={setOtherMemberName}
                  placeholder={t('expenses.other_name_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                  editable={phoneVerifyStatus === 'verified'}
                  returnKeyType="done"
                  onSubmitEditing={handleAddOtherMember}
                />
                <Pressable
                  onPress={handleAddOtherMember}
                  disabled={phoneVerifyStatus !== 'verified'}
                  style={[styles.addMemberBtn, phoneVerifyStatus !== 'verified' && styles.addMemberBtnDisabled]}>
                  <Plus size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              <Pressable onPress={() => handleToggleManualMode(true)} hitSlop={6}>
                <Text style={styles.manualLinkText}>{t('expenses.add_without_phone_link')}</Text>
              </Pressable>
            </View>
          )}

          {showOtherInput && manualNameMode && (
            <View style={styles.otherInputCard}>
              <View style={styles.otherInputFieldRow}>
                <User size={15} color={styles.placeholder.color} style={styles.otherInputIcon} />
                <TextInput
                  style={[styles.textInput, styles.otherTextInput]}
                  value={otherMemberName}
                  onChangeText={setOtherMemberName}
                  placeholder={t('expenses.other_name_placeholder_manual')}
                  placeholderTextColor={styles.placeholder.color}
                  autoFocus={true}
                  returnKeyType="done"
                  onSubmitEditing={handleAddOtherMember}
                />
                <Pressable onPress={handleAddOtherMember} style={styles.addMemberBtn}>
                  <Plus size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              <Pressable onPress={() => handleToggleManualMode(false)} hitSlop={6}>
                <Text style={styles.manualLinkText}>{t('expenses.use_phone_instead_link')}</Text>
              </Pressable>
            </View>
          )}

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
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    headerIcon: {
      color: '#FFFFFF',
    },
    primaryIcon: {
      color: colors.primary,
    },
    addIcon: {
      color: '#FFFFFF',
    },
    addNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary === '#000000' ? '#262626' : colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.25)',
      ...shadow.soft,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: fonts.serif,
      fontSize: 19,
      fontWeight: '700',
      color: '#FFFFFF',
      marginHorizontal: spacing.sm,
      letterSpacing: 0.3,
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
    oweStatVal: {
      color: colors.danger,
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
    addMemberTextInput: {
      flex: 1,
    },
    createButtonMargin: {
      marginTop: spacing.xl,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 36,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.card || 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.md,
    },
    emptyIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.blush || colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontSize: 17,
      color: colors.textPrimary,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: spacing.lg,
    },
    emptyButton: {
      minWidth: 200,
    },
    inputSubLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textSecondary,
      marginTop: 10,
      marginBottom: 6,
    },
    familyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    familyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md || 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 6,
    },
    familyChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.blush || colors.surface,
    },
    familyChipName: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textPrimary,
    },
    familyChipNameActive: {
      color: colors.primary,
    },
    familyChipRelation: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginLeft: 2,
    },
    familyHintText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
      fontStyle: 'italic',
      marginBottom: 10,
    },
    otherToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md || 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      alignSelf: 'flex-start',
      marginBottom: 10,
      gap: 6,
    },
    otherToggleBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.blush || colors.surface,
    },
    otherToggleText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textSecondary,
    },
    otherToggleTextActive: {
      color: colors.primary,
    },
    emptyBenefitsCard: {
      width: '100%',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md || 14,
      padding: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    benefitIcon: {
      marginRight: 8,
    },
    benefitText: {
      fontFamily: fonts.sans,
      fontSize: 12.5,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    otherInputCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md || 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.md,
      gap: 8,
    },
    otherInputFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    otherInputIcon: {
      marginLeft: 4,
    },
    otherTextInput: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    verifyBtn: {
      height: 40,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifyBtnDone: {
      backgroundColor: colors.forest,
      paddingHorizontal: 0,
      width: 40,
    },
    verifyBtnDisabled: {
      opacity: 0.5,
    },
    verifyBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
      color: '#FFFFFF',
    },
    verifiedBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
      marginLeft: 4,
    },
    verifiedBadgeText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11.5,
      color: colors.forest,
    },
    notFoundText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11.5,
      color: colors.danger,
      flexShrink: 1,
    },
    addMemberBtnDisabled: {
      opacity: 0.4,
    },
    manualLinkText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
      textDecorationLine: 'underline',
      marginTop: 2,
      marginLeft: 4,
    },
  });
