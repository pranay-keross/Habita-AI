// Matches `FamilyMemberResponse`/`FamilyResponse`/`FamilyInviteResponse` from
// `Saheli-Backend.postman_collection.json`'s Family folder — real backend shapes, not a
// local model. `OWNER` is permanent (assigned once at family creation, never reassignable
// through the API); `ADMIN` can invite/remove/change roles/manage dependents; `MEMBER`
// cannot.
export type FamilyRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export interface FamilyMember {
  id: string;
  name: string;
  role: FamilyRole;
  // A dependent (ManagedMember-backed row) has no login of their own — `managedMemberId`
  // is what Remove Managed Member needs; a User-backed member's own `userId` is not part
  // of this response at all (see docs/BACKEND_CONTEXT.md's identity-resolution gap).
  managed: boolean;
  managedMemberId: string | null;
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
}

// Assignable at invite time or role-change time — OWNER is never one of these, per the
// backend's "Ownership cannot be assigned this way" guardrail.
export const ASSIGNABLE_ROLES: Exclude<FamilyRole, 'OWNER'>[] = ['ADMIN', 'MEMBER'];
