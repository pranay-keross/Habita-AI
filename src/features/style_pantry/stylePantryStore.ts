import { getItem, setItem } from '../../utils/storage';
import { todayString } from '../../utils/date';
import { t } from '../../i18n';
import * as api from './api';
import { NETWORK_ERROR, NO_SESSION_ERROR, toStoreError, type StoreError } from './errors';
import type {
  CalendarEvent,
  ClothingItem,
  ClothingItemInput,
  CollectionInput,
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
 * Wardrobe sync layer. The server is authoritative:
 *
 * - Reads try the server, refresh the AsyncStorage cache, and return `{data, offline:false}`.
 *   If the server is unreachable they return the last cached data with `offline: true`;
 *   on a real HTTP error they return cached data plus `error`.
 * - Writes require a session and a reachable server. On success the cache is updated
 *   from the server response and `{ok:true, data}` is returned; on failure nothing is
 *   written locally and `{ok:false, offline, error}` says why.
 *
 * No seed/mock data ever enters the cache — an empty closet is a valid state.
 */

export interface ReadResult<T> {
  data: T;
  /** True when `data` came from the local cache because the server was unreachable. */
  offline: boolean;
  /** Set when the server was reached but answered with an error. */
  error?: StoreError;
}

export type WriteResult<T> =
  | { ok: true; data: T; offline: false; error?: undefined }
  | { ok: false; data: null; offline: boolean; error: StoreError };

type Token = string | null | undefined;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const KEY = {
  items: 'habita.style_pantry_items',
  occasions: 'habita.style_pantry_occasions',
  saved: 'habita.style_pantry_saved_outfits',
  history: 'habita.style_pantry_history',
  collections: 'habita.style_pantry_collections',
  trips: 'habita.style_pantry_trips',
  weather: 'habita.style_pantry_weather',
  todayOutfit: 'habita.style_pantry_today_outfit',
  tripOutfits: (tripId: string) => `habita.style_pantry_trip_outfits:${tripId}`,
  tripChecklist: (tripId: string) => `habita.style_pantry_trip_checklist:${tripId}`,
} as const;

async function readCache<T>(key: string, fallback: T): Promise<T> {
  return (await getItem<T>(key, fallback)) ?? fallback;
}

function warn(operation: string, error: StoreError): void {
  if (__DEV__) {
    console.warn(`[style_pantry] ${operation} failed (${error.code}${error.status ? ` HTTP ${error.status}` : ''})`, error.message ?? '');
  }
}

async function readThrough<T>(operation: string, key: string, fallback: T, token: Token, fetcher: (token: string) => Promise<T>): Promise<ReadResult<T>> {
  if (!token) {
    return { data: await readCache(key, fallback), offline: true, error: NO_SESSION_ERROR };
  }
  try {
    const data = await fetcher(token);
    await setItem(key, data);
    return { data, offline: false };
  } catch (err) {
    const error = toStoreError(err);
    warn(operation, error);
    return { data: await readCache(key, fallback), offline: error.code === 'NETWORK', error };
  }
}

async function write<T>(operation: string, token: Token, action: (token: string) => Promise<T>, onSuccess?: (data: T) => Promise<void>): Promise<WriteResult<T>> {
  if (!token) {
    return { ok: false, data: null, offline: true, error: NO_SESSION_ERROR };
  }
  try {
    const data = await action(token);
    if (onSuccess) await onSuccess(data);
    return { ok: true, data, offline: false };
  } catch (err) {
    const error = toStoreError(err);
    warn(operation, error);
    return { ok: false, data: null, offline: error === NETWORK_ERROR, error };
  }
}

async function upsertCached<T extends { id: string }>(key: string, entity: T, prepend = true): Promise<void> {
  const current = await readCache<T[]>(key, []);
  const rest = current.filter(e => e.id !== entity.id);
  await setItem(key, prepend && !current.some(e => e.id === entity.id) ? [entity, ...rest] : current.map(e => (e.id === entity.id ? entity : e)));
}

async function removeCached<T extends { id: string }>(key: string, id: string): Promise<void> {
  const current = await readCache<T[]>(key, []);
  await setItem(key, current.filter(e => e.id !== id));
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export function loadClothingItems(token: Token): Promise<ReadResult<ClothingItem[]>> {
  return readThrough('loadClothingItems', KEY.items, [], token, api.listWardrobeItems);
}

export async function getClothingItem(id: string, token: Token): Promise<ReadResult<ClothingItem | undefined>> {
  const r = await loadClothingItems(token);
  return { ...r, data: r.data.find(i => i.id === id) };
}

export function addClothingItem(input: ClothingItemInput, photo: PickedFile | null, token: Token): Promise<WriteResult<ClothingItem>> {
  return write('addClothingItem', token, tk => api.createWardrobeItem(input, photo, tk), item => upsertCached(KEY.items, item));
}

export function updateClothingItem(id: string, input: ClothingItemInput, photo: PickedFile | null, token: Token): Promise<WriteResult<ClothingItem>> {
  return write('updateClothingItem', token, tk => api.updateWardrobeItem(id, input, photo, tk), item => upsertCached(KEY.items, item, false));
}

export function deleteClothingItem(id: string, token: Token): Promise<WriteResult<void>> {
  return write('deleteClothingItem', token, tk => api.deleteWardrobeItem(id, tk), () => removeCached<ClothingItem>(KEY.items, id));
}

/** Items the wearer actually owns — wishlist entries are never outfit candidates. */
export function ownedItems(items: ClothingItem[]): ClothingItem[] {
  return items.filter(i => !i.isWishlist);
}

// ---------------------------------------------------------------------------
// Weather & occasions
// ---------------------------------------------------------------------------

export function loadWeather(token: Token): Promise<ReadResult<WeatherContext | null>> {
  return readThrough('loadWeather', KEY.weather, null, token, api.getWeather);
}

export function loadOccasions(token: Token): Promise<ReadResult<CalendarEvent[]>> {
  return readThrough('loadOccasions', KEY.occasions, [], token, api.listOccasions);
}

export function createOccasionEntry(input: OccasionInput, token: Token): Promise<WriteResult<CalendarEvent>> {
  return write('createOccasionEntry', token, tk => api.createOccasion(input, tk), o => upsertCached(KEY.occasions, o));
}

export function deleteOccasionEntry(occasionId: string, token: Token): Promise<WriteResult<void>> {
  return write('deleteOccasionEntry', token, tk => api.deleteOccasion(occasionId, tk), () => removeCached<CalendarEvent>(KEY.occasions, occasionId));
}

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/** The AI Stylist home's ad-hoc "what should I wear today" occasion. */
export function todaysEvent(): CalendarEvent {
  return {
    id: 'today',
    title: t('ai_stylist.today_outfit_event_title'),
    date: todayString(),
    time: '',
    eventType: 'casual',
  };
}

export function generateOutfitRecommendation(input: GenerateOutfitInput, token: Token): Promise<WriteResult<OutfitRecommendation>> {
  return write('generateOutfitRecommendation', token, tk => api.generateOutfit(input, tk));
}

/** One conversational turn with the AI stylist (style topics only, server-enforced). */
export function sendStyleMessage(input: StyleChatInput, token: Token): Promise<WriteResult<StyleChatReply>> {
  return write('sendStyleMessage', token, tk => api.styleChat(input, tk));
}

interface TodayOutfitCache {
  date: string;
  outfit: OutfitRecommendation;
}

/**
 * Today's outfit for the AI Stylist home, generated once per calendar day and cached so
 * the card doesn't change every time the screen is focused. `regenerate` forces a new one.
 */
export async function loadTodaysOutfit(token: Token, opts: { regenerate?: boolean } = {}): Promise<WriteResult<OutfitRecommendation>> {
  const today = todayString();
  if (!opts.regenerate) {
    const cached = await readCache<TodayOutfitCache | null>(KEY.todayOutfit, null);
    if (cached && cached.date === today) {
      return { ok: true, data: cached.outfit, offline: false };
    }
  }
  const result = await generateOutfitRecommendation({ event: todaysEvent() }, token);
  if (result.ok) {
    await setItem(KEY.todayOutfit, { date: today, outfit: result.data } satisfies TodayOutfitCache);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Saved outfits
// ---------------------------------------------------------------------------

export function loadSavedOutfits(token: Token): Promise<ReadResult<OutfitRecommendation[]>> {
  return readThrough('loadSavedOutfits', KEY.saved, [], token, api.listSavedOutfits);
}

/** Bookmarks an outfit. The returned outfit carries the server id — use it, not the input's. */
export function saveOutfit(outfit: OutfitRecommendation, token: Token): Promise<WriteResult<OutfitRecommendation>> {
  return write('saveOutfit', token, tk => api.saveOutfit(outfit, tk), saved => upsertCached(KEY.saved, saved));
}

export function unsaveOutfit(outfitId: string, token: Token): Promise<WriteResult<void>> {
  return write('unsaveOutfit', token, tk => api.deleteSavedOutfit(outfitId, tk), () => removeCached<OutfitRecommendation>(KEY.saved, outfitId));
}

// ---------------------------------------------------------------------------
// Wear today & style log
// ---------------------------------------------------------------------------

export function loadStyleHistory(token: Token): Promise<ReadResult<WornOutfitEntry[]>> {
  return readThrough('loadStyleHistory', KEY.history, [], token, api.listStyleHistory);
}

/**
 * "Wear Today": bumps each item's wearCount/lastWornDate AND appends a style-log row —
 * two independent endpoints by design (docs/WARDROBE_API_SPEC.md §4.6).
 */
export function wearOutfit(outfit: OutfitRecommendation, token: Token): Promise<WriteResult<WornOutfitEntry>> {
  const date = todayString();
  const itemIds = outfit.items.map(i => i.id);
  return write(
    'wearOutfit',
    token,
    async tk => {
      await api.recordWearEvent(itemIds, date, tk);
      return api.recordStyleHistoryEntry(
        { date, outfitTitle: outfit.title, occasion: outfit.occasion, eventTitle: outfit.eventTitle, itemIds, mood: outfit.mood },
        tk,
      );
    },
    async entry => {
      await upsertCached(KEY.history, entry);
      const items = await readCache<ClothingItem[]>(KEY.items, []);
      await setItem(
        KEY.items,
        items.map(i => (itemIds.includes(i.id) ? { ...i, wearCount: i.wearCount + 1, lastWornDate: date } : i)),
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export function loadCollections(token: Token): Promise<ReadResult<WardrobeCollection[]>> {
  return readThrough('loadCollections', KEY.collections, [], token, api.listCollections);
}

export function addCollection(input: CollectionInput, token: Token): Promise<WriteResult<WardrobeCollection>> {
  return write('addCollection', token, tk => api.createCollection(input, tk), c => upsertCached(KEY.collections, c));
}

export function editCollection(collectionId: string, input: CollectionInput, token: Token): Promise<WriteResult<WardrobeCollection>> {
  return write('editCollection', token, tk => api.updateCollection(collectionId, input, tk), c => upsertCached(KEY.collections, c, false));
}

/** Appends an item to a closet folder (used right after creating an item from inside that folder). */
export async function addItemToCollection(collectionId: string, itemId: string, token: Token): Promise<WriteResult<WardrobeCollection>> {
  const current = await loadCollections(token);
  const collection = current.data.find(c => c.id === collectionId);
  if (!collection) {
    return { ok: false, data: null, offline: current.offline, error: { status: 404, code: 'COLLECTION_NOT_FOUND' } };
  }
  if (collection.itemIds.includes(itemId)) {
    return { ok: true, data: collection, offline: false };
  }
  return editCollection(
    collectionId,
    { name: collection.name, iconKey: collection.iconKey, itemIds: [...collection.itemIds, itemId] },
    token,
  );
}

export function removeCollection(collectionId: string, token: Token): Promise<WriteResult<void>> {
  return write('removeCollection', token, tk => api.deleteCollection(collectionId, tk), () => removeCached<WardrobeCollection>(KEY.collections, collectionId));
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export function loadTrips(token: Token): Promise<ReadResult<WardrobeTrip[]>> {
  return readThrough('loadTrips', KEY.trips, [], token, api.listTrips);
}

export async function getTrip(tripId: string, token: Token): Promise<ReadResult<WardrobeTrip | undefined>> {
  const r = await loadTrips(token);
  return { ...r, data: r.data.find(tr => tr.id === tripId) };
}

export function addTrip(input: TripInput, token: Token): Promise<WriteResult<WardrobeTrip>> {
  return write('addTrip', token, tk => api.createTrip(input, tk), tr => upsertCached(KEY.trips, tr));
}

export function editTrip(tripId: string, input: TripInput, token: Token): Promise<WriteResult<WardrobeTrip>> {
  return write('editTrip', token, tk => api.updateTrip(tripId, input, tk), tr => upsertCached(KEY.trips, tr, false));
}

export function removeTrip(tripId: string, token: Token): Promise<WriteResult<void>> {
  return write('removeTrip', token, tk => api.deleteTrip(tripId, tk), async () => {
    await removeCached<WardrobeTrip>(KEY.trips, tripId);
    await setItem(KEY.tripOutfits(tripId), []);
    await setItem(KEY.tripChecklist(tripId), []);
  });
}

export function loadTripOutfits(tripId: string, token: Token): Promise<ReadResult<TripOutfitEntry[]>> {
  return readThrough('loadTripOutfits', KEY.tripOutfits(tripId), [], token, tk => api.listTripOutfits(tripId, tk));
}

/** Creates or replaces the entry for `input.date` (server upserts on trip + date). */
export function saveTripOutfit(tripId: string, input: TripOutfitInput, token: Token): Promise<WriteResult<TripOutfitEntry>> {
  return write('saveTripOutfit', token, tk => api.upsertTripOutfit(tripId, input, tk), async entry => {
    const key = KEY.tripOutfits(tripId);
    const current = await readCache<TripOutfitEntry[]>(key, []);
    const next = [...current.filter(e => e.id !== entry.id && e.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
    await setItem(key, next);
  });
}

export function removeTripOutfit(tripId: string, outfitEntryId: string, token: Token): Promise<WriteResult<void>> {
  return write('removeTripOutfit', token, tk => api.deleteTripOutfit(tripId, outfitEntryId, tk), () => removeCached<TripOutfitEntry>(KEY.tripOutfits(tripId), outfitEntryId));
}

export function loadTripChecklist(tripId: string, token: Token): Promise<ReadResult<TripChecklistItem[]>> {
  return readThrough('loadTripChecklist', KEY.tripChecklist(tripId), [], token, tk => api.listTripChecklist(tripId, tk));
}

export function addTripChecklistItem(tripId: string, label: string, token: Token): Promise<WriteResult<TripChecklistItem>> {
  return write('addTripChecklistItem', token, tk => api.createTripChecklistItem(tripId, { label }, tk), item => upsertCached(KEY.tripChecklist(tripId), item, false).then(async () => {
    // keep insertion order (oldest first) to match the server listing
    const key = KEY.tripChecklist(tripId);
    const current = await readCache<TripChecklistItem[]>(key, []);
    if (!current.some(i => i.id === item.id)) await setItem(key, [...current, item]);
  }));
}

export function updateTripChecklistItem(tripId: string, itemId: string, input: TripChecklistInput, token: Token): Promise<WriteResult<TripChecklistItem>> {
  return write('updateTripChecklistItem', token, tk => api.updateTripChecklistItem(tripId, itemId, input, tk), item => upsertCached(KEY.tripChecklist(tripId), item, false));
}

export function removeTripChecklistItem(tripId: string, itemId: string, token: Token): Promise<WriteResult<void>> {
  return write('removeTripChecklistItem', token, tk => api.deleteTripChecklistItem(tripId, itemId, tk), () => removeCached<TripChecklistItem>(KEY.tripChecklist(tripId), itemId));
}
