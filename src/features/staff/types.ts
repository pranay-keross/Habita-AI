export type CaregiverRateType = 'hourly' | 'monthly';

export interface Caregiver {
  id: string;
  name: string;
  service: string;
  rateType: CaregiverRateType;
  rate: number;
  phone: string;
  notes: string;
  createdAt: number;
}

export interface CaregiverTransaction {
  id: string;
  caregiverId: string;
  amount: number;
  reason: string;
  createdAt: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave';

export interface AttendanceEntry {
  id: string;
  caregiverId: string;
  date: string; // "YYYY-MM-DD", local calendar day
  status: AttendanceStatus;
  markedAt: number;
}
