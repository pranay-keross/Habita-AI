import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import Shirt from 'lucide-react-native/icons/shirt';
import Columns2 from 'lucide-react-native/icons/columns-2';
import SportShoe from 'lucide-react-native/icons/sport-shoe';
import Snowflake from 'lucide-react-native/icons/snowflake';
import Watch from 'lucide-react-native/icons/watch';
import Sun from 'lucide-react-native/icons/sun';
import CloudRain from 'lucide-react-native/icons/cloud-rain';
import Cloud from 'lucide-react-native/icons/cloud';
import type { ClothingCategory, WeatherContext } from './types';

export const CLOTHING_ICON_KEYS = ['shirt', 'pants', 'shoes', 'jacket', 'watch'] as const;

export type ClothingIconKey = (typeof CLOTHING_ICON_KEYS)[number];

export const CLOTHING_ICON_COMPONENTS: Record<ClothingIconKey, ComponentType<LucideProps>> = {
  shirt: Shirt,
  pants: Columns2,
  shoes: SportShoe,
  jacket: Snowflake,
  watch: Watch,
};

export const DEFAULT_CLOTHING_ICON = Shirt;

export function getClothingIconComponent(key?: string | null): ComponentType<LucideProps> {
  if (!key) return DEFAULT_CLOTHING_ICON;
  return CLOTHING_ICON_COMPONENTS[key as ClothingIconKey] ?? DEFAULT_CLOTHING_ICON;
}

// Maps each clothing category to its default icon key, used by category filter
// chips and the add/edit category picker.
export const CATEGORY_ICON_KEYS: Record<ClothingCategory, ClothingIconKey> = {
  tops: 'shirt',
  bottoms: 'pants',
  shoes: 'shoes',
  jackets: 'jacket',
  accessories: 'watch',
};

export const WEATHER_ICON_COMPONENTS: Record<WeatherContext['condition'], ComponentType<LucideProps>> = {
  sunny: Sun,
  rainy: CloudRain,
  cloudy: Cloud,
  cold: Snowflake,
  hot: Sun,
};

export function getWeatherIconComponent(
  condition?: WeatherContext['condition'] | null
): ComponentType<LucideProps> {
  if (!condition) return Sun;
  return WEATHER_ICON_COMPONENTS[condition] ?? Sun;
}
