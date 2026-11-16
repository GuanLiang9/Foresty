export const APP = 'Evergrove';

// Palette slots: a = light, b = mid, c = deep, t = trunk/stem, x = accent
const P = (a, b, c, t, x) => ({ a, b, c, t, x });

export const SPECIES = [
  { id: 'oak', min: 25, name: 'Elder Oak', kind: 'round', price: 0, rarity: 'Common', pal: P('#6ee7b7', '#34d399', '#059669', '#7a5a45', '#a7f3d0'), blurb: 'Steady and patient. Yours from day one.' },
  { id: 'pine', min: 10, name: 'North Pine', kind: 'pine', price: 0, rarity: 'Common', pal: P('#5eead4', '#14b8a6', '#0f766e', '#6b4f3d', '#ccfbf1'), blurb: 'Grows straight up, like a good morning.' },
  { id: 'sun', min: 15, name: 'Sunbloom', kind: 'flower', price: 60, rarity: 'Common', pal: P('#fde68a', '#fbbf24', '#22c55e', '#16a34a', '#92400e'), blurb: 'Turns to face whatever you focus on.' },
  { id: 'cactus', min: 20, name: 'Dune Cactus', kind: 'cactus', price: 120, rarity: 'Common', pal: P('#86efac', '#22c55e', '#15803d', '#15803d', '#fb7185'), blurb: 'Thrives on long, dry stretches of work.' },
  { id: 'blossom', min: 40, name: 'Dawn Blossom', kind: 'round', dots: true, price: 200, rarity: 'Rare', pal: P('#fbcfe8', '#f9a8d4', '#ec4899', '#5b4038', '#fff1f2'), blurb: 'Blooms once the hard part is behind you.' },
  { id: 'bamboo', min: 30, name: 'Jade Bamboo', kind: 'bamboo', price: 280, rarity: 'Rare', pal: P('#bef264', '#84cc16', '#4d7c0f', '#65a30d', '#ecfccb'), blurb: 'Quiet for a while, then all at once.' },
  { id: 'palm', min: 45, name: 'Lagoon Palm', kind: 'palm', price: 380, rarity: 'Rare', pal: P('#6ee7b7', '#10b981', '#047857', '#a16207', '#78350f'), blurb: 'For work that deserves a holiday after.' },
  { id: 'maple', min: 60, name: 'Ember Maple', kind: 'round', price: 500, rarity: 'Rare', pal: P('#fdba74', '#f97316', '#c2410c', '#57382b', '#ffedd5'), blurb: 'Burns bright through the late hours.' },
  { id: 'willow', min: 75, name: 'Moon Willow', kind: 'willow', price: 650, rarity: 'Epic', pal: P('#a5f3fc', '#5eead4', '#0d9488', '#64748b', '#ecfeff'), blurb: 'Bends, never breaks. Neither do you.' },
  { id: 'shroom', min: 90, name: 'Glowcap', kind: 'shroom', price: 850, rarity: 'Epic', pal: P('#ddd6fe', '#8b5cf6', '#6d28d9', '#ede9fe', '#67e8f9'), blurb: 'Lights up when everything else goes dark.' },
  { id: 'aurora', min: 120, name: 'Aurora Pine', kind: 'pine', snow: true, price: 1100, rarity: 'Epic', pal: P('#67e8f9', '#6366f1', '#3730a3', '#475569', '#e0f2fe'), blurb: 'Carries a little of the northern sky.' },
  { id: 'prism', min: 150, name: 'Prism Spire', kind: 'crystal', price: 1600, rarity: 'Legendary', pal: P('#a5f3fc', '#22d3ee', '#7c3aed', '#1e293b', '#f0abfc'), blurb: 'Attention, crystallised.' },
  { id: 'spirit', min: 180, name: 'Spirit Tree', kind: 'round', dots: true, price: 2400, rarity: 'Legendary', pal: P('#ecfeff', '#a5f3fc', '#38bdf8', '#e2e8f0', '#ffffff'), blurb: 'Only the most devoted keepers ever see one.' },
  // Pink garden
  { id: 'tulip', min: 15, name: 'Blush Tulips', kind: 'tulip', price: 90, rarity: 'Common', pal: P('#f9a8d4', '#ec4899', '#22c55e', '#16a34a', '#fdf2f8'), blurb: 'Three little reasons to smile.' },
  { id: 'sakura', min: 35, name: 'Sakura Cloud', kind: 'round', dots: true, fall: '#fbcfe8', price: 320, rarity: 'Rare', pal: P('#fce7f3', '#f9a8d4', '#f472b6', '#4a3432', '#ffffff'), blurb: 'Lets go of a petal for every quiet minute.' },
  { id: 'roses', min: 40, name: 'Rose Arbor', kind: 'round', bloom: true, price: 450, rarity: 'Rare', pal: P('#86efac', '#22c55e', '#15803d', '#5b4038', '#f472b6'), blurb: 'Every bloom is a session you did not give up on.' },
  { id: 'fairy', min: 80, name: 'Fairy Cap', kind: 'shroom', price: 780, rarity: 'Epic', pal: P('#fff1f2', '#f472b6', '#be185d', '#fdf2f8', '#f9a8d4'), blurb: 'Glows pink when someone is thinking of you.' },
  { id: 'quartz', min: 150, name: 'Rose Quartz', kind: 'crystal', price: 1800, rarity: 'Legendary', pal: P('#fce7f3', '#f9a8d4', '#db2777', '#3f1d2b', '#fbcfe8'), blurb: 'Soft on the outside, unbreakable inside.' },
  // Festive
  { id: 'cane', min: 25, name: 'Peppermint Cane', kind: 'cane', price: 240, rarity: 'Rare', pal: P('#ffffff', '#ef4444', '#15803d', '#ffffff', '#dc2626'), blurb: 'A sweet little hook to keep you here.' },
  { id: 'poinsettia', min: 45, name: 'Poinsettia', kind: 'poinsettia', price: 520, rarity: 'Rare', pal: P('#fb7185', '#dc2626', '#166534', '#991b1b', '#facc15'), blurb: 'The star of every festive windowsill.' },
  // Soulmate pair: the rarest trees in the grove. `pair` links each to its other half.
  { id: 'bobo', min: 120, name: 'Bobo’s Heart', kind: 'heart', orn: true, pair: 'heart', fall: '#fbcfe8', price: 3000, rarity: 'Soulmate', pal: P('#fff1f2', '#fbcfe8', '#f472b6', '#7a4a52', '#ffffff'), blurb: 'The rarest, prettiest tree in the grove. Made for Bobo.' },
  { id: 'heart', min: 120, name: 'Jobo’s Heart', kind: 'heart', orn: true, pair: 'bobo', fall: '#bae6fd', price: 2800, rarity: 'Soulmate', pal: P('#f0f9ff', '#93c5fd', '#2563eb', '#334155', '#ffffff'), blurb: 'Her other half. Grow both and they glow together.' },
  { id: 'yule', min: 60, name: 'Yuletide Fir', kind: 'pine', orn: true, fall: '#ffffff', price: 720, rarity: 'Epic', pal: P('#4ade80', '#16a34a', '#14532d', '#6b4f3d', '#ef4444'), blurb: 'Baubles, a star and presents underneath.' },
  // Exclusive species are never sold; they are earned from monthly challenges and seasonal events.
  { id: 'lantern', min: 35, name: 'Lantern Maple', kind: 'round', dots: true, exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#fde68a', '#f87171', '#b91c1c', '#4a2c2a', '#fef3c7'), blurb: 'Hung with small lights for those who kept going.' },
  { id: 'tide', min: 50, name: 'Tide Palm', kind: 'palm', exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#bae6fd', '#38bdf8', '#0369a1', '#94a3b8', '#f0f9ff'), blurb: 'Comes in slowly, the way good months do.' },
  { id: 'rose', min: 20, name: 'Rose Cactus', kind: 'cactus', exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#fecdd3', '#fb7185', '#be123c', '#be123c', '#fef08a'), blurb: 'Soft colour, stubborn heart.' },
  { id: 'petal', min: 40, name: 'Petal Willow', kind: 'willow', exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#fbcfe8', '#f472b6', '#be185d', '#6b4f4f', '#fff1f2'), blurb: 'Only flowers during Spring Bloom.' },
  { id: 'sunspire', min: 100, name: 'Sun Spire', kind: 'crystal', exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#fef08a', '#fbbf24', '#ea580c', '#292524', '#fde047'), blurb: 'A shard of the longest day.' },
  { id: 'star', min: 55, name: 'Starpine', kind: 'pine', snow: true, exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#fde68a', '#1d4ed8', '#1e3a8a', '#334155', '#fef9c3'), blurb: 'Catches the first cold stars of Ember Days.' },
  { id: 'frost', min: 70, name: 'Frostcap', kind: 'shroom', exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#e0f2fe', '#7dd3fc', '#0284c7', '#f1f5f9', '#bae6fd'), blurb: 'Glows under the Winter Lights.' },
  { id: 'noel', min: 60, name: 'Pink Noel', kind: 'pine', orn: true, fall: '#ffffff', exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#fce7f3', '#f9a8d4', '#ec4899', '#6b4f4f', '#ffffff'), blurb: 'The prettiest tree of Christmas Eve.' },
  { id: 'mandarin', min: 50, name: 'Lucky Mandarin', kind: 'round', dots: true, exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#86efac', '#22c55e', '#166534', '#57382b', '#fb923c'), blurb: 'Huat ah! Good fortune for the new year.' },
  { id: 'cupid', min: 45, name: "Cupid's Heart", kind: 'heart', fall: '#fda4af', exclusive: true, price: 0, rarity: 'Exclusive', pal: P('#fecdd3', '#fb7185', '#e11d48', '#4a2c2a', '#fff1f2'), blurb: 'Only blooms around Valentine’s Day.' },
];
export const BUYABLE = SPECIES.filter((s) => !s.exclusive);
export const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export const RARITY = { Common: 'text-white/50', Rare: 'text-cyan-300', Epic: 'text-violet-300', Legendary: 'text-amber-300', Exclusive: 'text-rose-300', Soulmate: 'soulmate-text' };

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
  { id: 'rain', name: 'Rain', price: 0 },
  { id: 'wind', name: 'Canopy wind', price: 0 },
  { id: 'deep', name: 'Deep hum', price: 0 },
  { id: 'waves', name: 'Shoreline', price: 40 },
  { id: 'fire', name: 'Campfire', price: 60 },
  { id: 'night', name: 'Night crickets', price: 60 },
  { id: 'stream', name: 'Mountain stream', price: 90 },
  { id: 'bowls', name: 'Singing bowls', price: 120 },
];
export const FREE_SOUNDS = SOUNDS.filter((s) => !s.price).map((s) => s.id);

// Monthly challenge: the reward rotates through these species.
export const MONTHLY = { goal: 900, rewards: ['lantern', 'tide', 'rose'] };
// Seasonal events repeat every year. from/to are [month, day], inclusive.
export const EVENTS = [
  { id: 'lunar', name: 'Lunar Spring', from: [1, 15], to: [2, 8], goal: 12, reward: 'mandarin', about: 'Chinese New Year. Grow good fortune for the year ahead.' },
  { id: 'valentine', name: 'Sweethearts', from: [2, 9], to: [2, 28], goal: 10, reward: 'cupid', about: 'Valentine’s season. Grow something for the one you love.' },
  { id: 'spring', name: 'Spring Bloom', from: [3, 10], to: [4, 10], goal: 12, reward: 'petal', about: 'The garden wakes up. Everything flowers.' },
  { id: 'summer', name: 'Midsummer', from: [6, 10], to: [7, 10], goal: 12, reward: 'sunspire', about: 'The longest, brightest days of the year.' },
  { id: 'ember', name: 'Ember Days', from: [11, 5], to: [11, 30], goal: 12, reward: 'star', about: 'Cool nights, first stars, the year winding down.' },
  { id: 'winter', name: 'Winter Lights', from: [12, 1], to: [12, 18], goal: 12, reward: 'frost', about: 'Lights go up all over the grove.' },
  { id: 'xmas', name: 'Christmas', from: [12, 19], to: [12, 31], goal: 8, reward: 'noel', about: 'Christmas week. Grow the prettiest tree of the year.' },
];
const MON = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
export const eventDates = (E) => `${E.from[1]} ${MON[E.from[0] - 1]} – ${E.to[1]} ${MON[E.to[0] - 1]}`;
// Where an exclusive species comes from, for the Nursery.
export function sourceOf(id) {
  const E = EVENTS.find((x) => x.reward === id);
  if (E) return { name: E.name, when: eventDates(E), how: `Grow ${E.goal} plants during the event`, about: E.about };
  if (MONTHLY.rewards.includes(id)) return { name: 'Monthly challenge', when: `every ${MONTHLY.rewards.length} months`, how: 'Focus for 15 hours in one month', about: 'The monthly reward rotates between three exclusive plants.' };
  return null;
}
// Paid on the first plant grown each day.
export const FIRST_BLOOM = 15;
export const PINK = ['tulip', 'sakura', 'roses', 'fairy', 'quartz', 'bobo', 'blossom', 'rose', 'petal', 'noel', 'cupid'];
export const FESTIVE = ['cane', 'poinsettia', 'yule'];
export const DUPLICATE_REWARD = 300;

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
  { id: 'colall', name: 'Botanist', desc: 'Own every Nursery species', reward: 500, test: (L) => L.buyable >= BUYABLE.length },
  { id: 'pink', name: 'Pretty in Pink', desc: 'Own 5 pink plants', reward: 100, test: (L) => L.owned.filter((id) => PINK.includes(id)).length >= 5 },
  { id: 'festive', name: 'Festive Spirit', desc: 'Own the cane, poinsettia and fir', reward: 120, test: (L) => FESTIVE.every((id) => L.owned.includes(id)) },
  { id: 'bobo', name: 'Bobo’s Heart', desc: 'Grow a Bobo’s Heart', reward: 300, test: (L) => L.grown.includes('bobo') },
  { id: 'jobo', name: 'Jobo’s Heart', desc: 'Grow a Jobo’s Heart', reward: 300, test: (L) => L.grown.includes('heart') },
  { id: 'soul', name: 'Soulmates', desc: 'Grow both hearts', reward: 600, test: (L) => L.grown.includes('bobo') && L.grown.includes('heart') },
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
