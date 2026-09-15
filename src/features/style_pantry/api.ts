import { apiFetch, postMultipart } from '../auth/api';
import type {
  CalendarEvent,
  ClothingItem,
  ClothingItemInput,
  CollectionInput,
  EventType,
  GenerateOutfitInput,
  OccasionInput,
  OutfitRecommendation,
  PickedFile,
  StyleChatInput,
  StyleChatReply,
  TripChecklistInput,
  TripChecklistItem,
  TripInput,
  TripOutfitEntry,
  TripOutfitInput,
  WardrobeCollection,
  WardrobeTrip,
  WeatherContext,
  WornOutfitEntry,
} from './types';

/**
 * Wardrobe & Weather-Adaptive Style Mirror — `/api/style/**`
 * (docs/WARDROBE_API_SPEC.md). Every function here is a thin, typed call: it sends
 * exactly the request shape the spec defines and normalises the response
 * (nulls → undefined, upper-cased enums → the client's lower-case unions).
 * Errors propagate as `ApiError`; the store decides how to fall back.
 */

// ---------------------------------------------------------------------------
// Response normalisation
// ---------------------------------------------------------------------------

type Nullable<T> = { [K in keyof T]: T[K] | null };

function orUndef<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

function lowerEventType(v: string | null | undefined): EventType {
  return (v ?? 'casual').toLowerCase() as EventType;
}

function toItem(raw: Nullable<ClothingItem>): ClothingItem {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    category: raw.category ?? 'tops',
    color: raw.color ?? '',
    brand: orUndef(raw.brand),
    season: raw.season ?? 'all-year',
    material: orUndef(raw.material),
    tags: raw.tags ?? [],
    imageUri: orUndef(raw.imageUri),
    emoji: raw.emoji ?? 'shirt',
    wearCount: raw.wearCount ?? 0,
    lastWornDate: orUndef(raw.lastWornDate),
    purchasePrice: orUndef(raw.purchasePrice),
    isWishlist: raw.isWishlist === true,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

function toOccasion(raw: Nullable<CalendarEvent>): CalendarEvent {
  return {
    id: raw.id ?? '',
    title: raw.title ?? '',
    date: raw.date ?? '',
    time: raw.time ?? '',
    eventType: lowerEventType(raw.eventType),
    location: orUndef(raw.location),
  };
}

function toOutfit(
  raw: Nullable<Omit<OutfitRecommendation, 'items'>> & { items?: Nullable<ClothingItem>[] | null },
): OutfitRecommendation {
  return {
    id: raw.id ?? '',
    title: raw.title ?? '',
    occasion: lowerEventType(raw.occasion),
    eventTitle: raw.eventTitle ?? '',
    weatherSuitability: raw.weatherSuitability ?? '',
    occasionSuitability: raw.occasionSuitability ?? '',
    items: (raw.items ?? []).map(toItem),
    stylistNote: raw.stylistNote ?? '',
    mood: orUndef(raw.mood),
    isSaved: raw.isSaved === true,
  };
}

function toHistoryEntry(raw: Nullable<WornOutfitEntry>): WornOutfitEntry {
  return {
    id: raw.id ?? '',
    date: raw.date ?? '',
    outfitTitle: raw.outfitTitle ?? '',
    occasion: lowerEventType(raw.occasion),
    eventTitle: raw.eventTitle ?? '',
    itemIds: raw.itemIds ?? [],
    mood: orUndef(raw.mood),
  };
}

function toCollection(raw: Nullable<WardrobeCollection>): WardrobeCollection {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    iconKey: raw.iconKey ?? 'closet',
    itemIds: raw.itemIds ?? [],
    createdAt: raw.createdAt ?? '',
  };
}

function toTrip(raw: Nullable<WardrobeTrip>): WardrobeTrip {
  return {
    id: raw.id ?? '',
    title: raw.title ?? '',
    coverImageUri: orUndef(raw.coverImageUri),
    startDate: raw.startDate ?? '',
    endDate: raw.endDate ?? '',
    location: orUndef(raw.location),
    notes: orUndef(raw.notes),
    packedItemIds: raw.packedItemIds ?? [],
    createdAt: raw.createdAt ?? '',
  };
}

function toTripOutfit(raw: Nullable<TripOutfitEntry>): TripOutfitEntry {
  return {
    id: raw.id ?? '',
    tripId: raw.tripId ?? '',
    date: raw.date ?? '',
    itemIds: raw.itemIds ?? [],
    outfitTitle: raw.outfitTitle ?? '',
    weatherHint: orUndef(raw.weatherHint),
  };
}

function toChecklistItem(raw: Nullable<TripChecklistItem>): TripChecklistItem {
  return {
    id: raw.id ?? '',
    tripId: raw.tripId ?? '',
    label: raw.label ?? '',
    checked: raw.checked === true,
  };
}

function toWeather(raw: Nullable<WeatherContext>): WeatherContext {
  return {
    temperature: raw.temperature ?? 0,
    condition: raw.condition ?? 'sunny',
    description: raw.description ?? '',
    icon: raw.icon ?? 'sun',
    city: orUndef(raw.city),
  };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function itemForm(input: ClothingItemInput, photo: PickedFile | null): FormData {
  // Only the spec's metadata fields — never device paths or server-owned counters.
  const metadata: ClothingItemInput = {
    name: input.name,
    category: input.category,
    color: input.color,
    brand: input.brand,
    season: input.season,
    material: input.material,
    tags: input.tags,
    emoji: input.emoji,
    purchasePrice: input.purchasePrice,
    isWishlist: input.isWishlist ?? false,
  };
  const form = new FormData();
  form.append('metadata', {
    string: JSON.stringify(metadata),
    type: 'application/json',
  } as unknown as Blob);
  if (photo) {
    form.append('file', {
      uri: photo.uri,
      name: photo.name || 'item.jpg',
      type: photo.type || 'image/jpeg',
    } as unknown as Blob);
  }
  return form;
}

/** GET /api/style/items */
export async function listWardrobeItems(token: string): Promise<ClothingItem[]> {
  const raw = await apiFetch<Nullable<ClothingItem>[]>('/style/items', { method: 'GET', token });
  return (raw ?? []).map(toItem);
}

/** POST /api/style/items (multipart: `metadata` JSON part + optional `file`) */
export async function createWardrobeItem(
  input: ClothingItemInput,
  photo: PickedFile | null,
  token: string,
): Promise<ClothingItem> {
  return toItem(await postMultipart<Nullable<ClothingItem>>('/style/items', itemForm(input, photo), token, 'POST'));
}

/** PUT /api/style/items/{itemId} — omitting `photo` keeps the existing one. */
export async function updateWardrobeItem(
  itemId: string,
  input: ClothingItemInput,
  photo: PickedFile | null,
  token: string,
): Promise<ClothingItem> {
  return toItem(
    await postMultipart<Nullable<ClothingItem>>(`/style/items/${itemId}`, itemForm(input, photo), token, 'PUT'),
  );
}

/** DELETE /api/style/items/{itemId} */
export async function deleteWardrobeItem(itemId: string, token: string): Promise<void> {
  await apiFetch<void>(`/style/items/${itemId}`, { method: 'DELETE', token });
}

/** POST /api/style/items/wear — bumps wearCount/lastWornDate server-side. */
export async function recordWearEvent(itemIds: string[], wornDate: string, token: string): Promise<void> {
  await apiFetch<void>('/style/items/wear', { method: 'POST', body: { itemIds, wornDate }, token });
}

// ---------------------------------------------------------------------------
// Weather & occasions
// ---------------------------------------------------------------------------

/** GET /api/style/weather — resolved server-side from the profile city. */
export async function getWeather(token: string): Promise<WeatherContext> {
  return toWeather(await apiFetch<Nullable<WeatherContext>>('/style/weather', { method: 'GET', token }));
}

/** GET /api/style/occasions */
export async function listOccasions(token: string): Promise<CalendarEvent[]> {
  const raw = await apiFetch<Nullable<CalendarEvent>[]>('/style/occasions', { method: 'GET', token });
  return (raw ?? []).map(toOccasion);
}

/** POST /api/style/occasions */
export async function createOccasion(input: OccasionInput, token: string): Promise<CalendarEvent> {
  return toOccasion(await apiFetch<Nullable<CalendarEvent>>('/style/occasions', { method: 'POST', body: input, token }));
}

/** DELETE /api/style/occasions/{occasionId} */
export async function deleteOccasion(occasionId: string, token: string): Promise<void> {
  await apiFetch<void>(`/style/occasions/${occasionId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Recommendation, saved outfits, style log
// ---------------------------------------------------------------------------

/**
 * POST /api/style/recommendations/generate. `eventType`/`eventTitle` let the server
 * recommend for occasions with no server row (the "today" pseudo-event).
 */
export async function generateOutfit(input: GenerateOutfitInput, token: string): Promise<OutfitRecommendation> {
  return toOutfit(
    await apiFetch<Nullable<OutfitRecommendation>>('/style/recommendations/generate', {
      timeoutMs: 45_000,
      method: 'POST',
      body: {
        occasionId: input.event.id,
        eventType: input.event.eventType,
        eventTitle: input.event.title,
        ...(input.mood ? { mood: input.mood } : {}),
        ...(input.refinementNote ? { refinementNote: input.refinementNote } : {}),
      },
      token,
    }),
  );
}

/**
 * POST /api/style/chat — one turn with the style-only AI stylist. Off-topic messages
 * get a polite redirect; style questions may come back with an outfit from the closet.
 */
export async function styleChat(input: StyleChatInput, token: string): Promise<StyleChatReply> {
  const raw = await apiFetch<{ reply: string | null; outfit: Nullable<OutfitRecommendation> | null }>('/style/chat', {
    method: 'POST',
    body: {
      message: input.message,
      history: input.history.slice(-12),
      occasionId: input.event?.id ?? null,
      eventType: input.event?.eventType ?? null,
      eventTitle: input.event?.title ?? null,
      mood: input.mood ?? null,
    },
    token,
    timeoutMs: 45_000,
  });
  return {
    reply: raw.reply ?? '',
    outfit: raw.outfit ? toOutfit(raw.outfit) : undefined,
  };
}

/** GET /api/style/outfits/saved */
export async function listSavedOutfits(token: string): Promise<OutfitRecommendation[]> {
  const raw = await apiFetch<Nullable<OutfitRecommendation>[]>('/style/outfits/saved', { method: 'GET', token });
  return (raw ?? []).map(toOutfit);
}

/** POST /api/style/outfits/saved — idempotent on a server id; a local id gets a fresh one. */
export async function saveOutfit(outfit: OutfitRecommendation, token: string): Promise<OutfitRecommendation> {
  return toOutfit(
    await apiFetch<Nullable<OutfitRecommendation>>('/style/outfits/saved', {
      method: 'POST',
      body: {
        id: outfit.id,
        title: outfit.title,
        occasion: outfit.occasion.toUpperCase(),
        eventTitle: outfit.eventTitle,
        weatherSuitability: outfit.weatherSuitability,
        occasionSuitability: outfit.occasionSuitability,
        items: outfit.items.map(i => ({ id: i.id })),
        stylistNote: outfit.stylistNote,
        mood: outfit.mood ?? null,
      },
      token,
    }),
  );
}

/** DELETE /api/style/outfits/saved/{outfitId} */
export async function deleteSavedOutfit(outfitId: string, token: string): Promise<void> {
  await apiFetch<void>(`/style/outfits/saved/${outfitId}`, { method: 'DELETE', token });
}

/** GET /api/style/history */
export async function listStyleHistory(token: string): Promise<WornOutfitEntry[]> {
  const raw = await apiFetch<Nullable<WornOutfitEntry>[]>('/style/history', { method: 'GET', token });
  return (raw ?? []).map(toHistoryEntry);
}

/** POST /api/style/history */
export async function recordStyleHistoryEntry(
  entry: Omit<WornOutfitEntry, 'id'>,
  token: string,
): Promise<WornOutfitEntry> {
  return toHistoryEntry(
    await apiFetch<Nullable<WornOutfitEntry>>('/style/history', {
      method: 'POST',
      body: { ...entry, occasion: entry.occasion.toUpperCase(), mood: entry.mood ?? null },
      token,
    }),
  );
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/** GET /api/style/collections */
export async function listCollections(token: string): Promise<WardrobeCollection[]> {
  const raw = await apiFetch<Nullable<WardrobeCollection>[]>('/style/collections', { method: 'GET', token });
  return (raw ?? []).map(toCollection);
}

/** POST /api/style/collections */
export async function createCollection(input: CollectionInput, token: string): Promise<WardrobeCollection> {
  return toCollection(
    await apiFetch<Nullable<WardrobeCollection>>('/style/collections', { method: 'POST', body: input, token }),
  );
}

/** PUT /api/style/collections/{collectionId} */
export async function updateCollection(
  collectionId: string,
  input: CollectionInput,
  token: string,
): Promise<WardrobeCollection> {
  return toCollection(
    await apiFetch<Nullable<WardrobeCollection>>(`/style/collections/${collectionId}`, {
      method: 'PUT',
      body: input,
      token,
    }),
  );
}

/** DELETE /api/style/collections/{collectionId} */
export async function deleteCollection(collectionId: string, token: string): Promise<void> {
  await apiFetch<void>(`/style/collections/${collectionId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

/** GET /api/style/trips */
export async function listTrips(token: string): Promise<WardrobeTrip[]> {
  const raw = await apiFetch<Nullable<WardrobeTrip>[]>('/style/trips', { method: 'GET', token });
  return (raw ?? []).map(toTrip);
}

/** POST /api/style/trips */
export async function createTrip(input: TripInput, token: string): Promise<WardrobeTrip> {
  return toTrip(await apiFetch<Nullable<WardrobeTrip>>('/style/trips', { method: 'POST', body: input, token }));
}

/** PUT /api/style/trips/{tripId} */
export async function updateTrip(tripId: string, input: TripInput, token: string): Promise<WardrobeTrip> {
  return toTrip(await apiFetch<Nullable<WardrobeTrip>>(`/style/trips/${tripId}`, { method: 'PUT', body: input, token }));
}

/** DELETE /api/style/trips/{tripId} */
export async function deleteTrip(tripId: string, token: string): Promise<void> {
  await apiFetch<void>(`/style/trips/${tripId}`, { method: 'DELETE', token });
}

/** GET /api/style/trips/{tripId}/outfits */
export async function listTripOutfits(tripId: string, token: string): Promise<TripOutfitEntry[]> {
  const raw = await apiFetch<Nullable<TripOutfitEntry>[]>(`/style/trips/${tripId}/outfits`, { method: 'GET', token });
  return (raw ?? []).map(toTripOutfit);
}

/** POST /api/style/trips/{tripId}/outfits — upsert keyed on (trip, date). */
export async function upsertTripOutfit(tripId: string, input: TripOutfitInput, token: string): Promise<TripOutfitEntry> {
  return toTripOutfit(
    await apiFetch<Nullable<TripOutfitEntry>>(`/style/trips/${tripId}/outfits`, { method: 'POST', body: input, token }),
  );
}

/** DELETE /api/style/trips/{tripId}/outfits/{outfitEntryId} */
export async function deleteTripOutfit(tripId: string, outfitEntryId: string, token: string): Promise<void> {
  await apiFetch<void>(`/style/trips/${tripId}/outfits/${outfitEntryId}`, { method: 'DELETE', token });
}

/** GET /api/style/trips/{tripId}/checklist */
export async function listTripChecklist(tripId: string, token: string): Promise<TripChecklistItem[]> {
  const raw = await apiFetch<Nullable<TripChecklistItem>[]>(`/style/trips/${tripId}/checklist`, {
    method: 'GET',
    token,
  });
  return (raw ?? []).map(toChecklistItem);
}

/** POST /api/style/trips/{tripId}/checklist */
export async function createTripChecklistItem(
  tripId: string,
  input: { label: string; checked?: boolean },
  token: string,
): Promise<TripChecklistItem> {
  return toChecklistItem(
    await apiFetch<Nullable<TripChecklistItem>>(`/style/trips/${tripId}/checklist`, {
      method: 'POST',
      body: { label: input.label, checked: input.checked ?? false },
      token,
    }),
  );
}

/** PUT /api/style/trips/{tripId}/checklist/{itemId} — omitted fields are left unchanged. */
export async function updateTripChecklistItem(
  tripId: string,
  itemId: string,
  input: TripChecklistInput,
  token: string,
): Promise<TripChecklistItem> {
  return toChecklistItem(
    await apiFetch<Nullable<TripChecklistItem>>(`/style/trips/${tripId}/checklist/${itemId}`, {
      method: 'PUT',
      body: input,
      token,
    }),
  );
}

/** DELETE /api/style/trips/{tripId}/checklist/{itemId} */
export async function deleteTripChecklistItem(tripId: string, itemId: string, token: string): Promise<void> {
  await apiFetch<void>(`/style/trips/${tripId}/checklist/${itemId}`, { method: 'DELETE', token });
}

export { ApiError } from '../auth/api';
