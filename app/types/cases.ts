export type CaseRarity = 'common' | 'rare' | 'mythical' | 'fake';

export type CaseItem = {
  id: number;
  caseId: string;
  name: string;
  category: string | null;
  rarity: CaseRarity;
  sellPrice: number;
  imageUrl: string | null;
  dropChance: number;
  isActive: boolean;
  isFake: boolean;
  sortOrder: number;
};

export type CaseDefinition = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  accent: string;
  isActive: boolean;
  items: CaseItem[];
};

export type CaseSettings = {
  casesEnabled: boolean;
  adminOnlyOpen: boolean;
};

export type BotInventoryItem = {
  name: string;
  count: number;
  price: number;
  image: string | null;
};

export type CaseCatalogResponse = {
  ok: boolean;
  databaseConfigured: boolean;
  source: 'database' | 'seed';
  settings: CaseSettings;
  cases: CaseDefinition[];
  error?: string;
};

export type CaseAdminResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  databaseConfigured: boolean;
  settings: CaseSettings;
  cases: CaseDefinition[];
  botConfigured: boolean;
  botItems: BotInventoryItem[];
  botError?: string | null;
  error?: string;
};

export type CaseOpenResponse = {
  ok: boolean;
  balance?: number;
  openingId?: number;
  winningItem?: CaseItem;
  caseId?: string;
  error?: string;
};

export type CaseClaimResponse = {
  ok: boolean;
  status?: 'claimed' | 'sold';
  balance?: number;
  error?: string;
};

export type CaseDefinitionInput = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  accent: string;
  isActive: boolean;
};

export type CaseItemInput = {
  id?: number | null;
  caseId: string;
  name: string;
  category?: string | null;
  rarity: CaseRarity;
  sellPrice: number;
  imageUrl?: string | null;
  dropChance: number;
  isActive?: boolean;
  isFake?: boolean;
  sortOrder?: number;
};
