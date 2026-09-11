import { apiFetch, ApiError, postMultipart } from '../../auth/api';
import type {
  BarcodeCatalogItem,
  BasketScanResponse,
  CookMealResponse,
  CookRecipeResponse,
  DailyMeal,
  DailyMealPlan,
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

export async function createPantryItemsBulkRemote(
  items: Omit<PantryItem, 'id'>[],
  token: string,
): Promise<PantryItem[]> {
  const res = await apiFetch<{ success: boolean; count: number; items: PantryItem[] }>(
    '/pantry/items/bulk',
    {
      method: 'POST',
      body: { items },
      token,
    },
  );
  return res.items || [];
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

export async function scanBasketRemote(
  file: { uri: string; name?: string; type?: string },
  token: string,
): Promise<BasketScanResponse> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name || 'basket.jpg',
    type: file.type || 'image/jpeg',
  } as unknown as Blob);

  return postMultipart<BasketScanResponse>('/pantry/scan-basket', form, token, 'POST');
}

export async function notifyExpiringPantryItemsRemote(
  token: string,
): Promise<{ itemsAlerted: number; message: string }> {
  return apiFetch<{ itemsAlerted: number; message: string }>('/pantry/radar/notify-expiring', {
    method: 'POST',
    token,
  });
}

function dietaryQuery(dietaryPreference?: string): string {
  if (!dietaryPreference || dietaryPreference === 'all') {
    return '';
  }
  return `?dietaryPreference=${encodeURIComponent(dietaryPreference)}`;
}

export async function getDailyMealsRemote(
  token: string,
  dietaryPreference?: string,
): Promise<DailyMealPlan> {
  return apiFetch<DailyMealPlan>(`/pantry/daily-meals${dietaryQuery(dietaryPreference)}`, {
    method: 'GET',
    token,
  });
}

export async function refreshDailyMealsRemote(
  token: string,
  dietaryPreference?: string,
): Promise<DailyMealPlan> {
  return apiFetch<DailyMealPlan>(`/pantry/daily-meals/refresh${dietaryQuery(dietaryPreference)}`, {
    method: 'POST',
    token,
  });
}

export async function getDailyMealRemote(mealId: string, token: string): Promise<DailyMeal> {
  return apiFetch<DailyMeal>(`/pantry/daily-meals/${encodeURIComponent(mealId)}`, {
    method: 'GET',
    token,
  });
}

export async function markMealCookedRemote(
  mealId: string,
  token: string,
): Promise<CookMealResponse> {
  return apiFetch<CookMealResponse>(
    `/pantry/daily-meals/${encodeURIComponent(mealId)}/cooked`,
    { method: 'POST', token },
  );
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
  | 'unauthorized'
  | 'scan_unavailable'
  | 'scan_invalid_image'
  | 'scan_file_too_large'
  | 'meal_not_found'
  | 'meal_already_cooked'
  | 'meal_ai_unavailable'
  | 'no_meals_generated'
  | 'refresh_limit'
  | 'unknown';

export function parsePantryError(err: unknown): PantryErrorKind {
  if (!(err instanceof ApiError)) {
    return 'unknown';
  }
  if (err.status === 0) {
    return 'network';
  }
  if (err.status === 401 || err.status === 403) {
    return 'unauthorized';
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
    case 'SCAN_AI_UNAVAILABLE':
    case 'SCAN_AI_FAILED':
      return 'scan_unavailable';
    case 'NO_IMAGE_PROVIDED':
    case 'UNSUPPORTED_IMAGE_TYPE':
    case 'INVALID_SCAN_RESULT':
    case 'INVALID_UPLOAD':
    case 'MISSING_UPLOAD_PART':
      return 'scan_invalid_image';
    case 'FILE_TOO_LARGE':
      return 'scan_file_too_large';
    case 'MEAL_NOT_FOUND':
      return 'meal_not_found';
    case 'MEAL_ALREADY_COOKED':
      return 'meal_already_cooked';
    case 'MEAL_AI_UNAVAILABLE':
    case 'MEAL_PLAN_STORAGE_FAILED':
      return 'meal_ai_unavailable';
    case 'NO_MEALS_GENERATED':
      return 'no_meals_generated';
    case 'REFRESH_LIMIT_REACHED':
      return 'refresh_limit';
    default:
      return 'unknown';
  }
}

/**
 * The backend's own `ErrorResponse.message` when it is a curated, user-safe sentence.
 * Stack traces and exception dumps are rejected so raw internals are never shown.
 */
function backendMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) {
    return null;
  }
  const body = err.body as { message?: unknown } | null;
  const message = body?.message;
  if (typeof message !== 'string') {
    return null;
  }
  const trimmed = message.trim();
  const looksInternal =
    trimmed.length > 180 ||
    trimmed.includes('\n') ||
    /Exception|\bat [a-z]+\.[a-z]+\./i.test(trimmed);
  return trimmed.length > 0 && !looksInternal ? trimmed : null;
}

/** Maps a pantry error to a user-facing message; raw backend errors are never surfaced. */
export function pantryErrorMessage(err: unknown): string {
  const kind = parsePantryError(err);

  if (kind === 'unknown' && err instanceof ApiError) {
    // An unmapped failure means we have no specific copy for it. Log the real status and
    // body, then fall back to the backend's own message so the user sees something
    // actionable instead of an opaque "something went wrong".
    console.warn('[pantry] unmapped API error', { status: err.status, body: err.body });

    const serverMessage = backendMessage(err);
    const base = serverMessage ?? 'Something went wrong. Please try again.';
    // Dev builds append the status/code so a failure can be diagnosed from the device
    // alone, without needing the Metro or backend console.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const code = (err.body as { code?: string } | null)?.code ?? 'no-code';
      return `${base}\n\n[dev] HTTP ${err.status} · ${code}`;
    }
    return base;
  }

  switch (kind) {
    case 'network':
      return 'No internet connection. Please check your network and try again.';
    case 'unauthorized':
      return 'Your session has expired. Please sign in again.';
    case 'no_family':
      return 'Create or join a household first to use your Smart Pantry.';
    case 'scan_unavailable':
      return 'Scanning is unavailable right now. Please try again in a moment or add items manually.';
    case 'scan_invalid_image':
      return 'That image could not be read. Please capture a clearer photo in JPEG or PNG format.';
    case 'scan_file_too_large':
      return 'That image is too large. Please use a photo under 10 MB.';
    case 'meal_not_found':
      return 'This meal suggestion is no longer available. Please refresh your suggestions.';
    case 'meal_already_cooked':
      return 'This meal has already been marked as cooked and stock was deducted.';
    case 'meal_ai_unavailable':
      return "We couldn't generate today's suggestions right now. Please try again.";
    case 'no_meals_generated':
      return "We couldn't build healthy meals from your current stock. Try adding a few more ingredients.";
    case 'refresh_limit':
      return "You've refreshed today's suggestions the maximum number of times. New meals arrive tomorrow.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
