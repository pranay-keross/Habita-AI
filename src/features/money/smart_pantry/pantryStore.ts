import { getItem, setItem } from '../../../utils/storage';
import type { PantryItem } from './types';

const STORAGE_KEY = 'habita.pantry_items';

const INITIAL_PANTRY: PantryItem[] = [
  {
    id: 'p_1',
    name: 'Organic Almond Milk 1L',
    category: 'dairy',
    quantity: 2,
    unit: 'cartons',
    expiryDate: '2026-08-20',
    allergens: ['dairy-free', 'vegan', 'halal'],
  },
  {
    id: 'p_2',
    name: 'Gluten-Free Oats 1kg',
    category: 'grains',
    quantity: 1,
    unit: 'bag',
    expiryDate: '2026-11-15',
    allergens: ['gluten-free', 'nut-free', 'vegan'],
  },
  {
    id: 'p_3',
    name: 'Fresh Farm Eggs (Dozen)',
    category: 'dairy',
    quantity: 1,
    unit: 'pack',
    expiryDate: '2026-08-16', // Expiring in 2 days!
    allergens: ['dairy-free', 'nut-free', 'gluten-free'],
    isLowStock: true,
  },
  {
    id: 'p_4',
    name: 'Greek Yogurt 500g',
    category: 'dairy',
    quantity: 3,
    unit: 'tubs',
    expiryDate: '2026-08-25',
    allergens: ['nut-free', 'gluten-free'],
  },
];

export async function loadPantry(): Promise<PantryItem[]> {
  const data = await getItem<PantryItem[]>(STORAGE_KEY, INITIAL_PANTRY);
  if (!data || data.length === 0) {
    await savePantry(INITIAL_PANTRY);
    return INITIAL_PANTRY;
  }
  return data;
}

export async function savePantry(items: PantryItem[]): Promise<void> {
  await setItem(STORAGE_KEY, items);
}
