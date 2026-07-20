import type { PoolClient } from 'pg';

import rwShopCatalogData from '@/lib/store/rwShopCatalogData.json';

type ImportedProduct = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  oldPrice: number | null;
  rarity: string;
  badge: string | null;
  amount: number;
  deliveryType: string;
  deliveryCommand: string;
  servers: string[];
  features: string[];
  sortOrder: number;
};

type ImportedCategory = {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  products: ImportedProduct[];
};

const RW_SHOP_CATALOG = rwShopCatalogData as ImportedCategory[];

export async function importRwShopCatalog(client: PoolClient) {
  if (RW_SHOP_CATALOG.length === 0) {
    return;
  }

  await client.query(`UPDATE store_products SET is_active = false, updated_at = now() WHERE is_active = true`);
  await client.query(`UPDATE store_categories SET is_active = false, updated_at = now() WHERE is_active = true`);

  for (const category of RW_SHOP_CATALOG) {
    const categoryResult = await client.query<{ id: number }>(
      `INSERT INTO store_categories (slug, title, description, sort_order, is_active, updated_at)
       VALUES ($1, $2, $3, $4, true, now())
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order,
         is_active = true,
         updated_at = now()
       RETURNING id`,
      [category.slug, category.title, category.description, category.sortOrder]
    );

    const categoryId = Number(categoryResult.rows[0]?.id);

    for (const product of category.products) {
      await client.query(
        `INSERT INTO store_products
          (category_id, slug, title, description, image_url, price, old_price, rarity, badge, amount, delivery_type, delivery_command, servers, features, is_active, sort_order, meta, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,true,$15,$16::jsonb,now())`,
        [
          categoryId,
          product.slug,
          product.title,
          product.description,
          product.imageUrl || null,
          product.price,
          product.oldPrice,
          product.rarity || null,
          product.badge || null,
          product.amount || null,
          product.deliveryType,
          product.deliveryCommand,
          JSON.stringify(product.servers || []),
          JSON.stringify(product.features || []),
          product.sortOrder,
          JSON.stringify({ source: 'rwshop-import-v1' }),
        ]
      );
    }
  }
}
