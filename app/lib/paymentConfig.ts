export type PaymentProvider = 'tbank' | 'enot' | 'morune' | 'skins';
export type PaymentType = 'vip' | 'coins' | 'balance_topup';

export const PAYMENT_PROVIDERS = [
  {
    id: 'tbank' as const,
    label: 'T-Bank',
    description: 'Быстрый переход на платежную форму банка.',
    tags: ['Банковские карты', 'Быстрая оплата'],
  },
  {
    id: 'enot' as const,
    label: 'ENOT',
    description: 'Эквайринг с несколькими способами оплаты.',
    tags: ['Банковские карты', 'СБП', 'Альтернативные методы'],
  },
  {
    id: 'skins' as const,
    label: 'Скинами',
    description: 'Оплата скинами Steam через трейд-сервис.',
    tags: ['Rust', 'CS2', 'Steam-трейд'],
  },
];

export const COINS_PAYMENT = {
  min: 100,
  max: 2000,
  step: 100,
  defaultAmount: 500,
  pricePerCoin: 1,
} as const;

export const BALANCE_TOPUP = {
  min: 100,
  max: 10000,
  step: 100,
  defaultAmount: 500,
} as const;

export const VIP_PAYMENT = {
  amount: 299,
  originalAmount: 399,
  discountPercent: 25,
  title: 'VIP - привилегия',
  description: 'Привилегия действует 6 дней. Сейчас доступна со скидкой 25%.',
} as const;

export function isPaymentType(value: unknown): value is PaymentType {
  return value === 'vip' || value === 'coins' || value === 'balance_topup';
}

export function isBalanceSpendType(value: unknown): value is Extract<PaymentType, 'vip' | 'coins'> {
  return value === 'vip' || value === 'coins';
}

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return value === 'tbank' || value === 'enot' || value === 'morune';
}

export function resolvePaymentAmount(paymentType: PaymentType, requestedAmount?: number) {
  if (paymentType === 'vip') {
    return VIP_PAYMENT.amount;
  }

  if (paymentType === 'balance_topup') {
    if (!Number.isFinite(requestedAmount)) {
      throw new Error('AMOUNT_REQUIRED');
    }

    const amount = Number(requestedAmount);

    if (!Number.isInteger(amount)) {
      throw new Error('AMOUNT_MUST_BE_INTEGER');
    }

    if (amount < BALANCE_TOPUP.min || amount > BALANCE_TOPUP.max) {
      throw new Error('AMOUNT_OUT_OF_RANGE');
    }

    if ((amount - BALANCE_TOPUP.min) % BALANCE_TOPUP.step !== 0) {
      throw new Error('AMOUNT_STEP_INVALID');
    }

    return amount;
  }

  if (!Number.isFinite(requestedAmount)) {
    throw new Error('AMOUNT_REQUIRED');
  }

  const amount = Number(requestedAmount);

  if (!Number.isInteger(amount)) {
    throw new Error('AMOUNT_MUST_BE_INTEGER');
  }

  if (amount < COINS_PAYMENT.min || amount > COINS_PAYMENT.max) {
    throw new Error('AMOUNT_OUT_OF_RANGE');
  }

  if ((amount - COINS_PAYMENT.min) % COINS_PAYMENT.step !== 0) {
    throw new Error('AMOUNT_STEP_INVALID');
  }

  return amount;
}

export function getPaymentTitle(paymentType: PaymentType, amount: number) {
  if (paymentType === 'vip') {
    return VIP_PAYMENT.title;
  }

  if (paymentType === 'balance_topup') {
    return `Пополнение баланса на ${amount} ₽`;
  }

  return `${amount} монет`;
}

export function getPaymentDescription(paymentType: PaymentType) {
  if (paymentType === 'vip') {
    return VIP_PAYMENT.description;
  }

  if (paymentType === 'balance_topup') {
    return 'Пополните баланс аккаунта и оплачивайте товары напрямую с внутреннего счёта.';
  }

  return 'Монеты для настоящих ценителей скинов.';
}

export function getPaymentComment(paymentType: PaymentType, amount: number) {
  if (paymentType === 'vip') {
    return 'Оплата VIP-привилегии Rust Way';
  }

  if (paymentType === 'balance_topup') {
    return `Пополнение баланса Rust Way на ${amount} RUB`;
  }

  return `Оплата ${amount} монет Rust Way`;
}