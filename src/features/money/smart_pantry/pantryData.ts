import AsyncStorage from '@react-native-async-storage/async-storage';

export type AllergenTag = 'nut-free' | 'gluten-free' | 'dairy-free' | 'vegan' | 'halal' | 'kosher';
export type CategoryType = 'produce' | 'dairy' | 'bakery' | 'beverages' | 'meat' | 'pantry';
export type StorageLocation = 'Fridge' | 'Freezer' | 'Pantry Shelf';

export interface PantryItem {
  id: string;
  name: string;
  category: CategoryType;
  quantity: number;
  unit: string;
  expiryDate: string; // YYYY-MM-DD
  storageLocation: StorageLocation;
  allergens: AllergenTag[];
  barcode?: string;
  isLowStock?: boolean;
  notes?: string;
}

export interface ZeroWasteRecipe {
  id: string;
  title: string;
  cookTime: string;
  difficulty: 'Easy' | 'Medium' | 'Chef';
  matchPercentage: number;
  expiringIngredientUsed: string;
  dietaryTags: AllergenTag[];
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
}

const STORAGE_KEY = '@sahel_smart_pantry_v2';

export const ALLERGEN_DEFINITIONS: { tag: AllergenTag; labelKey: string; label: string; icon: string; color: string }[] = [
  { tag: 'gluten-free', labelKey: 'smart_pantry.allergen_gluten_free', label: 'Gluten-Free', icon: '🌾', color: '#10B981' },
  { tag: 'vegan', labelKey: 'smart_pantry.allergen_vegan', label: 'Vegan', icon: '🌿', color: '#059669' },
  { tag: 'halal', labelKey: 'smart_pantry.allergen_halal', label: 'Halal', icon: '🌙', color: '#6366F1' },
  { tag: 'kosher', labelKey: 'smart_pantry.allergen_kosher', label: 'Kosher', icon: '✡️', color: '#8B5CF6' },
  { tag: 'nut-free', labelKey: 'smart_pantry.allergen_nut_free', label: 'Nut-Free', icon: '🥜', color: '#F59E0B' },
  { tag: 'dairy-free', labelKey: 'smart_pantry.allergen_dairy_free', label: 'Dairy-Free', icon: '🥛', color: '#3B82F6' },
];

export const BARCODE_CATALOG: Record<string, Partial<PantryItem>> = {
  '8901234567890': {
    name: 'Organic Oat Milk (1L)',
    category: 'beverages',
    unit: 'carton',
    storageLocation: 'Fridge',
    allergens: ['vegan', 'nut-free', 'dairy-free', 'halal', 'kosher'],
  },
  '8909876543210': {
    name: 'Greek Yogurt 500g',
    category: 'dairy',
    unit: 'tub',
    storageLocation: 'Fridge',
    allergens: ['gluten-free', 'nut-free', 'halal', 'kosher'],
  },
  '8901122334455': {
    name: 'Gluten-Free Whole Grain Bread',
    category: 'bakery',
    unit: 'loaf',
    storageLocation: 'Pantry Shelf',
    allergens: ['gluten-free', 'vegan', 'nut-free', 'dairy-free', 'halal'],
  },
  '8906677889900': {
    name: 'Organic Hass Avocados (3 Pack)',
    category: 'produce',
    unit: 'pack',
    storageLocation: 'Pantry Shelf',
    allergens: ['gluten-free', 'vegan', 'nut-free', 'dairy-free', 'halal', 'kosher'],
  },
};

export const INITIAL_PANTRY_ITEMS: PantryItem[] = [
  {
    id: 'p_101',
    name: 'Organic Almond Milk',
    category: 'beverages',
    quantity: 1,
    unit: 'carton',
    expiryDate: '2026-08-20', // Expiring soon
    storageLocation: 'Fridge',
    allergens: ['gluten-free', 'vegan', 'dairy-free', 'halal', 'kosher'],
    barcode: '8901234567890',
    isLowStock: true,
  },
  {
    id: 'p_102',
    name: 'Farm Fresh Eggs (12 pcs)',
    category: 'dairy',
    quantity: 2,
    unit: 'carton',
    expiryDate: '2026-08-21', // Expiring soon
    storageLocation: 'Fridge',
    allergens: ['gluten-free', 'nut-free', 'halal', 'kosher'],
  },
  {
    id: 'p_103',
    name: 'Organic Hass Avocados',
    category: 'produce',
    quantity: 4,
    unit: 'pcs',
    expiryDate: '2026-08-22',
    storageLocation: 'Pantry Shelf',
    allergens: ['gluten-free', 'vegan', 'nut-free', 'dairy-free', 'halal', 'kosher'],
  },
  {
    id: 'p_104',
    name: 'Greek Yogurt 500g',
    category: 'dairy',
    quantity: 1,
    unit: 'tub',
    expiryDate: '2026-08-28',
    storageLocation: 'Fridge',
    allergens: ['gluten-free', 'nut-free', 'halal'],
    isLowStock: true,
  },
  {
    id: 'p_105',
    name: 'Gluten-Free Bread',
    category: 'bakery',
    quantity: 2,
    unit: 'loaf',
    expiryDate: '2026-08-25',
    storageLocation: 'Pantry Shelf',
    allergens: ['gluten-free', 'vegan', 'nut-free', 'dairy-free'],
  },
  {
    id: 'p_106',
    name: 'Wild Atlantic Salmon Filet',
    category: 'meat',
    quantity: 1,
    unit: 'pack',
    expiryDate: '2026-08-19', // Expiring tomorrow!
    storageLocation: 'Freezer',
    allergens: ['gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher'],
    isLowStock: true,
  },
  {
    id: 'p_107',
    name: 'Organic Rolled Oats (1kg)',
    category: 'pantry',
    quantity: 3,
    unit: 'bag',
    expiryDate: '2026-11-15',
    storageLocation: 'Pantry Shelf',
    allergens: ['vegan', 'dairy-free', 'halal', 'kosher'],
  },
  {
    id: 'p_108',
    name: 'Peanut Butter Smooth',
    category: 'pantry',
    quantity: 1,
    unit: 'jar',
    expiryDate: '2027-01-10',
    storageLocation: 'Pantry Shelf',
    allergens: ['gluten-free', 'vegan', 'dairy-free', 'halal'],
  },
];

export const MOCK_ZERO_WASTE_RECIPES: ZeroWasteRecipe[] = [
  {
    id: 'rec_1',
    title: 'Gluten-Free Avocado Egg Bowl',
    cookTime: '12 mins',
    difficulty: 'Easy',
    matchPercentage: 98,
    expiringIngredientUsed: 'Farm Fresh Eggs & Organic Hass Avocados',
    dietaryTags: ['gluten-free', 'nut-free', 'dairy-free'],
    ingredients: ['2 Eggs', '1 Avocado', 'Olive Oil', 'Salt & Black Pepper', 'Chili Flakes'],
    instructions: [
      'Slice avocado into thin wedges.',
      'Heat olive oil in a non-stick pan over medium heat.',
      'Fry eggs to desired crispiness with runny yolk.',
      'Assemble fried eggs over avocado, sprinkle salt & chili flakes.',
    ],
  },
  {
    id: 'rec_2',
    title: 'Creamy Almond Berry Oats',
    cookTime: '8 mins',
    difficulty: 'Easy',
    matchPercentage: 92,
    expiringIngredientUsed: 'Organic Almond Milk',
    dietaryTags: ['vegan', 'dairy-free', 'gluten-free', 'halal', 'kosher'],
    ingredients: ['1 cup Rolled Oats', '1.5 cups Almond Milk', '1 tbsp Honey or Maple Syrup', 'Fresh Berries'],
    instructions: [
      'Combine oats and almond milk in a small saucepan.',
      'Simmer over medium-low heat for 5 minutes until creamy.',
      'Drizzle maple syrup and top with berries.',
    ],
  },
  {
    id: 'rec_3',
    title: 'Crispy Pan-Seared Salmon Bowl',
    cookTime: '15 mins',
    difficulty: 'Medium',
    matchPercentage: 88,
    expiringIngredientUsed: 'Wild Atlantic Salmon Filet',
    dietaryTags: ['gluten-free', 'dairy-free', 'nut-free', 'halal'],
    ingredients: ['1 Salmon Filet', 'Lemon Juice', 'Garlic Powder', 'Olive Oil', 'Sliced Cucumber'],
    instructions: [
      'Pat salmon dry and season with salt, garlic powder, and lemon.',
      'Sear skin-side down in hot skillet for 4 minutes until golden crispy.',
      'Flip and cook 3 minutes longer.',
      'Serve over fresh cucumber slices.',
    ],
  },
];

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
