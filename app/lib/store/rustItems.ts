import rawItems from '@/lib/store/rustItems.json';

// Каталог игровых предметов Rust (974 шт.) — источник для пикера в админке.
// Сгенерировано из LehaSex/rust-game-icons (image_name = shortname, name.ru, category).
// Иконки лежат локально: /rust-items/<shortname>.webp

export type RustItem = {
  shortname: string;
  name: string;
  en: string;
  category: string;
};

export const RUST_ITEMS = rawItems as RustItem[];

export const RUST_CATEGORY_LABELS: Record<string, string> = {
  ammo: 'Патроны',
  attire: 'Одежда',
  components: 'Компоненты',
  construction: 'Постройки',
  electrical: 'Электрика',
  food: 'Еда',
  fun: 'Развлечения',
  items: 'Предметы',
  medical: 'Медицина',
  misc: 'Разное',
  resources: 'Ресурсы',
  tools: 'Инструменты',
  traps: 'Ловушки',
  weapons: 'Оружие',
};

export const RUST_CATEGORIES = Array.from(new Set(RUST_ITEMS.map((item) => item.category)));

export function rustItemImage(shortname: string) {
  return `/rust-items/${shortname}.webp`;
}
