export const BALANCE_UPDATED_EVENT = 'balance-updated';

export type BalanceUpdatedDetail = {
  balance: number;
  isAuthenticated: boolean;
  databaseConfigured: boolean;
};

export function emitBalanceUpdated(detail: BalanceUpdatedDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<BalanceUpdatedDetail>(BALANCE_UPDATED_EVENT, { detail }));
}

export function isBalanceUpdatedEvent(event: Event): event is CustomEvent<BalanceUpdatedDetail> {
  return event instanceof CustomEvent;
}