import AsyncStorage from '@react-native-async-storage/async-storage';
import { PantryItem } from '../types';
import { INITIAL_PANTRY_ITEMS } from '../data/mockPantryData';

const STORAGE_KEY = '@sahel_smart_pantry_v3';

export async function loadPantryItems(): Promise<PantryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PANTRY_ITEMS));
      return INITIAL_PANTRY_ITEMS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load pantry items:', e);
    return INITIAL_PANTRY_ITEMS;
  }
}

export async function savePantryItems(items: PantryItem[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Failed to save pantry items:', e);
    return false;
  }
}

export function getDaysUntilExpiry(expiryDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDateStr);
  exp.setHours(0, 0, 0, 0);
  const diffTime = exp.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
