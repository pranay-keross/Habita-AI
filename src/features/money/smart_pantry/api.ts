import { apiFetch, ApiError, postMultipart } from '../../auth/api';
import type {
  BarcodeCatalogItem,
  CookRecipeResponse,
  PantryItem,
  PantryPageResponse,
  PantryRadar,
  PantrySummary,
  ReceiptScanResponse,
  ZeroWasteRecipe,
} from './types';

export interface ListPantryQuery {
  location?: string;
  category?: string;
  allergen?: string;
  search?: string;
  sortBy?: 'expiry' | 'quantity' | 'name';
  expiringOnly?: boolean;
  lowStockOnly?: boolean;
  page?: number;
  size?: number;
}

export async function listPantryItemsRemote(
  token: string,
  query?: ListPantryQuery,
): Promise<PantryPageResponse<PantryItem>> {
  const params = new URLSearchParams();
  if (query?.location && query.location !== 'All') params.append('location', query.location);
  if (query?.category && query.category !== 'all') params.append('category', query.category);
  if (query?.allergen && query.allergen !== 'all') params.append('allergen', query.allergen);
  if (query?.search) params.append('search', query.search);
  if (query?.sortBy) params.append('sortBy', query.sortBy);
  if (query?.expiringOnly) params.append('expiringOnly', 'true');
  if (query?.lowStockOnly) params.append('lowStockOnly', 'true');
  if (query?.page !== undefined) params.append('page', String(query.page));
  if (query?.size !== undefined) params.append('size', String(query.size));

  const qs = params.toString();
  const path = `/pantry/items${qs ? `?${qs}` : ''}`;
  return apiFetch<PantryPageResponse<PantryItem>>(path, { method: 'GET', token });
}

export async function createPantryItemRemote(
  item: Omit<PantryItem, 'id'>,
  token: string,
): Promise<PantryItem> {
  return apiFetch<PantryItem>('/pantry/items', {
    method: 'POST',
    body: item,
    token,
  });
}

export async function getPantryItemRemote(id: string, token: string): Promise<PantryItem> {
  return apiFetch<PantryItem>(`/pantry/items/${id}`, { method: 'GET', token });
}

export async function updatePantryItemRemote(
  id: string,
  item: Partial<PantryItem>,
  token: string,
): Promise<PantryItem> {
  return apiFetch<PantryItem>(`/pantry/items/${id}`, {
    method: 'PUT',
    body: item,
    token,
  });
}

export async function adjustPantryQuantityRemote(
  id: string,
  delta: number,
  token: string,
  deleteOnZero: boolean = true,
): Promise<{ id: string; previousQuantity: number; newQuantity: number; unit: string; isLowStock: boolean; isDeleted: boolean }> {
  return apiFetch<{
    id: string;
    previousQuantity: number;
    newQuantity: number;
    unit: string;
    isLowStock: boolean;
    isDeleted: boolean;
  }>(`/pantry/items/${id}/quantity?deleteOnZero=${deleteOnZero}`, {
    method: 'PATCH',
    body: { delta },
    token,
  });
}

export async function deletePantryItemRemote(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/pantry/items/${id}`, { method: 'DELETE', token });
}

export async function getPantrySummaryRemote(token: string): Promise<PantrySummary> {
  return apiFetch<PantrySummary>('/pantry/summary', { method: 'GET', token });
}

export async function getPantryRadarRemote(token: string): Promise<PantryRadar> {
  return apiFetch<PantryRadar>('/pantry/radar', { method: 'GET', token });
}

export async function lookupBarcodeRemote(code: string, token: string): Promise<BarcodeCatalogItem> {
  return apiFetch<BarcodeCatalogItem>(`/pantry/barcode/${encodeURIComponent(code)}`, {
    method: 'GET',
    token,
  });
}

export async function getZeroWasteRecipesRemote(
  token: string,
  maxRecipes: number = 5,
  dietaryPreference?: string,
): Promise<ZeroWasteRecipe[]> {
  const params = new URLSearchParams();
  params.append('maxRecipes', String(maxRecipes));
  if (dietaryPreference && dietaryPreference !== 'all') {
    params.append('dietaryPreference', dietaryPreference);
  }
  return apiFetch<ZeroWasteRecipe[]>(`/pantry/recipes/zero-waste?${params.toString()}`, {
    method: 'GET',
    token,
  });
}

export async function cookRecipeRemote(
  recipeId: string,
  token: string,
  portionsCooked: number = 1,
): Promise<CookRecipeResponse> {
  return apiFetch<CookRecipeResponse>(`/pantry/recipes/${recipeId}/cook`, {
    method: 'POST',
    body: { portionsCooked },
    token,
  });
}

export async function scanReceiptRemote(
  file: { uri: string; name?: string; type?: string },
  token: string,
  autoAdd: boolean = false,
): Promise<ReceiptScanResponse> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name || 'receipt.jpg',
    type: file.type || 'image/jpeg',
  } as unknown as Blob);

  form.append(
    'options',
    {
      string: JSON.stringify({ autoAdd }),
      type: 'application/json',
    } as unknown as Blob,
  );

  return postMultipart<ReceiptScanResponse>('/pantry/receipt-scan', form, token, 'POST');
}

export async function notifyExpiringPantryItemsRemote(
  token: string,
): Promise<{ itemsAlerted: number; message: string }> {
  return apiFetch<{ itemsAlerted: number; message: string }>('/pantry/radar/notify-expiring', {
    method: 'POST',
    token,
  });
}

export type PantryErrorKind =
  | 'network'
  | 'no_family'
  | 'not_found'
  | 'barcode_not_found'
  | 'recipe_not_found'
  | 'invalid_category'
  | 'invalid_storage_location'
  | 'invalid_allergen'
  | 'unknown';

export function parsePantryError(err: unknown): PantryErrorKind {
  if (!(err instanceof ApiError)) {
    return 'unknown';
  }
  if (err.status === 0) {
    return 'network';
  }
  const body = err.body as { code?: string } | null;
  const code = body?.code;
  switch (code) {
    case 'NO_FAMILY':
      return 'no_family';
    case 'ITEM_NOT_FOUND':
      return 'not_found';
    case 'BARCODE_NOT_FOUND':
      return 'barcode_not_found';
    case 'RECIPE_NOT_FOUND':
      return 'recipe_not_found';
    case 'INVALID_CATEGORY':
      return 'invalid_category';
    case 'INVALID_STORAGE_LOCATION':
      return 'invalid_storage_location';
    case 'INVALID_ALLERGEN_TAG':
      return 'invalid_allergen';
    default:
      return 'unknown';
  }
}
