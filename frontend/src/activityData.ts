import type { LinkedAccount } from './plaid';

export type ActivityTransaction = {
  id: string;
  description: string;
  merchantName: string | null;
  accountId: string;
  accountName: string;
  institution: string;
  amount: string;
  currency: string;
  category: string;
  date: string;
  kind: string;
  status: string;
};
export type ActivityCursor = { date: string; id: string };
export type ActivityPage = {
  transactions: ActivityTransaction[];
  nextCursor: ActivityCursor | null;
};
export type ActivityPeriod = { start: string; end: string };

export function calendarMonth(value: string): ActivityPeriod {
  const end = new Date(value + '-01T00:00:00Z');
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { start: value + '-01', end: end.toISOString().slice(0, 10) };
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Exhaust the server's date/id cursor before publishing counts or filter options. */
export async function loadActivityPeriod(
  period: ActivityPeriod,
  requestPage: (cursor: ActivityCursor | null) => Promise<ActivityPage>,
): Promise<ActivityTransaction[]> {
  const transactions = new Map<string, ActivityTransaction>();
  const cursors = new Set<string>();
  let cursor: ActivityCursor | null = null;
  while (true) {
    const page = await requestPage(cursor);
    if (!Array.isArray(page.transactions))
      throw new Error('Unable to read bank history. Please refresh.');
    for (const transaction of page.transactions) {
      if (transaction.date >= period.start && transaction.date <= period.end)
        transactions.set(transaction.id, transaction);
    }
    const next = page.nextCursor;
    if (!next) break;
    const key = next.date + ':' + next.id;
    if (
      cursors.has(key) ||
      (cursor && (next.date > cursor.date || (next.date === cursor.date && next.id >= cursor.id)))
    ) {
      throw new Error('Bank history pagination stopped advancing. Please retry.');
    }
    cursors.add(key);
    // The API orders by date DESC, id DESC. A boundary day may span many pages.
    if (next.date < period.start) break;
    cursor = next;
  }
  return [...transactions.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
}

export function activityAccountLabel(transaction: ActivityTransaction, accounts: LinkedAccount[]) {
  const account = accounts.find((item) => item.id === transaction.accountId);
  return account
    ? `${account.name}${account.mask ? ' •' + account.mask : ''}`
    : transaction.accountName;
}

export type ActivityFilters = {
  accounts: string[];
  categories: string[];
  search: string;
  mode: '' | 'spending' | 'income' | 'uncategorized';
  start: string;
  end: string;
};

export function filterActivity(
  transactions: ActivityTransaction[],
  accounts: LinkedAccount[],
  filters: ActivityFilters,
) {
  const query = filters.search.trim().toLocaleLowerCase();
  return transactions.filter(
    (transaction) =>
      (!filters.accounts.length || filters.accounts.includes(transaction.accountId)) &&
      (!filters.categories.length || filters.categories.includes(transaction.category)) &&
      (!filters.mode ||
        (filters.mode === 'spending' && transaction.kind === 'expense') ||
        (filters.mode === 'income' && transaction.kind === 'income') ||
        (filters.mode === 'uncategorized' &&
          (!transaction.category || /^uncategori[sz]ed$/i.test(transaction.category)))) &&
      transaction.date >= filters.start &&
      transaction.date <= filters.end &&
      (!query ||
        [
          transaction.merchantName,
          transaction.description,
          transaction.category,
          activityAccountLabel(transaction, accounts),
          transaction.institution,
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)),
  );
}

export function activityAmount(transaction: ActivityTransaction) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: transaction.currency,
    currencyDisplay: 'code',
    signDisplay: 'exceptZero',
  }).format(Number(transaction.amount));
}

export function activityDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
}
