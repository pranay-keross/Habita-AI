import { getItem, setItem } from '../../utils/storage';
import type {
  ClothingItem,
  ClothingCategory,
  CalendarEvent,
  WeatherContext,
  OutfitRecommendation,
} from './types';
//
const CLOSET_STORAGE_KEY = 'habita.style_pantry_items';
const SAVED_OUTFITS_KEY = 'habita.style_pantry_saved_outfits';

export const MOCK_WEATHER: WeatherContext = {
  temperature: 28,
  condition: 'sunny',
  description: '28°C · Sunny & Pleasant',
  icon: '☀️',
};

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'evt_1',
    title: 'Office Strategy Meeting',
    time: '10:00 AM',
    eventType: 'office',
    location: 'Conference Room A',
  },
  {
    id: 'evt_2',
    title: 'Client Lunch',
    time: '1:30 PM',
    eventType: 'formal',
    location: 'Taj Bengal Bistro',
  },
  {
    id: 'evt_3',
    title: 'Evening Celebration Party',
    time: '8:00 PM',
    eventType: 'party',
    location: 'Rooftop Lounge',
  },
  {
    id: 'evt_4',
    title: 'Weekend Casual Gathering',
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
    emoji: '👔',
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
    emoji: '👖',
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
    emoji: '👞',
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
    emoji: '🧥',
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
    emoji: '⌚',
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
    emoji: '👕',
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
    emoji: '👖',
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
    emoji: '👟',
    wearCount: 30,
    lastWornDate: '2026-08-16',
  },
];

export async function loadClothingItems(): Promise<ClothingItem[]> {
  const data = await getItem<ClothingItem[]>(CLOSET_STORAGE_KEY, INITIAL_CLOTHING);
  if (!data || data.length === 0) {
    await setItem(CLOSET_STORAGE_KEY, INITIAL_CLOTHING);
    return INITIAL_CLOTHING;
  }
  return data;
}

export async function saveClothingItems(items: ClothingItem[]): Promise<void> {
  await setItem(CLOSET_STORAGE_KEY, items);
}

export async function addClothingItem(item: Omit<ClothingItem, 'id' | 'wearCount'>): Promise<ClothingItem> {
  const current = await loadClothingItems();
  const newItem: ClothingItem = {
    ...item,
    id: `item_${Date.now()}`,
    wearCount: 0,
  };
  const updated = [newItem, ...current];
  await saveClothingItems(updated);
  return newItem;
}

export async function updateClothingItem(updatedItem: ClothingItem): Promise<void> {
  const current = await loadClothingItems();
  const updated = current.map((i) => (i.id === updatedItem.id ? updatedItem : i));
  await saveClothingItems(updated);
}

export async function deleteClothingItem(id: string): Promise<void> {
  const current = await loadClothingItems();
  const updated = current.filter((i) => i.id !== id);
  await saveClothingItems(updated);
}

export async function recordWearOutfit(itemIds: string[]): Promise<void> {
  const current = await loadClothingItems();
  const todayStr = new Date().toISOString().split('T')[0];
  const updated = current.map((item) => {
    if (itemIds.includes(item.id)) {
      return {
        ...item,
        wearCount: item.wearCount + 1,
        lastWornDate: todayStr,
      };
    }
    return item;
  });
  await saveClothingItems(updated);
}

export async function loadSavedOutfits(): Promise<OutfitRecommendation[]> {
  return (await getItem<OutfitRecommendation[]>(SAVED_OUTFITS_KEY, [])) || [];
}

export async function saveOutfit(outfit: OutfitRecommendation): Promise<void> {
  const current = await loadSavedOutfits();
  const exists = current.find((o) => o.id === outfit.id);
  let updated: OutfitRecommendation[];
  if (exists) {
    updated = current.map((o) => (o.id === outfit.id ? { ...o, isSaved: true } : o));
  } else {
    updated = [{ ...outfit, isSaved: true }, ...current];
  }
  await setItem(SAVED_OUTFITS_KEY, updated);
}

export function generateAIOutfit(
  weather: WeatherContext,
  event: CalendarEvent,
  items: ClothingItem[]
): OutfitRecommendation {
  const targetTag = event.eventType;
  const findItem = (category: ClothingCategory): ClothingItem | undefined => {
    const matchingCat = items.filter((i) => i.category === category);
    if (matchingCat.length === 0) return undefined;
    const tagMatch = matchingCat.find((i) => i.tags.includes(targetTag));
    return tagMatch || matchingCat[Math.floor(Math.random() * matchingCat.length)];
  };

  const top = findItem('tops') || items[0];
  const bottom = findItem('bottoms') || items[1];
  const shoes = findItem('shoes') || items[2];
  const jacket = weather.temperature < 22 || targetTag === 'office' ? findItem('jackets') : undefined;
  const accessory = findItem('accessories');

  const selectedItems: ClothingItem[] = [top, bottom, shoes];
  if (jacket) selectedItems.push(jacket);
  if (accessory) selectedItems.push(accessory);

  const occasionSuitability = targetTag === 'office' || targetTag === 'formal'
    ? '98% Professional & Meeting Compliant'
    : targetTag === 'party'
    ? '95% Vibrant Party Aesthetic'
    : '96% Comfortable Casual Vibe';

  const weatherSuitability = weather.temperature > 26
    ? '100% Breathable for Hot Weather (28°C)'
    : '95% Layered Comfort for Cool Weather';

  const title = `${top.color} Shirt + ${bottom.color} Trousers`;
  const stylistNote = `Perfect pairing for ${event.title} at ${event.time}. ${top.name} combined with ${bottom.name} ensures a crisp silhouette appropriate for ${event.eventType}.`;

  return {
    id: `outfit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title,
    occasion: event.eventType.toUpperCase(),
    eventTitle: event.title,
    weatherSuitability,
    occasionSuitability,
    items: selectedItems,
    stylistNote,
  };
}
