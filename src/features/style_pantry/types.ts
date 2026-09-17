// Wire contract: docs/WARDROBE_API_SPEC.md. Response types describe what the client
// holds after `api.ts` has normalised the server JSON (nulls → undefined, enum casing
// lower-cased); *Input types are exactly what the client is allowed to send.

export type ClothingCategory =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'shoes'
  | 'jackets'
  | 'accessories';

export const CLOTHING_CATEGORIES: ClothingCategory[] = [
  'tops',
  'bottoms',
  'dresses',
  'shoes',
  'jackets',
  'accessories',
];

// Only meaningful when category is 'dresses' — the specific silhouette, shown in place
// of the generic "Dresses" label so a one-piece garment reads as its exact type.
export type DressType =
  | 'gown'
  | 'maxi_dress'
  | 'cocktail_dress'
  | 'sundress'
  | 'wrap_dress'
  | 'bodycon'
  | 'a_line'
  | 'shirt_dress'
  | 'jumpsuit';

export const DRESS_TYPES: DressType[] = [
  'gown',
  'maxi_dress',
  'cocktail_dress',
  'sundress',
  'wrap_dress',
  'bodycon',
  'a_line',
  'shirt_dress',
  'jumpsuit',
];

export type ClothingSeason =
  | 'summer'
  | 'winter'
  | 'monsoon'
  | 'spring'
  | 'all-year';

export const CLOTHING_SEASONS: ClothingSeason[] = [
  'all-year',
  'summer',
  'winter',
  'monsoon',
  'spring',
];

export type EventType =
  | 'office'
  | 'party'
  | 'meeting'
  | 'casual'
  | 'formal'
  | 'workout';

export const EVENT_TYPES: EventType[] = [
  'office',
  'party',
  'meeting',
  'casual',
  'formal',
  'workout',
];

// How the wearer wants to feel — a second axis independent of the occasion's EventType.
export type Mood = 'confident' | 'relaxed' | 'bold' | 'cozy' | 'playful';

export type WeatherCondition = 'sunny' | 'rainy' | 'cloudy' | 'cold' | 'hot';

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  /** Only set when category is 'dresses'. */
  dressType?: DressType;
  color: string;
  brand?: string;
  season: ClothingSeason;
  material?: string;
  tags: string[];
  /** Presigned S3 URL (≈10 min validity). Render with an icon fallback on load error. */
  imageUri?: string;
  emoji: string; // ClothingIconKey, resolved via clothingIcons.ts
  wearCount: number;
  lastWornDate?: string; // YYYY-MM-DD
  purchasePrice?: number;
  isWishlist: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClothingItemInput {
  name: string;
  category: ClothingCategory;
  /** Only meaningful when category is 'dresses'. */
  dressType?: DressType;
  color: string;
  brand?: string;
  season: ClothingSeason;
  material?: string;
  tags: string[];
  emoji: string;
  purchasePrice?: number;
  isWishlist?: boolean;
}

// A locally-picked photo before it's uploaded.
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Weather & occasions
// ---------------------------------------------------------------------------

export interface WeatherContext {
  temperature: number; // Celsius
  condition: WeatherCondition;
  description: string;
  icon: string;
  city?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // display string, e.g. "10:00 AM"
  eventType: EventType;
  location?: string;
}

export interface OccasionInput {
  title: string;
  date: string;
  time: string;
  eventType: EventType;
  location?: string;
}

// ---------------------------------------------------------------------------
// Recommendations, saved outfits, style log
// ---------------------------------------------------------------------------

export interface OutfitRecommendation {
  id: string;
  title: string;
  occasion: EventType;
  eventTitle: string;
  weatherSuitability: string;
  occasionSuitability: string;
  items: ClothingItem[];
  stylistNote: string;
  mood?: Mood;
  isSaved: boolean;
}

export interface GenerateOutfitInput {
  /** A saved occasion, or an ad-hoc one (e.g. the "today" pseudo-event). */
  event: Pick<CalendarEvent, 'id' | 'title' | 'eventType'>;
  mood?: Mood;
  refinementNote?: string;
}

export interface StyleChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface StyleChatInput {
  message: string;
  /** Recent transcript (the server keeps the last 12 turns). */
  history: StyleChatTurn[];
  event?: Pick<CalendarEvent, 'id' | 'title' | 'eventType'>;
  mood?: Mood;
}

export interface StyleChatReply {
  reply: string;
  /** Present when the stylist proposed a complete outfit from the closet. */
  outfit?: OutfitRecommendation;
  /** Present when the stylist answered an inventory question (e.g. "show me my sneakers") — real owned items, not necessarily a full outfit. */
  items?: ClothingItem[];
}

// ---------------------------------------------------------------------------
// Photo auto-fill (POST /api/style/items/analyze-photo) — a suggestion only,
// nothing is saved until the caller confirms and calls createWardrobeItem.
// ---------------------------------------------------------------------------

export interface WardrobeItemSuggestion {
  /** false when the photo doesn't clearly show a wearable item — see `note`. */
  looksLikeClothing: boolean;
  name?: string;
  category?: ClothingCategory;
  /** Only set when category is 'dresses'. */
  dressType?: DressType;
  color?: string;
  material?: string;
  season: ClothingSeason;
  tags: string[];
  emoji: string;
  /** Set mainly when `looksLikeClothing` is false, explaining what the photo shows instead. */
  note?: string;
}

export interface WornOutfitEntry {
  id: string;
  date: string; // YYYY-MM-DD
  outfitTitle: string;
  occasion: EventType;
  eventTitle: string;
  itemIds: string[];
  mood?: Mood;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface WardrobeCollection {
  id: string;
  name: string;
  iconKey: string; // resolved via collectionIcons.ts
  itemIds: string[];
  createdAt: string;
}

export interface CollectionInput {
  name: string;
  iconKey: string;
  itemIds: string[];
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export interface WardrobeTrip {
  id: string;
  title: string;
  coverImageUri?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  location?: string;
  notes?: string;
  packedItemIds: string[];
  createdAt: string;
}

export interface TripInput {
  title: string;
  coverImageUri?: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  /** Omit to leave the packed list unchanged on update. */
  packedItemIds?: string[];
}

export interface TripOutfitEntry {
  id: string;
  tripId: string;
  date: string; // YYYY-MM-DD
  itemIds: string[];
  outfitTitle: string;
  weatherHint?: string;
}

export interface TripOutfitInput {
  date: string;
  itemIds: string[];
  outfitTitle: string;
  weatherHint?: string;
}

export interface TripChecklistItem {
  id: string;
  tripId: string;
  label: string;
  checked: boolean;
}

export interface TripChecklistInput {
  label?: string;
  checked?: boolean;
}
