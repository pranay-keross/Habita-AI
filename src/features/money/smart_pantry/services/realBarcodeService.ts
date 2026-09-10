import { NativeModules, Platform } from 'react-native';
import { AllergenTag, CategoryType, StorageLocation } from '../types';

const { BarcodeScannerModule } = NativeModules;

export interface RealScannedBarcodeResult {
  rawValue: string;
  displayValue?: string;
  format?: number;
}

export interface ResolvedBarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  category: CategoryType;
  unit: string;
  storageLocation: StorageLocation;
  allergens: AllergenTag[];
  suggestedExpiryDate: string;
  source: 'local' | 'backend' | 'openfoodfacts';
}

function computeExpiry(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Launches the live real-time CameraX hardware scanner.
 * Scans automatically without taking a photo.
 */
export async function startRealtimeBarcodeScan(): Promise<string | null> {
  if (Platform.OS === 'android' && BarcodeScannerModule?.startLiveScanner) {
    try {
      const result: RealScannedBarcodeResult | null =
        await BarcodeScannerModule.startLiveScanner();
      if (result && result.rawValue && result.rawValue.trim().length > 0) {
        return result.rawValue.trim();
      }
    } catch (err) {
      console.warn('Realtime barcode scanner error:', err);
    }
  }
  return null;
}

/**
 * Reads the actual physical barcode from an image file using Native ML Kit.
 */
export async function scanBarcodeFromImage(imageUri: string): Promise<string | null> {
  if (Platform.OS === 'android' && BarcodeScannerModule?.scanBarcodeFromUri) {
    try {
      const result: RealScannedBarcodeResult | null =
        await BarcodeScannerModule.scanBarcodeFromUri(imageUri);
      if (result && result.rawValue && result.rawValue.trim().length > 0) {
        return result.rawValue.trim();
      }
    } catch (err) {
      console.warn('Native BarcodeScannerModule failed:', err);
    }
  }
  return null;
}

/**
 * Resolves a real-world barcode against Open Food Facts global database (3+ million items).
 */
export async function lookupOpenFoodFacts(barcode: string): Promise<ResolvedBarcodeProduct | null> {
  try {
    const cleanCode = barcode.trim();
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HabitaAI-SmartPantry - Android - Version 1.0',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const rawName =
        p.product_name ||
        p.product_name_en ||
        p.product_name_imported ||
        p.brands ||
        '';

      if (!rawName.trim()) {
        return null;
      }

      // Infer Category
      const categoriesBlob = (
        (p.categories || '') +
        ' ' +
        (p.pnns_groups_1 || '') +
        ' ' +
        (p.pnns_groups_2 || '')
      ).toLowerCase();

      let category: CategoryType = 'pantry';
      let storageLocation: StorageLocation = 'Pantry Shelf';
      let shelfLifeDays = 30;

      if (
        categoriesBlob.includes('dairy') ||
        categoriesBlob.includes('milk') ||
        categoriesBlob.includes('cheese') ||
        categoriesBlob.includes('yogurt') ||
        categoriesBlob.includes('butter')
      ) {
        category = 'dairy';
        storageLocation = 'Fridge';
        shelfLifeDays = 10;
      } else if (
        categoriesBlob.includes('bakery') ||
        categoriesBlob.includes('bread') ||
        categoriesBlob.includes('pastr') ||
        categoriesBlob.includes('toast')
      ) {
        category = 'bakery';
        storageLocation = 'Pantry Shelf';
        shelfLifeDays = 5;
      } else if (
        categoriesBlob.includes('beverage') ||
        categoriesBlob.includes('drink') ||
        categoriesBlob.includes('juice') ||
        categoriesBlob.includes('water') ||
        categoriesBlob.includes('soda') ||
        categoriesBlob.includes('tea') ||
        categoriesBlob.includes('coffee')
      ) {
        category = 'beverages';
        storageLocation = 'Fridge';
        shelfLifeDays = 20;
      } else if (
        categoriesBlob.includes('meat') ||
        categoriesBlob.includes('fish') ||
        categoriesBlob.includes('seafood') ||
        categoriesBlob.includes('poultry')
      ) {
        category = 'meat';
        storageLocation = 'Fridge';
        shelfLifeDays = 4;
      } else if (
        categoriesBlob.includes('fruit') ||
        categoriesBlob.includes('vegetable') ||
        categoriesBlob.includes('produce') ||
        categoriesBlob.includes('salad')
      ) {
        category = 'produce';
        storageLocation = 'Fridge';
        shelfLifeDays = 7;
      }

      // Infer Allergen Tags
      const allergens: AllergenTag[] = [];
      const allergensTags = (p.allergens_tags || []).map((t: string) => t.toLowerCase());
      const tracesTags = (p.traces_tags || []).map((t: string) => t.toLowerCase());
      const allAllergenBlobs = [...allergensTags, ...tracesTags].join(' ');

      if (!allAllergenBlobs.includes('gluten') && !allAllergenBlobs.includes('wheat')) {
        allergens.push('gluten-free');
      }
      if (
        !allAllergenBlobs.includes('milk') &&
        !allAllergenBlobs.includes('dairy') &&
        category !== 'dairy'
      ) {
        allergens.push('dairy-free');
      }
      if (!allAllergenBlobs.includes('nut') && !allAllergenBlobs.includes('peanut')) {
        allergens.push('nut-free');
      }
      if (
        (p.labels_tags || []).some(
          (l: string) => l.includes('vegan') || l.includes('vegetarian'),
        )
      ) {
        allergens.push('vegan');
      }

      const unit = p.product_quantity_unit || p.quantity || 'pcs';
      const brand = p.brands || undefined;

      return {
        barcode: cleanCode,
        name: rawName.trim(),
        brand,
        category,
        unit: unit.replace(/[0-9.]/g, '').trim() || 'pcs',
        storageLocation,
        allergens,
        suggestedExpiryDate: computeExpiry(shelfLifeDays),
        source: 'openfoodfacts',
      };
    }
  } catch (err) {
    console.warn('Open Food Facts API error:', err);
  }
  return null;
}
