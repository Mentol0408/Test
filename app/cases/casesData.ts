// Данные кейсов и их содержимого для страницы /cases.
// Картинки кейсов лежат в public/cases. У предметов поле image опционально:
// как только появятся картинки скинов — добавь image: '/cases/skins/....png' к предмету.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

// Шансы (в %) как на референсе: Обычный 70 / Редкий 20 / Эпический 9 / Легендарный 1.
export const RARITY: Record<Rarity, { label: string; color: string; chance: number }> = {
  common: { label: 'Обычный', color: '#9aa6b4', chance: 70 },
  rare: { label: 'Редкий', color: '#4a90ff', chance: 20 },
  epic: { label: 'Эпический', color: '#b15bff', chance: 9 },
  legendary: { label: 'Легендарный', color: '#ffb02e', chance: 1 },
};

// Порядок отображения редкостей в панели шансов (от лучшей к худшей).
export const RARITY_ORDER: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

export type CaseItem = {
  name: string;
  category: string; // тип предмета (Штурмовая винтовка, Маска, ...)
  rarity: Rarity;
  sell: number; // цена продажи на баланс (RW)
  image?: string; // картинка скина (пока нет — рисуем плашку по редкости)
};

export type CaseDef = {
  id: string;
  name: string; // тематическое слово (показываем крупно), к нему в UI добавляется «кейс»
  price: number; // цена открытия в RW
  image: string;
  accent: string;
  items: CaseItem[];
};

export const CASES: CaseDef[] = [
  {
    id: 'crimson',
    name: 'Багровый',
    price: 99,
    accent: '#ff4d4d',
    image: '/cases/8f2b7c73-0c0f-4182-bde1-a4b19f2dda5f.png',
    items: [
      { name: 'Crimson Hammer', category: 'Молоток', rarity: 'common', sell: 40 },
      { name: 'Rust Garage', category: 'Гаражная дверь', rarity: 'common', sell: 55 },
      { name: 'Ember Hoodie', category: 'Худи', rarity: 'common', sell: 60 },
      { name: 'Ash Bag', category: 'Спальный мешок', rarity: 'common', sell: 45 },
      { name: 'Bloodsunset MP5', category: 'Пулемёт', rarity: 'rare', sell: 320 },
      { name: 'Crimson AR', category: 'Штурмовая винтовка', rarity: 'rare', sell: 360 },
      { name: 'Demon Mask', category: 'Маска', rarity: 'epic', sell: 1250 },
      { name: 'Inferno AK', category: 'Штурмовая винтовка', rarity: 'legendary', sell: 2600 },
    ],
  },
  {
    id: 'toxic',
    name: 'Токсичный',
    price: 149,
    accent: '#46c46a',
    image: '/cases/091e651f-e0c9-4490-aede-976b60da4414.png',
    items: [
      { name: 'Swamp Hammer', category: 'Молоток', rarity: 'common', sell: 45 },
      { name: 'Mutant Hoodie', category: 'Худи', rarity: 'common', sell: 60 },
      { name: 'Bog Garage', category: 'Гаражная дверь', rarity: 'common', sell: 70 },
      { name: 'Spore Bag', category: 'Спальный мешок', rarity: 'common', sell: 50 },
      { name: 'Radiation Tommy', category: 'Пулемёт', rarity: 'rare', sell: 380 },
      { name: 'Toxic AR', category: 'Штурмовая винтовка', rarity: 'rare', sell: 410 },
      { name: 'Biohazard Mask', category: 'Маска', rarity: 'epic', sell: 1400 },
      { name: 'Chernobyl M249', category: 'Пулемёт', rarity: 'legendary', sell: 2900 },
    ],
  },
  {
    id: 'frost',
    name: 'Ледяной',
    price: 199,
    accent: '#4aa3ff',
    image: '/cases/47d51e0a-ca8a-4a99-9ed3-379945be5e52.png',
    items: [
      { name: 'Frost Hammer', category: 'Молоток', rarity: 'common', sell: 55 },
      { name: 'Glacier Hoodie', category: 'Худи', rarity: 'common', sell: 70 },
      { name: 'Ice Garage', category: 'Гаражная дверь', rarity: 'common', sell: 80 },
      { name: 'Snow Bag', category: 'Спальный мешок', rarity: 'common', sell: 60 },
      { name: 'Blizzard MP5', category: 'Пулемёт', rarity: 'rare', sell: 440 },
      { name: 'Arctic AR', category: 'Штурмовая винтовка', rarity: 'rare', sell: 480 },
      { name: 'Cryogen Mask', category: 'Маска', rarity: 'epic', sell: 1600 },
      { name: 'Absolute Zero L96', category: 'Снайперская винтовка', rarity: 'legendary', sell: 3200 },
    ],
  },
  {
    id: 'phantom',
    name: 'Призрачный',
    price: 249,
    accent: '#c8d2dc',
    image: '/cases/65e529d4-e8e8-40ff-b65e-e66ba08287fe.png',
    items: [
      { name: 'Bone Hammer', category: 'Молоток', rarity: 'common', sell: 60 },
      { name: 'Shroud Hoodie', category: 'Худи', rarity: 'common', sell: 80 },
      { name: 'Mist Garage', category: 'Гаражная дверь', rarity: 'common', sell: 95 },
      { name: 'Ash Bag', category: 'Спальный мешок', rarity: 'common', sell: 70 },
      { name: 'Fog SMG', category: 'Пулемёт', rarity: 'rare', sell: 520 },
      { name: 'Skull AR', category: 'Штурмовая винтовка', rarity: 'rare', sell: 560 },
      { name: 'Phantom Mask', category: 'Маска', rarity: 'epic', sell: 1800 },
      { name: 'Reaper LR-300', category: 'Штурмовая винтовка', rarity: 'legendary', sell: 3600 },
    ],
  },
  {
    id: 'mystic',
    name: 'Мистический',
    price: 349,
    accent: '#a35bff',
    image: '/cases/94892be2-5939-43ac-9284-88669f378500.png',
    items: [
      { name: 'Starfall Hammer', category: 'Молоток', rarity: 'common', sell: 70 },
      { name: 'Wizard Hoodie', category: 'Худи', rarity: 'common', sell: 95 },
      { name: 'Rune Garage', category: 'Гаражная дверь', rarity: 'common', sell: 110 },
      { name: 'Potion Bag', category: 'Спальный мешок', rarity: 'common', sell: 85 },
      { name: 'Amethyst MP5', category: 'Пулемёт', rarity: 'rare', sell: 620 },
      { name: 'Cosmos AR', category: 'Штурмовая винтовка', rarity: 'rare', sell: 680 },
      { name: 'Nightmare Mask', category: 'Маска', rarity: 'epic', sell: 2100 },
      { name: 'Magic Python', category: 'Пистолет', rarity: 'legendary', sell: 4000 },
    ],
  },
  {
    id: 'gold',
    name: 'Золотой',
    price: 599,
    accent: '#ffb02e',
    image: '/cases/b832a014-5613-40f9-9a01-6fe7d8596eeb.png',
    items: [
      { name: 'Nugget Hammer', category: 'Молоток', rarity: 'common', sell: 90 },
      { name: 'Magnate Hoodie', category: 'Худи', rarity: 'common', sell: 120 },
      { name: 'Bullion Garage', category: 'Гаражная дверь', rarity: 'common', sell: 140 },
      { name: 'Luxury Bag', category: 'Спальный мешок', rarity: 'common', sell: 100 },
      { name: 'Luxury Tommy', category: 'Пулемёт', rarity: 'rare', sell: 820 },
      { name: 'Goldrush AR', category: 'Штурмовая винтовка', rarity: 'rare', sell: 900 },
      { name: 'Pharaoh Mask', category: 'Маска', rarity: 'epic', sell: 2800 },
      { name: 'Golden Age M39', category: 'Штурмовая винтовка', rarity: 'legendary', sell: 5200 },
    ],
  },
  {
    id: 'clown',
    name: 'Клоун',
    price: 799,
    accent: '#ff5ec4',
    image: '/cases/bb949fff-ea37-40b5-a9b6-3aa01613a3d5.png',
    items: [
      { name: 'Clown Hammer', category: 'Молоток', rarity: 'common', sell: 110 },
      { name: 'Clown Hoodie', category: 'Худи', rarity: 'common', sell: 140 },
      { name: 'Clown Garage', category: 'Гаражная дверь', rarity: 'common', sell: 160 },
      { name: 'Clown Sleeping Bag', category: 'Спальный мешок', rarity: 'common', sell: 120 },
      { name: 'Clown MP5', category: 'Пулемёт', rarity: 'rare', sell: 950 },
      { name: 'Clown AR', category: 'Штурмовая винтовка', rarity: 'rare', sell: 1050 },
      { name: 'Big Grin', category: 'Маска', rarity: 'epic', sell: 3200 },
      { name: 'Tempered AK', category: 'Штурмовая винтовка', rarity: 'legendary', sell: 6000 },
    ],
  },
];

// Случайный предмет: сперва редкость по шансам, затем равновероятно предмет этой редкости.
export function rollItem(c: CaseDef): CaseItem {
  const r = Math.random() * 100;
  let acc = 0;
  let chosen: Rarity = 'common';
  for (const rar of ['common', 'rare', 'epic', 'legendary'] as Rarity[]) {
    acc += RARITY[rar].chance;
    if (r < acc) { chosen = rar; break; }
  }
  let pool = c.items.filter((i) => i.rarity === chosen);
  // если в кейсе нет предметов выпавшей редкости — берём ближайшую более частую
  if (pool.length === 0) {
    const fallback: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
    for (const rar of fallback) {
      pool = c.items.filter((i) => i.rarity === rar);
      if (pool.length) break;
    }
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? c.items[0];
}
