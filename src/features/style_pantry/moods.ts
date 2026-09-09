import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import Flame from 'lucide-react-native/icons/flame';
import Leaf from 'lucide-react-native/icons/leaf';
import Zap from 'lucide-react-native/icons/zap';
import Coffee from 'lucide-react-native/icons/coffee';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import type { Mood } from './types';

export const MOODS: Mood[] = [
  'confident',
  'relaxed',
  'bold',
  'cozy',
  'playful',
];

export const MOOD_ICON_COMPONENTS: Record<Mood, ComponentType<LucideProps>> = {
  confident: Flame,
  relaxed: Leaf,
  bold: Zap,
  cozy: Coffee,
  playful: PartyPopper,
};

export function getMoodIconComponent(
  mood?: Mood | null,
): ComponentType<LucideProps> | undefined {
  if (!mood) return undefined;
  return MOOD_ICON_COMPONENTS[mood];
}
