import type { NextApiRequest, NextApiResponse } from 'next';

import {
  addLog,
  createPurchaseWithBalance,
  creditUserBalanceManually,
  isDatabaseUnavailableError,
  revertBalancePurchase,
  updatePurchaseStatus,
} from '@/lib/db';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import { fulfillStorePurchaseInGame } from '@/lib/store/fulfillment';
import { isStoreServerKey } from '@/lib/store/servers';
import { ensureStoreSchema, getStoreProduct } from '@/lib/store/storeDb';
import type { StorePurchaseResponse } from '@/types/store';

const MAX_QUANTITY = 99;

export default async function handler(req: NextApiRequest, res: NextApiResponse<StorePurchaseResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const steamId = await getSteamIdFromRequest(req, res);

  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }

  const productId = Number(req.body?.productId);
  const serverKey = req.body?.serverKey;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_PRODUCT' });
  }

  if (!isStoreServerKey(serverKey)) {
    return res.status(400).json({ ok: false, error: 'INVALID_SERVER' });
  }

  try {
    await ensureStoreSchema();

    const product = await getStoreProduct(productId);

    if (!product || !product.isActive) {
      return res.status(404).json({ ok: false, error: 'PRODUCT_NOT_FOUND' });
    }

    if (product.servers.length > 0 && !product.servers.includes(serverKey)) {
      return res.status(400).json({ ok: false, error: 'SERVER_NOT_ALLOWED' });
    }

    const rawQuantity = Number(req.body?.quantity);
    const requestedQuantity = Number.isInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
    // Привилегия — это статус, количество не имеет смысла; для остального ограничиваем сверху.
    const quantity = product.deliveryType === 'privilege' ? 1 : Math.min(requestedQuantity, MAX_QUANTITY);

    const unitPrice = product.price;

    // Защита от бесплатной выдачи: товар с нулевой/кривой ценой не продаём.
    if (!Number.isInteger(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({ ok: false, error: 'INVALID_PRODUCT' });
    }

    const price = unitPrice * quantity;

    const purchaseMeta = {
      provider: 'balance',
      store: true,
      paymentType: 'store_item',
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title,
      deliveryType: product.deliveryType,
      quantity,
      unitPrice,
      serverKey,
    };

    const purchase = await createPurchaseWithBalance({
      userSteamId: steamId,
      itemType: `store:${product.slug}`,
      amount: price,
      meta: purchaseMeta,
    });

    if (!purchase.ok) {
      return res.status(409).json({ ok: false, error: 'INSUFFICIENT_BALANCE', balance: purchase.balance });
    }

    const purchaseId = purchase.purchase?.id ?? null;

    if (!purchaseId) {
      return res.status(500).json({ ok: false, error: 'STORE_PURCHASE_FAILED' });
    }

    // Полный возврат с защитой: если сам возврат упал — НЕ теряем деньги молча,
    // фиксируем намерение вернуть (status=refund_pending + лог) для повтора.
    const safeFullRevert = async (detail: Record<string, unknown>): Promise<number> => {
      try {
        const reverted = await revertBalancePurchase({
          userSteamId: steamId,
          purchaseId,
          meta: { reason: 'delivery_failed', productSlug: product.slug, serverKey, ...detail },
        });
        return reverted.balance;
      } catch (revertError) {
        const message = revertError instanceof Error ? revertError.message : 'Unknown error';
        try { await updatePurchaseStatus(purchaseId, 'refund_pending', { reason: 'revert_failed', productSlug: product.slug, serverKey, message }); } catch {}
        try { await addLog({ purchaseId, serverKey, event: 'store_revert_failed', meta: { productSlug: product.slug, message } }); } catch {}
        return purchase.balance; // возврат не выполнен — фактический баланс остаётся списанным
      }
    };

    let fulfillment;

    try {
      fulfillment = await fulfillStorePurchaseInGame({
        purchaseId,
        userSteamId: steamId,
        product,
        serverKey,
        quantity,
      });
    } catch (error) {
      const balance = await safeFullRevert({ message: error instanceof Error ? error.message : 'Unknown error' });
      return res.status(502).json({ ok: false, error: 'DELIVERY_FAILED', balance, purchaseId });
    }

    if (!fulfillment.ok) {
      // Частичная выдача (актуально для quantity > 1): возвращаем ТОЛЬКО за невыданные единицы,
      // уже выданное игроку не отзываем и не возвращаем за него деньги.
      if (fulfillment.delivered > 0 && fulfillment.delivered < fulfillment.total) {
        const refundAmount = Math.round((price * (fulfillment.total - fulfillment.delivered)) / fulfillment.total);
        let balanceAfter = purchase.balance;

        try {
          if (refundAmount > 0) {
            const credited = await creditUserBalanceManually({
              userSteamId: steamId,
              amount: refundAmount,
              adminSteamId: 'system',
              reason: `partial_delivery_refund:${product.slug}`,
            });
            balanceAfter = credited.balance;
          }
        } catch (refundError) {
          try { await addLog({ purchaseId, serverKey, event: 'store_partial_refund_failed', meta: { refundAmount, message: refundError instanceof Error ? refundError.message : 'Unknown error' } }); } catch {}
        }

        try { await updatePurchaseStatus(purchaseId, 'partial', { delivered: fulfillment.delivered, total: fulfillment.total, refundAmount, serverKey }); } catch {}

        return res.status(207).json({ ok: false, error: 'PARTIAL_DELIVERY', balance: balanceAfter, purchaseId });
      }

      const balance = await safeFullRevert({ fulfillment });
      return res.status(502).json({ ok: false, error: 'DELIVERY_FAILED', balance, purchaseId });
    }

    return res.status(200).json({
      ok: true,
      balance: purchase.balance,
      purchaseId,
      product: { id: product.id, title: product.title, price },
      serverKey,
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ ok: false, error: 'DATABASE_UNAVAILABLE' });
    }

    console.error('Store purchase failed', error);

    return res.status(500).json({ ok: false, error: 'STORE_PURCHASE_FAILED' });
  }
}
