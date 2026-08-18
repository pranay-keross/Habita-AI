export type AllergenTag = 'nut-free' | 'gluten-free' | 'dairy-free' | 'vegan' | 'halal' | 'kosher';
export type CategoryType = 'produce' | 'dairy' | 'bakery' | 'beverages' | 'meat' | 'pantry';
export type StorageLocation = 'Fridge' | 'Freezer' | 'Pantry Shelf';
export type ScreenTab = 'dashboard' | 'inventory' | 'add' | 'details' | 'radar' | 'recipes';
export type AddMode = 'barcode' | 'receipt' | 'manual';

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

export interface AllergenDefinition {
  tag: AllergenTag;
  label: string;
  icon: string;
  color: string;
}
