import { currentDay } from './budgetState.ts';

const DAY_MS = 86_400_000;
const fullDate = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function getBudgetCycle(start: string, todayValue = currentDay()) {
  const anchor = new Date(`${start}T00:00:00Z`);
  const today = new Date(`${todayValue}T00:00:00Z`);
  const scheduled = today < anchor;

  function anniversary(offset: number) {
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth() + offset;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay)));
  }

  let offset = 0;
  if (!scheduled) {
    offset = (today.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + today.getUTCMonth() - anchor.getUTCMonth();
    if (today < anniversary(offset)) offset -= 1;
  }
  const firstDay = anniversary(offset);
  const nextStart = anniversary(offset + 1);
  const lastDay = new Date(nextStart.getTime() - DAY_MS);
  const firstLabel = firstDay.getUTCFullYear() === lastDay.getUTCFullYear() ? shortDate.format(firstDay) : fullDate.format(firstDay);

  return {
    firstDay, nextStart, scheduled,
    daysLeft: Math.ceil((nextStart.getTime() - today.getTime()) / DAY_MS),
    daysUntilStart: Math.max(0, Math.ceil((anchor.getTime() - today.getTime()) / DAY_MS)),
    label: `${firstLabel} – ${fullDate.format(lastDay)}`,
  };
}
