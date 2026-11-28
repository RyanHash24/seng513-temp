import type { AuthUser } from './auth';
import { activityAccountLabel } from './activityData';
import { currentDay } from './budgetState';
import Dashboard from './Dashboard';
import { accountGroup, balanceTotals, formatAccountMoney } from './linkedAccountData';
import { linkedMonthlyTotals, overviewBudgetContext, overviewBudgetSummary } from './overviewMetrics';
import { useActivityTransactions } from './useActivityTransactions';
import type { SavedBudget } from './useBudgetPlan';
import { useBudgetSpending } from './useBudgetSpending';
import type { useSavedAccounts } from './useSavedAccounts';
import WorkspaceEmptyState, { EmptyStateCard } from './WorkspaceEmptyState';

type Props = {
  user: AuthUser;
  savedBudget: SavedBudget;
  accounts: ReturnType<typeof useSavedAccounts>;
  onCreateBudget: () => void;
  onReviewBudget: () => void;
  onConnectAccount: () => void;
  onViewAccounts: () => void;
  onViewActivity: () => void;
  onViewPlans: () => void;
};

export default function WorkspaceOverview(props: Props) {
  const { savedBudget, accounts, onReviewBudget, onCreateBudget, onConnectAccount } = props;
  if (savedBudget.error || accounts.error) return <WorkspaceEmptyState label="Overview">
    {savedBudget.error && <div role="alert"><EmptyStateCard title="Unable to refresh your budget" action="Try again" onAction={savedBudget.reload}>
      <p>{savedBudget.error}</p></EmptyStateCard></div>}
    {accounts.error && <div role="alert"><EmptyStateCard title="Unable to load your accounts" action="Try again" onAction={accounts.reload}>
      <p>{accounts.error}</p></EmptyStateCard></div>}
  </WorkspaceEmptyState>;
  if (!savedBudget.snapshot || accounts.loading) return <WorkspaceEmptyState label="Overview">
    <p role="status">Loading your overview…</p>
  </WorkspaceEmptyState>;
  if (savedBudget.snapshot.environment !== accounts.status?.environment) return <WorkspaceEmptyState label="Overview">
    <EmptyStateCard title="Bank environment changed" action="Refresh overview" onAction={() => { accounts.reload(); savedBudget.reload(); }}>
      <p>Refresh to load accounts and budget figures from the same environment.</p>
    </EmptyStateCard>
  </WorkspaceEmptyState>;
  const plan = savedBudget.snapshot.plan;
  const today = currentDay();
  const { cycle } = overviewBudgetContext(plan, accounts.accounts, today);
  const connect = <EmptyStateCard title="No accounts connected" action="Connect an account" onAction={onConnectAccount}>
    <p>Connect with Plaid to bring in balances and transactions. You can also create a plan before linking an account.</p>
  </EmptyStateCard>;
  if (plan && cycle?.scheduled) return <WorkspaceEmptyState label="Overview">
    <EmptyStateCard title="Your budget is scheduled" action="Review your budget" onAction={onReviewBudget}>
      <p>{cycle.label} · Starts in {cycle.daysUntilStart} {cycle.daysUntilStart === 1 ? 'day' : 'days'}.</p>
      <p>Total allocated this cycle · {formatAccountMoney(plan.budget / 100, 'CAD')}</p>
    </EmptyStateCard>
    {accounts.accounts.length === 0 && connect}
  </WorkspaceEmptyState>;
  if (plan) return <OverviewFigures {...props} today={today} />;
  return <WorkspaceEmptyState label="Overview">
    {savedBudget.legacy ? <EmptyStateCard title="A budget is saved in this browser" action="Review saved plan" onAction={onReviewBudget}>
      <p>Review this plan and save it to your account to use it across devices.</p>
    </EmptyStateCard> : <EmptyStateCard title="No budget set yet" action="Create a new budget" onAction={onCreateBudget}>
      <p>Choose your monthly spending limit, select accounts to track and assign money to your categories.</p>
    </EmptyStateCard>}
    {accounts.accounts.length ? <OverviewFigures {...props} today={today} /> : connect}
  </WorkspaceEmptyState>;
}

function OverviewFigures({ user, savedBudget, accounts, today, onViewAccounts, onViewActivity, onReviewBudget, onViewPlans }: Props & { today: string }) {
  const plan = savedBudget.snapshot!.plan;
  const linked = accounts.accounts;
  const { cycle, availableIds, hasUnavailableAccount } = overviewBudgetContext(plan, linked, today);
  const monthStart = today.slice(0, 7) + '-01';
  const start = cycle?.firstDay.toISOString().slice(0, 10) ?? monthStart;
  const spending = useBudgetSpending(accounts.status?.environment, plan ? availableIds : [], start, today);
  const activity = useActivityTransactions(user.id, linked.length ? accounts.status : null, { start, end: today });
  if (spending.error || activity.error) return <div role="alert"><EmptyStateCard title="Unable to load activity" action="Try again" onAction={() => { spending.reload(); activity.reload(); }}>
    <p>{spending.error || activity.error}</p></EmptyStateCard></div>;
  if (spending.loading || (linked.length > 0 && activity.loading)) return <p role="status">Loading account activity…</p>;

  const linkedIds = new Set(linked.map(account => account.id));
  const posted = activity.transactions.filter(row => row.status === 'posted' && linkedIds.has(row.accountId));
  if (!plan || !cycle) {
    const cash = balanceTotals(linked.filter(account => accountGroup(account.accountType) === 'Cash'));
    const credit = balanceTotals(linked.filter(account => account.accountType === 'credit_card'), true);
    const balances = (totals: typeof cash) => totals.map(({ balance, currency }) => formatAccountMoney(balance, currency)).join(' · ') || '—';
    const totals = linkedMonthlyTotals(linked, posted);
    const monthly = (key: 'spending' | 'income') =>
      totals.map(([currency, amounts]) => formatAccountMoney(amounts[key] / 100, currency)).join(' · ') || '—';
    return <EmptyStateCard title="Your linked accounts" action="View your accounts" onAction={onViewAccounts}>
      <dl className="fc-overview-account-metrics">
        <div><dt>Cash balance</dt><dd>{balances(cash)}</dd></div>
        <div><dt>Credit card balance owed</dt><dd>{balances(credit)}</dd></div>
        <div><dt>Net spending this month</dt><dd>{monthly('spending')}</dd></div>
        <div><dt>Income this month</dt><dd>{monthly('income')}</dd></div>
      </dl>
      <p>Monthly totals use posted activity on connected cash and credit accounts. Refunds reduce spending. Each currency is shown separately.</p>
    </EmptyStateCard>;
  }
  const summary = overviewBudgetSummary(plan, linked, spending.entries, today);
  return <Dashboard onViewActivity={onViewActivity} onReviewBudget={onReviewBudget} onViewPlans={onViewPlans}
    unavailableAccounts={hasUnavailableAccount} data={{
      viewer: user, asOf: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updatedAt: activity.loadedAt || null, linkedAccountCount: linked.length,
      period: { start, end: new Date(cycle.nextStart.getTime() - 86400000).toISOString().slice(0, 10),
        allocated: plan.budget / 100, spent: summary.spent / 100 },
      spending: summary.categories.map(({ name, amount }) => ({ category: name, amount: amount / 100 })),
      recentTransactions: posted.slice(0, 5).map(row => ({ id: row.id, date: row.date, merchant: row.merchantName || row.description,
        category: row.category, account: activityAccountLabel(row, linked), amount: Number(row.amount), currency: row.currency })),
    }} />;
}
