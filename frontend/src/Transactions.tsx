import { useState, type FormEvent } from "react";
import "./Transactions.css";
import activityIcon from "./assets/navigation/activity.svg";
import searchIcon from "./assets/navigation/search.svg";
import filterIcon from "./assets/navigation/budget.svg";
import { EmptyStateCard } from "./WorkspaceEmptyState";

type Transaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  type: "income" | "expense";
};

const defaultCategories = [
  "Food", "Transport", "Shopping", "Subscriptions",
  "Housing", "Entertainment", "Income", "Other",
];

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function loadTransactions(storageKey: string): Transaction[] {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as Transaction[];
    }
  } catch (error) {
    console.error("Unable to load transactions:", error);
  }

  return [];
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function displayDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function signedAmount(transaction: Transaction) {
  const amount = transaction.type === "income" ? transaction.amount : -transaction.amount;
  return amount > 0 ? `+${currency.format(amount)}` : currency.format(amount);
}

const styles = `
  .fc-activity {
    --activity-surface: var(--fc-surface, #12221c);
    --activity-border: var(--fc-border, #263c31);
    --activity-muted: var(--fc-muted, #9bb0a3);
    --activity-text: var(--fc-text, #eafaf0);
    --activity-accent: var(--fc-accent, #61d98f);
    padding: 40px;
    color: var(--activity-text);
    color-scheme: var(--fc-color-scheme, dark);
  }

  .fc-activity * { box-sizing: border-box; }
  .fc-activity :is(h1, h2, p) { margin: 0; }
  .fc-activity h1 { font-size: 30px; font-weight: 600; line-height: 1.25; }
  .fc-activity h2 { font-size: 17px; font-weight: 500; }
  .fc-activity .fca-muted { color: var(--activity-muted); font-size: 13px; }
  .fc-activity .fca-income { color: var(--activity-accent); }

  .fc-activity .fcat-heading,
  .fc-activity .fcat-card-header,
  .fc-activity .fcat-actions,
  .fc-activity .fcat-totals {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .fc-activity .fcat-heading { margin-bottom: 32px; }
  .fc-activity .fcat-heading p { margin-top: 8px; }

  .fc-activity :is(button, input, select) {
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--activity-border);
    border-radius: 8px;
    background: var(--activity-surface);
    color: var(--activity-text);
    font: inherit;
    font-size: 13px;
  }

  .fc-activity input::placeholder { color: var(--activity-muted); }
  .fc-activity button { cursor: pointer; }
  .fc-activity button:hover { border-color: var(--activity-accent); }

  .fc-activity :is(button, input, select):focus-visible {
    outline: 2px solid var(--activity-accent);
    outline-offset: 2px;
  }

  .fc-activity .fcat-primary {
    border-color: var(--activity-accent);
    background: var(--activity-accent);
    color: var(--fc-on-accent, #0b1512);
    font-weight: 600;
  }

  .fc-activity .fcat-danger { color: var(--fc-error, #ffa5a5); }

  .fc-activity .fcat-filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 24px;
  }

  .fc-activity .fcat-search {
    position: relative;
    flex: 1 1 250px;
    max-width: 380px;
  }

  .fc-activity .fcat-search img {
    position: absolute;
    top: 50%;
    left: 12px;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .fc-activity .fcat-search input { width: 100%; padding-left: 42px; }
  .fc-activity .fcat-category-filter { position: relative; display: inline-flex; color: var(--activity-text); }
  .fc-activity .fcat-category-filter::before {
    content: "";
    position: absolute;
    z-index: 1;
    left: 14px;
    top: calc(50% - 5px);
    width: 7px;
    height: 7px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(45deg);
    pointer-events: none;
  }
  .fc-activity .fcat-category-filter select { appearance: none; padding-left: 34px; padding-right: 14px; cursor: pointer; }
  .fc-activity .fcat-filter-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .fc-activity .fcat-filter-toggle img { display: block; flex-shrink: 0; }
  .fc-shell[data-theme="light"] .fc-activity .fcat-filter-toggle img { filter: brightness(.52); }
  .fc-activity .fcat-count { margin-left: auto; }

  .fc-activity .fcat-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 24px;
  }

  .fc-activity .fcat-layout-with-details {
    grid-template-columns: minmax(0, 7fr) minmax(240px, 3fr);
  }

  .fc-activity .fcat-card {
    min-width: 0;
    border: 1px solid var(--activity-border);
    border-radius: 12px;
    background: var(--activity-surface);
  }

  .fc-activity .fcat-card-header { padding: 16px 20px; }
  .fc-activity .fcat-scroll { overflow-x: auto; }

  .fc-activity table {
    width: 100%;
    min-width: 410px;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }

  .fc-activity :is(th, td) { padding: 12px 16px; }

  .fc-activity thead {
    background: var(--fc-subtle, #172a22);
    color: var(--activity-muted);
    font-size: 11px;
    text-transform: uppercase;
  }

  .fc-activity .fcat-date-row th {
    padding-block: 9px;
    background: var(--fc-sidebar, #0f1c17);
    color: var(--activity-muted);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
  }

  .fc-activity .fcat-row td { border-bottom: 1px solid var(--activity-border); }
  .fc-activity .fcat-row-selected { background: var(--fc-selected, #163d2a); }
  .fc-activity .fcat-amount { text-align: right; white-space: nowrap; }

  .fc-activity .fcat-merchant {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 4px;
    border-color: transparent;
    background: transparent;
    text-align: left;
  }

  .fc-activity .fcat-merchant img { flex-shrink: 0; }

  .fc-shell[data-theme="light"] .fc-activity :is(.fcat-search, .fcat-merchant) img {
    filter: brightness(0.52);
  }

  .fc-activity .fcat-empty { padding: 24px 20px; }
  .fc-activity .fcat-empty button { margin-top: 12px; }
  .fc-activity .fcat-details { padding: 20px; }
  .fc-activity .fcat-details .fcat-card-header { padding: 0; }
  .fc-activity .fcat-detail-merchant { margin-top: 16px; }

  .fc-activity .fcat-detail-amount {
    display: block;
    margin: 16px 0;
    font-size: 32px;
    font-weight: 500;
  }

  .fc-activity .fcat-editor {
    display: grid;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--activity-border);
  }

  .fc-activity label { display: grid; gap: 6px; font-size: 13px; }
  .fc-activity .fcat-editor select { width: 100%; }
  .fc-activity .fcat-actions { justify-content: flex-start; }
  .fc-activity .fcat-add { padding: 20px; margin-bottom: 24px; }

  .fc-activity .fcat-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin: 16px 0;
  }

  .fc-activity .fcat-fields :is(input, select) { width: 100%; min-width: 0; }
  .fc-activity .fcat-totals { margin-top: 20px; }
  .fc-activity .fcat-feedback { margin: 0 0 12px; }

  @media (max-width: 1050px) {
    .fc-activity .fcat-layout-with-details { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 700px) {
    .fc-activity { padding: 24px 20px; }
    .fc-activity .fcat-search { max-width: none; }
    .fc-activity .fcat-fields { grid-template-columns: minmax(0, 1fr); }
    .fc-activity :is(th, td) { padding-inline: 10px; }
  }
`;

function ManualTransactions({ userId, hasLinkedAccounts, onViewAccounts }: {
  userId: string; hasLinkedAccounts: boolean; onViewAccounts: () => void;
}) {
  const storageKey = `finclear-manual-transactions:${userId}`;
  const [transactions, updateTransactions] = useState(() => loadTransactions(storageKey));
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState("");
  const [feedback, setFeedback] = useState("");
  const [storageError, setStorageError] = useState("");

  function setTransactions(next: Transaction[] | ((previous: Transaction[]) => Transaction[])) {
    const updated = typeof next === "function" ? next(transactions) : next;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setStorageError("");
    } catch (error) {
      console.error("Unable to save transactions:", error);
      setStorageError("Browser storage is unavailable. Changes may be lost when you reload.");
    }
    updateTransactions(updated);
  }

  const categories = [...new Set([
    ...defaultCategories,
    ...transactions.map((transaction) => transaction.category),
  ])];

  const query = search.trim().toLowerCase();
  const visible = transactions
    .filter((transaction) =>
      (!query || `${transaction.name} ${transaction.category}`.toLowerCase().includes(query)) &&
      (!categoryFilter || transaction.category === categoryFilter) &&
      (!typeFilter || transaction.type === typeFilter),
    )
    .sort((first, second) => second.date.localeCompare(first.date));

  const byDate = new Map<string, Transaction[]>();
  for (const transaction of visible) {
    const group = byDate.get(transaction.date);
    if (group) group.push(transaction);
    else byDate.set(transaction.date, [transaction]);
  }

  const selected = transactions.find((transaction) => transaction.id === selectedId);
  const totals = transactions.reduce(
    (sum, transaction) => {
      sum[transaction.type] += transaction.amount;
      return sum;
    },
    { income: 0, expense: 0 },
  );

  function clearFilters() {
    setSearch("");
    setCategoryFilter("");
    setTypeFilter("");
  }

  function openDetails(transaction: Transaction) {
    setSelectedId(transaction.id);
    setDraftCategory(transaction.category);
    setFeedback("");
  }

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const amount = Number(data.get("amount"));
    const date = String(data.get("date") ?? "");

    if (!name || !date || !Number.isFinite(amount) || amount <= 0) {
      setFeedback("Enter a transaction name, date, and positive amount.");
      return;
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      name,
      amount,
      date,
      category: String(data.get("category") ?? "Food"),
      type: data.get("type") === "income" ? "income" : "expense",
    };

    setTransactions((current) => [transaction, ...current]);
    setShowAdd(false);
    clearFilters();
    openDetails(transaction);
    setFeedback("Transaction added.");
  }

  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setTransactions((current) =>
      current.map((transaction) =>
        transaction.id === selected.id
          ? { ...transaction, category: draftCategory }
          : transaction,
      ),
    );
    setFeedback("Category updated.");
  }

  function deleteTransaction(transaction: Transaction) {
    if (!window.confirm(`Delete ${transaction.name}?`)) return;
    setTransactions((current) => current.filter((item) => item.id !== transaction.id));
    setSelectedId(null);
    setFeedback("Transaction deleted.");
  }

  return (
    <div className="fc-activity">
      <style>{styles}</style>

      <header className="fcat-heading">
        <div>
          <h1>Your activity</h1>
          <p className="fca-muted">Search and manage your transactions.</p>
        </div>
        <button
          type="button"
          className="fcat-primary"
          aria-expanded={showAdd}
          onClick={() => {
            setShowAdd((open) => !open);
            setFeedback("");
          }}
        >
          {showAdd ? "Cancel adding" : "+ Add transaction"}
        </button>
      </header>

      {storageError && <p className="fcat-feedback" role="alert">{storageError}</p>}
      {feedback && <p className="fcat-feedback" role="status">{feedback}</p>}

      {showAdd && (
        <form className="fcat-card fcat-add" onSubmit={addTransaction}>
          <h2>Add a transaction</h2>
          <div className="fcat-fields">
            <label>
              Merchant or transaction name
              <input name="name" placeholder="e.g. Groceries" required />
            </label>
            <label>
              Amount (CAD)
              <input name="amount" type="number" min="0.01" step="0.01" required />
            </label>
            <label>
              Category
              <select name="category" defaultValue="Food">
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Date
              <input name="date" type="date" defaultValue={today()} required />
            </label>
            <label>
              Type
              <select name="type" defaultValue="expense">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
          </div>
          <button type="submit" className="fcat-primary">Save transaction</button>
        </form>
      )}

      <div className="fcat-filters">
        <div className="fcat-search">
          <img src={searchIcon} alt="" />
          <input
            type="search"
            aria-label="Search transactions"
            placeholder="Search transactions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <span className="fcat-category-filter">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </span>

        <button
          type="button"
          className="fcat-filter-toggle"
          aria-expanded={showFilters}
          aria-controls="activity-extra-filters"
          onClick={() => setShowFilters((open) => !open)}
        >
          <img src={filterIcon} alt="" />
          {typeFilter ? "Filters (1)" : "Filters"}
        </button>

        <div id="activity-extra-filters" hidden={!showFilters}>
          <select
            aria-label="Filter by transaction type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
        </div>

        <span className="fca-muted fcat-count">
          {visible.length} {visible.length === 1 ? "transaction" : "transactions"}
        </span>
      </div>

      <div className={`fcat-layout${selected ? " fcat-layout-with-details" : ""}`}>
        <section className="fcat-card" aria-labelledby="activity-list-title">
          <header className="fcat-card-header">
            <h2 id="activity-list-title">Transactions</h2>
            <span className="fca-muted">All amounts in CAD</span>
          </header>

          {transactions.length === 0 ? <EmptyStateCard title="No transactions added yet"
            action={hasLinkedAccounts ? "View account activity" : "Connect an account"} onAction={onViewAccounts}>
            <p>{hasLinkedAccounts ? "View imported bank transactions under each account, or add a transaction using the button above."
              : "Connect an account to bring your bank activity into FinClear, or add a transaction using the button above."}</p>
          </EmptyStateCard> : visible.length === 0 ? (
            <div className="fcat-empty">
              <p className="fca-muted">No transactions found.</p>
              {(search || categoryFilter || typeFilter) && (
                <button type="button" onClick={clearFilters}>Clear filters</button>
              )}
            </div>
          ) : (
            <div className="fcat-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Merchant</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="fcat-amount">Amount</th>
                  </tr>
                </thead>

                {[...byDate.entries()].map(([date, group]) => (
                  <tbody key={date}>
                    <tr className="fcat-date-row">
                      <th scope="rowgroup" colSpan={3}>
                        <time dateTime={date}>{displayDate(date)}</time>
                      </th>
                    </tr>
                    {group.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className={`fcat-row${selectedId === transaction.id ? " fcat-row-selected" : ""}`}
                      >
                        <td>
                          <button
                            type="button"
                            className="fcat-merchant"
                            aria-pressed={selectedId === transaction.id}
                            onClick={() => openDetails(transaction)}
                          >
                            <img src={activityIcon} alt="" />
                            {transaction.name}
                          </button>
                        </td>
                        <td className="fca-muted">{transaction.category}</td>
                        <td className={`fcat-amount${transaction.type === "income" ? " fca-income" : ""}`}>
                          {signedAmount(transaction)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </section>

        {selected && (
          <section className="fcat-card fcat-details" aria-labelledby="activity-detail-title">
            <header className="fcat-card-header">
              <h2 id="activity-detail-title">Transaction details</h2>
              <button
                type="button"
                aria-label="Close transaction details"
                onClick={() => setSelectedId(null)}
              >
                ×
              </button>
            </header>

            <div className="fcat-detail-merchant">
              <strong>{selected.name}</strong>
              <p className="fca-muted">{displayDate(selected.date)}</p>
            </div>
            <strong className="fcat-detail-amount">{signedAmount(selected)}</strong>

            <form className="fcat-editor" onSubmit={saveCategory}>
              <label>
                Category
                <select
                  value={draftCategory}
                  onChange={(event) => {
                    setDraftCategory(event.target.value);
                    setFeedback("");
                  }}
                >
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <div className="fcat-actions">
                <button type="submit" className="fcat-primary">Save changes</button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftCategory(selected.category);
                    setFeedback("");
                  }}
                >
                  Cancel changes
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className="fcat-danger"
                  onClick={() => deleteTransaction(selected)}
                >
                  Delete transaction
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      <footer className="fca-muted fcat-totals" aria-label="All transaction totals">
        <span>Total income {currency.format(totals.income)}</span>
        <span>Total expenses {currency.format(totals.expense)}</span>
        <span>Net balance {currency.format(totals.income - totals.expense)}</span>
      </footer>
    </div>
  );
}
export default function Transactions({ userId, hasLinkedAccounts, onViewAccounts }: {
  userId: string; hasLinkedAccounts: boolean; onViewAccounts: () => void;
}) {
  return <ManualTransactions key={userId} userId={userId} hasLinkedAccounts={hasLinkedAccounts} onViewAccounts={onViewAccounts} />;
}
