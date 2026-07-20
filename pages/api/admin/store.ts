import type { NextApiRequest, NextApiResponse } from 'next';

import { getAdminAccessContext } from '@/lib/admin';
import { isDatabaseUnavailableError } from '@/lib/db';
import { isStoreServerKey, STORE_SERVERS } from '@/lib/store/servers';
import {
  deleteCategory,
  deleteProduct,
  ensureStoreSchema,
  listAdminCatalog,
  saveCategory,
  saveProduct,
} from '@/lib/store/storeDb';
import type { StoreAdminCatalogResponse, StoreDeliveryType } from '@/types/store';

const DELIVERY_TYPES: StoreDeliveryType[] = ['item', 'kit', 'privilege', 'currency', 'command'];

function emptyResponse(extra: Partial<StoreAdminCatalogResponse>): StoreAdminCatalogResponse {
  return {
    ok: false,
    isAuthenticated: false,
    isAdmin: false,
    databaseConfigured: false,
    servers: STORE_SERVERS,
    categories: [],
    products: [],
    ...extra,
  };
}

async function catalogResponse(): Promise<StoreAdminCatalogResponse> {
  const { categories, products } = await listAdminCatalog();

  return {
    ok: true,
    isAuthenticated: true,
    isAdmin: true,
    databaseConfigured: true,
    servers: STORE_SERVERS,
    categories,
    products,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<StoreAdminCatalogResponse>) {
  const access = await getAdminAccessContext(req, res);

  if (!access.isAuthenticated) {
    return res.status(401).json(emptyResponse({ error: 'AUTH_REQUIRED' }));
  }

  if (!access.isAdmin) {
    return res.status(403).json(emptyResponse({ isAuthenticated: true, error: 'FORBIDDEN' }));
  }

  try {
    await ensureStoreSchema();

    if (req.method === 'GET') {
      return res.status(200).json(await catalogResponse());
    }

    if (req.method === 'POST') {
      const action = req.body?.action;

      if (action === 'saveCategory') {
        const category = req.body?.category;

        if (!category?.slug?.trim() || !category?.title?.trim()) {
          return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_CATEGORY' }));
        }

        await saveCategory({
          id: category.id ?? null,
          slug: category.slug,
          title: category.title,
          description: category.description ?? null,
          sortOrder: Number(category.sortOrder) || 0,
          isActive: category.isActive !== false,
          isDefault: category.isDefault === true,
        });

        return res.status(200).json(await catalogResponse());
      }

      if (action === 'deleteCategory') {
        const id = Number(req.body?.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_ID' }));
        }

        await deleteCategory(id);

        return res.status(200).json(await catalogResponse());
      }

      if (action === 'saveProduct') {
        const product = req.body?.product;

        if (!product?.title?.trim()) {
          return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_PRODUCT' }));
        }

        const priceValue = Number(product.price);
        if (!Number.isInteger(priceValue) || priceValue <= 0) {
          return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_PRICE' }));
        }

        const deliveryType: StoreDeliveryType = DELIVERY_TYPES.includes(product.deliveryType) ? product.deliveryType : 'item';
        const servers = Array.isArray(product.servers) ? product.servers.filter((key: unknown) => isStoreServerKey(key)) : [];
        const features = Array.isArray(product.features) ? product.features.map((value: unknown) => String(value)) : [];

        await saveProduct({
          id: product.id ?? null,
          categoryId: product.categoryId == null ? null : Number(product.categoryId),
          slug: product.slug ?? '',
          title: product.title,
          description: product.description ?? null,
          imageUrl: product.imageUrl ?? null,
          price: priceValue,
          oldPrice: product.oldPrice === '' || product.oldPrice == null ? null : Number(product.oldPrice),
          rarity: product.rarity || null,
          badge: product.badge ?? null,
          amount: product.amount === '' || product.amount == null ? null : Number(product.amount),
          deliveryType,
          deliveryCommand: product.deliveryCommand ?? '',
          servers,
          features,
          isActive: product.isActive !== false,
          sortOrder: Number(product.sortOrder) || 0,
        });

        return res.status(200).json(await catalogResponse());
      }

      if (action === 'deleteProduct') {
        const id = Number(req.body?.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'INVALID_ID' }));
        }

        await deleteProduct(id);

        return res.status(200).json(await catalogResponse());
      }

      return res.status(400).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'UNKNOWN_ACTION' }));
    }

    return res.status(405).json(emptyResponse({ isAuthenticated: true, isAdmin: true, error: 'Method not allowed' }));
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json(emptyResponse({ isAuthenticated: true, isAdmin: true, error: 'DATABASE_UNAVAILABLE' }));
    }

    console.error('Store admin failed', error);

    return res.status(500).json(emptyResponse({ isAuthenticated: true, isAdmin: true, databaseConfigured: true, error: 'STORE_ADMIN_FAILED' }));
  }
}
