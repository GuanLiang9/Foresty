export const APP = 'Evergrove';

// Palette slots: a = light, b = mid, c = deep, t = trunk/stem, x = accent
const P = (a, b, c, t, x) => ({ a, b, c, t, x });

export const SPECIES = [
  { id: 'oak', name: 'Elder Oak', kind: 'round', price: 0, rarity: 'Common', pal: P('#6ee7b7', '#34d399', '#059669', '#7a5a45', '#a7f3d0'), blurb: 'Steady and patient. Yours from day one.' },
  { id: 'pine', name: 'North Pine', kind: 'pine', price: 0, rarity: 'Common', pal: P('#5eead4', '#14b8a6', '#0f766e', '#6b4f3d', '#ccfbf1'), blurb: 'Grows straight up, like a good morning.' },
  { id: 'sun', name: 'Sunbloom', kind: 'flower', price: 60, rarity: 'Common', pal: P('#fde68a', '#fbbf24', '#22c55e', '#16a34a', '#92400e'), blurb: 'Turns to face whatever you focus on.' },
  { id: 'cactus', name: 'Dune Cactus', kind: 'cactus', price: 120, rarity: 'Common', pal: P('#86efac', '#22c55e', '#15803d', '#15803d', '#fb7185'), blurb: 'Thrives on long, dry stretches of work.' },
  { id: 'blossom', name: 'Dawn Blossom', kind: 'round', dots: true, price: 200, rarity: 'Rare', pal: P('#fbcfe8', '#f9a8d4', '#ec4899', '#5b4038', '#fff1f2'), blurb: 'Blooms once the hard part is behind you.' },
  { id: 'bamboo', name: 'Jade Bamboo', kind: 'bamboo', price: 280, rarity: 'Rare', pal: P('#bef264', '#84cc16', '#4d7c0f', '#65a30d', '#ecfccb'), blurb: 'Quiet for a while, then all at once.' },
  { id: 'palm', name: 'Lagoon Palm', kind: 'palm', price: 380, rarity: 'Rare', pal: P('#6ee7b7', '#10b981', '#047857', '#a16207', '#78350f'), blurb: 'For work that deserves a holiday after.' },
  { id: 'maple', name: 'Ember Maple', kind: 'round', price: 500, rarity: 'Rare', pal: P('#fdba74', '#f97316', '#c2410c', '#57382b', '#ffedd5'), blurb: 'Burns bright through the late hours.' },
  { id: 'willow', name: 'Moon Willow', kind: 'willow', price: 650, rarity: 'Epic', pal: P('#a5f3fc', '#5eead4', '#0d9488', '#64748b', '#ecfeff'), blurb: 'Bends, never breaks. Neither do you.' },
  { id: 'shroom', name: 'Glowcap', kind: 'shroom', price: 850, rarity: 'Epic', pal: P('#ddd6fe', '#8b5cf6', '#6d28d9', '#ede9fe', '#67e8f9'), blurb: 'Lights up when everything else goes dark.' },
  { id: 'aurora', name: 'Aurora Pine', kind: 'pine', snow: true, price: 1100, rarity: 'Epic', pal: P('#67e8f9', '#6366f1', '#3730a3', '#475569', '#e0f2fe'), blurb: 'Carries a little of the northern sky.' },
  { id: 'prism', name: 'Prism Spire', kind: 'crystal', price: 1600, rarity: 'Legendary', pal: P('#a5f3fc', '#22d3ee', '#7c3aed', '#1e293b', '#f0abfc'), blurb: 'Attention, crystallised.' },
  { id: 'spirit', name: 'Spirit Tree', kind: 'round', dots: true, price: 2400, rarity: 'Legendary', pal: P('#ecfeff', '#a5f3fc', '#38bdf8', '#e2e8f0', '#ffffff'), blurb: 'Only the most devoted keepers ever see one.' },
];
export const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export const RARITY = { Common: 'text-white/50', Rare: 'text-cyan-300', Epic: 'text-violet-300', Legendary: 'text-amber-300' };

export const TAGS = [
  { id: 'work', name: 'Work', color: '#34d399' },
  { id: 'study', name: 'Study', color: '#22d3ee' },
  { id: 'read', name: 'Read', color: '#a78bfa' },
  { id: 'create', name: 'Create', color: '#f472b6' },
  { id: 'move', name: 'Move', color: '#fb923c' },
  { id: 'rest', name: 'Rest', color: '#facc15' },
];
export const TAG_COLORS = ['#f87171', '#60a5fa', '#4ade80', '#e879f9', '#fbbf24', '#2dd4bf', '#818cf8'];

export const SOUNDS = [
  { id: 'rain', name: 'Rain' },
  { id: 'wind', name: 'Canopy wind' },
  { id: 'waves', name: 'Shoreline' },
  { id: 'fire', name: 'Campfire' },
  { id: 'night', name: 'Night crickets' },
  { id: 'deep', name: 'Deep hum' },
];

export const PHRASES = [
  'Roots grow in the quiet.',
  'One thing. Just this.',
  'The phone can wait. The plant cannot.',
  'Small minutes, tall trees.',
  'Stay. It is working.',
  'Breathe out. Keep going.',
  'Future you is already grateful.',
  'Nothing out there is more urgent than this.',
  'Slow is smooth. Smooth is fast.',
];

export const LEVELS = ['Seedling', 'Sprout', 'Tender', 'Gardener', 'Grower', 'Arborist', 'Keeper', 'Warden', 'Elder', 'Evergreen'];

export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Root', desc: 'Grow your first plant', reward: 10, test: (L) => L.trees >= 1 },
  { id: 't10', name: 'Thicket', desc: 'Grow 10 plants', reward: 25, test: (L) => L.trees >= 10 },
  { id: 't50', name: 'Woodland', desc: 'Grow 50 plants', reward: 80, test: (L) => L.trees >= 50 },
  { id: 't200', name: 'Old Growth', desc: 'Grow 200 plants', reward: 250, test: (L) => L.trees >= 200 },
  { id: 'h5', name: 'Warm-up', desc: '5 hours focused', reward: 30, test: (L) => L.minutes >= 300 },
  { id: 'h25', name: 'In the Zone', desc: '25 hours focused', reward: 100, test: (L) => L.minutes >= 1500 },
  { id: 'h100', name: 'Centurion', desc: '100 hours focused', reward: 400, test: (L) => L.minutes >= 6000 },
  { id: 's3', name: 'Kindling', desc: '3-day streak', reward: 20, test: (L) => L.best >= 3 },
  { id: 's7', name: 'Wildfire', desc: '7-day streak', reward: 60, test: (L) => L.best >= 7 },
  { id: 's30', name: 'Unbroken', desc: '30-day streak', reward: 300, test: (L) => L.best >= 30 },
  { id: 'long', name: 'Deep Roots', desc: 'One 90-minute session', reward: 40, test: (L) => L.longest >= 90 },
  { id: 'day5', name: 'Full Bloom', desc: '5 plants in one day', reward: 40, test: (L) => L.maxDay >= 5 },
  { id: 'early', name: 'Dawn Patrol', desc: 'Start between 4 and 7am', reward: 20, test: (L) => L.early },
  { id: 'night', name: 'Night Shift', desc: 'Finish after 10pm', reward: 20, test: (L) => L.night },
  { id: 'gold', name: 'Golden Hour', desc: 'Find a golden bloom', reward: 30, test: (L) => L.golden >= 1 },
  { id: 'col5', name: 'Curator', desc: 'Own 5 species', reward: 40, test: (L) => L.species >= 5 },
  { id: 'colall', name: 'Botanist', desc: 'Own every species', reward: 500, test: (L) => L.species >= SPECIES.length },
];

// One quest is drawn from each slot every day.
export const QUESTS = [
  [
    { id: 'm45', text: 'Focus for 45 minutes', goal: 45, reward: 12, k: 'min' },
    { id: 'm90', text: 'Focus for 90 minutes', goal: 90, reward: 25, k: 'min' },
    { id: 'm120', text: 'Focus for 2 hours', goal: 120, reward: 35, k: 'min' },
  ],
  [
    { id: 'c2', text: 'Grow 2 plants', goal: 2, reward: 10, k: 'count' },
    { id: 'c4', text: 'Grow 4 plants', goal: 4, reward: 22, k: 'count' },
    { id: 'clean', text: 'Grow 3 plants, none withered', goal: 3, reward: 20, k: 'clean' },
  ],
  [
    { id: 'long', text: 'Finish a 45-minute session', goal: 1, reward: 15, k: 'long' },
    { id: 'tags', text: 'Focus under 2 different tags', goal: 2, reward: 10, k: 'tags' },
    { id: 'deep', text: 'Finish a Deep Focus session', goal: 1, reward: 10, k: 'deep' },
    { id: 'noon', text: 'Finish a session before noon', goal: 1, reward: 12, k: 'noon' },
  ],
];

export const SHIELD_PRICE = 150;
export const MAX_SHIELDS = 2;
