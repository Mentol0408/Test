import type { StoreDeliveryType, StoreRarity } from '@/types/store';


export type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  oldPrice?: number;
  rarity?: StoreRarity;
  badge?: string;
  amount?: number;
  deliveryType: StoreDeliveryType;
  deliveryCommand: string;
  servers?: string[];
  features?: string[];
};

export type SeedCategory = {
  slug: string;
  title: string;
  description: string;
  products: SeedProduct[];
};

export const STORE_SEED: SeedCategory[] = [
  {
    slug: 'privileges',
    title: 'Привилегии',
    description: 'VIP-статусы с бонусами к рейтам, приоритетным входом и ролью в Discord.',
    products: [
      {
        slug: 'vip',
        title: 'VIP',
        description: 'Рейты +50%, приоритетный вход, роль в Discord. Действует 30 дней.',
        imageUrl: '',
        price: 299,
        oldPrice: 399,
        rarity: 'rare',
        badge: 'ХИТ',
        deliveryType: 'privilege',
        deliveryCommand: 'rwmenu.giveprivilege ${steamId} vip VIP',
        features: [
          'Рейты добычи +50%',
          'Приоритетный вход на сервер',
          'Отдельная роль в Discord',
          'Скорость плавки и переработки +25%',
          'Маркер попадания по врагу (/hit)',
        ],
      },
      {
        slug: 'premium',
        title: 'Premium',
        description: 'Рейты +100%, увеличенные лимиты, набор привилегий VIP и сверху. 30 дней.',
        imageUrl: '',
        price: 599,
        oldPrice: 799,
        rarity: 'epic',
        deliveryType: 'privilege',
        deliveryCommand: 'rwmenu.giveprivilege ${steamId} premium Premium',
        features: [
          'Все привилегии VIP',
          'Рейты добычи +100%',
          'Увеличенные лимиты крафта',
          'Команды /tp и /home',
          'Приоритетная поддержка',
        ],
      },
      {
        slug: 'deluxe',
        title: 'Deluxe',
        description: 'Максимальный набор бонусов и приоритетов. Топ-привилегия проекта. 30 дней.',
        imageUrl: '',
        price: 999,
        oldPrice: 1299,
        rarity: 'legendary',
        deliveryType: 'privilege',
        deliveryCommand: 'rwmenu.giveprivilege ${steamId} deluxe Deluxe',
        features: [
          'Все привилегии Premium',
          'Рейты добычи +150%',
          'Максимальные лимиты и слоты',
          'Эксклюзивный скин-набор',
          'Именной титул в чате',
        ],
      },
    ],
  },
  {
    slug: 'kits',
    title: 'Наборы',
    description: 'Готовые комплекты для быстрого старта, фарма и рейдов.',
    products: [
      {
        slug: 'kit-starter',
        title: 'Стартовый набор',
        description: 'Базовое снаряжение и ресурсы для уверенного старта вайпа.',
        imageUrl: '/rust-items/box.wooden.large.webp',
        price: 149,
        rarity: 'common',
        deliveryType: 'kit',
        deliveryCommand: 'kit giveto ${steamId} starter',
        features: [
          'Базовое оружие и патроны',
          'Стартовые ресурсы',
          'Аптечки и еда',
        ],
      },
      {
        slug: 'kit-military',
        title: 'Военный набор',
        description: 'Оружие, патроны и броня для боевых столкновений.',
        imageUrl: '/rust-items/metal.facemask.webp',
        price: 399,
        oldPrice: 499,
        rarity: 'rare',
        badge: 'ХИТ',
        deliveryType: 'kit',
        deliveryCommand: 'kit giveto ${steamId} military',
        features: [
          'Боевое оружие',
          'Патроны и гранаты',
          'Военная броня',
        ],
      },
      {
        slug: 'kit-raid',
        title: 'Рейд набор',
        description: 'Взрывчатка и инструменты для рейда чужих баз.',
        imageUrl: '/rust-items/explosives.webp',
        price: 699,
        rarity: 'epic',
        deliveryType: 'kit',
        deliveryCommand: 'kit giveto ${steamId} raid',
        features: [
          'Взрывчатка C4 и ракеты',
          'Гранатомёт',
          'Инструменты для рейда',
        ],
      },
    ],
  },
  {
    slug: 'resources',
    title: 'Ресурсы',
    description: 'Дерево, камень, металл и сера для строительства и крафта.',
    products: [
      {
        slug: 'res-wood',
        title: 'Дерево ×10000',
        description: 'Большой запас дерева для строительства и апгрейда базы.',
        imageUrl: '/rust-items/wood.webp',
        price: 49,
        amount: 10000,
        rarity: 'common',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} wood ${amount}',
      },
      {
        slug: 'res-stones',
        title: 'Камень ×10000',
        description: 'Камень для апгрейда стен и крафта.',
        imageUrl: '/rust-items/stones.webp',
        price: 59,
        amount: 10000,
        rarity: 'common',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} stones ${amount}',
      },
      {
        slug: 'res-metal',
        title: 'Металл ×5000',
        description: 'Металлические фрагменты для оружия и брони.',
        imageUrl: '/rust-items/metal.fragments.webp',
        price: 99,
        amount: 5000,
        rarity: 'uncommon',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} metal.fragments ${amount}',
      },
      {
        slug: 'res-sulfur',
        title: 'Сера ×5000',
        description: 'Сера для патронов и взрывчатки.',
        imageUrl: '/rust-items/sulfur.ore.webp',
        price: 129,
        amount: 5000,
        rarity: 'rare',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} sulfur.ore ${amount}',
      },
    ],
  },
  {
    slug: 'weapons',
    title: 'Оружие',
    description: 'Оружие и взрывчатка для боёв и рейдов.',
    products: [
      {
        slug: 'weapon-ak',
        title: 'Автомат (AK-47)',
        description: 'Штурмовая винтовка — универсальное оружие для боёв.',
        imageUrl: '/rust-items/rifle.ak.webp',
        price: 79,
        amount: 1,
        rarity: 'rare',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} rifle.ak ${amount}',
      },
      {
        slug: 'weapon-bolt',
        title: 'Болтовка',
        description: 'Снайперская винтовка с высоким уроном на дистанции.',
        imageUrl: '/rust-items/rifle.bolt.webp',
        price: 59,
        amount: 1,
        rarity: 'uncommon',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} rifle.bolt ${amount}',
      },
      {
        slug: 'weapon-c4',
        title: 'C4 (взрывчатка) ×2',
        description: 'Таймерная взрывчатка для рейда укреплённых стен.',
        imageUrl: '/rust-items/explosive.timed.webp',
        price: 199,
        amount: 2,
        rarity: 'epic',
        badge: 'ХИТ',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} explosive.timed ${amount}',
      },
    ],
  },
  {
    slug: 'ammo',
    title: 'Патроны',
    description: 'Боеприпасы и ракеты для оружия и рейдов.',
    products: [
      {
        slug: 'ammo-rifle',
        title: 'Патроны 5.56 ×128',
        description: 'Стандартные винтовочные патроны.',
        imageUrl: '/rust-items/ammo.rifle.webp',
        price: 39,
        amount: 128,
        rarity: 'common',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} ammo.rifle ${amount}',
      },
      {
        slug: 'ammo-rocket',
        title: 'Ракета ×3',
        description: 'Ракеты для рейда баз.',
        imageUrl: '/rust-items/ammo.rocket.basic.webp',
        price: 89,
        amount: 3,
        rarity: 'rare',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} ammo.rocket.basic ${amount}',
      },
    ],
  },
  {
    slug: 'tools',
    title: 'Инструменты',
    description: 'Инструменты для фарма и добычи ресурсов.',
    products: [
      {
        slug: 'tool-icepick',
        title: 'Улучшенная кирка',
        description: 'Быстрая добыча камня, металла и серы.',
        imageUrl: '/rust-items/icepick.salvaged.webp',
        price: 35,
        amount: 1,
        rarity: 'uncommon',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} icepick.salvaged ${amount}',
      },
      {
        slug: 'tool-hammer',
        title: 'Молоток',
        description: 'Инструмент для строительства и апгрейда базы.',
        imageUrl: '/rust-items/hammer.webp',
        price: 19,
        amount: 1,
        rarity: 'common',
        deliveryType: 'item',
        deliveryCommand: 'rwmenu.giveitem ${steamId} hammer ${amount}',
      },
    ],
  },
];
