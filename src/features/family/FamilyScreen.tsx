import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import useAuth from '../../hooks/useAuth';
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
  updateMemberRole,
  updateRelationship,
  type FamilyErrorKind,
  type MyMembership,
} from './api';
import {
  ALL_RELATIONS,
  ASSIGNABLE_ROLES,
  type Family,
  type FamilyInvite,
  type FamilyMember,
  type FamilyRelation,
  type FamilyRole,
} from './types';

export type { FamilyMember } from './types';

type Props = StackScreenProps<RootStackParamList, 'Family'>;

const EMPTY_MEMBERSHIP: MyMembership = { member: null, role: 'MEMBER', isOwner: false, isAdmin: false };

export default function FamilyScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken, getUserId } = useAuth();

  const [loading, setLoading] = useState(true);
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
  const [inviteRole, setInviteRole] = useState<Exclude<FamilyRole, 'OWNER'>>('MEMBER');
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

  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [editRole, setEditRole] = useState<Exclude<FamilyRole, 'OWNER'>>('MEMBER');
  const [editRelation, setEditRelation] = useState<FamilyRelation | null>(null);
  const [editReciprocalRelation, setEditReciprocalRelation] = useState<FamilyRelation | null>(null);
  const [savingMember, setSavingMember] = useState(false);

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
      if (membership.isAdmin) {
        setPendingInvitesAdmin(await listFamilyPendingInvites(primary.id, token));
      } else {
        setPendingInvitesAdmin([]);
      }
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

  useEffect(() => {
    setLoading(true);
    reload({ silent: true }).finally(() => setLoading(false));
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setInviteRole('MEMBER');
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
        const invite = await inviteMember(family.id, phone, inviteRole, inviteRelation, token);
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

  const openEditMember = (member: FamilyMember) => {
    if (!myMembership.isAdmin || member.role === 'OWNER') {
      return;
    }
    setEditingMember(member);
    setEditRole(member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER');
    setEditRelation(member.relation);
    setEditReciprocalRelation(member.reciprocalRelation);
  };

  // Every member, admin or not, can open this — it's the only way a plain MEMBER (e.g.
  // an invite recipient who just accepted) has to see anyone else's relation, since the
  // full edit sheet stays admin-only. Read-only: no role/relation controls, just what
  // `GET /families/{id}` already returned.
  const openViewMember = (member: FamilyMember) => {
    setViewingMember(member);
  };

  const handleMemberPress = (member: FamilyMember) => {
    if (myMembership.isAdmin && member.role !== 'OWNER') {
      openEditMember(member);
    } else {
      openViewMember(member);
    }
  };

  const handleSaveMemberRole = async () => {
    if (!family || !editingMember) {
      return;
    }
    setSavingMember(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await updateMemberRole(family.id, editingMember.id, editRole, token);
        // Only a User-backed, invite-accepted member has a relationship row to correct —
        // the owner and managed members never do (types.ts's FamilyMember doc comment).
        if (editingMember.relationshipId && editRelation && editReciprocalRelation) {
          await updateRelationship(family.id, editingMember.relationshipId, editRelation, editReciprocalRelation, token);
        }
        setEditingMember(null);
        await reload();
      }
    } catch (err) {
      showError(err);
    } finally {
      setSavingMember(false);
    }
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
              setEditingMember(null);
              await reload();
            }
          } catch (err) {
            showError(err);
          }
        },
      },
    ]);
  };

  // Remove Member needs admin access on the *caller*, not just ownership of the row
  // being removed — so a plain MEMBER has no self-service leave endpoint on this
  // backend at all (docs/BACKEND_CONTEXT.md's "no self-service leave" gap). Rather than
  // hiding the option entirely (the previous behavior, and exactly what was reported as
  // "no option to leave"), a MEMBER still sees the entry point and gets told why it
  // can't complete yet instead of silently having no path at all. OWNER can never be
  // removed by anyone, including themselves, so they don't get this entry point.
  const handleLeaveFamily = () => {
    if (!myMembership.member) {
      return;
    }
    if (!myMembership.isAdmin) {
      Alert.alert(t('family.leave_needs_admin_title'), t('family.leave_needs_admin_msg'));
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

  const adminCount = family?.members.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN').length ?? 0;
  const managedCount = family?.members.filter((m) => m.managed).length ?? 0;

  // `member.relation`/`relatedToName` describe one directed edge — "this member relates
  // to relatedToUserId as relation" — recorded once, on the accepted-invite member's own
  // row. That's enough to show a relation next to a member *I* invited (their row's
  // `relatedToUserId` is my own userId, so `member.relation` already reads correctly as
  // "their relation to me"). It is NOT enough, on its own, to label the person who
  // invited *me* — that person's own row (often the OWNER) carries no relation fields at
  // all, since nobody accepted an invite to become them. My own row's
  // `reciprocalRelation` is the other half of that same edge, so borrowing it here is
  // what makes their card show "Brother" instead of nothing. Only resolvable when the
  // other side is the OWNER, since that's the one non-owner row whose userId this screen
  // can actually confirm (`family.ownerUserId`) — see docs/BACKEND_CONTEXT.md's
  // identity-resolution gap for why every other pairing can't be resolved this way.
  const getDisplayRelation = (member: FamilyMember): FamilyRelation | null => {
    if (!family || !myMembership.member || member.id === myMembership.member.id) {
      return null;
    }
    if (myUserId && member.relatedToUserId === myUserId) {
      return member.relation;
    }
    if (member.role === 'OWNER' && myMembership.member.relatedToUserId === family.ownerUserId) {
      return myMembership.member.reciprocalRelation;
    }
    return null;
  };

  return (
    <View style={styles.root} key={localeVersion}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('family.header_title')}</Text>
        {family && myMembership.isAdmin ? (
          <Pressable onPress={openInviteSheet} style={styles.addBtn}>
            <Text style={styles.addBtnText}>{t('family.invite_btn')}</Text>
          </Pressable>
        ) : (
          <View style={styles.addBtnPlaceholder} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={styles.addBtnText.color} />
          </View>
        ) : loadError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📡</Text>
            <Text style={styles.emptyStateTitle}>{t('family.load_error_title')}</Text>
            <Text style={styles.emptyStateSub}>{t(errorMessageKey(loadError))}</Text>
            <Button
              title={t('family.retry_btn')}
              onPress={() => {
                setLoading(true);
                reload({ silent: true }).finally(() => setLoading(false));
              }}
              style={styles.modalCta}
            />
          </View>
        ) : (
          <>
            {invitesForMe.length > 0 && (
              <View style={styles.inviteForMeSection}>
                <Text style={styles.sectionTitle}>{t('family.invites_for_me_title')}</Text>
                {invitesForMe.map((invite) => (
                  <View key={invite.id} style={styles.inviteForMeCard}>
                    <Text style={styles.inviteForMeText}>
                      {t('family.invited_by', { name: invite.invitedByName, family: invite.familyName })}
                    </Text>
                    <Text style={styles.inviteForMeRelation}>
                      {t('family.invited_as_relation', { relation: t(`family.relation_${invite.relation.toLowerCase()}`) })}
                    </Text>
                    <View style={styles.inviteResponseRow}>
                      <Pressable style={styles.acceptBtn} onPress={() => openAcceptSheet(invite)}>
                        <Text style={styles.acceptBtnText}>{t('family.accept')}</Text>
                      </Pressable>
                      <Pressable style={styles.declineBtn} onPress={() => handleDeclineInvite(invite)}>
                        <Text style={styles.declineBtnText}>{t('family.decline')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!family ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🏠</Text>
                <Text style={styles.emptyStateTitle}>{t('family.no_family_title')}</Text>
                <Text style={styles.emptyStateSub}>{t('family.no_family_sub')}</Text>
                <TextInput
                  style={styles.input}
                  value={newFamilyName}
                  onChangeText={setNewFamilyName}
                  placeholder={t('family.create_family_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
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
                  <Text style={styles.heroTitle}>{family.name}</Text>
                  <Text style={styles.heroSubtitle}>{t('family.hero_subtitle')}</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statChip}>
                      <Text style={styles.statNum}>{family.members.length}</Text>
                      <Text style={styles.statLabel}>{t('family.stat_members')}</Text>
                    </View>
                    <View style={styles.statChip}>
                      <Text style={styles.statNum}>{adminCount}</Text>
                      <Text style={styles.statLabel}>{t('family.stat_admins')}</Text>
                    </View>
                    <View style={styles.statChip}>
                      <Text style={styles.statNum}>{managedCount}</Text>
                      <Text style={styles.statLabel}>{t('family.stat_managed')}</Text>
                    </View>
                  </View>
                </View>

                {!myMembership.isAdmin && (
                  <View style={styles.readonlyBanner}>
                    <Text style={styles.readonlyText}>{t('family.readonly_note')}</Text>
                  </View>
                )}

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('family.section_title')}</Text>
                  <Text style={styles.sectionSub}>{t('family.section_sub')}</Text>
                </View>

                {family.members.map((member) => {
                  const displayRelation = getDisplayRelation(member);
                  return (
                    <Pressable key={member.id} style={styles.memberCard} onPress={() => handleMemberPress(member)}>
                      <View style={styles.memberAvatarWrap}>
                        <Text style={styles.memberAvatar}>{member.managed ? '🧓' : '🧑'}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          <View style={[styles.roleBadge, member.role === 'OWNER' ? styles.roleOwner : styles.roleEditor]}>
                            <Text style={styles.roleText}>{t(`family.role_${member.role.toLowerCase()}`)}</Text>
                          </View>
                          {displayRelation && (
                            <View style={styles.relationBadge}>
                              <Text style={styles.relationBadgeText}>
                                {t(`family.relation_${displayRelation.toLowerCase()}`)}
                              </Text>
                            </View>
                          )}
                          {member.managed && (
                            <View style={styles.managedBadge}>
                              <Text style={styles.managedBadgeText}>{t('family.managed_badge')}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.editChevronWrap}>
                        <Text style={styles.editChevron}>
                          {myMembership.isAdmin && member.role !== 'OWNER' ? '✏️' : '›'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}

                {myMembership.isAdmin && (
                  <Pressable style={styles.inviteBanner} onPress={openManagedSheet}>
                    <Text style={styles.inviteBannerIcon}>👪</Text>
                    <View style={styles.inviteBannerContent}>
                      <Text style={styles.inviteBannerTitle}>{t('family.add_managed_title')}</Text>
                      <Text style={styles.inviteBannerSub}>{t('family.add_managed_sub')}</Text>
                    </View>
                    <Text style={styles.inviteBannerArrow}>→</Text>
                  </Pressable>
                )}

                {myMembership.isAdmin && pendingInvitesAdmin.length > 0 && (
                  <View style={styles.inviteForMeSection}>
                    <Text style={styles.sectionTitle}>
                      {t('family.pending_invites_admin_title')} ({pendingInvitesAdmin.length})
                    </Text>
                    {pendingInvitesAdmin.map((invite) => (
                      <View key={invite.id} style={styles.pendingAdminRow}>
                        <Text style={styles.pendingAdminText}>
                          {invitedPhones[invite.id]
                            ? t('family.pending_invite_sent_to', { phone: invitedPhones[invite.id] })
                            : t('family.status_pending')}
                        </Text>
                        <Pressable onPress={() => handleCancelInvite(invite)}>
                          <Text style={styles.cancelInviteText}>{t('family.cancel_invite')}</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {myMembership.isAdmin && (
                  <View style={styles.inviteForMeSection}>
                    <Pressable style={styles.historyToggleRow} onPress={toggleInviteHistory}>
                      <Text style={styles.sectionTitle}>{t('family.invite_history_title')}</Text>
                      <Text style={styles.historyToggleText}>
                        {showHistory ? t('family.history_hide') : t('family.history_show')}
                      </Text>
                    </Pressable>
                    {showHistory && (
                      loadingHistory ? (
                        <View style={styles.loadingWrap}>
                          <ActivityIndicator color={styles.addBtnText.color} />
                        </View>
                      ) : inviteHistory.length === 0 ? (
                        <Text style={styles.historyEmptyText}>{t('family.history_empty')}</Text>
                      ) : (
                        inviteHistory.map((invite) => (
                          <View key={invite.id} style={styles.pendingAdminRow}>
                            <Text style={styles.pendingAdminText}>
                              {t(`family.role_${invite.role.toLowerCase()}`)} · {new Date(invite.createdAt).toLocaleDateString()}
                            </Text>
                            <Text style={[styles.historyStatusText, styles[`historyStatus_${invite.status}` as const]]}>
                              {t(`family.status_${invite.status.toLowerCase()}`)}
                            </Text>
                          </View>
                        ))
                      )
                    )}
                  </View>
                )}

                {myMembership.member && myMembership.role !== 'OWNER' && (
                  <Pressable style={styles.modalLeaveBtn} onPress={handleLeaveFamily}>
                    <Text style={styles.modalLeaveText}>{t('family.leave_family')}</Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={showInviteSheet} onClose={() => setShowInviteSheet(false)} title={t('family.sheet_title_invite')}>
        <View style={styles.sheetInfoBox}>
          <Text style={styles.sheetInfoIcon}>📨</Text>
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
        <Text style={styles.label}>{t('family.label_role')}</Text>
        <View style={styles.chipRow}>
          {ASSIGNABLE_ROLES.map((role) => (
            <Pressable
              key={role}
              style={[styles.chip, inviteRole === role && styles.chipActive]}
              onPress={() => setInviteRole(role)}>
              <Text style={[styles.chipText, inviteRole === role && styles.chipTextActive]}>
                {t(`family.role_${role.toLowerCase()}`)}
              </Text>
            </Pressable>
          ))}
        </View>
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
              <Text style={styles.sheetInfoIcon}>🤝</Text>
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
          <Text style={styles.sheetInfoIcon}>🧓</Text>
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

      <BottomSheet visible={!!editingMember} onClose={() => setEditingMember(null)} title={t('family.sheet_title_edit')}>
        <Text style={styles.label}>{editingMember?.name}</Text>
        <View style={styles.chipRow}>
          {ASSIGNABLE_ROLES.map((role) => (
            <Pressable
              key={role}
              style={[styles.chip, editRole === role && styles.chipActive]}
              onPress={() => setEditRole(role)}>
              <Text style={[styles.chipText, editRole === role && styles.chipTextActive]}>
                {t(`family.role_${role.toLowerCase()}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        {editingMember?.relationshipId && editRelation && editReciprocalRelation && (
          <>
            <Text style={styles.label}>{t('family.label_relation')}</Text>
            <Text style={styles.helperText}>
              {t('family.relation_correction_helper', { name: editingMember.relatedToName ?? '' })}
            </Text>
            <View style={styles.chipRow}>
              {relationOptions.map(({ value }) => (
                <Pressable
                  key={value}
                  style={[styles.chip, editRelation === value && styles.chipActive]}
                  onPress={() => setEditRelation(value)}>
                  <Text style={[styles.chipText, editRelation === value && styles.chipTextActive]}>
                    {t(`family.relation_${value.toLowerCase()}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{t('family.label_reciprocal_relation')}</Text>
            <View style={styles.chipRow}>
              {relationOptions.map(({ value }) => (
                <Pressable
                  key={value}
                  style={[styles.chip, editReciprocalRelation === value && styles.chipActive]}
                  onPress={() => setEditReciprocalRelation(value)}>
                  <Text style={[styles.chipText, editReciprocalRelation === value && styles.chipTextActive]}>
                    {t(`family.relation_${value.toLowerCase()}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Button title={t('family.save_changes')} onPress={handleSaveMemberRole} loading={savingMember} style={styles.modalCta} />
        {editingMember && (
          <Pressable style={styles.modalRemoveBtn} onPress={() => handleRemoveMember(editingMember)}>
            <Text style={styles.modalRemoveText}>🗑️ {t('family.remove_member')}</Text>
          </Pressable>
        )}
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
          </>
        )}
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
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
  addBtnPlaceholder: {
    width: 1,
  },
  addBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.textOnPrimary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyState: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyStateSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  inviteForMeSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  inviteForMeCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.turmeric,
    borderStyle: 'dashed',
  },
  inviteForMeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  inviteForMeRelation: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  readonlyBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  readonlyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
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
    color: colors.textOnPrimary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textOnPrimaryMuted,
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
    color: colors.textOnPrimary,
  },
  statLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textOnPrimaryMuted,
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
    backgroundColor: colors.surfaceElevated,
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
  viewMemberName: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.textPrimary,
  },
  viewRelationValue: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    color: colors.textOnPrimary,
    textTransform: 'uppercase',
  },
  managedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  managedBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // How this member relates to *the current viewer* (`getDisplayRelation`), not the raw
  // relation off the member row — deliberately styled distinctly from `roleBadge`
  // (fill) and `managedBadge` (neutral outline) so all three read as different kinds of
  // fact about the same person.
  relationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.blush,
  },
  relationBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
  inviteResponseRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  acceptBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.textOnPrimary,
  },
  declineBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.textSecondary,
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
  pendingAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingAdminText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
  },
  historyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyToggleText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.primary,
  },
  historyEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  historyStatusText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  historyStatus_PENDING: {
    color: colors.turmeric,
  },
  historyStatus_ACCEPTED: {
    color: colors.primary,
  },
  historyStatus_DECLINED: {
    color: colors.danger,
  },
  historyStatus_CANCELLED: {
    color: colors.textMuted,
  },
  cancelInviteText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.danger,
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
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
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  helperText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -4,
    marginBottom: 8,
    lineHeight: 16,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
    width: '100%',
  },
  // `placeholderTextColor` is a prop, not a style — the colour is kept here so
  // the factory stays the single place this screen reads the palette.
  placeholder: {
    color: colors.textMuted,
  },
  sheetInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
    lineHeight: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
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
  // Marks a chip among relationOptions' `suggestedReciprocals` for the invite being
  // accepted — a border-only accent so it stays visually distinct from `chipActive`
  // (the actually-selected value) even when a suggested chip is also the selection.
  chipSuggested: {
    borderColor: colors.turmeric,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  modalCta: {
    marginTop: 24,
  },
  modalRemoveBtn: {
    marginTop: 14,
    marginBottom: 24,
    backgroundColor: colors.dangerSoft,
    paddingVertical: 12,
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  modalRemoveText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.danger,
  },
  modalLeaveBtn: {
    marginTop: 4,
    marginBottom: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalLeaveText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
