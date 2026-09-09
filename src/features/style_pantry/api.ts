import { apiFetch, postMultipart } from '../auth/api';
import type {
  CalendarEvent,
  ClothingItem,
  ClothingItemInput,
  CreateOccasionRequest,
  Mood,
  OutfitRecommendation,
  PickedFile,
  WeatherContext,
  WornOutfitEntry,
} from './types';

/**
 * Habita AI — Wardrobe & Weather-Adaptive Style Mirror Backend API
 *
 * Implements the contract defined in:
 * - Habita AI SRS Module 15 ("Wardrobe & Weather-Adaptive Style Mirror")
 * - docs/WARDROBE_API_SPEC.md
 *
 * Contract not yet built server-side (docs/BACKEND_CONTEXT.md). `stylePantryStore.ts`
 * calls these whenever an access token is available and falls back to AsyncStorage on
 * any failure, so every call here fails with a network error (ApiError status 0) until
 * the backend is deployed matching docs/WARDROBE_API_SPEC.md, at which point the
 * feature starts syncing live with no further frontend changes (same rollout shape
 * Expenses/Vault used).
 */

function buildMetadataPart(input: ClothingItemInput): {
  string: string;
  type: string;
} {
  return { string: JSON.stringify(input), type: 'application/json' };
}

function resolvePhotoPart(file: PickedFile): {
  uri: string;
  name: string;
  type: string;
} {
  return {
    uri: file.uri,
    name: file.name || 'item.jpg',
    type: file.type || 'image/jpeg',
  };
}

/**
 * Lists every wardrobe item owned by the caller.
 * GET /api/style/items
 */
export async function listWardrobeItems(
  token: string,
): Promise<ClothingItem[]> {
  return apiFetch<ClothingItem[]>('/style/items', { method: 'GET', token });
}

/**
 * Creates a wardrobe item, optionally attaching a photo.
 * POST /api/style/items (multipart: `metadata` JSON part + optional `file` part)
 */
export async function createWardrobeItem(
  input: ClothingItemInput,
  photo: PickedFile | null,
  token: string,
): Promise<ClothingItem> {
  const form = new FormData();
  form.append('metadata', buildMetadataPart(input) as unknown as Blob);
  if (photo) {
    form.append('file', resolvePhotoPart(photo) as unknown as Blob);
  }
  return postMultipart<ClothingItem>('/style/items', form, token, 'POST');
}

/**
 * Updates a wardrobe item's metadata, optionally replacing its photo.
 * PUT /api/style/items/{itemId} (multipart, same shape as create)
 */
export async function updateWardrobeItem(
  itemId: string,
  input: ClothingItemInput,
  photo: PickedFile | null,
  token: string,
): Promise<ClothingItem> {
  const form = new FormData();
  form.append('metadata', buildMetadataPart(input) as unknown as Blob);
  if (photo) {
    form.append('file', resolvePhotoPart(photo) as unknown as Blob);
  }
  return postMultipart<ClothingItem>(
    `/style/items/${itemId}`,
    form,
    token,
    'PUT',
  );
}

/**
 * Deletes a wardrobe item.
 * DELETE /api/style/items/{itemId}
 */
export async function deleteWardrobeItem(
  itemId: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/style/items/${itemId}`, { method: 'DELETE', token });
}

/**
 * Bulk-records that a set of items was worn on a given date — increments each item's
 * wearCount and sets lastWornDate server-side.
 * POST /api/style/items/wear
 */
export async function recordWearEvent(
  itemIds: string[],
  wornDate: string,
  token: string,
): Promise<void> {
  await apiFetch<void>('/style/items/wear', {
    method: 'POST',
    body: { itemIds, wornDate },
    token,
  });
}

/**
 * Fetches today's weather, resolved server-side from the caller's saved profile city.
 * GET /api/style/weather
 */
export async function getWeather(token: string): Promise<WeatherContext> {
  return apiFetch<WeatherContext>('/style/weather', { method: 'GET', token });
}

/**
 * Lists the caller's upcoming style occasions (used to drive outfit context).
 * GET /api/style/occasions
 */
export async function listOccasions(token: string): Promise<CalendarEvent[]> {
  return apiFetch<CalendarEvent[]>('/style/occasions', {
    method: 'GET',
    token,
  });
}

/**
 * Creates a new style occasion.
 * POST /api/style/occasions
 */
export async function createOccasion(
  data: CreateOccasionRequest,
  token: string,
): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>('/style/occasions', {
    method: 'POST',
    body: data,
    token,
  });
}

/**
 * Deletes a style occasion.
 * DELETE /api/style/occasions/{occasionId}
 */
export async function deleteOccasion(
  occasionId: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/style/occasions/${occasionId}`, {
    method: 'DELETE',
    token,
  });
}

/**
 * Generates an AI outfit recommendation for the given occasion, factoring in the
 * caller's current wardrobe and today's weather (both resolved server-side). The
 * response shape is stable whether the backend implementation is rule-based or backed
 * by LlmClientService (docs/BACKLOG.md M8-T4) — the frontend never needs to change.
 * POST /api/style/recommendations/generate
 */
export async function generateOutfitRecommendationRemote(
  occasionId: string,
  token: string,
  mood?: Mood,
): Promise<OutfitRecommendation> {
  return apiFetch<OutfitRecommendation>('/style/recommendations/generate', {
    method: 'POST',
    body: mood ? { occasionId, mood } : { occasionId },
    token,
  });
}

/**
 * Lists the caller's style history — one row per "Wear Today" tap, most recently worn
 * first. Powers the Style Log screen (aCloset-style "what did I actually wear" view).
 * GET /api/style/history
 */
export async function listStyleHistory(
  token: string,
): Promise<WornOutfitEntry[]> {
  return apiFetch<WornOutfitEntry[]>('/style/history', {
    method: 'GET',
    token,
  });
}

/**
 * Records a style-log entry for an outfit just worn. Distinct from
 * `recordWearEvent` (`POST /style/items/wear`), which only bumps each item's
 * wearCount/lastWornDate — this keeps the outfit-level record (title, occasion, mood)
 * the Style Log screen displays.
 * POST /api/style/history
 */
export async function recordStyleHistoryEntry(
  entry: Omit<WornOutfitEntry, 'id'>,
  token: string,
): Promise<WornOutfitEntry> {
  return apiFetch<WornOutfitEntry>('/style/history', {
    method: 'POST',
    body: entry,
    token,
  });
}

/**
 * Lists the caller's saved (bookmarked) outfits.
 * GET /api/style/outfits/saved
 */
export async function listSavedOutfits(
  token: string,
): Promise<OutfitRecommendation[]> {
  return apiFetch<OutfitRecommendation[]>('/style/outfits/saved', {
    method: 'GET',
    token,
  });
}

/**
 * Saves (bookmarks) an outfit recommendation.
 * POST /api/style/outfits/saved
 */
export async function saveOutfitRemote(
  outfit: OutfitRecommendation,
  token: string,
): Promise<OutfitRecommendation> {
  return apiFetch<OutfitRecommendation>('/style/outfits/saved', {
    method: 'POST',
    body: outfit,
    token,
  });
}

/**
 * Removes a saved outfit.
 * DELETE /api/style/outfits/saved/{outfitId}
 */
export async function deleteSavedOutfit(
  outfitId: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/style/outfits/saved/${outfitId}`, {
    method: 'DELETE',
    token,
  });
}

export { ApiError } from '../auth/api';
