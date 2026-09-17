import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import Shirt from 'lucide-react-native/icons/shirt';
import Snowflake from 'lucide-react-native/icons/snowflake';
import Sun from 'lucide-react-native/icons/sun';
import Heart from 'lucide-react-native/icons/heart';
import Briefcase from 'lucide-react-native/icons/briefcase';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Plane from 'lucide-react-native/icons/plane';
import FolderHeart from 'lucide-react-native/icons/folder-heart';

export const COLLECTION_ICON_KEYS = [
  'closet',
  'winter',
  'summer',
  'wishlist',
  'office',
  'party',
  'workout',
  'travel',
] as const;

export type CollectionIconKey = (typeof COLLECTION_ICON_KEYS)[number];

export const COLLECTION_ICON_COMPONENTS: Record<
  CollectionIconKey,
  ComponentType<LucideProps>
> = {
  closet: FolderHeart,
  winter: Snowflake,
  summer: Sun,
  wishlist: Heart,
  office: Briefcase,
  party: PartyPopper,
  workout: Dumbbell,
  travel: Plane,
};

export const DEFAULT_COLLECTION_ICON = Shirt;

export function getCollectionIconComponent(
  key?: string | null,
): ComponentType<LucideProps> {
  if (!key) return DEFAULT_COLLECTION_ICON;
  return (
    COLLECTION_ICON_COMPONENTS[key as CollectionIconKey] ??
    DEFAULT_COLLECTION_ICON
  );
}
