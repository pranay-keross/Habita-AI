import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../../../../hooks/useAuth';
import { AllergenTag, BasketScanItem, PantryItem, StorageLocation, ZeroWasteRecipe } from '../types';
import { MOCK_ZERO_WASTE_RECIPES } from '../data/mockPantryData';
import {
  cookPantryRecipe,
  getDaysUntilExpiry,
  loadPantryItems,
  modifyPantryQuantity,
  removePantryItem,
  savePantryItem,
  savePantryItemsBulk,
} from '../services/pantryStorage';
import {
  getZeroWasteRecipesRemote,
  lookupBarcodeRemote,
  notifyExpiringPantryItemsRemote,
  pantryErrorMessage,
  scanBasketRemote,
  scanReceiptRemote,
} from '../api';

/** Idle time after the last +/- tap before the coalesced quantity API call fires. */
const QTY_FLUSH_MS = 3500;

export function useSmartPantry() {
  const { getAccessToken, pending, signedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<ZeroWasteRecipe[]>(MOCK_ZERO_WASTE_RECIPES);
  const [recipeDietaryFilter, setRecipeDietaryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | 'All'>('All');
  const [selectedAllergenFilter, setSelectedAllergenFilter] = useState<AllergenTag | 'all'>('all');
  const [sortBy, setSortBy] = useState<'expiry' | 'name' | 'quantity'>('expiry');
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);

  // The full-screen skeleton is only for the very first load. Every later fetch
  // (refresh, post-scan reload, auth change) refreshes the list silently.
  const hasLoadedOnce = useRef(false);

  // Read through a ref so fetchRecipes/fetchItems keep a stable identity and the
  // mount effect does not re-run (and re-flash a loader) on every filter change.
  const dietaryFilterRef = useRef(recipeDietaryFilter);
  dietaryFilterRef.current = recipeDietaryFilter;

  const fetchRecipes = useCallback(
    async (dietaryPref?: string) => {
      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch {}

      if (token) {
        try {
          const pref = dietaryPref !== undefined ? dietaryPref : dietaryFilterRef.current;
          const remoteRecipes = await getZeroWasteRecipesRemote(token, 5, pref);
          if (remoteRecipes && remoteRecipes.length > 0) {
            setRecipes(remoteRecipes);
          }
        } catch (err) {
          console.warn('Failed to load remote zero-waste recipes:', err);
        }
      }
    },
    [getAccessToken],
  );

  const fetchItems = useCallback(async () => {
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {
      // Offline / guest
    }

    const data = await loadPantryItems(token);
    setItems(data);
    setSelectedItem((prev) => prev ?? (data.length > 0 ? data[0] : null));

    hasLoadedOnce.current = true;
    setLoading(false);

    // Recipes hydrate in the background — they live on their own tab and must
    // not hold up the inventory the user is looking at.
    fetchRecipes();
  }, [getAccessToken, fetchRecipes]);

  useEffect(() => {
    if (!pending) {
      fetchItems();
    }
  }, [pending, signedIn, fetchItems]);

  const changeRecipeDietaryFilter = async (filter: string) => {
    setRecipeDietaryFilter(filter);
    await fetchRecipes(filter);
  };


  const addItem = async (newItem: PantryItem) => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    const saved = await savePantryItem(newItem, token);
    setItems((prev) => [saved, ...prev.filter((i) => i.id !== saved.id)]);
    setSelectedItem(saved);
  };

  const applyQuantityResult = useCallback((id: string, newQty: number) => {
    if (newQty === 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedItem((prev) => (prev?.id === id ? null : prev));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: newQty, isLowStock: newQty <= 1 } : i)),
    );
    setSelectedItem((prev) =>
      prev?.id === id ? { ...prev, quantity: newQty, isLowStock: newQty <= 1 } : prev,
    );
  }, []);

  // +/- taps must feel instant, so each tap only moves local state. The pending
  // deltas for an item are coalesced into a single API call once the user has
  // stopped tapping for QTY_FLUSH_MS.
  const pendingDeltas = useRef<Record<string, number>>({});
  const flushTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flushQuantity = useCallback(
    async (id: string) => {
      const timer = flushTimers.current[id];
      if (timer) {
        clearTimeout(timer);
        delete flushTimers.current[id];
      }

      const delta = pendingDeltas.current[id] ?? 0;
      delete pendingDeltas.current[id];
      if (delta === 0) return;

      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch {}

      try {
        const newQty = await modifyPantryQuantity(id, delta, token);
        applyQuantityResult(id, newQty);
      } catch (err) {
        console.warn('Failed to sync pantry quantity:', err);
        // Put the delta back so the next flush (or unmount) retries it rather
        // than silently losing the user's taps.
        pendingDeltas.current[id] = (pendingDeltas.current[id] ?? 0) + delta;
      }
    },
    [getAccessToken, applyQuantityResult],
  );

  const updateQuantity = (id: string, delta: number) => {
    let optimisticQty = 0;
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        optimisticQty = Math.max(0, i.quantity + delta);
        return { ...i, quantity: optimisticQty, isLowStock: optimisticQty <= 1 };
      }),
    );
    setSelectedItem((prev) =>
      prev?.id === id
        ? { ...prev, quantity: optimisticQty, isLowStock: optimisticQty <= 1 }
        : prev,
    );

    pendingDeltas.current[id] = (pendingDeltas.current[id] ?? 0) + delta;

    if (flushTimers.current[id]) {
      clearTimeout(flushTimers.current[id]);
    }

    // Hitting zero deletes the item, so sync that immediately instead of
    // leaving a row on screen that is already gone.
    if (optimisticQty === 0) {
      flushQuantity(id);
      return;
    }

    flushTimers.current[id] = setTimeout(() => flushQuantity(id), QTY_FLUSH_MS);
  };

  // Don't lose in-flight taps when the user leaves the screen.
  useEffect(
    () => () => {
      Object.keys(flushTimers.current).forEach((id) => clearTimeout(flushTimers.current[id]));
      flushTimers.current = {};
      Object.keys(pendingDeltas.current).forEach((id) => {
        const delta = pendingDeltas.current[id];
        if (!delta) return;
        delete pendingDeltas.current[id];
        getAccessToken()
          .catch(() => null)
          .then((token) => modifyPantryQuantity(id, delta, token))
          .catch((err) => console.warn('Failed to flush pantry quantity on unmount:', err));
      });
    },
    [getAccessToken],
  );

  const deleteItem = async (id: string) => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    await removePantryItem(id, token);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  const cookRecipe = async (recipe: ZeroWasteRecipe) => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    await cookPantryRecipe(recipe, token);
    // Reload items from cache / remote
    const reloaded = await loadPantryItems(token);
    setItems(reloaded);
  };

  const lookupBarcode = async (barcode: string) => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    if (token) {
      try {
        return await lookupBarcodeRemote(barcode, token);
      } catch (err) {
        console.warn('Barcode remote lookup failed:', err);
      }
    }
    return null;
  };

  const scanReceipt = async (
    file: { uri: string; name?: string; type?: string },
    autoAdd: boolean = false,
  ) => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    if (token) {
      try {
        const resp = await scanReceiptRemote(file, token, autoAdd);
        if (resp && resp.extractedItems && resp.extractedItems.length > 0) {
          if (autoAdd) {
            await fetchItems();
          }
          return resp.extractedItems;
        }
      } catch (err) {
        console.warn('Receipt remote scan failed:', err);
      }
    }
    return [];
  };

  /**
   * Detects fruits & vegetables in a basket photo. Returns an empty list when the
   * image genuinely contains no produce, and throws a user-facing message on
   * failure so the caller can tell the two cases apart.
   */
  const scanBasket = async (
    file: { uri: string; name?: string; type?: string },
  ): Promise<BasketScanItem[]> => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    if (!token) {
      throw new Error('Please sign in to scan items into your pantry.');
    }

    try {
      const resp = await scanBasketRemote(file, token);
      return resp?.items ?? [];
    } catch (err) {
      console.warn('Basket remote scan failed:', err);
      throw new Error(pantryErrorMessage(err));
    }
  };

  const addItemsBulk = async (newItems: PantryItem[]) => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    const savedList = await savePantryItemsBulk(newItems, token);
    const createdIds = new Set(savedList.map((i) => i.id));
    setItems((prev) => [...savedList, ...prev.filter((i) => !createdIds.has(i.id))]);
    if (savedList.length > 0) {
      setSelectedItem(savedList[0]);
    }
  };

  const triggerSpoilageAlerts = async () => {
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {}

    if (token) {
      try {
        return await notifyExpiringPantryItemsRemote(token);
      } catch (err) {
        console.warn('Trigger spoilage alerts failed:', err);
      }
    }
    return { itemsAlerted: 0, message: 'Could not trigger notifications.' };
  };

  const totalItemsCount = items.reduce((acc, i) => acc + (i.quantity || 1), 0);
  const expiringSoonItems = items.filter((i) => getDaysUntilExpiry(i.expiryDate) <= 5);
  const lowStockItems = items.filter((i) => i.isLowStock || (i.quantity && i.quantity <= 1));

  const filteredItems = items
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation = selectedLocation === 'All' || item.storageLocation === selectedLocation;
      const matchesAllergen = selectedAllergenFilter === 'all' || item.allergens.includes(selectedAllergenFilter);
      return matchesSearch && matchesLocation && matchesAllergen;
    })
    .sort((a, b) => {
      if (sortBy === 'expiry') {
        return getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate);
      }
      if (sortBy === 'quantity') {
        return b.quantity - a.quantity;
      }
      return a.name.localeCompare(b.name);
    });

  return {
    loading,
    items,
    recipes,
    recipeDietaryFilter,
    setRecipeDietaryFilter: changeRecipeDietaryFilter,
    filteredItems,
    searchQuery,
    setSearchQuery,
    selectedLocation,
    setSelectedLocation,
    selectedAllergenFilter,
    setSelectedAllergenFilter,
    sortBy,
    setSortBy,
    selectedItem,
    setSelectedItem,
    addItem,
    addItemsBulk,
    updateQuantity,
    deleteItem,
    cookRecipe,
    lookupBarcode,
    scanReceipt,
    scanBasket,
    triggerSpoilageAlerts,
    refresh: fetchItems,
    totalItemsCount,
    expiringSoonItems,
    lowStockItems,
  };
}
