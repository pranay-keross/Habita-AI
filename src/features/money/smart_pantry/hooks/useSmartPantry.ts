import { useEffect, useState } from 'react';
import { AllergenTag, PantryItem, StorageLocation, ZeroWasteRecipe } from '../types';
import { BARCODE_CATALOG, MOCK_ZERO_WASTE_RECIPES } from '../data/mockPantryData';
import { getDaysUntilExpiry, loadPantryItems, savePantryItems } from '../services/pantryStorage';

export function useSmartPantry() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | 'All'>('All');
  const [selectedAllergenFilter, setSelectedAllergenFilter] = useState<AllergenTag | 'all'>('all');
  const [sortBy, setSortBy] = useState<'expiry' | 'name' | 'quantity'>('expiry');
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const data = await loadPantryItems();
    setItems(data);
    if (data.length > 0 && !selectedItem) {
      setSelectedItem(data[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const updateItems = async (newItems: PantryItem[]) => {
    setItems(newItems);
    await savePantryItems(newItems);
  };

  const addItem = async (newItem: PantryItem) => {
    const updated = [newItem, ...items];
    await updateItems(updated);
    setSelectedItem(newItem);
  };

  const updateQuantity = async (id: string, delta: number) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const newQty = Math.max(0, target.quantity + delta);
    if (newQty === 0) {
      deleteItem(id);
      return;
    }
    const updated = items.map((i) => (i.id === id ? { ...i, quantity: newQty } : i));
    await updateItems(updated);
    if (selectedItem?.id === id) {
      setSelectedItem({ ...selectedItem, quantity: newQty });
    }
  };

  const deleteItem = async (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    await updateItems(updated);
    setSelectedItem(updated.length > 0 ? updated[0] : null);
  };

  const cookRecipe = async (recipe: ZeroWasteRecipe) => {
    const updated = items.map((item) => {
      if (getDaysUntilExpiry(item.expiryDate) <= 5 && item.quantity > 0) {
        return { ...item, quantity: Math.max(0, item.quantity - 1) };
      }
      return item;
    });
    await updateItems(updated);
  };

  const totalItemsCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const expiringSoonItems = items.filter((i) => getDaysUntilExpiry(i.expiryDate) <= 5);
  const lowStockItems = items.filter((i) => i.isLowStock || i.quantity <= 1);

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
    updateQuantity,
    deleteItem,
    cookRecipe,
    totalItemsCount,
    expiringSoonItems,
    lowStockItems,
  };
}
