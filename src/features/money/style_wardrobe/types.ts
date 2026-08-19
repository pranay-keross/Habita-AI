export type ClosetCategory = 'formal' | 'casual' | 'traditional' | 'party' | 'activewear';

export interface WardrobeItem {
  id: string;
  name: string;
  category: ClosetCategory;
  color: string;
  season: 'summer' | 'winter' | 'monsoon' | 'all-year';
  emoji: string;
}

export interface WeatherRecommendation {
  location: string;
  tempC: number;
  condition: string;
  suggestedOutfit: string;
  items: string[];
}
