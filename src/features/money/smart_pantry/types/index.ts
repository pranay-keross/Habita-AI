export type AllergenTag = 'nut-free' | 'gluten-free' | 'dairy-free' | 'vegan' | 'halal' | 'kosher';
export type CategoryType = 'produce' | 'dairy' | 'bakery' | 'beverages' | 'meat' | 'pantry';
export type StorageLocation = 'Fridge' | 'Freezer' | 'Pantry Shelf';
export type ScreenTab = 'dashboard' | 'inventory' | 'add' | 'details' | 'radar' | 'recipes';
export type AddMode = 'barcode' | 'receipt' | 'manual';

export interface PantryItem {
  id: string;
  familyId?: string;
  name: string;
  category: CategoryType;
  quantity: number;
  unit: string;
  expiryDate: string; // YYYY-MM-DD
  storageLocation: StorageLocation;
  allergens: AllergenTag[];
  barcode?: string | null;
  isLowStock?: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  imageUrl?: string | null;
}

export interface AllergenDefinition {
  tag: AllergenTag;
  labelKey?: string;
  label: string;
  icon: string;
  color: string;
}

export interface PantrySummary {
  totalItems: number;
  totalQuantity: number;
  expiringSoonCount: number;
  expiredCount: number;
  lowStockCount: number;
  freshnessScore: number;
  byLocation: {
    fridge: number;
    freezer: number;
    pantryShelf: number;
  };
  byCategory: Record<CategoryType, number>;
}

export interface RadarItem {
  id: string;
  name: string;
  category: CategoryType;
  quantity: number;
  unit: string;
  expiryDate: string;
  daysRemaining: number;
  storageLocation: StorageLocation;
  allergens: AllergenTag[];
}

export interface AllergenMatrixEntry {
  tag: AllergenTag;
  safeItemsCount: number;
  totalItemsCount: number;
}

export interface PantryRadar {
  urgentItems: RadarItem[];
  upcomingItems: RadarItem[];
  allergenMatrix: AllergenMatrixEntry[];
}

export interface BarcodeCatalogItem {
  barcode: string;
  name: string;
  brand?: string | null;
  category: CategoryType;
  defaultUnit: string;
  suggestedStorageLocation: StorageLocation;
  allergens: AllergenTag[];
  estimatedShelfLifeDays: number;
  suggestedExpiryDate: string;
}

export interface ExtractedReceiptItem {
  name: string;
  category: CategoryType;
  quantity: number;
  unit: string;
  predictedExpiryDate: string;
  suggestedStorageLocation: StorageLocation;
  allergens: AllergenTag[];
  confidence: number;
}

export interface ReceiptScanResponse {
  receiptId: string;
  storeName: string;
  scanDate: string;
  totalAmount: number;
  currency: string;
  extractedItems: ExtractedReceiptItem[];
}

export interface DeductedCookItem {
  pantryItemId: string;
  name: string;
  deducted: number;
  remainingQuantity: number;
  unit: string;
}

export interface CookRecipeResponse {
  success: boolean;
  recipeId: string;
  deductedItems: DeductedCookItem[];
  message: string;
}

export interface PantryPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
