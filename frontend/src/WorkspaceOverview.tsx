import type { SavedBudget } from './useBudgetPlan';
import type { useSavedAccounts } from './useSavedAccounts';
import WorkspaceEmptyState, { EmptyStateCard } from './WorkspaceEmptyState';

export default function WorkspaceOverview({ savedBudget, accounts, onCreateBudget, onReviewBudget, onConnectAccount, onViewAccounts }: {
  savedBudget: SavedBudget; accounts: ReturnType<typeof useSavedAccounts>;
  onCreateBudget: () => void; onReviewBudget: () => void; onConnectAccount: () => void; onViewAccounts: () => void;
}) {
  const plan = savedBudget.snapshot?.plan;
  const count = accounts.accounts.length;
  const budget = plan ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(plan.budget / 100) : null;
  return <WorkspaceEmptyState label="Overview">
    {savedBudget.error && <div role="alert"><EmptyStateCard title="Unable to refresh your budget" action="Try again" onAction={savedBudget.reload}><p>{savedBudget.error}</p></EmptyStateCard></div>}
    {!savedBudget.snapshot ? (!savedBudget.error && <p role="status">Loading your budget…</p>) : plan ? <EmptyStateCard title="Your monthly plan" action="Review your budget" onAction={onReviewBudget}>
      <p>Your spending limit is {budget}. Review your allocations and included accounts in Budget.</p>
    </EmptyStateCard> : savedBudget.legacy ? <EmptyStateCard title="A budget is saved in this browser" action="Review saved plan" onAction={onReviewBudget}>
      <p>Review this plan and save it to your account to use it across devices.</p>
    </EmptyStateCard> : <EmptyStateCard title="No budget set yet" action="Create a new budget" onAction={onCreateBudget}>
      <p>Choose your monthly spending limit, select accounts to track and assign money to your categories.</p>
    </EmptyStateCard>}
    {accounts.loading && <p role="status" className="fc-state-description">Loading your accounts…</p>}
    {accounts.error && <div role="alert"><EmptyStateCard title="Unable to load your accounts" action="Try again" onAction={accounts.reload}>
      <p className="fc-state-error">{accounts.error}</p>
    </EmptyStateCard></div>}
    {!accounts.loading && !accounts.error && (count ? <EmptyStateCard title="Your linked accounts" action="View your accounts" onAction={onViewAccounts}>
      <p>{count} {count === 1 ? 'account is' : 'accounts are'} linked to your FinClear profile. View balances, transaction history and connection status in Accounts.</p>
    </EmptyStateCard> : <EmptyStateCard title="No accounts connected" action="Connect an account" onAction={onConnectAccount}>
      <p>Connect with Plaid to bring in balances and transactions. You can also create a plan before linking an account.</p>
    </EmptyStateCard>)}
  </WorkspaceEmptyState>;
}
