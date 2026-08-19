export type AllergenTag = 'nut-free' | 'gluten-free' | 'dairy-free' | 'vegan' | 'halal';

export interface PantryItem {
  id: string;
  name: string;
  category: 'dairy' | 'produce' | 'grains' | 'snacks' | 'spices' | 'beverages';
  quantity: number;
  unit: string;
  expiryDate: string; // YYYY-MM-DD
  allergens: AllergenTag[];
  isLowStock?: boolean;
}
