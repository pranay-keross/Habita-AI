export type ClothingCategory =
  | 'tops'
  | 'bottoms'
  | 'shoes'
  | 'jackets'
  | 'accessories';

export type ClothingSeason =
  | 'summer'
  | 'winter'
  | 'monsoon'
  | 'spring'
  | 'all-year';

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  brand?: string;
  season: ClothingSeason;
  material?: string;
  tags: string[]; // e.g. ['office', 'formal', 'meeting']
  imageUri?: string; // local file:// uri before sync, remote CDN url once synced
  emoji: string;
  wearCount: number;
  lastWornDate?: string; // YYYY-MM-DD
  purchasePrice?: number; // powers the Style Calendar's "Expenses" stat
  isWishlist?: boolean; // not yet owned — excluded from outfit generation
  createdAt?: string;
  updatedAt?: string;
}

// Fields the client sends when creating/updating an item — server assigns id/wearCount.
export type ClothingItemInput = Omit<
  ClothingItem,
  'id' | 'wearCount' | 'createdAt' | 'updatedAt'
>;

export type EventType =
  | 'office'
  | 'party'
  | 'meeting'
  | 'casual'
  | 'formal'
  | 'workout';

// How the wearer wants to feel today — a second, independent axis from the occasion's
// EventType (e.g. a 'confident' office look vs. a 'relaxed' office look). Optional
// everywhere: a recommendation generated before this existed, or with no mood picked,
// simply omits it.
export type Mood = 'confident' | 'relaxed' | 'bold' | 'cozy' | 'playful';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. '10:00 AM'
  eventType: EventType;
  location?: string;
}

export type CreateOccasionRequest = Omit<CalendarEvent, 'id'>;

export interface WeatherContext {
  temperature: number; // in Celsius e.g. 28
  condition: 'sunny' | 'rainy' | 'cloudy' | 'cold' | 'hot';
  description: string; // e.g. '28°C · Sunny & Mild'
  icon: string;
  city?: string; // resolved server-side from the caller's saved profile city
}

// A locally-picked photo before it's uploaded — mirrors document_hub's PickedFile.
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

export interface OutfitRecommendation {
  id: string;
  title: string;
  occasion: string;
  eventTitle: string;
  weatherSuitability: string;
  occasionSuitability: string;
  items: ClothingItem[];
  stylistNote: string;
  mood?: Mood;
  isSaved?: boolean;
  isWornToday?: boolean;
}

// One row of the wearer's style log — recorded whenever "Wear Today" is tapped, so past
// outfits (and the mood/occasion behind each) can be browsed instead of only tracking
// each item's own wearCount/lastWornDate in isolation.
export interface WornOutfitEntry {
  id: string;
  date: string; // YYYY-MM-DD
  outfitTitle: string;
  occasion: string;
  eventTitle: string;
  itemIds: string[];
  mood?: Mood;
}

// A user-created closet folder (aCloset-style "Collections"). "All Clothes" and
// "Winter items" are computed client-side (all items / season === 'winter') and never
// stored as a WardrobeCollection — only custom, user-named folders are backend-owned.
export interface WardrobeCollection {
  id: string;
  name: string;
  iconKey: string; // resolved via collectionIcons.ts
  itemIds: string[];
  createdAt?: string;
}

export type CreateCollectionRequest = Omit<WardrobeCollection, 'id' | 'createdAt'>;

export interface WardrobeTrip {
  id: string;
  title: string;
  coverImageUri?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  location?: string;
  notes?: string;
  packedItemIds?: string[];
  createdAt?: string;
}

export type CreateTripRequest = Omit<WardrobeTrip, 'id' | 'createdAt'>;

// One row in a trip's day-by-day outfit itinerary.
export interface TripOutfitEntry {
  id: string;
  tripId: string;
  date: string; // YYYY-MM-DD
  itemIds: string[];
  outfitTitle: string;
  weatherHint?: string;
}

export type CreateTripOutfitRequest = Omit<TripOutfitEntry, 'id'>;

export interface TripChecklistItem {
  id: string;
  tripId: string;
  label: string;
  checked: boolean;
}

export type CreateTripChecklistItemRequest = Omit<TripChecklistItem, 'id'>;
