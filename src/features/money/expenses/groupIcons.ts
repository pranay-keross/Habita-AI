import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import House from 'lucide-react-native/icons/house';
import Umbrella from 'lucide-react-native/icons/umbrella';
import Popcorn from 'lucide-react-native/icons/popcorn';
import Car from 'lucide-react-native/icons/car';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import Plane from 'lucide-react-native/icons/plane';
import Hamburger from 'lucide-react-native/icons/hamburger';
import Gift from 'lucide-react-native/icons/gift';
import Users from 'lucide-react-native/icons/users';

export const GROUP_ICON_KEYS = [
  'house',
  'umbrella',
  'popcorn',
  'car',
  'graduation-cap',
  'plane',
  'hamburger',
  'gift',
] as const;

export type GroupIconKey = (typeof GROUP_ICON_KEYS)[number];

export const GROUP_ICON_COMPONENTS: Record<string, ComponentType<LucideProps>> = {
  house: House,
  umbrella: Umbrella,
  popcorn: Popcorn,
  car: Car,
  'graduation-cap': GraduationCap,
  plane: Plane,
  hamburger: Hamburger,
  gift: Gift,
};

export const DEFAULT_GROUP_ICON = Users;

export function getGroupIconComponent(key?: string | null): ComponentType<LucideProps> {
  if (!key) return DEFAULT_GROUP_ICON;
  return GROUP_ICON_COMPONENTS[key] ?? DEFAULT_GROUP_ICON;
}
