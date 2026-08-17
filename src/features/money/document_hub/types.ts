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
  fileUri?: string;
  fileName?: string;
  country?: string;
  issuingAuthority?: string;
  coveredMembers?: string;
}

export interface DocTemplateInfo {
  type: DocTemplateType;
  title: string;
  category: DocCategory;
  iconName: string;
  description: string;
  accentColor: string;
  bgColor: string;
}

export const DOC_TEMPLATES: DocTemplateInfo[] = [
  {
    type: 'passport',
    title: 'Passport',
    category: 'passport',
    iconName: 'file-text',
    description: 'International travel identity document & visa stamps',
    accentColor: '#004F63',
    bgColor: '#E0F2FE',
  },
  {
    type: 'visa',
    title: 'Travel Visa',
    category: 'visa',
    iconName: 'globe',
    description: 'Visitor, work, student & resident visas',
    accentColor: '#9333EA',
    bgColor: '#F3E8FF',
  },
  {
    type: 'license',
    title: "Driver's License",
    category: 'license',
    iconName: 'credit-card',
    description: 'Motor vehicle driving permit & identity card',
    accentColor: '#D97706',
    bgColor: '#FEF3C7',
  },
  {
    type: 'insurance',
    title: 'Health Insurance',
    category: 'insurance',
    iconName: 'shield-check',
    description: 'Medical floater policy & claims emergency card',
    accentColor: '#16A34A',
    bgColor: '#DCFCE7',
  },
];
