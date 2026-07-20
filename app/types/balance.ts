export type BalanceTransaction = {
  id: number;
  purchaseId: number | null;
  kind: string;
  amount: number;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

export type FreeCoinsRewardStatus = {
  trackedMinutes: number;
  requiredMinutes: number;
  remainingMinutes: number;
  activeDays: number;
  windowDays: number;
  coinsAmount: number;
  canClaim: boolean;
  claimedRecently: boolean;
  lastClaimAt: string | null;
};

export type BalanceSummaryResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  databaseConfigured: boolean;
  balance?: number;
  transactions?: BalanceTransaction[];
  freeCoinsReward?: FreeCoinsRewardStatus;
  error?: string;
};

export type BalancePurchaseResponse = {
  ok: boolean;
  balance?: number;
  purchaseId?: number | null;
  error?: string;
};

export type FreeCoinsClaimResponse = {
  ok: boolean;
  purchaseId?: number | null;
  reward?: FreeCoinsRewardStatus;
  error?: string;
};