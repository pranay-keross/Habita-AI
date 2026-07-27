import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import { colors, fonts, radius, shadow, spacing } from '../../theme';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import { getItem, setItem } from '../../utils/storage';


type Props = StackScreenProps<RootStackParamList, 'Family'>;

export interface FamilyMember {
  id: string;
  name: string;
  phone: string;
  relation: string;
  role: 'owner' | 'editor' | 'viewer';
  avatar: string;
  permissions: {
    medicines: boolean;
    expenses: boolean;
    documents: boolean;
    safety: boolean;
  };
}

const FAMILY_STORAGE_KEY = 'saheli.family_members';

const DEFAULT_MEMBERS: FamilyMember[] = [
  {
    id: '1',
    name: 'Priya Sharma',
    phone: '+91 98765 43210',
    relation: 'Self',
    role: 'owner',
    avatar: '👩‍💼',
    permissions: { medicines: true, expenses: true, documents: true, safety: true },
  },
  {
    id: '2',
    name: 'Rajesh Sharma',
    phone: '+91 98123 45678',
    relation: 'Spouse',
    role: 'editor',
    avatar: '👨‍💼',
    permissions: { medicines: true, expenses: true, documents: true, safety: true },
  },
  {
    id: '3',
    name: 'Ananya Sharma',
    phone: '+91 97111 22233',
    relation: 'Daughter',
    role: 'viewer',
    avatar: '👧',
    permissions: { medicines: true, expenses: false, documents: false, safety: true },
  },
];

export default function FamilyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<FamilyMember[]>(DEFAULT_MEMBERS);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Form State
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRelation, setInviteRelation] = useState('Spouse');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [permMeds, setPermMeds] = useState(true);
  const [permExpenses, setPermExpenses] = useState(true);
  const [permDocs, setPermDocs] = useState(false);
  const [permSafety, setPermSafety] = useState(true);

  useEffect(() => {
    getItem<FamilyMember[]>(FAMILY_STORAGE_KEY, DEFAULT_MEMBERS).then((stored) => {
      if (stored && stored.length > 0) setMembers(stored);
    });
  }, []);

  const saveMembers = async (updated: FamilyMember[]) => {
    setMembers(updated);
    await setItem(FAMILY_STORAGE_KEY, updated);
  };

  const openAddModal = () => {
    setEditingMemberId(null);
    setInviteName('');
    setInvitePhone('');
    setInviteRelation('Spouse');
    setInviteRole('editor');
    setPermMeds(true);
    setPermExpenses(true);
    setPermDocs(false);
    setPermSafety(true);
    setShowInviteModal(true);
  };

  const openEditModal = (member: FamilyMember) => {
    setEditingMemberId(member.id);
    setInviteName(member.name);
    setInvitePhone(member.phone);
    setInviteRelation(member.relation);
    setInviteRole(member.role === 'owner' ? 'editor' : member.role);
    setPermMeds(member.permissions.medicines);
    setPermExpenses(member.permissions.expenses);
    setPermDocs(member.permissions.documents);
    setPermSafety(member.permissions.safety);
    setShowInviteModal(true);
  };

  const handleSaveMember = async () => {
    if (!inviteName.trim() || !invitePhone.trim()) {
      Alert.alert('Incomplete Member Information', 'Please enter a valid name and phone number.');
      return;
    }

    if (editingMemberId) {
      // Edit existing member
      const updated = members.map((m) => {
        if (m.id === editingMemberId) {
          return {
            ...m,
            name: inviteName.trim(),
            phone: invitePhone.trim(),
            relation: inviteRelation,
            role: m.role === 'owner' ? ('owner' as const) : inviteRole,
            permissions: {
              medicines: permMeds,
              expenses: permExpenses,
              documents: permDocs,
              safety: permSafety,
            },
          };
        }
        return m;
      });
      await saveMembers(updated);
      setShowInviteModal(false);
      Alert.alert('Member Updated', `${inviteName}'s group role and access permissions have been saved.`);
    } else {
      // Add new member
      const newMember: FamilyMember = {
        id: Date.now().toString(),
        name: inviteName.trim(),
        phone: invitePhone.trim(),
        relation: inviteRelation,
        role: inviteRole,
        avatar: inviteRelation === 'Spouse' ? '👨‍💼' : inviteRelation === 'Parent' ? '👴' : inviteRelation === 'Child' ? '👦' : '🧑',
        permissions: {
          medicines: permMeds,
          expenses: permExpenses,
          documents: permDocs,
          safety: permSafety,
        },
      };

      const updated = [...members, newMember];
      await saveMembers(updated);
      setShowInviteModal(false);
      Alert.alert('Invitation Sent!', `An invitation SMS and access code have been dispatched to ${newMember.phone}.`);
    }
  };

  const handleRemoveMember = (id: string, name: string) => {
    Alert.alert('Remove Member', `Are you sure you want to remove ${name} from your family group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const filtered = members.filter((m) => m.id !== id);
          saveMembers(filtered);
          setShowInviteModal(false);
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Family & Group</Text>
        <Pressable onPress={openAddModal} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Invite</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Household Group</Text>
          <Text style={styles.heroSubtitle}>Share reminders, bills, emergency contacts & health logs securely.</Text>
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{members.length}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{members.filter((m) => m.role === 'editor').length + 1}</Text>
              <Text style={styles.statLabel}>Editors</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>4 / 4</Text>
              <Text style={styles.statLabel}>Modules Synced</Text>
            </View>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Connected Family Members</Text>
          <Text style={styles.sectionSub}>Tap any member tile to edit permissions and roles</Text>
        </View>

        {/* Members List */}
        {members.map((member) => (
          <Pressable key={member.id} style={styles.memberCard} onPress={() => openEditModal(member)}>
            <View style={styles.memberAvatarWrap}>
              <Text style={styles.memberAvatar}>{member.avatar}</Text>
            </View>

            <View style={styles.memberInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.memberName}>{member.name}</Text>
                <View style={[styles.roleBadge, member.role === 'owner' ? styles.roleOwner : styles.roleEditor]}>
                  <Text style={styles.roleText}>{member.role.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.memberSub}>
                {member.relation} · {member.phone}
              </Text>

              {/* Permissions Pills */}
              <View style={styles.permRow}>
                {member.permissions.medicines && <Text style={styles.permTag}>💊 Meds</Text>}
                {member.permissions.expenses && <Text style={styles.permTag}>🧾 Expenses</Text>}
                {member.permissions.safety && <Text style={styles.permTag}>🛡️ SOS</Text>}
                {member.permissions.documents && <Text style={styles.permTag}>📁 Docs</Text>}
              </View>
            </View>

            <View style={styles.editChevronWrap}>
              <Text style={styles.editChevron}>✏️</Text>
            </View>
          </Pressable>
        ))}

        {/* Invite CTA Banner */}
        <Pressable style={styles.inviteBanner} onPress={openAddModal}>
          <Text style={styles.inviteBannerIcon}>👪</Text>
          <View style={styles.inviteBannerContent}>
            <Text style={styles.inviteBannerTitle}>Add Spouse, Parents, or Kids</Text>
            <Text style={styles.inviteBannerSub}>Assign custom permissions for household management.</Text>
          </View>
          <Text style={styles.inviteBannerArrow}>→</Text>
        </Pressable>
      </ScrollView>

      {/* Draggable Member Invite / Edit BottomSheet with Backdrop Blur */}
      <BottomSheet
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={editingMemberId ? 'Edit Family Member' : 'Invite Family Member'}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={inviteName}
          onChangeText={setInviteName}
          placeholder="e.g. Rajesh Sharma"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          style={styles.input}
          value={invitePhone}
          onChangeText={setInvitePhone}
          keyboardType="phone-pad"
          placeholder="e.g. +91 98765 43210"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Relationship</Text>
        <View style={styles.chipRow}>
          {['Spouse', 'Parent', 'Child', 'Staff', 'Self'].map((rel) => (
            <Pressable
              key={rel}
              style={[styles.chip, inviteRelation === rel && styles.chipActive]}
              onPress={() => setInviteRelation(rel)}>
              <Text style={[styles.chipText, inviteRelation === rel && styles.chipTextActive]}>{rel}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Group Role</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, inviteRole === 'editor' && styles.chipActive]}
            onPress={() => setInviteRole('editor')}>
            <Text style={[styles.chipText, inviteRole === 'editor' && styles.chipTextActive]}>Editor (Full Access)</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, inviteRole === 'viewer' && styles.chipActive]}
            onPress={() => setInviteRole('viewer')}>
            <Text style={[styles.chipText, inviteRole === 'viewer' && styles.chipTextActive]}>Viewer (View Only)</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Module Access Permissions</Text>
        <View style={styles.permCheckGrid}>
          <Pressable style={styles.checkRow} onPress={() => setPermMeds(!permMeds)}>
            <Text style={styles.checkIcon}>{permMeds ? '☑️' : '⏹️'}</Text>
            <Text style={styles.checkLabel}>Medicine Chest & Reminders</Text>
          </Pressable>
          <Pressable style={styles.checkRow} onPress={() => setPermExpenses(!permExpenses)}>
            <Text style={styles.checkIcon}>{permExpenses ? '☑️' : '⏹️'}</Text>
            <Text style={styles.checkLabel}>Household Expenses & Budget</Text>
          </Pressable>
          <Pressable style={styles.checkRow} onPress={() => setPermDocs(!permDocs)}>
            <Text style={styles.checkIcon}>{permDocs ? '☑️' : '⏹️'}</Text>
            <Text style={styles.checkLabel}>Document Hub & OCR Tags</Text>
          </Pressable>
          <Pressable style={styles.checkRow} onPress={() => setPermSafety(!permSafety)}>
            <Text style={styles.checkIcon}>{permSafety ? '☑️' : '⏹️'}</Text>
            <Text style={styles.checkLabel}>Safety Emergency SOS Alerts</Text>
          </Pressable>
        </View>

        <Button title={editingMemberId ? 'Save Member Changes' : 'Send Invitation →'} onPress={handleSaveMember} style={styles.modalCta} />

        {editingMemberId && (
          <Pressable
            style={styles.modalRemoveBtn}
            onPress={() => handleRemoveMember(editingMemberId, inviteName)}>
            <Text style={styles.modalRemoveText}>🗑️ Remove Member from Group</Text>
          </Pressable>
        )}
      </BottomSheet>

    </View>
  );
}

const styles = StyleSheet.create({
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: '#FFF',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...shadow.medium,
  },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: '#FFF',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#F8ECE4',
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    color: '#FFF',
  },
  statLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: '#F8ECE4',
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  sectionSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  memberAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatar: {
    fontSize: 24,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textPrimary,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  roleOwner: {
    backgroundColor: colors.primary,
  },
  roleEditor: {
    backgroundColor: colors.turmeric,
  },
  roleText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    color: '#FFF',
  },
  memberSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  permRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  permTag: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  editChevron: {
    fontSize: 14,
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  inviteBannerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  inviteBannerContent: {
    flex: 1,
  },
  inviteBannerTitle: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inviteBannerSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  inviteBannerArrow: {
    fontSize: 18,
    color: colors.primary,
    fontFamily: fonts.sansBold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 20, 30, 0.45)',
  },
  modalBackdropTap: {
    ...StyleSheet.absoluteFill,
  },

  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '85%',
    ...shadow.medium,
    elevation: 24,
  },
  modalSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: '#FFF',
  },
  permCheckGrid: {
    gap: 10,
    marginTop: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  checkLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  modalCta: {
    marginTop: 24,
  },
  modalRemoveBtn: {
    marginTop: 14,
    marginBottom: 24,
    backgroundColor: '#FDE8E8',
    paddingVertical: 12,
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F8B4B4',
  },
  modalRemoveText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.danger,
  },
});
