import type { StoreServer } from '@/types/store';

// Публичный список серверов для магазина. Ключи совпадают с app/lib/purchaseConfig.json,
// поэтому по key мы находим RCON-доступ при выдаче товара (server-side).
export const STORE_SERVERS: StoreServer[] = [
  { key: 'hard', label: 'Rust Way Hard x1000', mode: 'Hard', rate: 'x1000', accent: '#B94130', image: '/hardway-logo.png' },
  { key: 'chill', label: 'Rust Way Chill', mode: 'Chill', rate: 'x2', accent: '#F266FF', image: '/chillway-logo.png' },
];

export const STORE_SERVER_KEYS = STORE_SERVERS.map((server) => server.key);

export function isStoreServerKey(value: unknown): value is string {
  return typeof value === 'string' && STORE_SERVER_KEYS.includes(value);
}

export function getStoreServer(key: string): StoreServer | null {
  return STORE_SERVERS.find((server) => server.key === key) ?? null;
}
