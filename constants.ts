import { BookOpen, Calculator, Dna, Globe, Sparkles, Gift, BadgeCheck } from './components/icons';

export const ALL_ICONS = [Calculator, Dna, BookOpen, Globe, Sparkles];

// Firebase ile uyumluluk için icon mapping
export const ICON_MAP = {
  'Gift': Gift,
  'BadgeCheck': BadgeCheck,
  'BookOpen': BookOpen,
  'Calculator': Calculator,
  'Dna': Dna,
  'Globe': Globe,
  'Sparkles': Sparkles
};

// Icon string'den component'e çeviren helper function
export const getIconComponent = (iconName: string) => {
  return ICON_MAP[iconName as keyof typeof ICON_MAP] || Gift;
};