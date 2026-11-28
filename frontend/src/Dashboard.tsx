import calendarIcon from "./assets/overview/calendar.svg";
import activityIcon from "./assets/navigation/activity.svg";
import type { OverviewSnapshot } from "./overviewData";
import "./Dashboard.css";

type DashboardProps = {
  data: OverviewSnapshot;
  unavailableAccounts: boolean;
  onViewActivity?: () => void;
  onReviewBudget?: () => void;
  onViewPlans?: () => void;
};

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const wholeMoney = new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD", maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
// Light and dark variants share a hue so the legend reads the same in either theme.
const chartColors = [
  "light-dark(#147549, #61d98f)", // Mint
  "light-dark(#2165ae, #70aaff)", // Blue
  "light-dark(#a34c08, #ffab59)", // Orange
  "light-dark(#7549ac, #bd96f5)", // Violet
  "light-dark(#bd3542, #ff7d81)", // Coral
  "light-dark(#007a83, #4ed3d9)", // Cyan
  "light-dark(#886900, #f1d254)", // Gold
  "light-dark(#ac387e, #ee92ce)", // Pink
  "light-dark(#5b7722, #b1ce60)", // Olive
  "light-dark(#617182, #a8b9c9)", // Slate
];
const dayMilliseconds = 86_400_000;

function parseDay(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function summaryMoney(amount: number) {
  return Number.isInteger(amount) ? wholeMoney.format(amount) : money.format(amount);
}

function periodLabel(start: Date, end: Date) {
  return start.getUTCFullYear() === end.getUTCFullYear()
    ? `${shortDate.format(start)} – ${shortDate.format(end)}, ${end.getUTCFullYear()}`
    : `${fullDate.format(start)} – ${fullDate.format(end)}`;
}

export default function Dashboard({
  data,
  unavailableAccounts,
  onViewActivity,
  onReviewBudget,
  onViewPlans,
}: DashboardProps) {
  const now = new Date(data.asOf);
  const start = parseDay(data.period.start);
  const end = parseDay(data.period.end);
  const localDate = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: data.timeZone,
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) => Number(localDate.find(item => item.type === name)?.value);
  const today = Date.UTC(part("year"), part("month") - 1, part("day"));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - today) / dayMilliseconds));
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "numeric", hourCycle: "h23", timeZone: data.timeZone,
  }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const month = new Intl.DateTimeFormat("en-CA", {
    month: "long", year: "numeric", timeZone: data.timeZone,
  }).format(now);
  const todayLabel = new Intl.DateTimeFormat("en-CA", {
    month: "short", day: "numeric", timeZone: data.timeZone,
  }).format(now);
  const remaining = (Math.round(data.period.allocated * 100) - Math.round(data.period.spent * 100)) / 100;
  const scheduled = today < start.getTime();
  const status = scheduled ? "Plan scheduled" : today > end.getTime()
    ? "Cycle complete" : remaining < 0 ? "Over budget" : "Within budget";
  const percentage = data.period.allocated > 0
    ? (data.period.spent / data.period.allocated) * 100 : data.period.spent > 0 ? 100 : 0;
  const progress = Math.max(0, Math.min(100, percentage));
  const positiveSpending = data.spending.filter(item => item.amount > 0);
  // Assign by name so a change in spending rank doesn't swap the category colors.
  const categoryColors = new Map(positiveSpending.map(item => item.category).sort().map((name, index) => {
    const hue = ((index - chartColors.length) * 137.508 + 24) % 360;
    const color = chartColors[index] ?? `light-dark(oklch(49% 0.13 ${hue}), oklch(78% 0.13 ${hue}))`;
    return [name, color];
  }));
  const spending = positiveSpending.map(item => ({ ...item, color: categoryColors.get(item.category)! }));
  const credits = data.spending.filter(item => item.amount < 0);
  const chartTotal = spending.reduce((total, item) => total + item.amount, 0);
  const chart = spending.reduce((result, item, index) => {
    const angle = index === spending.length - 1 ? 360 : result.angle + item.amount / chartTotal * 360;
    return { angle, stops: [...result.stops, `${item.color} ${result.angle}deg ${angle}deg`] };
  }, { angle: 0, stops: [] as string[] });
  const chartBackground = chart.stops.length
    ? `conic-gradient(${chart.stops.join(", ")})` : "var(--overview-border)";
  const elapsedMinutes = data.updatedAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(data.updatedAt).getTime()) / 60_000)) : null;
  const updatedLabel = elapsedMinutes === null ? null : elapsedMinutes === 0
    ? "Updated just now" : elapsedMinutes < 60
      ? `Updated ${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`
      : `Updated ${shortDate.format(new Date(data.updatedAt!))}`;
  const trialEnd = data.viewer.role === "trial" && data.viewer.trialEndsAt
    ? shortDate.format(new Date(data.viewer.trialEndsAt)) : null;
  const footer = [updatedLabel,
    `${data.linkedAccountCount} linked account${data.linkedAccountCount === 1 ? "" : "s"}`, "Budget amounts in CAD"].filter(Boolean).join(" · ");

  return (
    <div className="fc-overview">
      <header className="fc-overview-heading">
        <div>
          <h1>{`${greeting}, ${data.viewer.firstName}`}</h1>
          <p className="fc-overview-muted">{month} · A little more clarity on your month.</p>
        </div>
        <span className="fc-overview-month"><img src={calendarIcon} alt="" />{month}</span>
      </header>

      {trialEnd && (
        <div className="fc-overview-trial">
          <div className="fc-overview-trial-details"><span className="fc-overview-badge">TRIAL</span><span>Trial ends {trialEnd}</span></div>
          {onViewPlans && <button type="button" className="fc-overview-link" onClick={onViewPlans}>View plans <span aria-hidden="true">→</span></button>}
        </div>
      )}

      <div className="fc-overview-grid">
        <div className="fc-overview-column">
          <section className="fc-overview-card fc-overview-budget" aria-label="Current budget cycle">
            <button type="button" className="fc-overview-cycle" onClick={onReviewBudget} disabled={!onReviewBudget} aria-label="Review your budget">
              {periodLabel(start, end)}
            </button>
            <p className="fc-overview-cycle-note fc-overview-muted"><span>Today · {todayLabel}</span><span aria-hidden="true">·</span><span>{`${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}</span></p>
            <p className={`fc-overview-cycle-status${remaining < 0 ? " fc-overview-budget-over" : ""}`}>{status}</p>
            {unavailableAccounts && <p className="fc-overview-muted">A selected account is unavailable. Totals reflect available saved activity.</p>}
            <dl className="fc-overview-budget-stats">
              <div className="fc-overview-budget-stat"><dt>Spent</dt><dd>{summaryMoney(data.period.spent)}</dd></div>
              <div className="fc-overview-budget-stat"><dt>{remaining < 0 ? "Over budget" : "Left to spend"}</dt><dd className={remaining < 0 ? "fc-overview-budget-over" : undefined}>{summaryMoney(Math.abs(remaining))}</dd></div>
            </dl>
            <progress className="fc-overview-budget-track" aria-label="Percentage of budget spent" value={progress} max={100} />
            <div className="fc-overview-budget-caption"><span>Total allocated this month</span><span>{summaryMoney(data.period.allocated)}</span></div>
          </section>

          <section className="fc-overview-card fc-overview-activity-card" aria-labelledby="overview-activity-title">
            <header className="fc-overview-card-heading">
              <h2 id="overview-activity-title">Recent activity this cycle</h2>
              {onViewActivity && <button type="button" className="fc-overview-link" onClick={onViewActivity}>See all activity <span aria-hidden="true">→</span></button>}
            </header>
            {data.recentTransactions.length ? (
              <ul className="fc-overview-activity">
                {data.recentTransactions.map(transaction => (
                  <li key={transaction.id}>
                    <span className="fc-overview-merchant-icon"><img src={activityIcon} alt="" /></span>
                    <div className="fc-overview-merchant"><strong>{transaction.merchant}</strong><p>{transaction.category} · {transaction.account}</p></div>
                    <time dateTime={transaction.date}>{shortDate.format(parseDay(transaction.date))}</time>
                    <span className={`fc-overview-transaction-amount${transaction.amount > 0 ? " fc-overview-positive" : ""}`}>{new Intl.NumberFormat("en-CA", { style: "currency", currency: transaction.currency, currencyDisplay: transaction.currency === "CAD" ? "symbol" : "code", signDisplay: "exceptZero" }).format(transaction.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="fc-overview-empty">No recent transactions.</p>}
          </section>
        </div>

        <div className="fc-overview-column">
          <section className="fc-overview-card fc-overview-monthly-plan" aria-labelledby="overview-plan-title">
            <h2 id="overview-plan-title">Your monthly plan</h2>
            <dl className="fc-overview-plan">
              <div className="fc-overview-plan-row"><dt>Spent so far</dt><dd>{summaryMoney(data.period.spent)}</dd></div>
              <div className="fc-overview-plan-row"><dt>Total allocated</dt><dd>{summaryMoney(data.period.allocated)}</dd></div>
              <div className="fc-overview-plan-row"><dt>{remaining < 0 ? "Over budget" : "Left to spend"}</dt><dd>{summaryMoney(Math.abs(remaining))}</dd></div>
            </dl>
          </section>

          <section className="fc-overview-card fc-overview-spending" aria-labelledby="overview-spending-title">
            <h2 id="overview-spending-title">Where you spent</h2>
            <div className="fc-overview-donut" style={{ background: chartBackground }} role="img" aria-label={`Spending by category: ${spending.map(item => `${item.category} ${summaryMoney(item.amount)}`).join(", ") || "No spending"}`}>
              <div className="fc-overview-donut-center" aria-hidden="true"><strong>{summaryMoney(data.period.spent)}</strong><span>spent this cycle</span></div>
            </div>
            {spending.length ? <ul className="fc-overview-legend">
              {spending.map(item => <li key={item.category} className="fc-overview-legend-row"><span><span className="fc-overview-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.category}</span><span>{summaryMoney(item.amount)}</span></li>)}
            </ul> : !credits.length && <p className="fc-overview-empty">No spending this cycle.</p>}
            {credits.map(item => <p key={item.category} className="fc-overview-legend-row">
              <span>{item.category} · Net refunds</span><span>{summaryMoney(-item.amount)}</span>
            </p>)}
          </section>
        </div>
      </div>
      <footer className="fc-overview-footer">{footer}</footer>
    </div>
  );
}
