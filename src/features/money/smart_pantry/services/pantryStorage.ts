import AsyncStorage from '@react-native-async-storage/async-storage';
import { PantryItem, ZeroWasteRecipe } from '../types';
import { INITIAL_PANTRY_ITEMS } from '../data/mockPantryData';
import {
  adjustPantryQuantityRemote,
  cookRecipeRemote,
  createPantryItemRemote,
  deletePantryItemRemote,
  listPantryItemsRemote,
} from '../api';

const STORAGE_KEY = '@sahel_smart_pantry_v4';

export async function loadPantryItems(token?: string | null): Promise<PantryItem[]> {
  if (token) {
    try {
      const remoteResponse = await listPantryItemsRemote(token, { size: 100 });
      let itemsList: PantryItem[] | null = null;
      if (Array.isArray(remoteResponse)) {
        itemsList = remoteResponse;
      } else if (remoteResponse && Array.isArray((remoteResponse as any).content)) {
        itemsList = (remoteResponse as any).content;
      }
      if (itemsList) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(itemsList));
        return itemsList;
      }
    } catch (err) {
      console.warn('Pantry remote load failed, falling back to local storage:', err);
    }
  }

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

export async function savePantryItem(
  item: PantryItem,
  token?: string | null,
): Promise<PantryItem> {
  let created = item;
  if (token) {
    try {
      const { id, ...itemInput } = item;
      created = await createPantryItemRemote(itemInput, token);
    } catch (err) {
      console.warn('Remote create pantry item failed, saving locally:', err);
    }
  }

  const existing = await loadPantryItems();
  const updated = [created, ...existing.filter((i) => i.id !== created.id)];
  await savePantryItems(updated);
  return created;
}

export async function removePantryItem(
  id: string,
  token?: string | null,
): Promise<void> {
  if (token) {
    try {
      await deletePantryItemRemote(id, token);
    } catch (err) {
      console.warn('Remote delete pantry item failed:', err);
    }
  }

  const existing = await loadPantryItems();
  const updated = existing.filter((i) => i.id !== id);
  await savePantryItems(updated);
}

export async function modifyPantryQuantity(
  id: string,
  delta: number,
  token?: string | null,
): Promise<number> {
  let newQty = 0;
  if (token) {
    try {
      const resp = await adjustPantryQuantityRemote(id, delta, token);
      newQty = resp.newQuantity;
    } catch (err) {
      console.warn('Remote adjust pantry quantity failed:', err);
    }
  }

  const existing = await loadPantryItems();
  const target = existing.find((i) => i.id === id);
  if (!target) return 0;

  const computedQty = Math.max(0, target.quantity + delta);
  if (computedQty === 0) {
    await removePantryItem(id, token);
    return 0;
  }

  const updated = existing.map((i) =>
    i.id === id ? { ...i, quantity: computedQty, isLowStock: computedQty <= 1 } : i,
  );
  await savePantryItems(updated);
  return computedQty;
}

export async function cookPantryRecipe(
  recipe: ZeroWasteRecipe,
  token?: string | null,
): Promise<void> {
  if (token) {
    try {
      await cookRecipeRemote(recipe.id, token, 1);
      // Reload stock after cooking
      await loadPantryItems(token);
      return;
    } catch (err) {
      console.warn('Remote cook recipe failed:', err);
    }
  }

  // Fallback offline deduction
  const existing = await loadPantryItems();
  const updated = existing.map((item) => {
    if (getDaysUntilExpiry(item.expiryDate) <= 5 && item.quantity > 0) {
      const rem = Math.max(0, item.quantity - 1);
      return { ...item, quantity: rem, isLowStock: rem <= 1 };
    }
    return item;
  });
  await savePantryItems(updated);
}

export function getDaysUntilExpiry(expiryDateStr: string): number {
  if (!expiryDateStr) return 999;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  let expMidnight: number;
  const parts = expiryDateStr.split('-');
  if (parts.length === 3) {
    expMidnight = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  } else {
    const exp = new Date(expiryDateStr);
    expMidnight = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()).getTime();
  }

  const diffTime = expMidnight - todayMidnight;
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

