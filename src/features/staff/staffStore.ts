import { getItem, setItem } from '../../utils/storage';
import type { Caregiver } from './types';

export const CAREGIVER_STORAGE_KEY = 'habita.caregivers';

export async function loadCaregivers(): Promise<Caregiver[]> {
  return getItem<Caregiver[]>(CAREGIVER_STORAGE_KEY, []);
}

export async function saveCaregivers(caregivers: Caregiver[]): Promise<void> {
  await setItem(CAREGIVER_STORAGE_KEY, caregivers);
}
