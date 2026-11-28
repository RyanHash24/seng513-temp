type Transaction = {
  id: number;
  name: string;
  category: string;
  date: string;
  type: "income" | "expense";
  amount: number;
};

type OverviewProps = {
  onViewActivity?: () => void;
  onReviewBudget?: () => void;
};

const transactions: Transaction[] = [
  { id: 1, name: "Groceries", category: "Food", date: "2026-11-05", type: "expense", amount: 85.5 },
  { id: 2, name: "Salary", category: "Income", date: "2026-11-01", type: "income", amount: 4500 },
  { id: 3, name: "Netflix", category: "Subscriptions", date: "2026-10-30", type: "expense", amount: 16.99 },
  { id: 4, name: "Coffee", category: "Food", date: "2026-10-28", type: "expense", amount: 6.5 },
];

const sampleMonth = "2026-11";
const sampleBudget = 3600;
const chartColors = [
  "var(--overview-chart-green)",
  "var(--overview-chart-amber)",
  "var(--overview-chart-gray)",
  "var(--overview-chart-blue)",
];

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const monthFormat = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const styles = `
  .fc-overview {
    --overview-background: var(--fc-background, #0b1512);
    --overview-surface: var(--fc-surface, #12221c);
    --overview-text: var(--fc-text, #eafaf0);
    --overview-muted: #9cb3a7;
    --overview-border: var(--fc-border, #263c31);
    --overview-accent: #60d68a;
    --overview-highlight: var(--fc-selected, #163d2a);
    --overview-chart-green: #60d68a;
    --overview-chart-amber: #ffac32;
    --overview-chart-gray: #879f93;
    --overview-chart-blue: #83c8dd;
    min-height: 100vh;
    background: var(--overview-background);
    color: var(--overview-text);
    font-family: "Inter Variable", Inter, sans-serif;
  }

  .fc-shell[data-theme="light"] .fc-overview {
    --overview-muted: var(--fc-muted, #526660);
    --overview-accent: var(--fc-accent, #217a43);
    --overview-chart-green: #217a43;
    --overview-chart-amber: #aa620c;
    --overview-chart-gray: #6f8a7f;
    --overview-chart-blue: #246b91;
  }

  .fc-overview * { box-sizing: border-box; }
  .fc-overview :is(h1, h2, p) { margin: 0; }

  .fc-overview-topbar,
  .fc-overview-heading,
  .fc-overview-card-heading,
  .fc-overview-plan-row,
  .fc-overview-legend-row,
  .fc-overview-budget-caption,
  .fc-overview-budget-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .fc-overview-topbar {
    min-height: 72px;
    padding: 0 40px;
    border-bottom: 1px solid var(--overview-border);
  }

  .fc-overview-topbar,
  .fc-overview-muted,
  .fc-overview-footer {
    color: var(--overview-muted);
    font-size: 13px;
  }

  .fc-overview-current { color: var(--overview-text); }
  .fc-overview-body { padding: 40px; }
  .fc-overview-heading { margin-bottom: 28px; }
  .fc-overview h1 { font-size: 30px; font-weight: 600; line-height: 1.25; }
  .fc-overview-heading p { margin-top: 8px; }

  .fc-overview-month {
    flex-shrink: 0;
    padding: 10px 14px;
    border: 1px solid var(--overview-border);
    border-radius: 8px;
    background: var(--overview-surface);
    font-size: 13px;
    font-weight: 600;
  }

  .fc-overview-grid {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 3fr);
    align-items: start;
    gap: 24px;
  }

  .fc-overview-column { display: grid; gap: 24px; min-width: 0; }

  .fc-overview-card {
    min-width: 0;
    padding: 24px;
    border: 1px solid var(--overview-border);
    border-radius: 12px;
    background: var(--overview-surface);
  }

  .fc-overview-card h2 { font-size: 17px; font-weight: 500; line-height: 1.4; }

  .fc-overview-budget {
    min-height: 240px;
    background: var(--overview-highlight);
  }

  .fc-overview-budget h2 {
    color: var(--overview-accent);
    font-size: 12px;
    font-weight: 650;
    text-transform: uppercase;
  }

  .fc-overview-budget-value {
    margin-top: 22px;
    font-size: clamp(30px, 4vw, 52px);
    font-weight: 650;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .fc-overview-budget-track {
    display: block;
    width: 100%;
    height: 8px;
    margin: 20px 0 16px;
    overflow: hidden;
    border: 0;
    border-radius: 99px;
    appearance: none;
    background: var(--overview-border);
    accent-color: var(--overview-accent);
  }

  .fc-overview-budget-track::-webkit-progress-bar {
    background: var(--overview-border);
  }

  .fc-overview-budget-track::-webkit-progress-value {
    border-radius: 99px;
    background: var(--overview-accent);
  }

  .fc-overview-budget-track::-moz-progress-bar {
    border-radius: 99px;
    background: var(--overview-accent);
  }

  .fc-overview .fc-overview-budget-note { margin-top: 16px; }

  .fc-overview-budget-caption,
  .fc-overview-card-heading,
  .fc-overview-budget-action { flex-wrap: wrap; }

  .fc-overview-plan { margin: 16px 0 0; }
  .fc-overview-plan-row { padding: 10px 0; font-size: 14px; }
  .fc-overview-plan-row dt { color: var(--overview-muted); }
  .fc-overview-plan-row dd { margin: 0; white-space: nowrap; }

  .fc-overview-plan-row:last-child {
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--overview-border);
  }

  .fc-overview-positive { color: var(--overview-accent); }
  .fc-overview-activity, .fc-overview-legend { margin: 12px 0 0; padding: 0; }

  .fc-overview-activity li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--overview-border);
    font-size: 14px;
  }

  .fc-overview-activity li:last-child { border-bottom: 0; }
  .fc-overview-activity li div { min-width: 0; overflow-wrap: anywhere; }
  .fc-overview-activity li p { margin-top: 4px; }
  .fc-overview-activity time { white-space: nowrap; }
  .fc-overview-transaction-amount { min-width: 80px; text-align: right; }

  .fc-overview-donut {
    display: grid;
    width: 158px;
    max-width: 100%;
    aspect-ratio: 1;
    place-items: center;
    margin: 20px auto;
    border-radius: 50%;
  }

  .fc-overview-donut-center {
    display: grid;
    width: 78%;
    height: 78%;
    align-content: center;
    gap: 4px;
    border-radius: 50%;
    background: var(--overview-surface);
    text-align: center;
  }

  .fc-overview-donut-center strong { font-size: 19px; }
  .fc-overview-legend { list-style: none; }
  .fc-overview-legend-row { padding: 7px 0; font-size: 13px; }

  .fc-overview-swatch {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 8px;
    border-radius: 2px;
  }

  .fc-overview .fc-overview-link {
    min-height: 36px;
    padding: 4px 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--fc-accent, #61d98f);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .fc-overview .fc-overview-link:hover { text-decoration: underline; }

  .fc-overview .fc-overview-link:focus-visible {
    outline: 2px solid var(--fc-accent, #61d98f);
    outline-offset: 3px;
  }

  .fc-overview-budget-action {
    margin-top: 24px;
    padding: 14px 20px;
    border: 1px solid var(--overview-border);
    border-radius: 8px;
    background: var(--overview-surface);
    font-size: 14px;
  }

  .fc-overview-footer { margin-top: 24px; line-height: 1.6; }

  @media (max-width: 1000px) {
    .fc-overview-grid { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 700px) {
    .fc-overview { min-height: auto; }
    .fc-overview-topbar { display: none; }
    .fc-overview-body { padding: 24px 20px; }
    .fc-overview-heading { align-items: flex-start; flex-direction: column; }
    .fc-overview-card { padding: 20px; }
    .fc-overview-activity li { gap: 8px; }
    .fc-overview-transaction-amount { min-width: 0; }
  }
`;

function sumByType(items: Transaction[], type: Transaction["type"]) {
  return items
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export default function Overview({
  onViewActivity,
  onReviewBudget,
}: OverviewProps) {
  const income = sumByType(transactions, "income");
  const expenses = sumByType(transactions, "expense");

  const monthlyTransactions = transactions.filter((transaction) =>
    transaction.date.startsWith(`${sampleMonth}-`),
  );
  const monthlyIncome = sumByType(monthlyTransactions, "income");
  const monthlyExpenses = sumByType(monthlyTransactions, "expense");
  const remaining = sampleBudget - monthlyExpenses;
  const availableToSave = Math.max(0, monthlyIncome - sampleBudget);
  const percentRemaining = Math.round((remaining / sampleBudget) * 100);
  const progress = Math.max(0, Math.min(100, percentRemaining));
  const month = monthFormat.format(new Date(`${sampleMonth}-01T00:00:00Z`));

  const recent = [...transactions]
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 5);

  const categoryTotals = new Map<string, number>();
  for (const transaction of monthlyTransactions) {
    if (transaction.type === "expense") {
      const total = categoryTotals.get(transaction.category) ?? 0;
      categoryTotals.set(transaction.category, total + transaction.amount);
    }
  }

  const categories = [...categoryTotals.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([name, amount], index) => ({
      name,
      amount,
      color: chartColors[index % chartColors.length],
    }));

  const { stops: chartStops } = categories.reduce(({ angle, stops }, { amount, color }, index) => {
    const end = index === categories.length - 1
      ? 360
      : angle + (amount / monthlyExpenses) * 360;
    return { angle: end, stops: [...stops, `${color} ${angle}deg ${end}deg`] };
  }, { angle: 0, stops: [] as string[] });

  const chartBackground = chartStops.length
    ? `conic-gradient(${chartStops.join(", ")})`
    : "var(--overview-border)";

  return (
    <div className="fc-overview">
      <style>{styles}</style>

      <header className="fc-overview-topbar">
        <span>
          Personal workspace / <span className="fc-overview-current">Overview</span>
        </span>
        <span>All amounts in CAD</span>
      </header>

      <div className="fc-overview-body">
        <header className="fc-overview-heading">
          <div>
            <h1>Overview</h1>
            <p className="fc-overview-muted">Your financial overview for {month}</p>
          </div>
          <span className="fc-overview-month">{month}</span>
        </header>

        <div className="fc-overview-grid">
          <div className="fc-overview-column">
            <section className="fc-overview-card fc-overview-budget">
              <h2>
                {remaining < 0 ? "Monthly budget exceeded by" : "Monthly budget remaining"}
              </h2>
              <div className="fc-overview-budget-value">
                {currency.format(Math.abs(remaining))}
              </div>
              <progress
                className="fc-overview-budget-track"
                aria-label="Percentage of monthly budget remaining"
                value={progress}
                max={100}
              />
              <div className="fc-overview-budget-caption">
                <span>{currency.format(monthlyExpenses)} spent</span>
                <span className="fc-overview-muted">
                  of {currency.format(sampleBudget)} planned
                </span>
              </div>
              <p className="fc-overview-muted fc-overview-budget-note">
                {remaining < 0
                  ? "Monthly spending is over budget."
                  : `${percentRemaining}% of your plan left`}
              </p>
            </section>

            <section className="fc-overview-card">
              <header className="fc-overview-card-heading">
                <h2>Recent activity</h2>
                {onViewActivity && (
                  <button type="button" className="fc-overview-link" onClick={onViewActivity}>
                    See all activity <span aria-hidden="true">→</span>
                  </button>
                )}
              </header>

              {recent.length === 0 ? (
                <p className="fc-overview-muted">No recent transactions.</p>
              ) : (
                <ul className="fc-overview-activity">
                  {recent.map((transaction) => {
                    const isIncome = transaction.type === "income";
                    const amountClass = isIncome ? " fc-overview-positive" : "";

                    return (
                      <li key={transaction.id}>
                        <div>
                          <strong>{transaction.name}</strong>
                          <p className="fc-overview-muted">{transaction.category}</p>
                        </div>
                        <time className="fc-overview-muted" dateTime={transaction.date}>
                          {dayFormat.format(new Date(`${transaction.date}T00:00:00Z`))}
                        </time>
                        <span className={`fc-overview-transaction-amount${amountClass}`}>
                          {isIncome ? "+" : "−"}{currency.format(transaction.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="fc-overview-column">
            <section className="fc-overview-card">
              <h2>Your monthly plan</h2>
              <dl className="fc-overview-plan">
                <div className="fc-overview-plan-row">
                  <dt>Monthly income</dt>
                  <dd>{currency.format(monthlyIncome)}</dd>
                </div>
                <div className="fc-overview-plan-row">
                  <dt>Spending plan</dt>
                  <dd>{currency.format(sampleBudget)}</dd>
                </div>
                <div className="fc-overview-plan-row">
                  <dt>Available to save</dt>
                  <dd className="fc-overview-positive">{currency.format(availableToSave)}</dd>
                </div>
              </dl>
            </section>

            <section className="fc-overview-card">
              <header className="fc-overview-card-heading">
                <h2>Where it went</h2>
                <span className="fc-overview-muted">This month</span>
              </header>

              <div className="fc-overview-donut" style={{ background: chartBackground }}>
                <div className="fc-overview-donut-center">
                  <strong>{currency.format(monthlyExpenses)}</strong>
                  <span className="fc-overview-muted">spent this month</span>
                </div>
              </div>

              {categories.length === 0 ? (
                <p className="fc-overview-muted">No spending this month.</p>
              ) : (
                <ul className="fc-overview-legend">
                  {categories.map(({ name, amount, color }) => (
                    <li className="fc-overview-legend-row" key={name}>
                      <span>
                        <span
                          className="fc-overview-swatch"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        {name}
                      </span>
                      <span>{currency.format(amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        {onReviewBudget && (
          <div className="fc-overview-budget-action">
            <span>Monthly budget</span>
            <button type="button" className="fc-overview-link" onClick={onReviewBudget}>
              Review budget <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        <footer className="fc-overview-footer">
          Sample data · All activity · Income {currency.format(income)} · Expenses{" "}
          {currency.format(expenses)} · Net balance {currency.format(income - expenses)}
        </footer>
      </div>
    </div>
  );
}
