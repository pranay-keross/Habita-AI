import { getItem, setItem } from '../../../utils/storage';
import type { DocHubEntry } from './types';

const STORAGE_KEY = 'habita.dochub_entries';

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

export async function loadDocuments(): Promise<DocHubEntry[]> {
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

export async function addDocument(doc: Omit<DocHubEntry, 'id'>): Promise<DocHubEntry> {
  const docs = await loadDocuments();
  const newDoc: DocHubEntry = {
    ...doc,
    id: `doc_${Date.now()}`,
  };
  const updated = [newDoc, ...docs];
  await saveDocuments(updated);
  return newDoc;
}

export async function updateDocument(updatedDoc: DocHubEntry): Promise<void> {
  const docs = await loadDocuments();
  const updated = docs.map((d) => (d.id === updatedDoc.id ? updatedDoc : d));
  await saveDocuments(updated);
}

export async function deleteDocument(id: string): Promise<void> {
  const docs = await loadDocuments();
  const updated = docs.filter((d) => d.id !== id);
  await saveDocuments(updated);
}

export async function getDocById(id: string): Promise<DocHubEntry | undefined> {
  const docs = await loadDocuments();
  return docs.find((d) => d.id === id);
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
