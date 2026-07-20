import type { NextApiRequest, NextApiResponse } from 'next';

import db, { isDatabaseUnavailableError } from '@/lib/db';
import { isBalanceSpendType, resolvePaymentAmount } from '@/lib/paymentConfig';
import { fulfillPurchaseInGame } from '@/lib/purchaseFulfillment';
import { getSteamIdFromRequest } from '@/lib/paymentServer';
import type { BalancePurchaseResponse } from '@/types/balance';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BalancePurchaseResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const steamId = await getSteamIdFromRequest(req, res);

  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }

  const paymentType = req.body?.paymentType;

  if (!isBalanceSpendType(paymentType)) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_TYPE' });
  }

  let amount: number;

  try {
    const rawAmount =
      typeof req.body?.amount === 'number'
        ? req.body.amount
        : Number.isFinite(Number(req.body?.amount))
          ? Number(req.body?.amount)
          : undefined;

    amount = resolvePaymentAmount(paymentType, rawAmount);
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'INVALID_AMOUNT',
    });
  }

  const purchaseMeta = {
    provider: 'balance',
    paymentType,
    coinsAmount: paymentType === 'coins' ? Number(req.body?.amount || amount) : null,
    balancePurchase: true,
  };

  try {
    const purchase = await db.createPurchaseWithBalance({
      userSteamId: steamId,
      itemType: paymentType,
      amount,
      meta: purchaseMeta,
    });

    if (!purchase.ok) {
      return res.status(409).json({
        ok: false,
        error: 'INSUFFICIENT_BALANCE',
        balance: purchase.balance,
      });
    }

    const purchaseId = purchase.purchase?.id ?? null;

    if (!purchaseId) {
      return res.status(500).json({ ok: false, error: 'BALANCE_PURCHASE_FAILED' });
    }

    let fulfillment;

    try {
      fulfillment = await fulfillPurchaseInGame({
        purchaseId,
        userSteamId: steamId,
        itemType: paymentType,
        amount,
        meta: purchaseMeta,
      });
    } catch (error) {
      const reverted = await db.revertBalancePurchase({
        userSteamId: steamId,
        purchaseId,
        meta: {
          reason: 'delivery_failed',
          itemType: paymentType,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return res.status(502).json({
        ok: false,
        error: 'DELIVERY_FAILED',
        balance: reverted.balance,
        purchaseId,
      });
    }

    if (!fulfillment.ok) {
      const reverted = await db.revertBalancePurchase({
        userSteamId: steamId,
        purchaseId,
        meta: {
          reason: 'delivery_failed',
          itemType: paymentType,
          fulfillment,
        },
      });

      return res.status(502).json({
        ok: false,
        error: 'DELIVERY_FAILED',
        balance: reverted.balance,
        purchaseId,
      });
    }

    return res.status(200).json({
      ok: true,
      balance: purchase.balance,
      purchaseId,
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({ ok: false, error: 'DATABASE_UNAVAILABLE' });
    }

    return res.status(500).json({ ok: false, error: 'BALANCE_PURCHASE_FAILED' });
  }
}