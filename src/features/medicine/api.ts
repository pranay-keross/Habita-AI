import { apiFetch, ApiError, postMultipart } from '../auth/api';

// Real backend contract for the "Medchest" domain, added to the collection between
// D-024 (2026-08-11, flagged as unsafe/unfinished — blank `{{family}}` var, a
// CHILD/KID category mismatch between a request example and its own response) and this
// pass (2026-08-13). The blank `{{family}}`/`{{medicine}}` collection variables are
// still blank in the export, but every captured response's own `path` field resolves
// them: `{{family}}` = `{{baseUrl}}/api/families`, `{{medicine}}` = `{{baseUrl}}/api/medicines`
// — see docs/DECISIONS.md and docs/BACKEND_CONTEXT.md for the full writeup, including
// what's still unconfirmed (no delete endpoint for a profile/medicine/document anywhere
// in the collection; `dateOfBirth`'s required-ness on Create Profile is unconfirmed;
// this was only ever captured against `localhost:8080`, not verified against the
// deployed backend this app now points at).

// `SELF` is a profile representing the account holder themselves; `KID`/`ELDER`/`OTHER`
// are dependents — same idea as Family's ManagedMember, but this is a distinct resource
// (`FamilyProfile`), not the same row. Confirmed via `GET /families/relationship/type`'s
// saved example, which is also what disambiguates the Create Profile category mismatch:
// "KID" is a real value (its 200 example succeeded), "CHILD" is not (its use 500s).
export type FamilyProfileCategory = 'SELF' | 'KID' | 'ELDER' | 'OTHER';

export interface FamilyProfile {
  id: string;
  name: string;
  category: FamilyProfileCategory;
  dateOfBirth: string; // "YYYY-MM-DD"
}

export interface RemoteMedicine {
  id: string;
  name: string;
  dosage: string;
  scheduleTimes: string[]; // "HH:MM", 24-hour — not this app's local slot enum
  stockQuantity: number;
  lowStockThreshold: number;
  // `lowStock`/`adherenceRate` are computed server-side and returned on every
  // create/list/update response — unlike the local model's `calculateAdherence`, these
  // are not meant to be derived client-side once this is wired up for real.
  lowStock: boolean;
  adherenceRate: number;
}

export interface CreateOrUpdateMedicineInput {
  name: string;
  dosage: string;
  scheduleTimes: string[];
  stockQuantity: number;
  lowStockThreshold: number;
}

// Only "TAKEN" appears anywhere in the collection's saved examples — no evidence of a
// "MISSED"/"SKIPPED" value, though the field being a free string (not obviously
// constrained in what's captured) suggests more may exist.
export type IntakeStatus = 'TAKEN';

export interface MedicalDocument {
  id: string;
  originalFilename: string;
  documentType: string;
  uploadedAt: string;
  ocrStatus: string;
}

// Static lookup — same "no family context needed" shape as `GET /families/relations`
// (docs/DECISIONS.md D-030). Despite living under `/families/relationship/type`, this is
// what Create Profile's `category` values actually mean, not a family-member relation.
export async function listRelationshipTypes(
  token: string,
): Promise<{ id: string; relationshipType: FamilyProfileCategory }[]> {
  return apiFetch<{ id: string; relationshipType: FamilyProfileCategory }[]>('/families/relationship/type', {
    method: 'GET',
    token,
  });
}

export async function listFamilyProfiles(familyId: string, token: string): Promise<FamilyProfile[]> {
  return apiFetch<FamilyProfile[]>(`/families/${familyId}/profiles`, { method: 'GET', token });
}

export async function createFamilyProfile(
  familyId: string,
  name: string,
  category: FamilyProfileCategory,
  dateOfBirth: string,
  token: string,
): Promise<FamilyProfile> {
  return apiFetch<FamilyProfile>(`/families/${familyId}/profiles`, {
    method: 'POST',
    body: { name, category, dateOfBirth },
    token,
  });
}

export async function listMedicines(familyProfileId: string, token: string): Promise<RemoteMedicine[]> {
  return apiFetch<RemoteMedicine[]>(`/profiles/${familyProfileId}/medicines`, { method: 'GET', token });
}

export async function createMedicine(
  familyProfileId: string,
  input: CreateOrUpdateMedicineInput,
  token: string,
): Promise<RemoteMedicine> {
  return apiFetch<RemoteMedicine>(`/profiles/${familyProfileId}/medicines`, {
    method: 'POST',
    body: input,
    token,
  });
}

export async function updateMedicine(
  medicineId: string,
  input: CreateOrUpdateMedicineInput,
  token: string,
): Promise<RemoteMedicine> {
  return apiFetch<RemoteMedicine>(`/medicines/${medicineId}`, { method: 'PUT', body: input, token });
}

// 204 No Content on success — nothing to return. The collection's examples never show
// stock/adherence after a logged intake, so it's unconfirmed whether the backend
// decrements `stockQuantity` server-side; callers should re-fetch (`listMedicines`)
// rather than assume.
export async function logIntake(
  medicineId: string,
  status: IntakeStatus,
  note: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/medicines/${medicineId}/intake`, { method: 'POST', body: { status, note }, token });
}

// `documentType` must be sent as a JSON-typed text part (`{string, type: 'application/json'}`),
// not a plain string part — same multipart gotcha as Profile's `profileRequest`
// (docs/DECISIONS.md D-013–D-015): a bare string part arrives at Spring as
// `application/octet-stream` and is rejected.
export async function uploadMedicalDocument(
  familyProfileId: string,
  file: { uri: string; name: string; type: string },
  documentType: string,
  token: string,
): Promise<MedicalDocument> {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  form.append('documentType', { string: JSON.stringify(documentType), type: 'application/json' } as unknown as Blob);
  return postMultipart<MedicalDocument>(`/profiles/${familyProfileId}/documents`, form, token);
}

export async function listMedicalDocuments(familyProfileId: string, token: string): Promise<MedicalDocument[]> {
  return apiFetch<MedicalDocument[]>(`/profiles/${familyProfileId}/documents`, { method: 'GET', token });
}

export type MedchestErrorKind = 'network' | 'not_found' | 'no_permission' | 'unknown';

function extractMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'message' in body && typeof (body as { message: unknown }).message === 'string') {
    return (body as { message: string }).message;
  }
  return null;
}

// Same message-matching shape as `parseFamilyError`/`parseAuthError` — this API is
// equally guilty of collapsing distinct failures onto 400/404/500 with a structured
// `{message}` body. "An unexpected error occurred" (the generic 500 catch-all, e.g. an
// invalid `category` value) is deliberately left as `unknown` rather than guessed at —
// there is no evidence in the collection distinguishing a real server fault from bad
// input on this endpoint.
export function parseMedchestError(err: unknown): MedchestErrorKind {
  if (!(err instanceof ApiError)) {
    return 'unknown';
  }
  if (err.status === 0) {
    return 'network';
  }
  const message = extractMessage(err.body);
  if (message === 'Family profile not found' || message === 'Medicine not found') {
    return 'not_found';
  }
  if (message === 'You are not a member of this family' || message === 'You do not have admin access to this family') {
    return 'no_permission';
  }
  return 'unknown';
}
