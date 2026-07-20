import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getPaymentComment,
  isPaymentType,
  resolvePaymentAmount,
} from '@/lib/paymentConfig';
import {
  buildMerchantOrderId,
  createPurchaseRecord,
  getBaseUrl,
  getSteamIdFromRequest,
  updatePurchaseRecord,
} from '@/lib/paymentServer';

type CreatePaymentResponse = {
  ok: boolean;
  url?: string;
  error?: string;
  provider?: 'tbank';
  purchaseId?: number | null;
};

function buildTBankToken(payload: Record<string, string | number>, password: string) {
  const data: Record<string, string | number> = { ...payload, Password: password };
  const concatenated = Object.keys(data)
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((key) => String(data[key]))
    .join('');

  return crypto.createHash('sha256').update(concatenated, 'utf8').digest('hex');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreatePaymentResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const steamId = await getSteamIdFromRequest(req, res);

  if (!steamId) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }

  if (!process.env.TBANK_TERMINAL_KEY || !process.env.TBANK_PASSWORD) {
    return res.status(503).json({ ok: false, error: 'TBANK_NOT_CONFIGURED' });
  }

  const paymentType = req.body?.paymentType;

  if (!isPaymentType(paymentType)) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_TYPE' });
  }

  if (paymentType !== 'balance_topup') {
    return res.status(409).json({ ok: false, error: 'DIRECT_PAYMENT_DISABLED' });
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

  const purchase = await createPurchaseRecord({
    steamId,
    paymentType,
    amount,
    provider: 'tbank',
  });

  const orderId = buildMerchantOrderId('tbank', purchase?.id);
  const baseUrl = getBaseUrl(req);
  const amountInKopecks = Math.round(amount * 100);
  const description = getPaymentComment(paymentType, amount);
  const successUrl = process.env.TBANK_SUCCESS_URL || `${baseUrl}/?payment=success&provider=tbank#donate`;
  const failUrl = process.env.TBANK_FAIL_URL || `${baseUrl}/?payment=failed&provider=tbank#donate`;
  const notificationUrl = `${baseUrl}/api/tbank/webhook`;

  const tokenPayload = {
    Amount: amountInKopecks,
    CustomerKey: steamId,
    Description: description,
    FailURL: failUrl,
    Language: 'ru',
    NotificationURL: notificationUrl,
    OrderId: orderId,
    SuccessURL: successUrl,
    TerminalKey: process.env.TBANK_TERMINAL_KEY,
  };

  const payload = {
    ...tokenPayload,
    DATA: {
      Provider: 'tbank',
      PaymentType: paymentType,
      SteamId: steamId,
      PurchaseId: purchase?.id ? String(purchase.id) : '',
      AmountRub: String(amount),
    },
    Token: buildTBankToken(tokenPayload, process.env.TBANK_PASSWORD),
  };

  try {
    const response = await fetch(process.env.TBANK_INIT_URL || 'https://securepay.tinkoff.ru/v2/Init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    const paymentUrl = data?.PaymentURL as string | undefined;
    const paymentId = data?.PaymentId as string | undefined;

    if (!response.ok || !data?.Success || !paymentUrl) {
      await updatePurchaseRecord({
        purchaseId: purchase?.id,
        provider: 'tbank',
        status: 'provider_error',
        event: 'tbank_payment_create_failed',
        meta: {
          orderId,
          responseStatus: response.status,
          errorCode: data?.ErrorCode || null,
          errorMessage: data?.Message || data?.Details || null,
        },
      });

      return res.status(response.ok ? 502 : response.status).json({
        ok: false,
        error: data?.Message || data?.Details || 'TBANK_CREATE_FAILED',
      });
    }

    await updatePurchaseRecord({
      purchaseId: purchase?.id,
      provider: 'tbank',
      status: 'invoice_created',
      event: 'tbank_payment_created',
      meta: {
        orderId,
        paymentId,
        paymentUrl,
      },
    });

    return res.status(200).json({
      ok: true,
      url: paymentUrl,
      provider: 'tbank',
      purchaseId: purchase?.id ?? null,
    });
  } catch (error) {
    await updatePurchaseRecord({
      purchaseId: purchase?.id,
      provider: 'tbank',
      status: 'provider_error',
      event: 'tbank_request_failed',
      meta: {
        orderId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return res.status(502).json({ ok: false, error: 'TBANK_REQUEST_FAILED' });
  }
}