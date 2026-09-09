import { getItem, setItem } from '../../utils/storage';
import { isNetworkError } from '../../utils/networkStatus';
import {
  createOccasion,
  createWardrobeItem,
  deleteOccasion,
  deleteSavedOutfit,
  deleteWardrobeItem,
  generateOutfitRecommendationRemote,
  getWeather,
  listOccasions,
  listSavedOutfits,
  listStyleHistory,
  listWardrobeItems,
  recordStyleHistoryEntry,
  recordWearEvent,
  saveOutfitRemote,
  updateWardrobeItem,
} from './api';
import type {
  ClothingItem,
  ClothingCategory,
  ClothingItemInput,
  CalendarEvent,
  CreateOccasionRequest,
  Mood,
  PickedFile,
  WeatherContext,
  OutfitRecommendation,
  WornOutfitEntry,
} from './types';

const CLOSET_STORAGE_KEY = 'habita.style_pantry_items';
const SAVED_OUTFITS_KEY = 'habita.style_pantry_saved_outfits';
const OCCASIONS_STORAGE_KEY = 'habita.style_pantry_occasions';
const STYLE_HISTORY_STORAGE_KEY = 'habita.style_pantry_history';

// Local/offline fallback data — kept as the manual fallback per docs/BACKLOG.md M8-T4
// ("each hook-point's manual/local fallback must keep working if the AI call fails"),
// used whenever there's no token or the backend call fails.
export const MOCK_WEATHER: WeatherContext = {
  temperature: 28,
  condition: 'sunny',
  description: '28°C · Sunny & Pleasant',
  icon: 'sun',
};

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'evt_1',
    title: 'Office Strategy Meeting',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    eventType: 'office',
    location: 'Conference Room A',
  },
  {
    id: 'evt_2',
    title: 'Client Lunch',
    date: new Date().toISOString().split('T')[0],
    time: '1:30 PM',
    eventType: 'formal',
    location: 'Taj Bengal Bistro',
  },
  {
    id: 'evt_3',
    title: 'Evening Celebration Party',
    date: new Date().toISOString().split('T')[0],
    time: '8:00 PM',
    eventType: 'party',
    location: 'Rooftop Lounge',
  },
  {
    id: 'evt_4',
    title: 'Weekend Casual Gathering',
    date: new Date().toISOString().split('T')[0],
    time: '5:00 PM',
    eventType: 'casual',
    location: 'Park Cafe',
  },
];

export const INITIAL_CLOTHING: ClothingItem[] = [
  {
    id: 'c_1',
    name: 'Oxford Cotton Shirt',
    category: 'tops',
    color: 'White',
    brand: 'Brooks Brothers',
    season: 'all-year',
    material: '100% Premium Cotton',
    tags: ['office', 'formal', 'meeting'],
    emoji: 'shirt',
    wearCount: 14,
    lastWornDate: '2026-08-10',
  },
  {
    id: 'c_2',
    name: 'Tailored Slim Trousers',
    category: 'bottoms',
    color: 'Charcoal Black',
    brand: 'Raymond',
    season: 'all-year',
    material: 'Wool Blend',
    tags: ['office', 'formal', 'meeting', 'party'],
    emoji: 'pants',
    wearCount: 18,
    lastWornDate: '2026-08-12',
  },
  {
    id: 'c_3',
    name: 'Italian Leather Loafers',
    category: 'shoes',
    color: 'Tan Brown',
    brand: 'Clarks',
    season: 'all-year',
    material: 'Genuine Leather',
    tags: ['office', 'formal', 'casual'],
    emoji: 'shoes',
    wearCount: 22,
    lastWornDate: '2026-08-15',
  },
  {
    id: 'c_4',
    name: 'Single-Breasted Blazer',
    category: 'jackets',
    color: 'Navy Blue',
    brand: 'Zara Man',
    season: 'winter',
    material: 'Blended Wool',
    tags: ['office', 'formal', 'meeting'],
    emoji: 'jacket',
    wearCount: 8,
    lastWornDate: '2026-08-01',
  },
  {
    id: 'c_5',
    name: 'Swiss Chronograph Watch',
    category: 'accessories',
    color: 'Silver & Blue',
    brand: 'Tissot',
    season: 'all-year',
    material: 'Stainless Steel',
    tags: ['office', 'formal', 'party', 'casual'],
    emoji: 'watch',
    wearCount: 35,
    lastWornDate: '2026-08-17',
  },
  {
    id: 'c_6',
    name: 'Linen Graphic Polo',
    category: 'tops',
    color: 'Olive Green',
    brand: 'Uniqlo',
    season: 'summer',
    material: 'Linen Cotton',
    tags: ['casual', 'party', 'workout'],
    emoji: 'shirt',
    wearCount: 10,
    lastWornDate: '2026-08-14',
  },
  {
    id: 'c_7',
    name: 'Slim Fit Denim Jeans',
    category: 'bottoms',
    color: 'Indigo Blue',
    brand: "Levi's",
    season: 'all-year',
    material: 'Stretch Denim',
    tags: ['casual', 'party'],
    emoji: 'pants',
    wearCount: 26,
    lastWornDate: '2026-08-16',
  },
  {
    id: 'c_8',
    name: 'White Leather Sneakers',
    category: 'shoes',
    color: 'Pure White',
    brand: 'Adidas Stan Smith',
    season: 'all-year',
    material: 'Leather & Rubber',
    tags: ['casual', 'party', 'workout'],
    emoji: 'shoes',
    wearCount: 30,
    lastWornDate: '2026-08-16',
  },
];

export async function loadClothingItems(
  token?: string | null,
): Promise<ClothingItem[]> {
  if (token) {
    try {
      const items = await listWardrobeItems(token);
      await setItem(CLOSET_STORAGE_KEY, items);
      return items;
    } catch {
      // Remote call failed, fallback to local storage
    }
  }
  const data = await getItem<ClothingItem[]>(
    CLOSET_STORAGE_KEY,
    INITIAL_CLOTHING,
  );
  if (!data || data.length === 0) {
    await setItem(CLOSET_STORAGE_KEY, INITIAL_CLOTHING);
    return INITIAL_CLOTHING;
  }
  return data;
}

export async function saveClothingItems(items: ClothingItem[]): Promise<void> {
  await setItem(CLOSET_STORAGE_KEY, items);
}

export async function addClothingItem(
  input: ClothingItemInput,
  photo: PickedFile | null,
  token?: string | null,
): Promise<{ item: ClothingItem; offline: boolean }> {
  let offline = !token;
  let created: ClothingItem = {
    ...input,
    id: `item_${Date.now()}`,
    wearCount: 0,
  };

  if (token) {
    try {
      created = await createWardrobeItem(input, photo, token);
      offline = false;
    } catch {
      offline = true;
    }
  }

  const current = await loadClothingItems();
  await saveClothingItems([
    created,
    ...current.filter(i => i.id !== created.id),
  ]);
  return { item: created, offline };
}

export async function updateClothingItem(
  updatedItem: ClothingItem,
  photo: PickedFile | null,
  token?: string | null,
): Promise<{ item: ClothingItem; offline: boolean }> {
  let offline = !token;
  let result: ClothingItem = updatedItem;

  if (token) {
    try {
      result = await updateWardrobeItem(
        updatedItem.id,
        updatedItem,
        photo,
        token,
      );
      offline = false;
    } catch {
      offline = true;
    }
  }

  const current = await loadClothingItems();
  await saveClothingItems(current.map(i => (i.id === result.id ? result : i)));
  return { item: result, offline };
}

export async function deleteClothingItem(
  id: string,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await deleteWardrobeItem(id, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  const current = await loadClothingItems();
  await saveClothingItems(current.filter(i => i.id !== id));
  return { offline };
}

export async function recordWearOutfit(
  itemIds: string[],
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  const todayStr = new Date().toISOString().split('T')[0];

  if (token) {
    try {
      await recordWearEvent(itemIds, todayStr, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }

  const current = await loadClothingItems();
  const updated = current.map(item => {
    if (itemIds.includes(item.id)) {
      return { ...item, wearCount: item.wearCount + 1, lastWornDate: todayStr };
    }
    return item;
  });
  await saveClothingItems(updated);
  return { offline };
}

export async function loadSavedOutfits(
  token?: string | null,
): Promise<OutfitRecommendation[]> {
  if (token) {
    try {
      const outfits = await listSavedOutfits(token);
      await setItem(SAVED_OUTFITS_KEY, outfits);
      return outfits;
    } catch {
      // fall through to local cache
    }
  }
  return (await getItem<OutfitRecommendation[]>(SAVED_OUTFITS_KEY, [])) || [];
}

export async function saveOutfit(
  outfit: OutfitRecommendation,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await saveOutfitRemote(outfit, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }

  const current = await loadSavedOutfits();
  const exists = current.find(o => o.id === outfit.id);
  const updated = exists
    ? current.map(o => (o.id === outfit.id ? { ...o, isSaved: true } : o))
    : [{ ...outfit, isSaved: true }, ...current];
  await setItem(SAVED_OUTFITS_KEY, updated);
  return { offline };
}

export async function unsaveOutfit(
  outfitId: string,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await deleteSavedOutfit(outfitId, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  const current = await loadSavedOutfits();
  await setItem(
    SAVED_OUTFITS_KEY,
    current.filter(o => o.id !== outfitId),
  );
  return { offline };
}

export async function loadWeather(
  token?: string | null,
): Promise<WeatherContext> {
  if (token) {
    try {
      return await getWeather(token);
    } catch {
      // fall through to the local fallback
    }
  }
  return MOCK_WEATHER;
}

export async function loadOccasions(
  token?: string | null,
): Promise<CalendarEvent[]> {
  if (token) {
    try {
      const occasions = await listOccasions(token);
      await setItem(OCCASIONS_STORAGE_KEY, occasions);
      return occasions;
    } catch {
      // fall through to local cache/mock
    }
  }
  const cached = await getItem<CalendarEvent[] | null>(
    OCCASIONS_STORAGE_KEY,
    null,
  );
  return cached && cached.length > 0 ? cached : MOCK_EVENTS;
}

export async function createOccasionEntry(
  data: CreateOccasionRequest,
  token?: string | null,
): Promise<{ occasion: CalendarEvent; offline: boolean }> {
  let offline = !token;
  let created: CalendarEvent = { ...data, id: `evt_${Date.now()}` };

  if (token) {
    try {
      created = await createOccasion(data, token);
      offline = false;
    } catch {
      offline = true;
    }
  }

  const current = await loadOccasions();
  await setItem(OCCASIONS_STORAGE_KEY, [created, ...current]);
  return { occasion: created, offline };
}

export async function deleteOccasionEntry(
  occasionId: string,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await deleteOccasion(occasionId, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  const current = await loadOccasions();
  await setItem(
    OCCASIONS_STORAGE_KEY,
    current.filter(o => o.id !== occasionId),
  );
  return { offline };
}

// Which style tags a mood leans toward, layered on top of the occasion's own EventType
// tag match — e.g. a 'bold' mood on an 'office' occasion still prefers an item tagged
// both 'office' and 'party' over one tagged 'office' alone. Independent of EventType
// (docs/WARDROBE_API_SPEC.md §3.7), so an item never needs a mood-specific tag of its
// own — it's just a second pass over the same free-form `tags` the item already has.
const MOOD_TAG_HINTS: Record<Mood, string[]> = {
  confident: ['formal', 'office'],
  relaxed: ['casual'],
  bold: ['party'],
  cozy: ['casual', 'workout'],
  playful: ['party', 'casual'],
};

const MOOD_NOTE_PHRASE: Record<Mood, string> = {
  confident: ' with a confident, put-together edge',
  relaxed: ' with an easy, relaxed feel',
  bold: ' with a bold, stand-out energy',
  cozy: ' with a cozy, comfortable feel',
  playful: ' with a playful, fun touch',
};

// Pure, testable rule-based outfit matcher — kept as the manual/local fallback per
// docs/BACKLOG.md M7-T4/M8-T4, used whenever there's no token or the backend
// recommendation call fails. Never renamed/changed shape so it keeps working standalone;
// `mood` was added additively (optional, defaults to no preference) so existing callers
// keep compiling untouched.
export function generateAIOutfit(
  weather: WeatherContext,
  event: CalendarEvent,
  items: ClothingItem[],
  mood?: Mood,
): OutfitRecommendation {
  const targetTag = event.eventType;
  const moodTags = mood ? MOOD_TAG_HINTS[mood] : [];
  const findItem = (category: ClothingCategory): ClothingItem | undefined => {
    const matchingCat = items.filter(i => i.category === category);
    if (matchingCat.length === 0) return undefined;
    const moodAndOccasionMatch = matchingCat.find(
      i =>
        i.tags.includes(targetTag) &&
        moodTags.some(hint => i.tags.includes(hint)),
    );
    const tagMatch =
      moodAndOccasionMatch || matchingCat.find(i => i.tags.includes(targetTag));
    return (
      tagMatch || matchingCat[Math.floor(Math.random() * matchingCat.length)]
    );
  };

  const top = findItem('tops') || items[0];
  const bottom = findItem('bottoms') || items.find(i => i !== top);
  const shoes = findItem('shoes') || items.find(i => i !== top && i !== bottom);
  const jacket =
    weather.temperature < 22 || targetTag === 'office'
      ? findItem('jackets')
      : undefined;
  const accessory = findItem('accessories');

  const selectedItems: ClothingItem[] = [
    top,
    bottom,
    shoes,
    jacket,
    accessory,
  ].filter((i): i is ClothingItem => Boolean(i));

  const occasionSuitability =
    targetTag === 'office' || targetTag === 'formal'
      ? '98% Professional & Meeting Compliant'
      : targetTag === 'party'
      ? '95% Vibrant Party Aesthetic'
      : '96% Comfortable Casual Vibe';

  const weatherSuitability =
    weather.temperature > 26
      ? `100% Breathable for Hot Weather (${weather.temperature}°C)`
      : '95% Layered Comfort for Cool Weather';

  const title =
    top && bottom
      ? `${top.color} ${top.name} + ${bottom.color} ${bottom.name}`
      : top
      ? `${top.color} ${top.name}`
      : 'Outfit Suggestion';
  const stylistNote =
    top && bottom
      ? `Perfect pairing for ${event.title} at ${event.time}. ${
          top.name
        } combined with ${bottom.name} ensures a crisp silhouette${
          mood ? MOOD_NOTE_PHRASE[mood] : ''
        } appropriate for ${event.eventType}.`
      : `Add more items to your wardrobe for a complete outfit suggestion for ${event.title}.`;

  return {
    id: `outfit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title,
    occasion: event.eventType.toUpperCase(),
    eventTitle: event.title,
    weatherSuitability,
    occasionSuitability,
    items: selectedItems,
    stylistNote,
    mood,
  };
}

/**
 * Online-first outfit recommendation: tries the backend's AI/rule-based endpoint
 * (docs/WARDROBE_API_SPEC.md §"Outfit Recommendation") and falls back to the local
 * `generateAIOutfit` rule-based matcher on any failure — same manual-fallback shape
 * every other AI hook-point in this app uses (docs/BACKLOG.md M8-T4).
 */
export async function generateOutfitRecommendation(
  weather: WeatherContext,
  event: CalendarEvent,
  items: ClothingItem[],
  token?: string | null,
  mood?: Mood,
): Promise<OutfitRecommendation> {
  if (token) {
    try {
      return await generateOutfitRecommendationRemote(event.id, token, mood);
    } catch {
      // fall through to the local rule-based matcher
    }
  }
  return generateAIOutfit(weather, event, items, mood);
}

/**
 * Lists the caller's style log (aCloset-style "what did I actually wear" history),
 * most recently worn first. Online-first with an AsyncStorage fallback — same
 * shape as every other read in this store.
 */
export async function loadStyleHistory(
  token?: string | null,
): Promise<WornOutfitEntry[]> {
  if (token) {
    try {
      const history = await listStyleHistory(token);
      await setItem(STYLE_HISTORY_STORAGE_KEY, history);
      return history;
    } catch {
      // fall through to local cache
    }
  }
  return (
    (await getItem<WornOutfitEntry[]>(STYLE_HISTORY_STORAGE_KEY, [])) || []
  );
}

/**
 * Appends a style-log entry for an outfit just worn. Called alongside
 * `recordWearOutfit` (which only bumps each item's wearCount/lastWornDate) from
 * `OutfitDetailsScreen`'s "Wear Today" action — kept as a separate function so that
 * existing call sites of `recordWearOutfit` are untouched.
 */
export async function logStyleHistoryEntry(
  outfit: OutfitRecommendation,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  const draft: Omit<WornOutfitEntry, 'id'> = {
    date: new Date().toISOString().split('T')[0],
    outfitTitle: outfit.title,
    occasion: outfit.occasion,
    eventTitle: outfit.eventTitle,
    itemIds: outfit.items.map(i => i.id),
    mood: outfit.mood,
  };
  let entry: WornOutfitEntry = { ...draft, id: `history_${Date.now()}` };

  if (token) {
    try {
      entry = await recordStyleHistoryEntry(draft, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }

  const current = await loadStyleHistory();
  await setItem(STYLE_HISTORY_STORAGE_KEY, [entry, ...current]);
  return { offline };
}
