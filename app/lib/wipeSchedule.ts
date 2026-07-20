const MOSCOW_TIME_ZONE = 'Europe/Moscow';

type WipeScheduleOptions = {
  wipeHourMoscow: number;
  now?: Date;
};

function getMoscowDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const valueOf = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');

  return {
    year: valueOf('year'),
    month: valueOf('month'),
    day: valueOf('day'),
    hour: valueOf('hour'),
    minute: valueOf('minute'),
    second: valueOf('second'),
  };
}

function getDateForMoscowFriday(year: number, monthIndex0: number, day: number, wipeHourMoscow: number) {
  return new Date(Date.UTC(year, monthIndex0, day, wipeHourMoscow - 3, 0, 0, 0));
}

export function getWeeklyFridayWipeSchedule({ wipeHourMoscow, now = new Date() }: WipeScheduleOptions) {
  const moscow = getMoscowDateParts(now);
  const todayUtc = new Date(Date.UTC(moscow.year, moscow.month - 1, moscow.day));
  const daysSinceFriday = (todayUtc.getUTCDay() - 5 + 7) % 7;

  let lastDay = moscow.day - daysSinceFriday;
  let lastMonthIndex0 = moscow.month - 1;
  let lastYear = moscow.year;

  const passedToday = moscow.hour >= wipeHourMoscow;
  if (daysSinceFriday === 0 && !passedToday) {
    lastDay -= 7;
  }

  while (lastDay <= 0) {
    lastMonthIndex0 -= 1;
    if (lastMonthIndex0 < 0) {
      lastMonthIndex0 = 11;
      lastYear -= 1;
    }

    lastDay += new Date(Date.UTC(lastYear, lastMonthIndex0 + 1, 0)).getUTCDate();
  }

  const lastWipe = getDateForMoscowFriday(lastYear, lastMonthIndex0, lastDay, wipeHourMoscow);
  const nextWipe = new Date(lastWipe.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    lastWipeMs: lastWipe.getTime(),
    nextWipeMs: nextWipe.getTime(),
  };
}

export function formatWipeTimestamp(timestampMs: number) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestampMs));
}
