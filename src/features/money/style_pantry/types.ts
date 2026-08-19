export type ClothingCategory =
  | 'tops'
  | 'bottoms'
  | 'shoes'
  | 'jackets'
  | 'accessories';

export type ClothingSeason = 'summer' | 'winter' | 'monsoon' | 'spring' | 'all-year';

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  brand?: string;
  season: ClothingSeason;
  material?: string;
  tags: string[]; // e.g. ['office', 'formal', 'meeting']
  imageUri?: string;
  emoji: string;
  wearCount: number;
  lastWornDate?: string; // YYYY-MM-DD
}

export type EventType = 'office' | 'party' | 'meeting' | 'casual' | 'formal' | 'workout';

export interface CalendarEvent {
  id: string;
  title: string;
  time: string; // e.g. '10:00 AM'
  eventType: EventType;
  location?: string;
}

export interface WeatherContext {
  temperature: number; // in Celsius e.g. 28
  condition: 'sunny' | 'rainy' | 'cloudy' | 'cold' | 'hot';
  description: string; // e.g. '28°C · Sunny & Mild'
  icon: string;
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
  isSaved?: boolean;
  isWornToday?: boolean;
}
