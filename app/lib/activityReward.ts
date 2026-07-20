export const ACTIVITY_FREE_COINS_REWARD = {
  kind: 'activity_free_coins',
  coinsAmount: 25,
  requiredMinutes: 5 * 60,
  windowDays: 4,
} as const;

export function formatMinutesToHours(minutes: number) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${restMinutes} мин`;
  }

  if (restMinutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${restMinutes} мин`;
}