export type AllergenTag = 'nut-free' | 'gluten-free' | 'dairy-free' | 'vegan' | 'halal' | 'kosher';
export type CategoryType = 'produce' | 'dairy' | 'bakery' | 'beverages' | 'meat' | 'pantry';
export type StorageLocation = 'Fridge' | 'Freezer' | 'Pantry Shelf';
export type ScreenTab =
  | 'dashboard'
  | 'inventory'
  | 'add'
  | 'details'
  | 'radar'
  | 'recipes'
  | 'meals';
export type MealTypeKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type AddMode = 'barcode' | 'receipt' | 'basket' | 'manual';

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

export interface BasketScanItem {
  name: string;
  category: CategoryType | string;
  quantity: number;
  unit: string;
  confidence?: number;
  storageLocation?: StorageLocation;
  estimatedShelfLifeDays?: number;
  allergens?: AllergenTag[];
}

export interface BasketScanResponse {
  success: boolean;
  message: string;
  items: BasketScanItem[];
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

export interface MealIngredient {
  name: string;
  quantity: number;
  unit: string;
  /** True when the pantry holds at least the required quantity. */
  available: boolean;
  pantryItemId?: string | null;
  availableQuantity?: number | null;
  availableUnit?: string | null;
}

export interface MealNutrition {
  calories?: number | null;
  protein?: number | null;
  carbohydrates?: number | null;
  fat?: number | null;
  fiber?: number | null;
}

export interface DailyMeal {
  id: string;
  mealType: MealTypeKey | string;
  name: string;
  description?: string | null;
  recommendationReason?: string | null;
  ingredients: MealIngredient[];
  missingIngredients: MealIngredient[];
  nutrition: MealNutrition;
  /** Nutrition figures are AI estimates, never measured values. */
  nutritionEstimated: boolean;
  healthBenefits: string[];
  instructions: string[];
  dietaryTags: string[];
  difficulty: string;
  prepTime: number;
  cookTime: number;
  estimatedTime: number;
  pantryMatchPercentage: number;
  recommendationScore: number;
  cooked: boolean;
  cookedAt?: string | null;
}

export interface DailyMealPlan {
  success: boolean;
  date: string;
  recommendations: DailyMeal[];
  /** Pantry stock changed after the plan was generated; offer "Refresh Suggestions". */
  stale: boolean;
  pantryEmpty: boolean;
  generatedAt?: string | null;
  refreshesLeft: number;
  message: string;
  nutritionDisclaimer: string;
}

export interface DeductedMealIngredient {
  pantryItemId: string;
  name: string;
  deducted: number;
  remainingQuantity: number;
  unit: string;
  removedFromPantry: boolean;
}

export interface InsufficientMealIngredient {
  name: string;
  required: number;
  available: number;
  unit: string;
  reason: string;
}

export interface CookMealResponse {
  success: boolean;
  mealId: string;
  mealName: string;
  deductedItems: DeductedMealIngredient[];
  insufficientItems: InsufficientMealIngredient[];
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
