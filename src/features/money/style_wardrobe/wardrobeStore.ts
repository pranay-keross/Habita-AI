import { getItem, setItem } from '../../../utils/storage';
import type { WardrobeItem, WeatherRecommendation } from './types';

const STORAGE_KEY = 'habita.wardrobe_items';

const INITIAL_WARDROBE: WardrobeItem[] = [
  {
    id: 'w_1',
    name: 'Linen Pastel Pink Shirt',
    category: 'casual',
    color: 'Pink',
    season: 'summer',
    emoji: '👔',
  },
  {
    id: 'w_2',
    name: 'Navy Blue Tailored Blazer',
    category: 'formal',
    color: 'Navy Blue',
    season: 'all-year',
    emoji: '🧥',
  },
  {
    id: 'w_3',
    name: 'Silk Royal Kurta Set',
    category: 'traditional',
    color: 'Maroon & Cream',
    season: 'all-year',
    emoji: '👘',
  },
  {
    id: 'w_4',
    name: 'Beige Chino Trousers',
    category: 'casual',
    color: 'Beige',
    season: 'all-year',
    emoji: '👖',
  },
];

export const MOCK_WEATHER_RECOMMENDATION: WeatherRecommendation = {
  location: 'Kolkata, Salt Lake',
  tempC: 31,
  condition: 'Humid & Partly Sunny ☀️',
  suggestedOutfit: 'Breathable Linen Pastel Pink Shirt & Beige Chinos with Casual Loafers',
  items: ['Linen Pastel Pink Shirt', 'Beige Chino Trousers'],
};

export async function loadWardrobe(): Promise<WardrobeItem[]> {
  const data = await getItem<WardrobeItem[]>(STORAGE_KEY, INITIAL_WARDROBE);
  if (!data || data.length === 0) {
    await saveWardrobe(INITIAL_WARDROBE);
    return INITIAL_WARDROBE;
  }
  return data;
}

export async function saveWardrobe(items: WardrobeItem[]): Promise<void> {
  await setItem(STORAGE_KEY, items);
}
