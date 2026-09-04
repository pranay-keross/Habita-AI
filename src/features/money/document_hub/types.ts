export type DocCategory =
  | 'passport'
  | 'visa'
  | 'license'
  | 'insurance'
  | 'warranty'
  | 'property'
  | 'tax';

export type DocTemplateType = 'passport' | 'visa' | 'license' | 'insurance';

export interface DocHubEntry {
  id: string;
  title: string;
  category: DocCategory;
  docNumber?: string;
  memberName: string;
  issueDate?: string;
  expiryDate: string; // YYYY-MM-DD
  notes?: string;
  // `fileUri` is a local, device-only URI (from the picker or a not-yet-synced offline
  // create) — never sent to or received from the backend. `fileUrl` is the backend's
  // presigned, short-lived download URL, only present once a document has synced
  // remotely. Prefer `fileUrl` when present; fall back to `fileUri` for an offline-only
  // document (see docs/VAULT_API_SPEC.md §3.2, §3.3).
  fileUri?: string;
  fileUrl?: string;
  fileName?: string;
  country?: string;
  issuingAuthority?: string;
  coveredMembers?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Shape for creating/updating a document, before an `id` (or server-assigned fields)
// exists. A picked-but-unsynced file is carried separately (see `PickedFile` below) so
// this stays plain JSON-serializable for the multipart `metadata` part (§4.2 of the spec).
export type VaultDocumentInput = Omit<
  DocHubEntry,
  'id' | 'fileUri' | 'fileUrl' | 'createdAt' | 'updatedAt'
>;

// A file selected via the document/image picker, not yet uploaded.
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];

// Neither `fileUrl` (a presigned URL, often with a query string) nor `fileName` is
// guaranteed to be set — checks `fileName` first since it always carries the real
// extension, and only falls back to the URL's path when no name was stored.
export function getFileKind(fileName?: string, url?: string): 'pdf' | 'image' | 'other' {
  const source = fileName || url || '';
  const ext = source.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  return 'other';
}

export interface DocTemplateInfo {
  type: DocTemplateType;
  titleKey: string;
  title: string;
  category: DocCategory;
  iconName: string;
  descriptionKey: string;
  description: string;
  accentColor: string;
  bgColor: string;
}

export const DOC_TEMPLATES: DocTemplateInfo[] = [
  {
    type: 'passport',
    titleKey: 'doc_hub.tmpl_passport_title',
    title: 'Passport',
    category: 'passport',
    iconName: 'file-text',
    descriptionKey: 'doc_hub.tmpl_passport_desc',
    description: 'International travel identity document & visa stamps',
    accentColor: '#004F63',
    bgColor: '#E0F2FE',
  },
  {
    type: 'visa',
    titleKey: 'doc_hub.tmpl_visa_title',
    title: 'Travel Visa',
    category: 'visa',
    iconName: 'globe',
    descriptionKey: 'doc_hub.tmpl_visa_desc',
    description: 'Visitor, work, student & resident visas',
    accentColor: '#9333EA',
    bgColor: '#F3E8FF',
  },
  {
    type: 'license',
    titleKey: 'doc_hub.tmpl_license_title',
    title: "Driver's License",
    category: 'license',
    iconName: 'credit-card',
    descriptionKey: 'doc_hub.tmpl_license_desc',
    description: 'Motor vehicle driving permit & identity card',
    accentColor: '#D97706',
    bgColor: '#FEF3C7',
  },
  {
    type: 'insurance',
    titleKey: 'doc_hub.tmpl_insurance_title',
    title: 'Health Insurance',
    category: 'insurance',
    iconName: 'shield-check',
    descriptionKey: 'doc_hub.tmpl_insurance_desc',
    description: 'Medical floater policy & claims emergency card',
    accentColor: '#16A34A',
    bgColor: '#DCFCE7',
  },
];
