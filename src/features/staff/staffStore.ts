import { getItem, setItem } from '../../utils/storage';
import type { Caregiver, CaregiverTransaction } from './types';

export const CAREGIVER_STORAGE_KEY = 'habita.caregivers';
export const CAREGIVER_TRANSACTION_STORAGE_KEY = 'habita.caregiver_transactions';

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
