// Типы магазина игровых предметов и привилегий (/store)

export type StoreDeliveryType = 'item' | 'kit' | 'privilege' | 'currency' | 'command';

export type StoreRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Публичная инфа о сервере для переключателя в магазине (без RCON-паролей).
// key должен совпадать с ключами в app/lib/purchaseConfig.json (hard/vanilla/chill).
export type StoreServer = {
  key: string;
  label: string;
  mode: string;
  rate: string;
  accent: string;
  image: string;
};

export type StoreCategory = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
};

// Публичный товар — без шаблона команды выдачи (он не должен утекать на клиент).
export type StoreProduct = {
  id: number;
  categoryId: number | null;
  categorySlug: string | null;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  oldPrice: number | null;
  rarity: StoreRarity | null;
  badge: string | null;
  amount: number | null;
  deliveryType: StoreDeliveryType;
  servers: string[]; // разрешённые серверы; пусто = все
  features: string[]; // что даёт товар (преимущества), для привилегий и наборов
  isActive: boolean;
  sortOrder: number;
};

// Админский товар — добавляет шаблон команды выдачи (только серверная сторона/админка).
export type StoreProductAdmin = StoreProduct & {
  deliveryCommand: string;
};

export type StoreCategoryInput = {
  id?: number | null;
  slug: string;
  title: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
};

export type StoreProductInput = {
  id?: number | null;
  categoryId: number | null;
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  oldPrice?: number | null;
  rarity?: StoreRarity | null;
  badge?: string | null;
  amount?: number | null;
  deliveryType: StoreDeliveryType;
  deliveryCommand: string;
  servers?: string[];
  features?: string[];
  isActive?: boolean;
  sortOrder?: number;
};

export type StoreCatalogResponse = {
  ok: boolean;
  databaseConfigured: boolean;
  source: 'database' | 'seed';
  servers: StoreServer[];
  categories: StoreCategory[];
  products: StoreProduct[];
  error?: string;
};

export type StorePurchaseResponse = {
  ok: boolean;
  balance?: number;
  purchaseId?: number | null;
  product?: { id: number; title: string; price: number };
  serverKey?: string;
  error?: string;
};

export type StoreAdminCatalogResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  databaseConfigured: boolean;
  servers: StoreServer[];
  categories: StoreCategory[];
  products: StoreProductAdmin[];
  error?: string;
};
