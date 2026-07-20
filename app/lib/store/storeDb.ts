import { ensureDatabaseReady, query, isDatabaseUnavailableError } from '@/lib/db';
import { STORE_SEED } from '@/lib/store/seedCatalog';
import type {
  StoreCategory,
  StoreCategoryInput,
  StoreDeliveryType,
  StoreProduct,
  StoreProductAdmin,
  StoreProductInput,
  StoreRarity,
} from '@/types/store';

// ── Инициализация каталога ───────────────────────────────────────────────────
// Схема магазина теперь живёт в общих DB migrations.
// Здесь остаётся только безопасный первичный сид для пустой таблицы категорий.

let schemaReady: Promise<void> | null = null;

async function seedIfEmpty() {
  const existing = await query('SELECT COUNT(*)::int AS count FROM store_categories');

  if (Number(existing.rows[0]?.count || 0) > 0) {
    return;
  }

  for (let categoryIndex = 0; categoryIndex < STORE_SEED.length; categoryIndex += 1) {
    const category = STORE_SEED[categoryIndex];

    const categoryResult = await query(
      `INSERT INTO store_categories (slug, title, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [category.slug, category.title, category.description, categoryIndex]
    );

    const categoryId = Number(categoryResult.rows[0].id);

    for (let productIndex = 0; productIndex < category.products.length; productIndex += 1) {
      const product = category.products[productIndex];

      await query(
        `INSERT INTO store_products
          (category_id, slug, title, description, image_url, price, old_price, rarity, badge, amount, delivery_type, delivery_command, servers, features, is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,true,$15)`,
        [
          categoryId,
          product.slug,
          product.title,
          product.description,
          product.imageUrl || null,
          product.price,
          product.oldPrice ?? null,
          product.rarity ?? null,
          product.badge ?? null,
          product.amount ?? null,
          product.deliveryType,
          product.deliveryCommand,
          JSON.stringify(product.servers || []),
          JSON.stringify(product.features || []),
          productIndex,
        ]
      );
    }
  }
}

export function ensureStoreSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureDatabaseReady();
      await seedIfEmpty();
    })().catch((error) => {
      schemaReady = null; // позволяем повторить после сбоя БД
      throw error;
    });
  }

  return schemaReady;
}

export { isDatabaseUnavailableError };

// ── Мапперы строк ────────────────────────────────────────────────────────────

function mapCategory(row: Record<string, unknown>): StoreCategory {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active !== false,
    isDefault: row.is_default === true,
  };
}

function mapProductBase(row: Record<string, unknown>): StoreProduct {
  return {
    id: Number(row.id),
    categoryId: row.category_id == null ? null : Number(row.category_id),
    categorySlug: row.category_slug == null ? null : String(row.category_slug),
    slug: String(row.slug || ''),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    imageUrl: row.image_url == null ? null : String(row.image_url),
    price: Number(row.price || 0),
    oldPrice: row.old_price == null ? null : Number(row.old_price),
    rarity: (row.rarity == null ? null : String(row.rarity)) as StoreRarity | null,
    badge: row.badge == null ? null : String(row.badge),
    amount: row.amount == null ? null : Number(row.amount),
    deliveryType: (String(row.delivery_type || 'item')) as StoreDeliveryType,
    servers: Array.isArray(row.servers) ? (row.servers as unknown[]).map((value) => String(value)) : [],
    features: Array.isArray(row.features) ? (row.features as unknown[]).map((value) => String(value)) : [],
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
  };
}

function mapProductAdmin(row: Record<string, unknown>): StoreProductAdmin {
  return {
    ...mapProductBase(row),
    deliveryCommand: String(row.delivery_command || ''),
  };
}

const PRODUCT_SELECT = `
  SELECT p.*, c.slug AS category_slug
  FROM store_products p
  LEFT JOIN store_categories c ON c.id = p.category_id
`;

// ── Чтение каталога ──────────────────────────────────────────────────────────

export async function listPublicCatalog() {
  const [categoriesResult, productsResult] = await Promise.all([
    query('SELECT * FROM store_categories WHERE is_active = true ORDER BY sort_order, id'),
    query(`${PRODUCT_SELECT} WHERE p.is_active = true AND (c.is_active = true OR p.category_id IS NULL) ORDER BY p.sort_order, p.id`),
  ]);

  return {
    categories: categoriesResult.rows.map(mapCategory),
    products: productsResult.rows.map(mapProductBase),
  };
}

export async function listAdminCatalog() {
  const [categoriesResult, productsResult] = await Promise.all([
    query('SELECT * FROM store_categories ORDER BY sort_order, id'),
    query(`${PRODUCT_SELECT} ORDER BY p.sort_order, p.id`),
  ]);

  return {
    categories: categoriesResult.rows.map(mapCategory),
    products: productsResult.rows.map(mapProductAdmin),
  };
}

export async function getStoreProduct(id: number): Promise<StoreProductAdmin | null> {
  const result = await query(`${PRODUCT_SELECT} WHERE p.id = $1 LIMIT 1`, [id]);
  const row = result.rows[0];

  return row ? mapProductAdmin(row) : null;
}

// ── Мутации категорий ────────────────────────────────────────────────────────

export async function saveCategory(input: StoreCategoryInput): Promise<number> {
  const slug = input.slug.trim();
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const sortOrder = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0;
  const isActive = input.isActive !== false;
  const isDefault = input.isDefault === true && isActive;

  if (isDefault) {
    await query('UPDATE store_categories SET is_default = false WHERE is_default = true');
  }

  if (input.id) {
    await query(
      `UPDATE store_categories
       SET slug = $2, title = $3, description = $4, sort_order = $5, is_active = $6, is_default = $7, updated_at = now()
       WHERE id = $1`,
      [input.id, slug, title, description, sortOrder, isActive, isDefault]
    );

    return Number(input.id);
  }

  const result = await query(
    `INSERT INTO store_categories (slug, title, description, sort_order, is_active, is_default)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [slug, title, description, sortOrder, isActive, isDefault]
  );

  return Number(result.rows[0].id);
}

export async function deleteCategory(id: number): Promise<void> {
  await query('DELETE FROM store_categories WHERE id = $1', [id]);
}

// ── Мутации товаров ──────────────────────────────────────────────────────────

export async function saveProduct(input: StoreProductInput): Promise<number> {
  const categoryId = input.categoryId == null ? null : Number(input.categoryId);
  const slug = input.slug.trim();
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const imageUrl = input.imageUrl?.trim() || null;
  const price = Math.max(0, Math.round(Number(input.price) || 0));
  const oldPrice = input.oldPrice == null || input.oldPrice === ('' as unknown) ? null : Math.max(0, Math.round(Number(input.oldPrice)));
  const rarity = input.rarity || null;
  const badge = input.badge?.trim() || null;
  const amount = input.amount == null || input.amount === ('' as unknown) ? null : Math.round(Number(input.amount));
  const deliveryType = input.deliveryType;
  const deliveryCommand = (input.deliveryCommand || '').trim();
  const servers = Array.isArray(input.servers) ? input.servers : [];
  const features = Array.isArray(input.features) ? input.features.map((value) => String(value).trim()).filter(Boolean) : [];
  const isActive = input.isActive !== false;
  const sortOrder = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0;

  if (input.id) {
    await query(
      `UPDATE store_products SET
        category_id = $2, slug = $3, title = $4, description = $5, image_url = $6,
        price = $7, old_price = $8, rarity = $9, badge = $10, amount = $11,
        delivery_type = $12, delivery_command = $13, servers = $14::jsonb, features = $15::jsonb,
        is_active = $16, sort_order = $17, updated_at = now()
       WHERE id = $1`,
      [
        input.id, categoryId, slug, title, description, imageUrl,
        price, oldPrice, rarity, badge, amount,
        deliveryType, deliveryCommand, JSON.stringify(servers), JSON.stringify(features),
        isActive, sortOrder,
      ]
    );

    return Number(input.id);
  }

  const result = await query(
    `INSERT INTO store_products
      (category_id, slug, title, description, image_url, price, old_price, rarity, badge, amount, delivery_type, delivery_command, servers, features, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)
     RETURNING id`,
    [
      categoryId, slug, title, description, imageUrl,
      price, oldPrice, rarity, badge, amount,
      deliveryType, deliveryCommand, JSON.stringify(servers), JSON.stringify(features),
      isActive, sortOrder,
    ]
  );

  return Number(result.rows[0].id);
}

export async function deleteProduct(id: number): Promise<void> {
  await query('DELETE FROM store_products WHERE id = $1', [id]);
}
