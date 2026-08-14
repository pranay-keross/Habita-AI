// Matches `FamilyMemberResponse`/`FamilyResponse`/`FamilyInviteResponse` from
// `Saheli Backend — Auth, Profile & Family.postman_collection.json`'s Family folder —
// real backend shapes, not a local model. `OWNER` is permanent (assigned once at family
// creation, never reassignable through the API); `ADMIN` can invite/remove/change
// roles/manage dependents; `MEMBER` cannot.
export type FamilyRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

// The invited person's relation to the inviter (set on Invite Member) and, once
// accepted, the inviter's relation back to them (set on Accept Invite) — see
// docs/DECISIONS.md's relation-tracking entry. Static enum returned by
// `GET /families/relations`, mirrored here rather than fetched-and-cached, since the
// backend documents it as a fixed lookup with no family context.
export type FamilyRelation =
  | 'MOTHER'
  | 'FATHER'
  | 'SON'
  | 'DAUGHTER'
  | 'HUSBAND'
  | 'WIFE'
  | 'BROTHER'
  | 'SISTER'
  | 'GRANDFATHER'
  | 'GRANDMOTHER'
  | 'GRANDSON'
  | 'GRANDDAUGHTER'
  | 'UNCLE'
  | 'AUNT'
  | 'NEPHEW'
  | 'NIECE'
  | 'COUSIN'
  | 'FRIEND'
  | 'OTHER';

// Order and suggestedReciprocals match `GET /families/relations`'s saved example
// exactly — the picker renders in this order and `ALL_RELATIONS.map(r => r.value)` is
// the full enum for validation/lookup.
export const ALL_RELATIONS: { value: FamilyRelation; suggestedReciprocals: FamilyRelation[] }[] = [
  { value: 'MOTHER', suggestedReciprocals: ['SON', 'DAUGHTER'] },
  { value: 'FATHER', suggestedReciprocals: ['SON', 'DAUGHTER'] },
  { value: 'SON', suggestedReciprocals: ['MOTHER', 'FATHER'] },
  { value: 'DAUGHTER', suggestedReciprocals: ['MOTHER', 'FATHER'] },
  { value: 'HUSBAND', suggestedReciprocals: ['WIFE'] },
  { value: 'WIFE', suggestedReciprocals: ['HUSBAND'] },
  { value: 'BROTHER', suggestedReciprocals: ['BROTHER', 'SISTER'] },
  { value: 'SISTER', suggestedReciprocals: ['BROTHER', 'SISTER'] },
  { value: 'GRANDFATHER', suggestedReciprocals: ['GRANDSON', 'GRANDDAUGHTER'] },
  { value: 'GRANDMOTHER', suggestedReciprocals: ['GRANDSON', 'GRANDDAUGHTER'] },
  { value: 'GRANDSON', suggestedReciprocals: ['GRANDFATHER', 'GRANDMOTHER'] },
  { value: 'GRANDDAUGHTER', suggestedReciprocals: ['GRANDFATHER', 'GRANDMOTHER'] },
  { value: 'UNCLE', suggestedReciprocals: ['NEPHEW', 'NIECE'] },
  { value: 'AUNT', suggestedReciprocals: ['NEPHEW', 'NIECE'] },
  { value: 'NEPHEW', suggestedReciprocals: ['UNCLE', 'AUNT'] },
  { value: 'NIECE', suggestedReciprocals: ['UNCLE', 'AUNT'] },
  { value: 'COUSIN', suggestedReciprocals: ['COUSIN'] },
  { value: 'FRIEND', suggestedReciprocals: ['FRIEND'] },
  { value: 'OTHER', suggestedReciprocals: ['OTHER'] },
];

export interface FamilyMember {
  id: string;
  name: string;
  role: FamilyRole;
  // A dependent (ManagedMember-backed row) has no login of their own — `managedMemberId`
  // is what Remove Managed Member needs; a User-backed member's own `userId` is not part
  // of this response at all (see docs/BACKEND_CONTEXT.md's identity-resolution gap).
  managed: boolean;
  managedMemberId: string | null;
  // Null for the OWNER (no relation to themselves) and for a managed member (dependents
  // use the free-text `relationship` field instead — see `addManagedMember`). Set for
  // every other member from the invite/accept flow: `relation` is how this member
  // relates to `relatedToUserId`/`relatedToName` (the inviter), `reciprocalRelation` is
  // how the inviter relates back. `relationshipId` is the id of the underlying
  // FamilyRelationship row, needed to correct it via `updateRelationship`.
  relationshipId: string | null;
  relatedToUserId: string | null;
  relatedToName: string | null;
  relation: FamilyRelation | null;
  reciprocalRelation: FamilyRelation | null;
}

export interface Family {
  id: string;
  name: string;
  ownerUserId: string;
  members: FamilyMember[];
}

export interface FamilyInvite {
  id: string;
  familyId: string;
  familyName: string;
  invitedByName: string;
  role: FamilyRole;
  status: InviteStatus;
  createdAt: string;
  // The invitee's relation to the inviter, set by the inviter at invite time.
  // `suggestedReciprocalRelations` is what Accept Invite's reciprocalRelation picker
  // should offer as quick choices (not the only valid values — any FamilyRelation is
  // accepted, these are just the backend's suggestions for this specific relation).
  relation: FamilyRelation;
  suggestedReciprocalRelations: FamilyRelation[];
}

// One row per User-backed non-owner FamilyMember, created on invite accept. Has its own
// id, separate from the FamilyMember/FamilyInvite it came from, specifically so it can
// be corrected via `updateRelationship` without touching membership itself.
export interface FamilyRelationship {
  id: string;
  familyId: string;
  familyMemberId: string;
  memberName: string;
  relatedToUserId: string;
  relatedToName: string;
  relation: FamilyRelation;
  reciprocalRelation: FamilyRelation;
}

// Assignable at invite time or role-change time — OWNER is never one of these, per the
// backend's "Ownership cannot be assigned this way" guardrail.
export const ASSIGNABLE_ROLES: Exclude<FamilyRole, 'OWNER'>[] = ['ADMIN', 'MEMBER'];
