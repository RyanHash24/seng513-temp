
import { useEffect, useState, type FormEvent } from "react";
import "./Budgets.css";
import type { AuthUser } from "./auth";

type Budget = {
  id: number;
  category: string;
  limit: number;
  spent: number;
};

const initialBudgets: Budget[] = [
  { id: 1, category: "Groceries", limit: 500, spent: 320 },
  { id: 2, category: "Entertainment", limit: 200, spent: 150 },
  { id: 3, category: "Transportation", limit: 300, spent: 90 },
  { id: 4, category: "Shopping", limit: 250, spent: 230 },
];

// Confirm this endpoint with Ryan before integration.
const REPORT_API_URL =
  "http://localhost:7070/api/reports/monthly";

const formatMoney = (amount: number) =>
  amount.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

function Budgets({user}: {user: AuthUser}) {
  const key = `finclear-budgets-${user.id}`;
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    try { const saved = localStorage.getItem(key); if (saved) return JSON.parse(saved); } catch { /* demo fallback */ }
    return user.permissions.maxBudgetCategories === null ? initialBudgets : initialBudgets.slice(0,user.permissions.maxBudgetCategories);
  });
  useEffect(()=>{ localStorage.setItem(key, JSON.stringify(budgets)); },[key,budgets]);
  const atLimit = user.permissions.maxBudgetCategories !== null && budgets.length >= user.permissions.maxBudgetCategories;

  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const totalBudget = budgets.reduce(
    (sum, budget) => sum + budget.limit,
    0
  );

  const totalSpent = budgets.reduce(
    (sum, budget) => sum + budget.spent,
    0
  );

  const remaining = totalBudget - totalSpent;

  async function downloadMonthlyReport() {
    if (downloading || !user.permissions.monthlyReports) return;

    setDownloading(true);
    setDownloadError("");

    // Open a tab immediately to avoid popup blockers.
    const reportTab = window.open("", "_blank");

    try {
      const access = await fetch("/api/account/report-access", {credentials:"same-origin"});
      if (!access.ok) throw new Error("Your current plan does not allow report downloads.");
      const response = await fetch(REPORT_API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Report request failed (${response.status}).`
        );
      }

      const data: unknown = await response.json();

      if (
        typeof data !== "object" ||
        data === null ||
        !("url" in data) ||
        typeof data.url !== "string"
      ) {
        throw new Error("Invalid report URL response.");
      }

      const reportUrl = new URL(data.url);

      if (reportUrl.protocol !== "https:") {
        throw new Error("Report URL must use HTTPS.");
      }

      if (reportTab) {
        reportTab.location.replace(reportUrl.href);
      } else {
        // Fallback when the browser blocks new tabs.
        window.location.assign(reportUrl.href);
      }
    } catch (error) {
      if (reportTab) reportTab.close();

      setDownloadError(
        error instanceof Error
          ? error.message
          : "Unable to download the monthly report."
      );
    } finally {
      setDownloading(false);
    }
  }

  function addBudget(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (atLimit) return;

    const amount = Number(limit);

    if (
      !category.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert("Enter a category and a valid budget amount.");
      return;
    }

    setBudgets((previous) => [
      ...previous,
      {
        id: Date.now(),
        category: category.trim(),
        limit: amount,
        spent: 0,
      },
    ]);

    setCategory("");
    setLimit("");
  }

  function deleteBudget(id: number) {
    if (window.confirm("Delete this budget?")) {
      setBudgets((previous) =>
        previous.filter((budget) => budget.id !== id)
      );
    }
  }

  function editBudget(id: number) {
    const budget = budgets.find((item) => item.id === id);
    if (!budget) return;

    const answer = window.prompt(
      `Enter a new monthly limit for ${budget.category}:`,
      String(budget.limit)
    );

    if (answer === null) return;

    const newLimit = Number(answer);

    if (
      !Number.isFinite(newLimit) ||
      newLimit <= 0
    ) {
      alert("Please enter a valid positive amount.");
      return;
    }

    setBudgets((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, limit: newLimit }
          : item
      )
    );
  }

  return (
    <div className="budgets-page">
      <h1>Budgets</h1>

      <p className="budgets-subtitle">
        Manage your monthly spending and stay on track.
      </p>

      <div className="budgets-summary">
        <div className="budget-panel">
          <p>Total Budget</p>
          <h2>{formatMoney(totalBudget)}</h2>
        </div>

        <div className="budget-panel">
          <p>Total Spent</p>
          <h2>{formatMoney(totalSpent)}</h2>
        </div>

        <div className="budget-panel">
          <p>Remaining Budget</p>
          <h2 className="budget-accent">
            {formatMoney(remaining)}
          </h2>
        </div>
      </div>

      <section className="budget-panel budget-create">
        <h3>Create New Budget</h3>
        {atLimit && <p>Your plan limit is reached. Delete a budget or upgrade to add another.</p>}

        <form className="budget-form" onSubmit={addBudget}>
          <input
            type="text"
            placeholder="Category name"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Monthly limit"
            value={limit}
            min="0.01"
            step="0.01"
            onChange={(e) => setLimit(e.target.value)}
            required
          />

          <button type="submit" disabled={atLimit}>
            + Add Budget
          </button>
        </form>
      </section>

      <section className="budget-panel budget-list">
        <h3>My Monthly Budgets</h3>

        <div className="budget-grid">
          {budgets.map((budget) => {
            const percentage =
              (budget.spent / budget.limit) * 100;

            const nearLimit = percentage >= 80;

            return (
              <div className="budget-card" key={budget.id}>
                <div className="budget-card-top">
                  <h3>{budget.category}</h3>

                  <button
                    className="budget-delete"
                    onClick={() => deleteBudget(budget.id)}
                  >
                    Delete
                  </button>
                </div>

                <p>
                  {formatMoney(budget.spent)} of{" "}
                  {formatMoney(budget.limit)}
                </p>

                <div className="budget-progress">
                  <div
                    className={
                      nearLimit
                        ? "budget-progress-fill budget-progress-warning"
                        : "budget-progress-fill"
                    }
                    style={{
                      width: `${Math.min(percentage, 100)}%`,
                    }}
                  />
                </div>

                <p className="budget-progress-label">
                  {percentage.toFixed(0)}% used
                </p>

                {nearLimit && (
                  <p className="budget-alert">
                    {percentage >= 100
                      ? "Budget limit reached or exceeded!"
                      : "You're approaching your budget limit."}
                  </p>
                )}

                <button
                  className="budget-edit"
                  onClick={() => editBudget(budget.id)}
                >
                  Edit Budget
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="budget-panel budget-report">
        <h3>Monthly Budget Report</h3>
        {!user.permissions.monthlyReports && <p>Available on Trial and Premium plans.</p>}

        <p>
          Download your monthly financial summary
          as a PDF report.
        </p>

        <button
          type="button"
          className="budget-report-button"
          onClick={downloadMonthlyReport}
          disabled={downloading || !user.permissions.monthlyReports}
        >
          {downloading
            ? "Preparing Report..."
            : "Download Monthly Report"}
        </button>

        {downloadError && (
          <p className="budget-report-error" role="alert">
            {downloadError}
          </p>
        )}
      </section>
    </div>
  );
}

export default Budgets;
