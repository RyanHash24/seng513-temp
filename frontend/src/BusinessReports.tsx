import { useRef } from "react";
import reportsIcon from "./assets/navigation/reports.svg";
import WorkspaceEmptyState, { EmptyStateCard } from "./WorkspaceEmptyState";

const month = "October 2026";
const income = 8400;

const categories = [
  { name: "Supplies", amount: 2400 },
  { name: "Software", amount: 1250 },
  { name: "Travel", amount: 900 },
  { name: "Other", amount: 600 },
];

const expenses = categories.reduce((total, category) => total + category.amount, 0);
const netCashFlow = income - expenses;

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const cashFlow = [
  { key: "income", label: "Money in", amount: income, note: "Business income · " + month },
  { key: "expenses", label: "Money out", amount: expenses, note: "Business expenses · " + month },
  { key: "net", label: "Net cash flow", amount: netCashFlow, note: "Money in minus money out" },
];

function formatCashFlow(item: (typeof cashFlow)[number]) {
  const prefix = item.key === "net" && item.amount > 0 ? "+" : "";
  return prefix + currency.format(item.amount);
}

const csv = [
  "month,metric,amount_cad",
  ...cashFlow.map(({ label, amount }) => [month, label, amount].join(",")),
  ...categories.map(({ name, amount }) => [month, name, amount].join(",")),
].join("\r\n");

function downloadCsv() {
  const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = "finclear-business-report-2026-10.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const styles = `
  .fc-business-reports {
    --report-background: var(--fc-background, #0b1512);
    --report-surface: var(--fc-surface, #12221c);
    --report-border: var(--fc-border, #263c31);
    --report-text: var(--fc-text, #eafaf0);
    --report-muted: var(--fc-muted, #9bb0a3);
    --report-accent: var(--fc-accent, #60d68a);
    --report-selected: var(--fc-selected, #163d2a);
    --report-subtle: var(--fc-subtle, #172a22);
    --report-income: #60d68a;
    --report-expenses: #879f93;
    --report-net: #36b64b;
    padding: 40px;
    background: var(--report-background);
    color: var(--report-text);
    color-scheme: var(--fc-color-scheme, dark);
  }

  .fc-shell[data-theme="light"] .fc-business-reports {
    --report-income: #217a43;
    --report-expenses: #60726e;
    --report-net: #528c6a;
  }

  .fc-business-reports * { box-sizing: border-box; }
  .fc-business-reports :is(h1, h2, p) { margin: 0; }

  .fcr-header,
  .fcr-heading,
  .fcr-tools,
  .fcr-bar-label,
  .fcr-dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .fcr-header, .fcr-heading, .fcr-tools, .fcr-dialog-actions { flex-wrap: wrap; }
  .fcr-header h1 { font-size: 30px; font-weight: 600; }
  .fc-business-reports .fcr-header p { margin-top: 8px; }
  .fcr-muted, .fcr-footer { color: var(--report-muted); font-size: 13px; }

  .fcr-month,
  .fc-business-reports button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid var(--report-border);
    border-radius: 8px;
    background: var(--report-surface);
    color: var(--report-text);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
  }

  .fc-business-reports button { cursor: pointer; }

  .fc-business-reports .fcr-primary {
    border-color: var(--report-accent);
    background: var(--report-accent);
    color: var(--fc-on-accent, #0b1512);
  }

  .fcr-primary img {
    display: block;
    flex-shrink: 0;
    filter: brightness(0.18);
  }

  .fc-shell[data-theme="light"] .fcr-primary img {
    filter: brightness(0) invert(1);
  }

  .fc-business-reports button:focus-visible {
    outline: 2px solid var(--report-accent);
    outline-offset: 3px;
  }

  .fc-business-reports .fcr-scope { margin: 26px 0 20px; }

  .fcr-badge {
    display: inline-block;
    margin-right: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--report-selected);
    color: var(--report-accent);
    font-size: 11px;
    font-weight: 600;
  }

  .fcr-summary, .fcr-content { display: grid; gap: 20px; }
  .fcr-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }

  .fcr-content {
    grid-template-columns: minmax(0, 5fr) minmax(0, 3fr);
    align-items: start;
    margin-top: 28px;
  }

  .fcr-card {
    min-width: 0;
    overflow: hidden;
    padding: 24px;
    border: 1px solid var(--report-border);
    border-radius: 12px;
    background: var(--report-surface);
  }

  .fcr-card h2 { font-size: 17px; font-weight: 500; }
  .fcr-highlight { background: var(--report-selected); }

  .fcr-amount {
    display: block;
    margin: 10px 0;
    font-size: 30px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .fcr-highlight .fcr-amount { color: var(--report-accent); }
  .fcr-table-card { padding: 0; }
  .fcr-table-card .fcr-heading { padding: 24px; }
  .fcr-table { width: 100%; border-collapse: collapse; font-size: 13px; }

  .fcr-table th, .fcr-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--report-border);
    text-align: right;
  }

  .fcr-table th:first-child { text-align: left; }

  .fcr-table thead {
    background: var(--report-subtle);
    color: var(--report-muted);
    font-size: 11px;
    text-transform: uppercase;
  }

  .fcr-table tbody th { width: 60%; font-weight: 500; }
  .fcr-table td { white-space: nowrap; }
  .fcr-table tfoot tr > * { border-bottom: 0; }

  .fcr-track {
    height: 6px;
    margin-top: 8px;
    overflow: hidden;
    border-radius: 8px;
    background: var(--report-border);
  }

  .fcr-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--report-income);
  }

  .fcr-fill[data-series="expenses"] { background: var(--report-expenses); }
  .fcr-fill[data-series="net"] { background: var(--report-net); }
  .fcr-bar + .fcr-bar { margin-top: 16px; }
  .fcr-bar-label { font-size: 13px; }
  .fc-business-reports .fcr-comparison-subtitle { margin: 12px 0 20px; }
  .fc-business-reports .fcr-footer { margin-top: 20px; }

  .fcr-dialog {
    width: min(540px, calc(100% - 32px));
    max-height: calc(100% - 32px);
    padding: 24px;
    border: 1px solid var(--report-border);
    border-radius: 12px;
    background: var(--report-surface);
    color: var(--report-text);
  }

  .fcr-dialog::backdrop { background: rgb(0 0 0 / 65%); }

  .fcr-dialog pre {
    overflow: auto;
    padding: 16px;
    border: 1px solid var(--report-border);
    border-radius: 8px;
    background: var(--report-background);
    color: var(--report-text);
  }

  .fcr-dialog-actions { justify-content: flex-end; }

  @media (max-width: 900px) {
    .fcr-content { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 700px) {
    .fc-business-reports { padding: 24px 20px; }
    .fcr-summary { grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .fcr-table th, .fcr-table td { padding: 10px 8px; }
  }
`;

// Kept as a standalone design preview until the report API supplies user data.
// The signed-in application must never substitute these fixtures for a user's report.
export function BusinessReportsPreview() {
  const previewRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="fc-business-reports">
      <style>{styles}</style>

      <header className="fcr-header">
        <div>
          <h1>Business reports</h1>
          <p className="fcr-muted">Morgan’s workspace · A clearer picture of your business.</p>
        </div>
        <div className="fcr-tools">
          <span className="fcr-month">{month}</span>
          <button
            type="button"
            className="fcr-primary"
            onClick={() => previewRef.current?.showModal()}
          >
            <img src={reportsIcon} alt="" />
            Export report · CSV
          </button>
        </div>
      </header>

      <p className="fcr-scope fcr-muted">
        <span className="fcr-badge">Business</span>
        Business transactions only · Sample data
      </p>

      <section className="fcr-summary" aria-label="Month-to-date cash flow">
        {cashFlow.map((item) => (
          <article
            key={item.key}
            className={item.key === "net" ? "fcr-card fcr-highlight" : "fcr-card"}
          >
            <p className="fcr-muted">{item.label}</p>
            <strong className="fcr-amount">{formatCashFlow(item)}</strong>
            <p className="fcr-muted">{item.note}</p>
          </article>
        ))}
      </section>

      <div className="fcr-content">
        <section className="fcr-card fcr-table-card" aria-labelledby="fcr-categories">
          <header className="fcr-heading">
            <h2 id="fcr-categories">Spending by category</h2>
            <span className="fcr-muted">{month}</span>
          </header>

          <table className="fcr-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Amount</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(({ name, amount }) => {
                const share = (amount / expenses) * 100;

                return (
                  <tr key={name}>
                    <th scope="row">
                      {name}
                      <div className="fcr-track" aria-hidden="true">
                        <span className="fcr-fill" style={{ width: share + "%" }} />
                      </div>
                    </th>
                    <td>{currency.format(amount)}</td>
                    <td>{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total money out</th>
                <td colSpan={2}>{currency.format(expenses)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="fcr-card" aria-labelledby="fcr-comparison">
          <h2 id="fcr-comparison">In, out, and what’s left</h2>
          <p className="fcr-muted fcr-comparison-subtitle">{month} · Month to date</p>

          {cashFlow.map((item) => {
            const percentage = (item.amount / income) * 100;

            return (
              <div className="fcr-bar" key={item.key}>
                <div className="fcr-bar-label">
                  <span className="fcr-muted">{item.label}</span>
                  <span>{formatCashFlow(item)}</span>
                </div>
                <div className="fcr-track" aria-hidden="true">
                  <span
                    className="fcr-fill"
                    data-series={item.key}
                    style={{ width: percentage + "%" }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <p className="fcr-footer">All amounts in CAD · Percentages rounded.</p>

      <dialog className="fcr-dialog" ref={previewRef} aria-labelledby="fcr-export-title">
        <h2 id="fcr-export-title">Report export preview</h2>
        <p className="fcr-muted">{month} · Sample business transactions</p>
        <pre>{csv}</pre>

        <div className="fcr-dialog-actions">
          <form method="dialog">
            <button type="submit">Cancel</button>
          </form>
          <button type="button" className="fcr-primary" onClick={downloadCsv}>
            Download CSV
          </button>
        </div>
      </dialog>
    </div>
  );
}

export default function BusinessReports({ onViewBudget, onViewAccounts, hasLinkedAccounts }: {
  onViewBudget: () => void; onViewAccounts: () => void; hasLinkedAccounts: boolean;
}) {
  return <WorkspaceEmptyState label="Business reports">
    <EmptyStateCard title="No reports yet" action="View your budget" onAction={onViewBudget}>
      <p>Your monthly reports will appear here once a report has been generated for your account.</p>
    </EmptyStateCard>
    {!hasLinkedAccounts && <EmptyStateCard title="Start with your accounts" action="Connect an account" onAction={onViewAccounts}>
      <p>Connect your accounts to bring your balances and transaction history into FinClear.</p>
    </EmptyStateCard>}
  </WorkspaceEmptyState>;
}
