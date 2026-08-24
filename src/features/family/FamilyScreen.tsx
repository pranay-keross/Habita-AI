import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import ModernBottomNav, { type BottomNavTab } from '../../components/ModernBottomNav';
import { SkeletonCard, SkeletonHeroCard } from '../../components/Skeleton';
import useAuth from '../../hooks/useAuth';
import {
  ArrowLeft,
  ChevronRight,
  UserPlus,
  HeartHandshake,
  Sparkles,
  ShieldCheck,
  Phone,
  User,
  Users,
  Mail,
  AlertCircle,
} from 'lucide-react-native';
import {
  acceptInvite,
  addManagedMember,
  cancelInvite,
  createFamily,
  declineInvite,
  getInvitedPhones,
  getMyProfileName,
  inviteMember,
  listFamilyInviteHistory,
  listFamilyPendingInvites,
  listMyFamilies,
  listMyPendingInvites,
  listRelationOptions,
  parseFamilyError,
  rememberInvitedPhone,
  removeManagedMember,
  removeMember,
  resolveMyMembership,
  type FamilyErrorKind,
  type MyMembership,
} from './api';
import {
  ALL_RELATIONS,
  type Family,
  type FamilyInvite,
  type FamilyMember,
  type FamilyRelation,
} from './types';

export type { FamilyMember } from './types';

type Props = StackScreenProps<RootStackParamList, 'Family'>;

const EMPTY_MEMBERSHIP: MyMembership = { member: null, role: 'MEMBER', isOwner: false, isCreator: false };

export default function FamilyScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken, getUserId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [family, setFamily] = useState<Family | null>(null);
  const [myMembership, setMyMembership] = useState<MyMembership>(EMPTY_MEMBERSHIP);
  // Needed to work out, for a card that isn't `myMembership.member` itself, "is this the
  // person who invited me" — `relatedToUserId` on my own row is a userId, and this is
  // the only other userId this screen ever has to compare it against (see
  // `getDisplayRelation` below).
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [invitesForMe, setInvitesForMe] = useState<FamilyInvite[]>([]);
  const [pendingInvitesAdmin, setPendingInvitesAdmin] = useState<FamilyInvite[]>([]);
  const [invitedPhones, setInvitedPhones] = useState<Record<string, string>>({});
  const [localeVersion, setLocaleVersion] = useState(0);

  const [showHistory, setShowHistory] = useState(false);
  const [inviteHistory, setInviteHistory] = useState<FamilyInvite[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [newFamilyName, setNewFamilyName] = useState('');
  const [creatingFamily, setCreatingFamily] = useState(false);

  const [relationOptions, setRelationOptions] = useState(ALL_RELATIONS);

  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRelation, setInviteRelation] = useState<FamilyRelation | null>(null);
  const [inviting, setInviting] = useState(false);

  const [acceptingInvite, setAcceptingInvite] = useState<FamilyInvite | null>(null);
  const [acceptReciprocalRelation, setAcceptReciprocalRelation] = useState<FamilyRelation | null>(null);
  const [accepting, setAccepting] = useState(false);

  const [showManagedSheet, setShowManagedSheet] = useState(false);
  const [managedName, setManagedName] = useState('');
  const [managedRelationship, setManagedRelationship] = useState('');
  const [addingManaged, setAddingManaged] = useState(false);

  const [viewingMember, setViewingMember] = useState<FamilyMember | null>(null);

  const [loadError, setLoadError] = useState<FamilyErrorKind | null>(null);

  const errorMessageKey = useCallback((kind: FamilyErrorKind): string => {
    const key: Record<FamilyErrorKind, string> = {
      network: 'onboarding.network_error',
      not_found: 'family.error_not_found',
      no_permission: 'family.error_no_permission',
      phone_not_registered: 'family.error_phone_not_registered',
      already_member: 'family.error_already_member',
      family_full: 'family.error_family_full',
      unknown: 'family.error_generic',
    };
    return key[kind];
  }, []);

  const showError = useCallback((err: unknown) => {
    Alert.alert(t('onboarding.error_title'), t(errorMessageKey(parseFamilyError(err))));
  }, [errorMessageKey]);

  // `silent`: used for the screen's own initial/automatic load — a fetch failure there
  // (most commonly "no backend reachable") shouldn't greet the user with a modal alert
  // the moment they open the screen. Renders an inline retry card instead. Reloads
  // triggered by an explicit user action (create/invite/accept/…) keep the Alert, since
  // those are a direct response to something the user just tapped.
  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    try {
      const [families, myInvites, profileName, userId, invitedPhoneMap, relations] = await Promise.all([
        listMyFamilies(token),
        listMyPendingInvites(token),
        getMyProfileName(),
        getUserId(),
        getInvitedPhones(),
        // Static lookup, but worth a best-effort refresh per load rather than trusting
        // the ALL_RELATIONS fallback forever — falls back silently on failure since it's
        // not on the critical path for anything else the screen shows.
        listRelationOptions(token).catch(() => ALL_RELATIONS),
      ]);
      setLoadError(null);
      setInvitesForMe(myInvites);
      setRelationOptions(relations);
      setInvitedPhones(invitedPhoneMap);
      setMyUserId(userId);
      const primary = families[0] ?? null;
      setFamily(primary);
      if (!primary) {
        setMyMembership(EMPTY_MEMBERSHIP);
        setPendingInvitesAdmin([]);
        return;
      }
      const membership = resolveMyMembership(primary, userId, profileName);
      setMyMembership(membership);
      // Any member can see pending invites now — there is no admin-only read tier.
      setPendingInvitesAdmin(await listFamilyPendingInvites(primary.id, token));
      setShowHistory(false);
      setInviteHistory([]);
    } catch (err) {
      if (opts?.silent) {
        setLoadError(parseFamilyError(err));
      } else {
        showError(err);
      }
    }
  }, [getAccessToken, getUserId, showError]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  useEffect(() => {
    setLoading(true);
    reload({ silent: true }).finally(() => setLoading(false));
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, [reload]);

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) {
      Alert.alert(t('family.incomplete_title'), t('family.incomplete_msg'));
      return;
    }
    setCreatingFamily(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await createFamily(newFamilyName.trim(), token);
        setNewFamilyName('');
        await reload();
      }
    } catch (err) {
      showError(err);
    } finally {
      setCreatingFamily(false);
    }
  };

  const handleDeclineInvite = async (invite: FamilyInvite) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      await declineInvite(invite.id, token);
      await reload();
    } catch (err) {
      showError(err);
    }
  };

  const openAcceptSheet = (invite: FamilyInvite) => {
    setAcceptingInvite(invite);
    setAcceptReciprocalRelation(invite.suggestedReciprocalRelations[0] ?? null);
  };

  const handleConfirmAccept = async () => {
    if (!acceptingInvite || !acceptReciprocalRelation) {
      Alert.alert(t('family.incomplete_title'), t('family.incomplete_msg'));
      return;
    }
    setAccepting(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await acceptInvite(acceptingInvite.id, acceptReciprocalRelation, token);
        setAcceptingInvite(null);
        await reload();
      }
    } catch (err) {
      showError(err);
    } finally {
      setAccepting(false);
    }
  };

  const openInviteSheet = () => {
    setInvitePhone('');
    setInviteRelation(null);
    setShowInviteSheet(true);
  };

  const handleSendInvite = async () => {
    if (!family || !invitePhone.trim() || !inviteRelation) {
      Alert.alert(t('family.incomplete_title'), t('family.incomplete_msg'));
      return;
    }
    setInviting(true);
    try {
      const token = await getAccessToken();
      if (token) {
        const phone = invitePhone.trim();
        const invite = await inviteMember(family.id, phone, inviteRelation, token);
        await rememberInvitedPhone(invite.id, phone);
        setShowInviteSheet(false);
        Alert.alert(t('family.invited_title'), t('family.invited_msg', { phone }));
        await reload();
      }
    } catch (err) {
      showError(err);
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (invite: FamilyInvite) => {
    if (!family) {
      return;
    }
    try {
      const token = await getAccessToken();
      if (token) {
        await cancelInvite(family.id, invite.id, token);
        await reload();
      }
    } catch (err) {
      showError(err);
    }
  };

  const toggleInviteHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (!family) {
      return;
    }
    setLoadingHistory(true);
    try {
      const token = await getAccessToken();
      if (token) {
        setInviteHistory(await listFamilyInviteHistory(family.id, token));
      }
    } catch (err) {
      showError(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openManagedSheet = () => {
    setManagedName('');
    setManagedRelationship('');
    setShowManagedSheet(true);
  };

  const handleAddManaged = async () => {
    if (!family || !managedName.trim() || !managedRelationship.trim()) {
      Alert.alert(t('family.incomplete_title'), t('family.incomplete_msg'));
      return;
    }
    setAddingManaged(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await addManagedMember(family.id, managedName.trim(), managedRelationship.trim(), token);
        setShowManagedSheet(false);
        await reload();
      }
    } catch (err) {
      showError(err);
    } finally {
      setAddingManaged(false);
    }
  };

  // Every member can open this — read-only, just what `GET /families/{id}` already
  // returned. The only action available from here is Remove, and that's gated
  // separately (creator-only, never on the OWNER's own row) inside the sheet itself.
  const openViewMember = (member: FamilyMember) => {
    setViewingMember(member);
  };

  const handleRemoveMember = (member: FamilyMember) => {
    if (!family) {
      return;
    }
    Alert.alert(t('family.remove_confirm_title'), t('family.remove_confirm_msg', { name: member.name }), [
      { text: t('family.cancel'), style: 'cancel' },
      {
        text: t('family.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getAccessToken();
            if (token) {
              if (member.managed && member.managedMemberId) {
                await removeManagedMember(family.id, member.managedMemberId, token);
              } else {
                await removeMember(family.id, member.id, token);
              }
              setViewingMember(null);
              await reload();
            }
          } catch (err) {
            showError(err);
          }
        },
      },
    ]);
  };

  // Any non-creator member can leave on their own now (self-removal via removeMember) —
  // the backend used to require admin access on the caller for this, blocking a plain
  // MEMBER from leaving at all. The creator (OWNER) can never be removed, including by
  // themselves, so they don't get this entry point (see the render condition below).
  const handleLeaveFamily = () => {
    if (!myMembership.member) {
      return;
    }
    const member = myMembership.member;
    Alert.alert(t('family.leave_confirm_title'), t('family.leave_confirm_msg', { name: member.name }), [
      { text: t('family.cancel'), style: 'cancel' },
      {
        text: t('family.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getAccessToken();
            if (token && family) {
              await removeMember(family.id, member.id, token);
              await reload();
            }
          } catch (err) {
            showError(err);
          }
        },
      },
    ]);
  };

  const managedCount = family ? family.members.filter((m) => m.managed).length : 0;

  const getDisplayRelation = (member: FamilyMember): string | null => {
    if (member.relation) return member.relation;
    if (myMembership.member?.relatedToUserId && myUserId && member.id !== myMembership.member.id) {
      if (myMembership.member.relatedToUserId === member.id || myMembership.member.relatedToUserId === family?.ownerUserId) {
        return myMembership.member.relation ?? null;
      }
    }
    return null;
  };

  const handleNavPress = (tab: BottomNavTab) => {
    if (tab === 'home') {
      navigation.navigate('Dashboard');
    } else if (tab === 'family') {
      // already on family tab
    } else if (tab === 'center') {
      navigation.navigate('Voice');
    } else if (tab === 'health') {
      navigation.navigate('Medicine');
    } else if (tab === 'vault') {
      navigation.navigate('DocHub');
    }
  };

  return (
    <View style={styles.root} key={localeVersion}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft size={18} color="#000000" strokeWidth={1.5} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('family.header_title')}</Text>
          <View style={styles.headerSubtitleRow}>
            <ShieldCheck size={11} color="#10B981" strokeWidth={1.8} />
            <Text style={styles.headerSubtitleText}>Private & Encrypted Hub</Text>
          </View>
        </View>
        {family ? (
          <Pressable onPress={openInviteSheet} style={styles.addBtn}>
            <UserPlus size={13} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.addBtnText}>{t('family.invite_btn')}</Text>
          </Pressable>
        ) : (
          <View style={styles.addBtnPlaceholder} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
            colors={['#000000']}
          />
        }>
        {loading ? (
          <View style={{ paddingTop: 8 }}>
            <SkeletonHeroCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : loadError ? (
          <View style={styles.emptyState}>
            <View style={{ marginBottom: 12 }}>
              <AlertCircle size={28} color="#888888" strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyStateTitle}>{t('family.load_error_title')}</Text>
            <Text style={styles.emptyStateSub}>{t(errorMessageKey(loadError))}</Text>
            <Button
              title={t('family.retry_btn')}
              onPress={() => reload()}
              style={styles.modalCta}
            />
          </View>
        ) : !family ? (
            <View style={styles.emptyState}>
                <View style={{ marginBottom: 12 }}>
                  <Users size={28} color="#888888" strokeWidth={1.5} />
                </View>
                <Text style={styles.emptyStateTitle}>{t('family.no_family_title')}</Text>
                <TextInput
                  style={styles.input}
                  value={newFamilyName}
                  onChangeText={setNewFamilyName}
                  placeholder={t('family.create_family_placeholder')}
                />
                <Button
                  title={t('family.create_family_btn')}
                  onPress={handleCreateFamily}
                  loading={creatingFamily}
                  style={styles.modalCta}
                />
            </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroTitleWrap}>
                  <Text style={styles.heroTitle}>{family.name}</Text>
                  <Text style={styles.heroSubtitle}>Shared Health & Household Sync</Text>
                </View>
                <View style={styles.heroSyncBadge}>
                  <Sparkles size={11} color="#10B981" strokeWidth={2} />
                  <Text style={styles.heroSyncText}>Active Hub</Text>
                </View>
              </View>

              <View style={styles.avatarStackRow}>
                {family.members.slice(0, 5).map((m, idx) => (
                  <View key={m.id} style={[styles.stackAvatarBubble, { zIndex: 10 - idx, marginLeft: idx === 0 ? 0 : -10 }]}>
                    <User size={13} color="#FFFFFF" strokeWidth={1.6} />
                  </View>
                ))}
                {family.members.length > 5 && (
                  <View style={[styles.stackAvatarBubble, styles.stackAvatarBubbleMore, { zIndex: 4, marginLeft: -10 }]}>
                    <Text style={styles.stackAvatarMoreText}>+{family.members.length - 5}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statNum}>{family.members.length}</Text>
                  <Text style={styles.statLabel}>{t('family.stat_members')}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statNum}>{managedCount}</Text>
                  <Text style={styles.statLabel}>{t('family.stat_managed')}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statNum}>{pendingInvitesAdmin.length}</Text>
                  <Text style={styles.statLabel}>Invited</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionMargin}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Circle Members</Text>
                <Text style={styles.sectionSub}>Active household members with app access</Text>
              </View>

              {family.members
                .filter((m) => !m.managed)
                .map((member) => {
                  const displayRelation = getDisplayRelation(member);
                  const isOwner = member.role === 'OWNER';
                  return (
                    <Pressable key={member.id} style={styles.memberCard} onPress={() => openViewMember(member)}>
                      <View style={styles.memberAvatarWrap}>
                        <User size={18} color="#000000" strokeWidth={1.5} />
                      </View>
                      <View style={styles.memberInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          <View style={[styles.roleBadge, isOwner ? styles.roleOwner : styles.roleEditor]}>
                            <Text style={[styles.roleText, isOwner && styles.roleTextOwner]}>
                              {t(`family.role_${member.role.toLowerCase()}`)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.memberSubRow}>
                          {displayRelation ? (
                            <View style={styles.relationPill}>
                              <Text style={styles.relationPillText}>
                                {t(`family.relation_${displayRelation.toLowerCase()}`)}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={styles.memberSubText}>Full App Access</Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color="#888888" strokeWidth={1.4} />
                    </Pressable>
                  );
                })}
            </View>

            <View style={styles.sectionMargin}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Managed Dependents</Text>
                <Text style={styles.sectionSub}>Children & elders managed by this household</Text>
              </View>

              {family.members.filter((m) => m.managed).length === 0 ? (
                <View style={styles.emptyDependentCard}>
                  <Text style={styles.emptyDependentText}>No managed dependents added yet</Text>
                </View>
              ) : (
                family.members
                  .filter((m) => m.managed)
                  .map((member) => {
                    const displayRelation = getDisplayRelation(member);
                    return (
                      <Pressable key={member.id} style={styles.memberCard} onPress={() => openViewMember(member)}>
                        <View style={[styles.memberAvatarWrap, styles.memberAvatarWrapManaged]}>
                          <User size={18} color="#000000" strokeWidth={1.5} />
                        </View>
                        <View style={styles.memberInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.memberName}>{member.name}</Text>
                            <View style={styles.managedBadge}>
                              <Text style={styles.managedBadgeText}>{t('family.managed_badge')}</Text>
                            </View>
                          </View>
                          <View style={styles.memberSubRow}>
                            {displayRelation ? (
                              <View style={styles.relationPill}>
                                <Text style={styles.relationPillText}>
                                  {t(`family.relation_${displayRelation.toLowerCase()}`)}
                                </Text>
                              </View>
                            ) : null}
                            <Text style={styles.memberSubText}>Managed Profile</Text>
                          </View>
                        </View>
                        <ChevronRight size={16} color="#888888" strokeWidth={1.4} />
                      </Pressable>
                    );
                  })
              )}

              <Pressable style={styles.addManagedBanner} onPress={openManagedSheet}>
                <View style={styles.addManagedIconWrap}>
                  <HeartHandshake size={20} color="#000000" strokeWidth={1.5} />
                </View>
                <View style={styles.addManagedContent}>
                  <Text style={styles.addManagedTitle}>{t('family.add_managed_title')}</Text>
                  <Text style={styles.addManagedSub}>{t('family.add_managed_sub')}</Text>
                </View>
                <ChevronRight size={16} color="#888888" strokeWidth={1.4} />
              </Pressable>
            </View>

            {invitesForMe.length > 0 && (
              <View style={styles.inviteForMeSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {t('family.invites_for_me_title')} ({invitesForMe.length})
                  </Text>
                  <Text style={styles.sectionSub}>Invitations to join a family</Text>
                </View>
                {invitesForMe.map((invite) => (
                  <View key={invite.id} style={styles.pendingAdminRow}>
                    <View style={styles.pendingAdminInfo}>
                      <Users size={14} color="#555555" strokeWidth={1.5} />
                      <Text style={styles.pendingAdminText}>
                        {invite.familyName || invite.familyId}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable style={styles.addBtn} onPress={() => openAcceptSheet(invite)}>
                        <Text style={styles.addBtnText}>{t('family.accept_invite')}</Text>
                      </Pressable>
                      <Pressable style={styles.cancelInvitePill} onPress={() => handleDeclineInvite(invite)}>
                        <Text style={styles.cancelInviteText}>{t('family.decline_invite')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {pendingInvitesAdmin.length > 0 && (
              <View style={styles.inviteForMeSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {t('family.pending_invites_admin_title')} ({pendingInvitesAdmin.length})
                  </Text>
                  <Text style={styles.sectionSub}>Invitations awaiting member acceptance</Text>
                </View>
                {pendingInvitesAdmin.map((invite) => (
                  <View key={invite.id} style={styles.pendingAdminRow}>
                    <View style={styles.pendingAdminInfo}>
                      <Phone size={14} color="#555555" strokeWidth={1.5} />
                      <Text style={styles.pendingAdminText}>
                        {invitedPhones[invite.id]
                          ? invitedPhones[invite.id]
                          : t('family.status_pending')}
                      </Text>
                    </View>
                    <Pressable style={styles.cancelInvitePill} onPress={() => handleCancelInvite(invite)}>
                      <Text style={styles.cancelInviteText}>{t('family.cancel_invite')}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.inviteForMeSection}>
              <Pressable style={styles.historyToggleRow} onPress={toggleInviteHistory}>
                <View>
                  <Text style={styles.sectionTitle}>{t('family.invite_history_title')}</Text>
                  <Text style={styles.sectionSub}>Audit log of previous invitations</Text>
                </View>
                <Text style={styles.historyToggleText}>
                  {showHistory ? t('family.history_hide') : t('family.history_show')}
                </Text>
              </Pressable>
              {showHistory && (
                loadingHistory ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color="#000000" />
                  </View>
                ) : inviteHistory.length === 0 ? (
                  <Text style={styles.historyEmptyText}>{t('family.history_empty')}</Text>
                ) : (
                  inviteHistory.map((invite) => (
                    <View key={invite.id} style={styles.historyCard}>
                      <Text style={styles.historyCardDate}>
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </Text>
                      <Text style={[styles.historyStatusText, styles[`historyStatus_${invite.status}` as const]]}>
                        {t(`family.status_${invite.status.toLowerCase()}`)}
                      </Text>
                    </View>
                  ))
                )
              )}
            </View>

            {myMembership.member && myMembership.role !== 'OWNER' && (
              <Pressable style={styles.modalLeaveBtn} onPress={handleLeaveFamily}>
                <Text style={styles.modalLeaveText}>{t('family.leave_family')}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={showInviteSheet} onClose={() => setShowInviteSheet(false)} title={t('family.sheet_title_invite')}>
        <View style={styles.sheetInfoBox}>
          <Mail size={16} color="#000000" strokeWidth={1.5} style={{ marginRight: 8 }} />
          <Text style={styles.sheetInfoText}>{t('family.invite_helper')}</Text>
        </View>
        <Text style={styles.label}>{t('family.label_phone')}</Text>
        <TextInput
          style={styles.input}
          value={invitePhone}
          onChangeText={setInvitePhone}
          keyboardType="phone-pad"
          placeholder={t('family.placeholder_phone')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('family.label_relation')}</Text>
        <Text style={styles.helperText}>{t('family.relation_helper')}</Text>
        <View style={styles.chipRow}>
          {relationOptions.map(({ value }) => (
            <Pressable
              key={value}
              style={[styles.chip, inviteRelation === value && styles.chipActive]}
              onPress={() => setInviteRelation(value)}>
              <Text style={[styles.chipText, inviteRelation === value && styles.chipTextActive]}>
                {t(`family.relation_${value.toLowerCase()}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button title={t('family.send_invitation')} onPress={handleSendInvite} loading={inviting} style={styles.modalCta} />
      </BottomSheet>

      <BottomSheet visible={!!acceptingInvite} onClose={() => setAcceptingInvite(null)} title={t('family.sheet_title_accept')}>
        {acceptingInvite && (
          <>
            <View style={styles.sheetInfoBox}>
              <HeartHandshake size={16} color="#000000" strokeWidth={1.5} style={{ marginRight: 8 }} />
              <Text style={styles.sheetInfoText}>
                {t('family.accept_helper', {
                  name: acceptingInvite.invitedByName,
                  relation: t(`family.relation_${acceptingInvite.relation.toLowerCase()}`),
                })}
              </Text>
            </View>
            <Text style={styles.label}>{t('family.label_reciprocal_relation')}</Text>
            <View style={styles.chipRow}>
              {relationOptions.map(({ value }) => (
                <Pressable
                  key={value}
                  style={[
                    styles.chip,
                    acceptReciprocalRelation === value && styles.chipActive,
                    acceptingInvite.suggestedReciprocalRelations.includes(value) && styles.chipSuggested,
                  ]}
                  onPress={() => setAcceptReciprocalRelation(value)}>
                  <Text style={[styles.chipText, acceptReciprocalRelation === value && styles.chipTextActive]}>
                    {t(`family.relation_${value.toLowerCase()}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button
              title={t('family.accept_invitation')}
              onPress={handleConfirmAccept}
              loading={accepting}
              style={styles.modalCta}
            />
          </>
        )}
      </BottomSheet>

      <BottomSheet visible={showManagedSheet} onClose={() => setShowManagedSheet(false)} title={t('family.sheet_title_managed')}>
        <View style={styles.sheetInfoBox}>
          <UserPlus size={16} color="#000000" strokeWidth={1.5} style={{ marginRight: 8 }} />
          <Text style={styles.sheetInfoText}>{t('family.managed_helper')}</Text>
        </View>
        <Text style={styles.label}>{t('family.label_name')}</Text>
        <TextInput
          style={styles.input}
          value={managedName}
          onChangeText={setManagedName}
          placeholder={t('family.placeholder_name')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('family.label_relationship')}</Text>
        <TextInput
          style={styles.input}
          value={managedRelationship}
          onChangeText={setManagedRelationship}
          placeholder={t('family.placeholder_relationship')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Button title={t('family.add_dependent_btn')} onPress={handleAddManaged} loading={addingManaged} style={styles.modalCta} />
      </BottomSheet>

      <BottomSheet visible={!!viewingMember} onClose={() => setViewingMember(null)} title={t('family.sheet_title_view')}>
        {viewingMember && (
          <>
            <View style={styles.nameRow}>
              <Text style={styles.viewMemberName}>{viewingMember.name}</Text>
              <View style={[styles.roleBadge, viewingMember.role === 'OWNER' ? styles.roleOwner : styles.roleEditor]}>
                <Text style={styles.roleText}>{t(`family.role_${viewingMember.role.toLowerCase()}`)}</Text>
              </View>
              {viewingMember.managed && (
                <View style={styles.managedBadge}>
                  <Text style={styles.managedBadgeText}>{t('family.managed_badge')}</Text>
                </View>
              )}
            </View>
            {/* No relation section at all when viewing your own card, or when this
                member's relation to you isn't resolvable (`getDisplayRelation`) — same
                relative-to-viewer value the card's badge already used, not the raw
                relation/relatedToName off the member row, which describes their
                relation to whoever invited *them*, not to whoever is looking. */}
            {getDisplayRelation(viewingMember) && (
              <>
                <Text style={styles.label}>{t('family.label_relation')}</Text>
                <Text style={styles.viewRelationValue}>
                  {t(`family.relation_${getDisplayRelation(viewingMember)!.toLowerCase()}`)}
                </Text>
              </>
            )}
            {/* Only the creator can remove someone else, and never the creator's own
                row — matches the backend's removeMember rule exactly. */}
            {myMembership.isCreator && viewingMember.role !== 'OWNER' && (
              <Pressable style={styles.modalRemoveBtn} onPress={() => handleRemoveMember(viewingMember)}>
                <Text style={styles.modalRemoveText}>🗑️ {t('family.remove_member')}</Text>
              </Pressable>
            )}
          </>
        )}
      </BottomSheet>

      <ModernBottomNav activeTab="family" onTabPress={handleNavPress} />
    </View>
  );
}

const makeStyles = ({ fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEE',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  headerSubtitleText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '400',
    color: '#10B981',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  addBtnPlaceholder: {
    width: 36,
  },
  addBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + 80,
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyState: {
    marginTop: spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#ECECEE',
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.soft,
  },
  emptyStateIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  emptyStateTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  emptyStateSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '300',
    color: '#888888',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  inviteForMeSection: {
    marginBottom: spacing.md,
  },
  inviteForMeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#ECECEE',
    ...shadow.soft,
  },
  inviteForMeText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  inviteForMeRelation: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '400',
    color: '#666666',
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#24242A',
    ...shadow.soft,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroTitle: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#999999',
    marginTop: 2,
  },
  heroSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  heroSyncText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  avatarStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingLeft: 4,
  },
  stackAvatarBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222228',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D0D0D',
  },
  stackAvatarBubbleMore: {
    backgroundColor: '#33333E',
  },
  stackAvatarEmoji: {
    fontSize: 14,
  },
  stackAvatarMoreText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    backgroundColor: '#18181E',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#26262E',
  },
  statNum: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '400',
    color: '#888888',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionMargin: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  sectionSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#888888',
    marginTop: 1,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#ECECEE',
    ...shadow.soft,
  },
  memberAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarWrapManaged: {
    backgroundColor: '#F0F0F5',
  },
  memberAvatar: {
    fontSize: 20,
  },
  memberInfo: {
    flex: 1,
  },
  viewMemberName: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  viewRelationValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: '#000000',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: '#F5F5F7',
  },
  roleOwner: {
    backgroundColor: '#000000',
  },
  roleEditor: {
    backgroundColor: '#F5F5F7',
  },
  roleText: {
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
  },
  roleTextOwner: {
    color: '#FFFFFF',
  },
  memberSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  relationPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  relationPillText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '500',
    color: '#333333',
  },
  memberSubText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#888888',
  },
  managedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  managedBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '600',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  relationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: '#F5F5F7',
  },
  relationBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: '500',
    color: '#444444',
    textTransform: 'uppercase',
  },
  emptyDependentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#ECECEE',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyDependentText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '300',
    color: '#888888',
  },
  addManagedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#ECECEE',
    ...shadow.soft,
  },
  addManagedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addManagedContent: {
    flex: 1,
  },
  addManagedTitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  addManagedSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#666666',
    marginTop: 1,
  },
  inviteResponseRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  acceptBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  acceptBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  declineBtn: {
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#ECECEE',
  },
  declineBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '500',
    color: '#555555',
  },
  pendingAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#ECECEE',
  },
  pendingAdminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pendingAdminText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
  },
  cancelInvitePill: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  cancelInviteText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#FF3B30',
  },
  historyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyToggleText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  historyEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '300',
    color: '#888888',
    marginTop: spacing.sm,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#ECECEE',
  },
  historyCardDate: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#444444',
  },
  historyStatusText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  historyStatus_PENDING: {
    color: '#F59E0B',
  },
  historyStatus_ACCEPTED: {
    color: '#10B981',
  },
  historyStatus_DECLINED: {
    color: '#FF3B30',
  },
  historyStatus_CANCELLED: {
    color: '#888888',
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#888888',
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  helperText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '300',
    color: '#666666',
    marginTop: -4,
    marginBottom: 8,
    lineHeight: 16,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#ECECEE',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: '#000000',
    width: '100%',
  },
  placeholder: {
    color: '#999999',
  },
  sheetInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ECECEE',
    padding: spacing.md,
    marginBottom: 4,
  },
  sheetInfoIcon: {
    fontSize: 18,
  },
  sheetInfoText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#666666',
    lineHeight: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#ECECEE',
  },
  chipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipSuggested: {
    borderColor: '#F59E0B',
  },
  chipText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#444444',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalCta: {
    marginTop: 24,
  },
  modalRemoveBtn: {
    marginTop: 14,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  modalRemoveText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  modalLeaveBtn: {
    marginTop: 4,
    marginBottom: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalLeaveText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#888888',
    textDecorationLine: 'underline',
  },
});
