import { getItem, setItem } from '../../../utils/storage';
import { isNetworkError } from '../../../utils/networkStatus';
import {
  createVaultDocument,
  deleteVaultDocument,
  getVaultDocument,
  listVaultDocuments,
  parseVaultError,
  updateVaultDocument,
} from './api';
import type { DocHubEntry, PickedFile, VaultDocumentInput } from './types';

const STORAGE_KEY = 'habita.dochub_entries';

// Seed data shown until the household adds its own first document, or until a real
// family + backend sync replaces it — see docs/VAULT_API_SPEC.md §8. Once a remote load
// succeeds even once, the returned list (empty or not) fully replaces this seed in local
// cache, so it never leaks into synced data.
const INITIAL_DOCS: DocHubEntry[] = [
  {
    id: 'doc_1',
    title: 'Indian Passport (Animesh)',
    category: 'passport',
    docNumber: 'Z8942104',
    memberName: 'Animesh Manna',
    issueDate: '2020-04-12',
    expiryDate: '2030-04-11',
    country: 'India',
    issuingAuthority: 'Passport Seva Kendra Kolkata',
    notes: 'Primary passport, kept in desk safe',
  },
  {
    id: 'doc_2',
    title: 'US B1/B2 Visitor Visa',
    category: 'visa',
    docNumber: 'V9182341',
    memberName: 'Animesh Manna',
    issueDate: '2021-09-10',
    expiryDate: '2026-09-09',
    country: 'United States',
    issuingAuthority: 'US Consulate General',
    notes: '10-year multiple entry visa',
  },
  {
    id: 'doc_3',
    title: 'Health Insurance Policy (Family)',
    category: 'insurance',
    docNumber: 'HDFC-ERGO-9921',
    memberName: 'Sharma Household',
    issueDate: '2025-10-01',
    expiryDate: '2026-09-30',
    coveredMembers: 'Animesh, Priya, Rahul',
    issuingAuthority: 'HDFC ERGO Health',
    notes: 'Includes ₹10L floater coverage',
  },
  {
    id: 'doc_4',
    title: 'Washing Machine 3-Yr Warranty',
    category: 'warranty',
    docNumber: 'LG-WM-8812',
    memberName: 'Home Asset',
    issueDate: '2024-02-15',
    expiryDate: '2027-02-14',
    issuingAuthority: 'LG Electronics India',
    notes: 'LG DirectDrive Front Load',
  },
];

/**
 * Loads every document in the household vault. Tries the real backend first whenever a
 * token is available (docs/VAULT_API_SPEC.md §4.1); on any failure — including the
 * expected case today, where the backend doesn't exist yet — falls back to the local
 * on-device cache, seeding it with sample documents on a genuine first run. This is the
 * same dual-mode shape `loadGroups()` (expenseStore.ts) and Medicine's remote-first
 * loaders already use.
 */
export async function loadDocuments(token?: string | null): Promise<DocHubEntry[]> {
  if (token) {
    try {
      const remote = await listVaultDocuments(token);
      if (Array.isArray(remote)) {
        await saveDocuments(remote);
        return remote;
      }
    } catch {
      // Remote call failed (most likely: backend not deployed yet) — fall back below.
    }
  }
  const data = await getItem<DocHubEntry[]>(STORAGE_KEY, INITIAL_DOCS);
  if (!data || data.length === 0) {
    await saveDocuments(INITIAL_DOCS);
    return INITIAL_DOCS;
  }
  return data;
}

export async function saveDocuments(docs: DocHubEntry[]): Promise<void> {
  await setItem(STORAGE_KEY, docs);
}

// True for a failure that means "couldn't reach a real backend decision at all" — no
// connectivity, or no family to own the vault yet (the documented graceful-degradation
// case, docs/VAULT_API_SPEC.md §2) — where silently continuing in local-only mode is the
// right call. False for a failure the server actually reached and rejected (bad
// category, expiry before issue date, oversized/wrong-type file, not found, no
// permission) — those must never be swallowed into a fake "saved offline" success, since
// the input was actually invalid and retrying unchanged will just fail again forever.
function isRecoverableOffline(err: unknown): boolean {
  const kind = parseVaultError(err);
  return kind === 'network' || kind === 'no_family';
}

/**
 * Creates a document. Attempts the remote multipart upload first when a token is
 * available. On real connectivity loss (or no token at all) saves it locally with a
 * temporary id instead, so the user's input is never lost — `offline: true` tells the
 * caller to surface the standard "saved on your device only" notice. A rejection the
 * server actually sent back (invalid data, oversized file, ...) is rethrown instead —
 * saving that locally would just produce a document that can never sync and silently
 * tell the user it worked.
 */
export async function addDocument(
  input: VaultDocumentInput,
  token?: string | null,
  file?: PickedFile | null,
): Promise<{ doc: DocHubEntry; offline: boolean }> {
  if (token) {
    try {
      const created = await createVaultDocument(input, file ?? null, token);
      const docs = await loadLocalOnly();
      await saveDocuments([created, ...docs]);
      return { doc: created, offline: false };
    } catch (err) {
      if (!isRecoverableOffline(err)) throw err;
      // Fall through to local-only save below — never lose the user's input.
    }
  }

  const docs = await loadLocalOnly();
  const newDoc: DocHubEntry = {
    ...input,
    id: `doc_local_${Date.now()}`,
    fileUri: file?.uri,
    fileName: file?.name ?? input.fileName,
  };
  await saveDocuments([newDoc, ...docs]);
  return { doc: newDoc, offline: true };
}

/**
 * Updates a document's metadata (and optionally replaces its file). Attempts the remote
 * call first when a token is present. Only a connectivity failure (or no family yet)
 * falls back to a local-only write; a rejection the server actually sent back (e.g. a
 * renewed expiry date that's still before the issue date) is rethrown rather than
 * quietly written to the local cache and reported as a success — the previous behavior
 * here told the user "Updated!" even though the server had refused the change.
 */
export async function updateDocument(
  updatedDoc: DocHubEntry,
  token?: string | null,
  file?: PickedFile | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  let resolved = updatedDoc;

  if (token) {
    try {
      const { id, fileUri, fileUrl, createdAt, updatedAt, ...input } = updatedDoc;
      const remote = await updateVaultDocument(id, input, file ?? null, token);
      resolved = remote;
      offline = false;
    } catch (err) {
      if (!isRecoverableOffline(err)) throw err;
      offline = true;
    }
  }

  const docs = await loadLocalOnly();
  const merged = docs.map((d) =>
    d.id === updatedDoc.id
      ? { ...resolved, fileUri: file?.uri ?? d.fileUri, fileName: file?.name ?? resolved.fileName }
      : d,
  );
  await saveDocuments(merged);
  return { offline };
}

export async function deleteDocument(id: string, token?: string | null): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await deleteVaultDocument(id, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
      // Not a network error means the server was reached (e.g. already-deleted 404) —
      // still remove the local copy either way, since the user already confirmed this
      // delete via the UI.
    }
  }
  const docs = await loadLocalOnly();
  await saveDocuments(docs.filter((d) => d.id !== id));
  return { offline };
}

export async function getDocById(id: string, token?: string | null): Promise<DocHubEntry | undefined> {
  if (token && !id.startsWith('doc_local_')) {
    try {
      const remote = await getVaultDocument(id, token);
      if (remote) {
        const docs = await loadLocalOnly();
        await saveDocuments([remote, ...docs.filter((d) => d.id !== remote.id)]);
        return remote;
      }
    } catch {
      // Fall through to local lookup below.
    }
  }
  const docs = await loadLocalOnly();
  return docs.find((d) => d.id === id);
}

// Reads the local cache as-is, without ever attempting a remote call or reseeding — used
// by the write paths above so a create/update/delete never re-triggers a network round
// trip or resurrects the sample seed data mid-write.
async function loadLocalOnly(): Promise<DocHubEntry[]> {
  const data = await getItem<DocHubEntry[]>(STORAGE_KEY, INITIAL_DOCS);
  return data ?? [];
}

export function getDocStatus(expiryDate: string): {
  status: 'valid' | 'expiring' | 'expired';
  daysLeft: number;
} {
  const now = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft <= 60) return { status: 'expiring', daysLeft };
  return { status: 'valid', daysLeft };
}
