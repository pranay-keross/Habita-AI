import { apiFetch, ApiError, postMultipart } from '../../auth/api';
import type { DocHubEntry, PickedFile, VaultDocumentInput } from './types';

// Contract not yet built server-side — see docs/VAULT_API_SPEC.md. `docStore.ts` calls
// these whenever an access token is available and falls back to AsyncStorage on any
// failure, so every call here fails with a network error (ApiError status 0) until the
// backend is deployed matching that spec, at which point the vault starts syncing live
// with no further frontend changes (same rollout shape Expenses/Medicine used).

function buildMetadataPart(input: VaultDocumentInput): { string: string; type: string } {
  return { string: JSON.stringify(input), type: 'application/json' };
}

function resolveFilePart(file: PickedFile): { uri: string; name: string; type: string } {
  let fileName = file.name || 'document';
  let fileType = file.type || 'application/octet-stream';

  if (fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
    fileType = 'application/pdf';
    if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
  } else if (fileType.includes('png') || fileName.toLowerCase().endsWith('.png')) {
    fileType = 'image/png';
    if (!fileName.toLowerCase().endsWith('.png')) fileName += '.png';
  } else {
    fileType = 'image/jpeg';
    if (!fileName.toLowerCase().endsWith('.jpg') && !fileName.toLowerCase().endsWith('.jpeg')) {
      fileName += '.jpg';
    }
  }

  return { uri: file.uri, name: fileName, type: fileType };
}

export async function listVaultDocuments(token: string): Promise<DocHubEntry[]> {
  return apiFetch<DocHubEntry[]>('/vault/documents', { method: 'GET', token });
}

export async function getVaultDocument(documentId: string, token: string): Promise<DocHubEntry> {
  return apiFetch<DocHubEntry>(`/vault/documents/${documentId}`, { method: 'GET', token });
}

export async function createVaultDocument(
  input: VaultDocumentInput,
  file: PickedFile | null,
  token: string,
): Promise<DocHubEntry> {
  const form = new FormData();
  form.append('metadata', buildMetadataPart(input) as unknown as Blob);
  if (file) {
    form.append('file', resolveFilePart(file) as unknown as Blob);
  }
  return postMultipart<DocHubEntry>('/vault/documents', form, token, 'POST');
}

export async function updateVaultDocument(
  documentId: string,
  input: VaultDocumentInput,
  file: PickedFile | null,
  token: string,
): Promise<DocHubEntry> {
  const form = new FormData();
  form.append('metadata', buildMetadataPart(input) as unknown as Blob);
  if (file) {
    form.append('file', resolveFilePart(file) as unknown as Blob);
  }
  return postMultipart<DocHubEntry>(`/vault/documents/${documentId}`, form, token, 'PUT');
}

export async function deleteVaultDocument(documentId: string, token: string): Promise<void> {
  await apiFetch<void>(`/vault/documents/${documentId}`, { method: 'DELETE', token });
}

export type VaultErrorKind =
  | 'network'
  | 'not_found'
  | 'no_family'
  | 'no_permission'
  | 'invalid_expiry'
  | 'file_too_large'
  | 'unsupported_file_type'
  | 'unknown';

function extractCode(body: unknown): string | null {
  if (body && typeof body === 'object' && 'code' in body && typeof (body as { code: unknown }).code === 'string') {
    return (body as { code: string }).code;
  }
  return null;
}

export function parseVaultError(err: unknown): VaultErrorKind {
  if (!(err instanceof ApiError)) {
    return 'unknown';
  }
  if (err.status === 0) {
    return 'network';
  }
  const code = extractCode(err.body);
  switch (code) {
    case 'DOCUMENT_NOT_FOUND':
      return 'not_found';
    case 'NO_FAMILY':
      return 'no_family';
    case 'NOT_FAMILY_MEMBER':
      return 'no_permission';
    case 'INVALID_EXPIRY_DATE':
      return 'invalid_expiry';
    case 'FILE_TOO_LARGE':
      return 'file_too_large';
    case 'UNSUPPORTED_FILE_TYPE':
      return 'unsupported_file_type';
    default:
      return 'unknown';
  }
}

export function extractVaultErrorMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== 'object') {
    return null;
  }
  const body = err.body as { message?: unknown };
  if (typeof body.message === 'string' && body.message.trim().length > 0) {
    return body.message;
  }
  return null;
}
