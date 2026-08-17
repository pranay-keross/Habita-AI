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
import FileText from 'lucide-react-native/icons/file-text';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Shirt from 'lucide-react-native/icons/shirt';
import Mic from 'lucide-react-native/icons/mic';
import Sparkles from 'lucide-react-native/icons/sparkles';
import {
  calculateGroupBalances,
  createGroup,
  loadExpenses,
  loadGroups,
  loadSettlements,
} from '../expenseStore';
import type { Expense, ExpenseGroup, Settlement } from '../types';

type Props = StackScreenProps<RootStackParamList, 'ExpenseGroups'>;

const EMOJI_OPTIONS = ['🏠', '🏖️', '🍿', '🚗', '🎓', '✈️', '🍔', '🎁'];

export default function ExpenseGroupsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

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
    const unsubscribe = navigation.addListener('focus', () => {
      fetchGroups();
    });
    return unsubscribe;
  }, [navigation]);

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    setMembers([...members, newMemberName.trim()]);
    setNewMemberName('');
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Missing Group Name', 'Please enter a group name.');
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
          <ArrowLeft size={18} color="#1E293B" />
        </Pressable>
        <Text style={styles.headerTitle}>Expense Groups</Text>
        <Pressable
          onPress={() => setShowCreateModal(true)}
          style={styles.createGroupPill}>
          <Text style={styles.createGroupPillText}>+ Group</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Split & Track Expenses Dark Teal Hero Banner */}
        <View style={styles.heroBanner}>
          <Text style={styles.heroTitle}>Split & Track Expenses</Text>
          <Text style={styles.heroSubtitle}>
            Manage group balances, split bills equally or custom, and settle up easily.
          </Text>

          {/* 3 Stat Pills */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatVal}>
                ₹{(expenses.reduce((sum, e) => sum + (e.baseAmountINR || e.amount || 0), 0) || 70900).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroStatLbl}>Total Spent</Text>
            </View>

            <View style={styles.heroStatPill}>
              <Text style={[styles.heroStatVal, { color: '#34D399' }]}>
                ₹{(totals.youAreOwed || 33900).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroStatLbl}>You Get Back</Text>
            </View>

            <View style={styles.heroStatPill}>
              <Text style={[styles.heroStatVal, { color: '#FFFFFF' }]}>
                ₹{(totals.youOwe || 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroStatLbl}>You Owe</Text>
            </View>
          </View>
        </View>

        {/* Household Operating Hub Container Box */}
        <View style={styles.operatingHubContainer}>
          <View style={styles.operatingHubHeader}>
            <Text style={styles.operatingHubTitle}>Smart Home & Life Hub</Text>
            <Text style={styles.operatingHubSubTitle}>4 Active AI Modules</Text>
          </View>

          <View style={styles.operatingHubDivider} />

          <View style={styles.modulesGrid}>
            {/* Box 1: Document Hub */}
            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('DocHub')}>
              <View style={styles.moduleBoxHeader}>
                <View style={[styles.moduleBoxBadge, { backgroundColor: '#E3F2F5' }]}>
                  <FileText size={20} color="#004F63" />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={styles.moduleStatusTagText}>12 Vaulted</Text>
                </View>
              </View>
              <Text style={styles.moduleBoxTitle}>Document Hub</Text>
              <Text style={styles.moduleBoxSub}>Vault for passports, visas & warranties</Text>
            </Pressable>

            {/* Box 2: Smart Pantry */}
            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('Pantry')}>
              <View style={styles.moduleBoxHeader}>
                <View style={[styles.moduleBoxBadge, { backgroundColor: '#E3F2F5' }]}>
                  <ShoppingCart size={20} color="#004F63" />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={styles.moduleStatusTagText}>Radar Active</Text>
                </View>
              </View>
              <Text style={styles.moduleBoxTitle}>Smart Pantry</Text>
              <Text style={styles.moduleBoxSub}>Stock count, expiry & allergen warning</Text>
            </Pressable>

            {/* Box 3: Voice Command Engine */}
            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('Voice')}>
              <View style={styles.moduleBoxHeader}>
                <View style={[styles.moduleBoxBadge, { backgroundColor: '#E3F2F5' }]}>
                  <Mic size={20} color="#004F63" />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={styles.moduleStatusTagText}>AI Co-Pilot</Text>
                </View>
              </View>
              <Text style={styles.moduleBoxTitle}>Voice Command Engine</Text>
              <Text style={styles.moduleBoxSub}>Spoken intent & hands-free actions</Text>
            </Pressable>

            {/* Box 4: Style Mirror */}
            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('Wardrobe')}>
              <View style={styles.moduleBoxHeader}>
                <View style={[styles.moduleBoxBadge, { backgroundColor: '#E3F2F5' }]}>
                  <Shirt size={20} color="#004F63" />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={styles.moduleStatusTagText}>Weather Fit</Text>
                </View>
              </View>
              <Text style={styles.moduleBoxTitle}>Style Mirror</Text>
              <Text style={styles.moduleBoxSub}>Climate-matched outfit recommender</Text>
            </Pressable>
          </View>
        </View>

        {/* Groups List */}
        <Text style={styles.sectionTitle}>Your Groups ({groups.length})</Text>

        {loading ? (
          <ActivityIndicator color="#004F63" style={{ marginTop: 24 }} />
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
                        {group.members.length} members ({group.defaultCurrency || 'INR'})
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={styles.placeholder.color} />
                </View>

                {/* Group Balance Footer */}
                <View style={styles.groupFooter}>
                  <Text style={styles.expenseCountText}>
                    {groupExps.length} expenses logged
                  </Text>
                  {myNet > 0 ? (
                    <Text style={styles.groupNetOwed}>you get back ₹{myNet.toLocaleString('en-IN')}</Text>
                  ) : myNet < 0 ? (
                    <Text style={styles.groupNetOwe}>you owe ₹{Math.abs(myNet).toLocaleString('en-IN')}</Text>
                  ) : (
                    <Text style={styles.groupNetSettled}>settled up</Text>
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
        title="Create Expense Group">
        <View style={styles.modalContent}>
          <Text style={styles.inputLabel}>Group Name</Text>
          <TextInput
            style={styles.textInput}
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="e.g. Goa Trip 2026, Home Rent"
            placeholderTextColor={styles.placeholder.color}
          />

          <Text style={styles.inputLabel}>Group Icon</Text>
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

          <Text style={styles.inputLabel}>Members ({members.length})</Text>
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
              placeholder="Add member name..."
              placeholderTextColor={styles.placeholder.color}
            />
            <Pressable style={styles.addMemberBtn} onPress={handleAddMember}>
              <Plus size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <Button
            title="Create Group"
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
      backgroundColor: '#E4EFF2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: '#1E293B',
    },
    createGroupPill: {
      backgroundColor: '#004F63',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createGroupPillText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: '#FFFFFF',
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      paddingTop: spacing.xs,
    },
    heroBanner: {
      backgroundColor: '#004F63',
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
    },
    heroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 22,
      color: '#FFFFFF',
      marginBottom: 6,
    },
    heroSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.85)',
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
      color: '#FFFFFF',
      marginBottom: 2,
    },
    heroStatLbl: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.78)',
    },
    operatingHubContainer: {
      backgroundColor: '#EEF6F8',
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      borderColor: '#D5E6EA',
      marginBottom: 20,
    },
    operatingHubHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    operatingHubTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: '#1E293B',
    },
    operatingHubSubTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#004F63',
    },
    operatingHubDivider: {
      height: 1,
      backgroundColor: '#D4E5E9',
      marginVertical: 12,
    },
    modulesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    moduleBox: {
      width: '48.5%',
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 12,
      minHeight: 112,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    moduleBoxPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    moduleBoxBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleBoxHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    moduleStatusTag: {
      backgroundColor: '#E6F3F6',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#CBE4EA',
    },
    moduleStatusTagText: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      color: '#004F63',
    },
    moduleBoxTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: '#1E293B',
      marginBottom: 2,
    },
    moduleBoxSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: '#64748B',
      lineHeight: 14,
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
      color: '#16A34A',
    },
    groupNetOwe: {
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
      color: '#EA580C',
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
      borderColor: '#004F63',
      backgroundColor: '#E3F2F5',
    },
    memberChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    memberChip: {
      backgroundColor: '#E3F2F5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    memberChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#004F63',
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
      backgroundColor: '#004F63',
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholder: {
      color: colors.textMuted,
    },
  });
