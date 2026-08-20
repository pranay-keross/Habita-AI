import { apiFetch, ApiError } from '../auth/api';
import { getItem, setItem } from '../../utils/storage';
import type { Family, FamilyInvite, FamilyMember, FamilyRelation, FamilyRelationship, FamilyRole } from './types';

// Same key `onboarding/profile.tsx` writes to (`PROFILE_STORAGE_KEY`) — read directly
// rather than importing a screen module, same pattern already used for the inline
// `habita.user_phone` reads in `otp.tsx`/`phone.tsx` (docs/DECISIONS.md D-019).
const PROFILE_STORAGE_KEY = 'habita.user_profile';

// `FamilyInviteResponse` never carries the invitee's phone number (real backend
// contract gap — see docs/BACKEND_CONTEXT.md), so the admin "pending invites" list has
// no way to show who an invite actually went to. Cached client-side, keyed by invite
// id, at the moment an invite is sent. Best-effort: an invite sent from another
// device/install, or before this cache existed, just won't resolve.
const INVITE_PHONES_STORAGE_KEY = 'habita.family_invite_phones';

export async function createFamily(name: string, token: string): Promise<Family> {
  return apiFetch<Family>('/families', { method: 'POST', body: { name }, token });
}

export async function listMyFamilies(token: string): Promise<Family[]> {
  return apiFetch<Family[]>('/families', { method: 'GET', token });
}

export async function getFamily(familyId: string, token: string): Promise<Family> {
  return apiFetch<Family>(`/families/${familyId}`, { method: 'GET', token });
}

export async function inviteMember(
  familyId: string,
  phone: string,
  relation: FamilyRelation,
  token: string,
): Promise<FamilyInvite> {
  return apiFetch<FamilyInvite>(`/families/${familyId}/members`, {
    method: 'POST',
    body: { phone, relation },
    token,
  });
}

// Static lookup, no family context — fetched once per screen load rather than baked
// into a constant, per the endpoint's own description ("use this instead of hardcoding
// the enum"). `types.ts`'s `ALL_RELATIONS` mirrors the same saved example as a
// same-shape fallback for the brief window before this resolves, and so validation
// logic has a value to type against without waiting on a network round trip.
export async function listRelationOptions(
  token: string,
): Promise<{ value: FamilyRelation; suggestedReciprocals: FamilyRelation[] }[]> {
  return apiFetch<{ value: FamilyRelation; suggestedReciprocals: FamilyRelation[] }[]>('/families/relations', {
    method: 'GET',
    token,
  });
}

export async function listMyPendingInvites(token: string): Promise<FamilyInvite[]> {
  return apiFetch<FamilyInvite[]>('/families/invites', { method: 'GET', token });
}

export async function acceptInvite(
  inviteId: string,
  reciprocalRelation: FamilyRelation,
  token: string,
): Promise<Family> {
  return apiFetch<Family>(`/families/invites/${inviteId}/accept`, {
    method: 'POST',
    body: { reciprocalRelation },
    token,
  });
}

export async function declineInvite(inviteId: string, token: string): Promise<void> {
  await apiFetch<void>(`/families/invites/${inviteId}/decline`, { method: 'POST', token });
}

export async function listFamilyPendingInvites(familyId: string, token: string): Promise<FamilyInvite[]> {
  return apiFetch<FamilyInvite[]>(`/families/${familyId}/invites`, { method: 'GET', token });
}

export async function cancelInvite(familyId: string, inviteId: string, token: string): Promise<void> {
  await apiFetch<void>(`/families/${familyId}/invites/${inviteId}`, { method: 'DELETE', token });
}

// Every invite ever sent for this family, any status (PENDING/ACCEPTED/DECLINED/
// CANCELLED) — unlike listFamilyPendingInvites above, which the backend filters to
// PENDING only. Any member can read.
export async function listFamilyInviteHistory(familyId: string, token: string): Promise<FamilyInvite[]> {
  return apiFetch<FamilyInvite[]>(`/families/${familyId}/invites/history`, { method: 'GET', token });
}

// One FamilyRelationship per User-backed non-owner member, created on invite accept —
// its own id, separate from the FamilyMember row, so it can be looked up/corrected via
// updateRelationship without touching membership. Any member can read.
export async function listRelationships(familyId: string, token: string): Promise<FamilyRelationship[]> {
  return apiFetch<FamilyRelationship[]>(`/families/${familyId}/relationships`, { method: 'GET', token });
}

export async function getRelationship(
  familyId: string,
  relationshipId: string,
  token: string,
): Promise<FamilyRelationship> {
  return apiFetch<FamilyRelationship>(`/families/${familyId}/relationships/${relationshipId}`, {
    method: 'GET',
    token,
  });
}

// Corrects a relationship after the fact — e.g. the invitee picked the wrong reciprocal
// at accept time. Any member can correct it.
export async function updateRelationship(
  familyId: string,
  relationshipId: string,
  relation: FamilyRelation,
  reciprocalRelation: FamilyRelation,
  token: string,
): Promise<FamilyRelationship> {
  return apiFetch<FamilyRelationship>(`/families/${familyId}/relationships/${relationshipId}`, {
    method: 'PATCH',
    body: { relation, reciprocalRelation },
    token,
  });
}

export async function removeMember(familyId: string, familyMemberId: string, token: string): Promise<void> {
  await apiFetch<void>(`/families/${familyId}/members/${familyMemberId}`, { method: 'DELETE', token });
}

export async function addManagedMember(
  familyId: string,
  name: string,
  relationship: string,
  token: string,
): Promise<Family> {
  return apiFetch<Family>(`/families/${familyId}/managed-members`, {
    method: 'POST',
    body: { name, relationship },
    token,
  });
}

export async function removeManagedMember(
  familyId: string,
  managedMemberId: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/families/${familyId}/managed-members/${managedMemberId}`, {
    method: 'DELETE',
    token,
  });
}

// Convenience for screens that only care about "my one family" — the backend supports
// multiple, but nothing in this client has a family switcher yet (see
// docs/BACKEND_CONTEXT.md). `null` means the caller has no family at all, distinct from
// a network/auth failure, which throws.
export async function getMyPrimaryFamily(token: string): Promise<Family | null> {
  const families = await listMyFamilies(token);
  return families[0] ?? null;
}

export interface MyMembership {
  member: FamilyMember | null;
  role: FamilyRole;
  isOwner: boolean;
  isCreator: boolean; // role === 'OWNER' — the only member who can remove someone else
}

// `FamilyMemberResponse` carries no `userId` for a non-owner row (a real backend
// contract gap — see docs/BACKEND_CONTEXT.md), so "which member is me" can only be
// answered two ways: an exact match against `Family.ownerUserId` (always reliable), or a
// best-effort name match against the caller's own profile name (unreliable if two
// members share a name, or if a member renamed since joining). Unresolved falls back to
// a plain 'MEMBER' read — every member (resolved or not) already has full add/edit
// access, so an unresolved match only costs the ability to leave/be identified as the
// creator, not any read/write capability.
export function resolveMyMembership(
  family: Family,
  userId: string | null,
  profileName: string | null,
): MyMembership {
  if (userId && family.ownerUserId === userId) {
    const owner = family.members.find((m) => m.role === 'OWNER') ?? null;
    return { member: owner, role: 'OWNER', isOwner: true, isCreator: true };
  }
  // Trimmed + case-insensitive: the exact match this used to require broke easily on
  // nothing more than incidental casing/whitespace drift between the locally-cached
  // profile name and what the backend stored on the member row.
  const normalizedProfileName = profileName?.trim().toLowerCase() || null;
  const mine = normalizedProfileName
    ? family.members.find((m) => !m.managed && m.name.trim().toLowerCase() === normalizedProfileName) ?? null
    : null;
  return { member: mine, role: 'MEMBER', isOwner: false, isCreator: false };
}

// Reads the locally-cached profile name (same offline-fallback pattern `profile.tsx`
// already uses for `GET /profile/details`) rather than making a second network round
// trip just to resolve "who am I" for resolveMyMembership above.
export async function getMyProfileName(): Promise<string | null> {
  const stored = await getItem<{ name?: string } | null>(PROFILE_STORAGE_KEY, null);
  return stored?.name || null;
}

export async function rememberInvitedPhone(inviteId: string, phone: string): Promise<void> {
  const map = await getItem<Record<string, string>>(INVITE_PHONES_STORAGE_KEY, {});
  await setItem(INVITE_PHONES_STORAGE_KEY, { ...map, [inviteId]: phone });
}

export async function getInvitedPhones(): Promise<Record<string, string>> {
  return getItem<Record<string, string>>(INVITE_PHONES_STORAGE_KEY, {});
}

export type FamilyErrorKind =
  | 'network'
  | 'not_found'
  | 'no_permission'
  | 'phone_not_registered'
  | 'already_member'
  | 'family_full'
  | 'unknown';

function extractMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'message' in body && typeof (body as { message: unknown }).message === 'string') {
    return (body as { message: string }).message;
  }
  return null;
}

// Same message-matching shape as `parseAuthError` (`src/features/auth/api.ts`,
// docs/DECISIONS.md D-013) — the Family endpoints are equally guilty of using 400/401
// for everything, so status code alone can't tell these apart.
export function parseFamilyError(err: unknown): FamilyErrorKind {
  if (!(err instanceof ApiError)) {
    return 'unknown';
  }
  if (err.status === 0) {
    return 'network';
  }

  const message = extractMessage(err.body);

  if (
    message === 'Family not found' ||
    message === 'Family member not found' ||
    message === 'Invite not found' ||
    message === 'Managed member not found in this family' ||
    message === 'Relationship not found'
  ) {
    return 'not_found';
  }
  if (
    message === 'You are not a member of this family' ||
    message === 'Only the family creator can perform this action' ||
    message === 'Only the family creator can remove other members' ||
    message === 'Cannot remove the family creator'
  ) {
    return 'no_permission';
  }
  if (message?.startsWith('No registered user with phone')) {
    return 'phone_not_registered';
  }
  if (
    message === 'User is already a member of this family' ||
    message === 'User already has a pending invite to this family'
  ) {
    return 'already_member';
  }
  if (message === 'Family already has the maximum of 5 members') {
    return 'family_full';
  }
  return 'unknown';
}
