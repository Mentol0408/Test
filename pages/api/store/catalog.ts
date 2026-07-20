import type { NextApiRequest, NextApiResponse } from 'next';

import { STORE_SEED } from '@/lib/store/seedCatalog';
import { STORE_SERVERS } from '@/lib/store/servers';
import { ensureStoreSchema, isDatabaseUnavailableError, listPublicCatalog } from '@/lib/store/storeDb';
import type { StoreCatalogResponse, StoreCategory, StoreProduct } from '@/types/store';

// Каталог из сида — fallback, когда БД недоступна (локалка без Postgres),
// чтобы /store всё равно рендерился с примерами товаров.
function buildSeedCatalog(): { categories: StoreCategory[]; products: StoreProduct[] } {
  const categories: StoreCategory[] = [];
  const products: StoreProduct[] = [];
  let productId = 1;

  STORE_SEED.forEach((category, categoryIndex) => {
    const categoryId = categoryIndex + 1;

    categories.push({
      id: categoryId,
      slug: category.slug,
      title: category.title,
      description: category.description,
      sortOrder: categoryIndex,
      isActive: true,
      isDefault: false,
    });

    category.products.forEach((product, productIndex) => {
      products.push({
        id: productId,
        categoryId,
        categorySlug: category.slug,
        slug: product.slug,
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl || null,
        price: product.price,
        oldPrice: product.oldPrice ?? null,
        rarity: product.rarity ?? null,
        badge: product.badge ?? null,
        amount: product.amount ?? null,
        deliveryType: product.deliveryType,
        servers: product.servers || [],
        features: product.features || [],
        isActive: true,
        sortOrder: productIndex,
      });

      productId += 1;
    });
  });

  return { categories, products };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<StoreCatalogResponse>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      databaseConfigured: false,
      source: 'seed',
      servers: STORE_SERVERS,
      categories: [],
      products: [],
      error: 'Method not allowed',
    });
  }

  try {
    await ensureStoreSchema();
    const { categories, products } = await listPublicCatalog();

    return res.status(200).json({
      ok: true,
      databaseConfigured: true,
      source: 'database',
      servers: STORE_SERVERS,
      categories,
      products,
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Store catalog failed, serving seed', error);
    }

    const seed = buildSeedCatalog();

    return res.status(200).json({
      ok: true,
      databaseConfigured: false,
      source: 'seed',
      servers: STORE_SERVERS,
      categories: seed.categories,
      products: seed.products,
    });
  }
}
