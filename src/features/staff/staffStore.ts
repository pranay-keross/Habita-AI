import { getItem, setItem } from '../../utils/storage';
import type { AttendanceEntry, Caregiver, CaregiverTransaction } from './types';

export const CAREGIVER_STORAGE_KEY = 'habita.caregivers';
export const CAREGIVER_TRANSACTION_STORAGE_KEY = 'habita.caregiver_transactions';
export const CAREGIVER_ATTENDANCE_STORAGE_KEY = 'habita.caregiver_attendance';

export async function loadCaregivers(): Promise<Caregiver[]> {
  return getItem<Caregiver[]>(CAREGIVER_STORAGE_KEY, []);
}

export async function saveCaregivers(caregivers: Caregiver[]): Promise<void> {
  await setItem(CAREGIVER_STORAGE_KEY, caregivers);
}

export async function loadCaregiverTransactions(): Promise<CaregiverTransaction[]> {
  return getItem<CaregiverTransaction[]>(CAREGIVER_TRANSACTION_STORAGE_KEY, []);
}

export async function saveCaregiverTransactions(transactions: CaregiverTransaction[]): Promise<void> {
  await setItem(CAREGIVER_TRANSACTION_STORAGE_KEY, transactions);
}

export async function loadAttendanceEntries(): Promise<AttendanceEntry[]> {
  return getItem<AttendanceEntry[]>(CAREGIVER_ATTENDANCE_STORAGE_KEY, []);
}

export async function saveAttendanceEntries(entries: AttendanceEntry[]): Promise<void> {
  await setItem(CAREGIVER_ATTENDANCE_STORAGE_KEY, entries);
}
