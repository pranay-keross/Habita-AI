import AsyncStorage from '@react-native-async-storage/async-storage';
import { PantryItem, ZeroWasteRecipe } from '../types';
import { INITIAL_PANTRY_ITEMS } from '../data/mockPantryData';
import {
  adjustPantryQuantityRemote,
  cookRecipeRemote,
  createPantryItemRemote,
  createPantryItemsBulkRemote,
  deletePantryItemRemote,
  listPantryItemsRemote,
} from '../api';

const STORAGE_KEY = '@sahel_smart_pantry_v4';

// Ids of the signed-out demo catalogue. Used to evict demo rows that an earlier failed
// or signed-out session cached, so a signed-in pantry never shows items the server
// has no record of.
const DEMO_ITEM_IDS = new Set(INITIAL_PANTRY_ITEMS.map((item) => item.id));

/**
 * Loads pantry stock.
 *
 * When signed in the backend is the single source of truth, and demo data is never
 * substituted: seeding `INITIAL_PANTRY_ITEMS` here made the Inventory tab disagree with
 * every server-side feature (meal planning, recipes, expiry radar), which read the real
 * — empty — pantry. On a remote failure we fall back only to previously cached *real*
 * rows, so the list degrades to stale-but-true rather than fictional.
 */
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
      console.warn('Pantry remote load failed, using last synced items:', err);
    }

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const cached: PantryItem[] = raw ? JSON.parse(raw) : [];
      // Purge demo rows seeded by an earlier signed-out/failed session.
      return cached.filter((item) => !DEMO_ITEM_IDS.has(item.id));
    } catch (e) {
      console.error('Failed to read cached pantry items:', e);
      return [];
    }
  }

  // Signed out: the local demo catalogue is the only stock there is.
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

/** Strips the client-side placeholder id; the server assigns the real one on create. */
function toCreatePayload(item: PantryItem): Omit<PantryItem, 'id'> {
  const { id, ...rest } = item;
  void id;
  return rest;
}

/**
 * Raw cached rows with no demo seeding. Mutators must use this rather than
 * `loadPantryItems()`: calling that without a token takes the signed-out branch and
 * re-seeds the demo catalogue, which then gets written back into the cache.
 */
async function readCachedItems(): Promise<PantryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read cached pantry items:', e);
    return [];
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
      created = await createPantryItemRemote(toCreatePayload(item), token);
    } catch (err) {
      console.warn('Remote create pantry item failed, saving locally:', err);
    }
  }

  const existing = await readCachedItems();
  const updated = [created, ...existing.filter((i) => i.id !== created.id)];
  await savePantryItems(updated);
  return created;
}

export async function savePantryItemsBulk(
  items: PantryItem[],
  token?: string | null,
): Promise<PantryItem[]> {
  let createdList = items;
  if (token) {
    try {
      const payloads = items.map(toCreatePayload);
      const remoteCreated = await createPantryItemsBulkRemote(payloads, token);
      if (remoteCreated && remoteCreated.length > 0) {
        createdList = remoteCreated;
      }
    } catch (err) {
      console.warn('Remote bulk create pantry items failed, saving locally:', err);
    }
  }

  const existing = await readCachedItems();
  const createdIds = new Set(createdList.map((i) => i.id));
  const updated = [...createdList, ...existing.filter((i) => !createdIds.has(i.id))];
  await savePantryItems(updated);
  return createdList;
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

  const existing = await readCachedItems();
  const updated = existing.filter((i) => i.id !== id);
  await savePantryItems(updated);
}

export async function modifyPantryQuantity(
  id: string,
  delta: number,
  token?: string | null,
): Promise<number> {
  // The server's post-adjustment quantity is authoritative when we have it; recomputing
  // locally from a possibly stale cached value is how the UI drifts away from real stock.
  let serverQty: number | null = null;
  if (token) {
    try {
      const resp = await adjustPantryQuantityRemote(id, delta, token);
      serverQty = resp.newQuantity;
    } catch (err) {
      console.warn('Remote adjust pantry quantity failed:', err);
    }
  }

  const existing = await readCachedItems();
  const target = existing.find((i) => i.id === id);
  if (!target && serverQty === null) return 0;

  const newQty = serverQty !== null
    ? Math.max(0, serverQty)
    : Math.max(0, (target?.quantity ?? 0) + delta);

  if (newQty === 0) {
    await removePantryItem(id, token);
    return 0;
  }

  const updated = existing.map((i) =>
    i.id === id ? { ...i, quantity: newQty, isLowStock: newQty <= 1 } : i,
  );
  await savePantryItems(updated);
  return newQty;
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

