import type { CategoryType } from '../types';

/**
 * Resolves a specific product emoji from an item's name, so the pantry shows
 * "this is a tomato" rather than "this is produce" — one shared picture per
 * category was the old behavior (see pantryData.ts PANTRY_CATEGORY_ICONS) and
 * couldn't tell a tomato from an avocado. This is computed at render time from
 * whatever name the item currently has, so it's correct for anything already in
 * inventory, anything just scanned (barcode/receipt/basket all resolve to a
 * `name` before the item is created — see AddScanView.tsx), and anything typed
 * in manually, with no extra field to persist or keep in sync.
 *
 * Keyword list, not a lookup service: no network call, no dependency on a
 * backend field the API doesn't have (pantry_items has no image column — see
 * docs/SMART_PANTRY_API_SPEC.md), and it degrades gracefully — an unrecognized
 * product still gets its category's emoji, never a broken image.
 *
 * Matching rule: every keyword is checked at a word boundary (`chai` won't match
 * inside "chair", `tea` won't match inside "steak"), and entries are sorted by
 * word count then length, longest/most-specific first, so a multi-word product
 * like "peanut butter" or "coconut milk" is matched whole before "peanut"/
 * "butter" or "coconut"/"milk" are checked alone.
 */

const FRUITS: [string, string][] = [
  ['apple', '🍎'], ['green apple', '🍏'], ['banana', '🍌'], ['bananas', '🍌'], ['orange', '🍊'], ['oranges', '🍊'],
  ['mandarin', '🍊'], ['tangerine', '🍊'], ['clementine', '🍊'], ['lemon', '🍋'], ['lemons', '🍋'],
  ['lime', '🍋'], ['limes', '🍋'], ['grape', '🍇'], ['grapes', '🍇'], ['watermelon', '🍉'],
  ['muskmelon', '🍈'], ['cantaloupe', '🍈'], ['melon', '🍈'], ['pineapple', '🍍'],
  ['mango', '🥭'], ['mangoes', '🥭'], ['mangos', '🥭'], ['papaya', '🫐'], ['guava', '🍈'], ['pomegranate', '🍎'],
  ['kiwi', '🥝'], ['peach', '🍑'], ['plum', '🍑'], ['apricot', '🍑'],
  ['pear', '🍐'], ['cherry', '🍒'], ['cherries', '🍒'], ['strawberry', '🍓'],
  ['strawberries', '🍓'], ['blueberry', '🫐'], ['blueberries', '🫐'],
  ['raspberry', '🍇'], ['blackberry', '🫐'], ['fig', '🍈'], ['figs', '🍈'],
  ['date', '🌴'], ['dates', '🌴'], ['coconut', '🥥'], ['coconut water', '🥥'],
  ['avocado', '🥑'], ['avocados', '🥑'], ['litchi', '🍈'], ['lychee', '🍈'], ['jackfruit', '🍈'],
  ['dragon fruit', '🐉'], ['passion fruit', '🍈'], ['custard apple', '🍈'],
];

const VEGETABLES: [string, string][] = [
  ['tomato', '🍅'], ['tomatoes', '🍅'], ['potato', '🥔'], ['potatoes', '🥔'],
  ['sweet potato', '🍠'], ['onion', '🧅'], ['onions', '🧅'],
  ['spring onion', '🧅'], ['garlic', '🧄'], ['ginger', '🫚'], ['carrot', '🥕'],
  ['carrots', '🥕'], ['cucumber', '🥒'], ['cucumbers', '🥒'], ['capsicum', '🫑'], ['bell pepper', '🫑'],
  ['chili', '🌶️'], ['chilli', '🌶️'], ['chile', '🌶️'], ['pepper', '🌶️'], ['peppers', '🌶️'],
  ['cabbage', '🥬'], ['cauliflower', '🥦'], ['broccoli', '🥦'], ['spinach', '🥬'],
  ['lettuce', '🥬'], ['kale', '🥬'], ['leafy greens', '🥬'], ['peas', '🫛'],
  ['green peas', '🫛'], ['beans', '🫘'], ['green beans', '🫛'], ['corn', '🌽'],
  ['sweet corn', '🌽'], ['brinjal', '🍆'], ['eggplant', '🍆'], ['aubergine', '🍆'],
  ['pumpkin', '🎃'], ['squash', '🎃'], ['zucchini', '🥒'], ['radish', '🥕'],
  ['beet', '🥕'], ['beetroot', '🥕'], ['mushroom', '🍄'], ['mushrooms', '🍄'],
  ['okra', '🌿'], ['lady finger', '🌿'], ['coriander', '🌿'], ['cilantro', '🌿'],
  ['mint', '🌿'], ['parsley', '🌿'], ['basil', '🌿'], ['curry leaves', '🌿'],
  ['scallion', '🧅'], ['celery', '🥬'], ['asparagus', '🌿'], ['artichoke', '🌿'],
  ['sprouts', '🌱'], ['bean sprouts', '🌱'],
];

const NUTS_SEEDS: [string, string][] = [
  ['peanut butter', '🥜'], ['nuts', '🥜'], ['nut', '🥜'], ['mixed nuts', '🥜'],
  ['almond', '🌰'], ['almonds', '🌰'], ['almond milk', '🥛'], ['cashew', '🥜'],
  ['cashews', '🥜'], ['walnut', '🌰'], ['walnuts', '🌰'], ['pistachio', '🥜'],
  ['pistachios', '🥜'], ['peanut', '🥜'], ['peanuts', '🥜'], ['groundnut', '🥜'],
  ['hazelnut', '🌰'], ['hazelnuts', '🌰'], ['pecan', '🌰'], ['pecans', '🌰'],
  ['macadamia', '🌰'], ['sunflower seed', '🌻'], ['pumpkin seed', '🎃'],
  ['chia seed', '🌱'], ['flax seed', '🌱'], ['sesame', '🌱'],
];

const DAIRY_EGGS: [string, string][] = [
  ['coconut milk', '🥥'], ['oat milk', '🥛'], ['soy milk', '🥛'],
  ['greek yogurt', '🥛'], ['milk', '🥛'], ['curd', '🥣'], ['yogurt', '🥛'],
  ['yoghurt', '🥛'], ['cheese', '🧀'], ['paneer', '🧀'], ['butter', '🧈'],
  ['ghee', '🧈'], ['cream', '🥛'], ['buttermilk', '🥛'], ['eggs', '🥚'],
  ['egg', '🥚'],
];

const MEAT_SEAFOOD: [string, string][] = [
  ['chicken breast', '🍗'], ['chicken thigh', '🍗'], ['ground beef', '🥩'],
  ['mince', '🥩'], ['chicken', '🍗'], ['turkey', '🦃'], ['mutton', '🥩'],
  ['lamb', '🥩'], ['beef', '🥩'], ['steak', '🥩'], ['pork', '🥓'],
  ['meat', '🥩'], ['fish', '🐟'], ['prawn', '🦐'], ['prawns', '🦐'],
  ['shrimp', '🦐'], ['crab', '🦀'], ['salmon', '🐟'], ['tuna', '🐟'],
  ['bacon', '🥓'], ['sausage', '🌭'], ['sausages', '🌭'], ['ham', '🍖'],
  ['drumstick', '🍗'],
];

const BAKERY_GRAINS: [string, string][] = [
  ['whole wheat', '🌾'], ['brown bread', '🍞'], ['bread', '🍞'], ['bun', '🍞'],
  ['buns', '🍞'], ['loaf', '🍞'], ['croissant', '🥐'], ['bagel', '🥯'],
  ['roti', '🫓'], ['chapati', '🫓'], ['naan', '🫓'], ['paratha', '🫓'],
  ['tortilla', '🫓'], ['basmati', '🍚'], ['rice', '🍚'], ['wheat', '🌾'],
  ['flour', '🌾'], ['atta', '🌾'], ['maida', '🌾'], ['oats', '🥣'],
  ['oatmeal', '🥣'], ['cereal', '🥣'], ['cornflakes', '🥣'], ['pasta', '🍝'],
  ['noodles', '🍜'], ['spaghetti', '🍝'], ['macaroni', '🍝'], ['quinoa', '🌾'],
  ['barley', '🌾'], ['millet', '🌾'], ['cake', '🍰'], ['cupcake', '🧁'],
  ['cookie', '🍪'], ['cookies', '🍪'], ['biscuit', '🍪'], ['biscuits', '🍪'],
  ['cracker', '🍘'], ['crackers', '🍘'], ['pretzel', '🥨'], ['pizza', '🍕'],
  ['donut', '🍩'], ['doughnut', '🍩'], ['muffin', '🧁'], ['pancake', '🥞'],
  ['waffle', '🧇'],
];

const BEVERAGES: [string, string][] = [
  ['energy drink', '🥤'], ['soft drink', '🥤'], ['coconut water', '🥥'],
  ['water', '💧'], ['juice', '🧃'], ['soda', '🥤'], ['cola', '🥤'],
  ['coffee', '☕'], ['tea', '🍵'], ['chai', '☕'], ['wine', '🍷'],
  ['beer', '🍺'], ['whiskey', '🥃'], ['vodka', '🍸'], ['rum', '🥃'],
  ['milkshake', '🥤'], ['smoothie', '🥤'],
];

const PANTRY_CONDIMENTS: [string, string][] = [
  ['olive oil', '🫒'], ['chili powder', '🌶️'],
  ['ice cream', '🍨'], ['honey', '🍯'], ['sugar', '🧂'], ['salt', '🧂'],
  ['oil', '🫙'], ['vinegar', '🫙'], ['sauce', '🫙'], ['ketchup', '🍅'],
  ['mayonnaise', '🫙'], ['mustard', '🫙'], ['jam', '🫙'], ['jelly', '🫙'],
  ['nutella', '🍫'], ['chocolate', '🍫'], ['cocoa', '🍫'], ['spice', '🌿'],
  ['masala', '🌿'], ['turmeric', '🌿'], ['cumin', '🌿'], ['cinnamon', '🌿'],
  ['cardamom', '🌿'], ['clove', '🌿'], ['lentil', '🫘'], ['lentils', '🫘'],
  ['dal', '🫘'], ['chickpea', '🫘'], ['chickpeas', '🫘'], ['kidney bean', '🫘'],
  ['soybean', '🫘'], ['tofu', '🧊'], ['popcorn', '🍿'], ['chips', '🍟'],
  ['candy', '🍬'],
];

/** All entries merged, sorted longest/most-specific keyword first. */
const PRODUCT_KEYWORDS: [string, string][] = [
  ...FRUITS,
  ...VEGETABLES,
  ...NUTS_SEEDS,
  ...DAIRY_EGGS,
  ...MEAT_SEAFOOD,
  ...BAKERY_GRAINS,
  ...BEVERAGES,
  ...PANTRY_CONDIMENTS,
].sort((a, b) => {
  const wordsA = a[0].split(' ').length;
  const wordsB = b[0].split(' ').length;
  if (wordsA !== wordsB) return wordsB - wordsA;
  return b[0].length - a[0].length;
});

/** One emoji per broad category, used when no specific product keyword matches. */
const CATEGORY_EMOJI: Record<CategoryType, string> = {
  produce: '🥦',
  dairy: '🥛',
  bakery: '🥐',
  beverages: '🥤',
  meat: '🥩',
  pantry: '📦',
};

export const DEFAULT_PRODUCT_EMOJI = '📦';

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical pack sizes, e.g. "(12 pcs)"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Compiled once at module load, in the same priority order as PRODUCT_KEYWORDS,
// rather than building a RegExp per keyword on every call — this runs once per
// pantry item on every render of every list in the feature.
const PRODUCT_PATTERNS: [RegExp, string][] = PRODUCT_KEYWORDS.map(([keyword, emoji]) => [
  new RegExp(`\\b${escapeRegExp(keyword)}\\b`),
  emoji,
]);

/**
 * Picks the specific product emoji for an item's name, falling back to its
 * category, then to a generic package. Every keyword is matched at a word
 * boundary so short entries like "tea" or "ham" can't fire inside an unrelated
 * word (e.g. "steak", "shampoo").
 */
export function getProductEmoji(name: string | null | undefined, category?: CategoryType | string): string {
  const normalized = normalize(name || '');
  if (normalized) {
    for (const [pattern, emoji] of PRODUCT_PATTERNS) {
      if (pattern.test(normalized)) {
        return emoji;
      }
    }
  }
  if (category && category in CATEGORY_EMOJI) {
    return CATEGORY_EMOJI[category as CategoryType];
  }
  return DEFAULT_PRODUCT_EMOJI;
}
