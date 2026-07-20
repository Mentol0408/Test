export type AdminSummary = {
  totalPurchases: number;
  paidPurchases: number;
  failedPurchases: number;
  totalRevenue: number;
  paidRevenue: number;
  tbankPaidRevenue: number;
  enotPaidRevenue: number;
  balancePaidRevenue: number;
  balanceToday: number;
  freeRewardClaims: number;
  freeRewardClaimsTotal: number;
  freeRewardClaimsToday: number;
  uniqueBuyers: number;
  totalLogs: number;
  totalBalanceHolders: number;
  totalOutstandingBalance: number;
  totalBalanceTransactions: number;
  creditedBalance: number;
  debitedBalance: number;
};

export type AdminDashboardFilters = {
  dateFrom?: string;
  dateTo?: string;
  steamId?: string;
  provider?: string;
  status?: string;
};

export type AdminPurchase = {
  id: number;
  userId: string | null;
  userName?: string | null;
  serverKey: string;
  itemType: string;
  amount: number;
  status: string;
  provider: string | null;
  createdAt: string;
  meta: Record<string, unknown> | null;
};

export type AdminLog = {
  id: number;
  purchaseId: number | null;
  serverKey: string;
  event: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
};

export type AdminBalanceAccount = {
  userSteamId: string;
  userName?: string | null;
  balance: number;
  updatedAt: string;
};

export type AdminBalanceTransaction = {
  id: number;
  userSteamId: string;
  userName?: string | null;
  purchaseId: number | null;
  kind: string;
  amount: number;
  createdAt: string;
  meta: Record<string, unknown> | null;
};

export type AdminTopDonor = {
  userId: string;
  userName?: string | null;
  totalAmount: number;
  purchasesCount: number;
};

export type AdminPlayerSearchResult = {
  steamId: string;
  name: string | null;
  balance: number;
  source: string;
};

export type AdminDashboardPayload = {
  summary: AdminSummary;
  topDonors: AdminTopDonor[];
  purchases: AdminPurchase[];
  logs: AdminLog[];
  balanceAccounts: AdminBalanceAccount[];
  balanceTransactions: AdminBalanceTransaction[];
};

export type AdminDashboardResponse = {
  ok: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  steamId: string | null;
  databaseConfigured: boolean;
  databaseError?: string;
  summary?: AdminSummary;
  topDonors?: AdminTopDonor[];
  purchases?: AdminPurchase[];
  logs?: AdminLog[];
  balanceAccounts?: AdminBalanceAccount[];
  balanceTransactions?: AdminBalanceTransaction[];
  error?: string;
};
