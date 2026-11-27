import calendarIcon from "./assets/overview/calendar.svg";
import groceriesIcon from "./assets/overview/groceries.svg";
import transportIcon from "./assets/overview/transport.svg";
import { overviewPreview, type OverviewSnapshot } from "./overviewData";
import "./Dashboard.css";

type DashboardProps = {
  data?: OverviewSnapshot;
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
const chartColors = ["var(--overview-chart-green)", "var(--overview-chart-secondary)", "var(--overview-chart-gray)"];
const icons = { groceries: groceriesIcon, transport: transportIcon };
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
  data = overviewPreview,
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
  const remaining = data.period.allocated - data.period.spent;
  const scheduled = today < start.getTime();
  const status = scheduled ? "Plan scheduled" : today > end.getTime()
    ? "Cycle complete" : remaining < 0 ? "Over budget" : "Within budget";
  const percentage = data.period.allocated > 0
    ? (data.period.spent / data.period.allocated) * 100 : data.period.spent > 0 ? 100 : 0;
  const progress = Math.max(0, Math.min(100, percentage));
  const spending = data.spending.filter(item => item.amount > 0);
  const chartTotal = spending.reduce((total, item) => total + item.amount, 0);
  const chart = spending.reduce((result, item, index) => {
    const angle = index === spending.length - 1 ? 360 : result.angle + item.amount / chartTotal * 360;
    return { angle, stops: [...result.stops, `${chartColors[index % chartColors.length]} ${result.angle}deg ${angle}deg`] };
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
    ? shortDate.format(parseDay(data.viewer.trialEndsAt)) : null;
  const footer = [data.isPreview ? "Preview data" : null, updatedLabel,
    `${data.linkedAccountCount} linked account${data.linkedAccountCount === 1 ? "" : "s"}`, "All amounts in CAD"].filter(Boolean).join(" · ");

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
            <button type="button" className="fc-overview-cycle" onClick={onReviewBudget} disabled={!onReviewBudget} aria-label={`Review budget for ${periodLabel(start, end)}`}>
              {periodLabel(start, end)}
            </button>
            <p className="fc-overview-cycle-note fc-overview-muted"><span>Today · {todayLabel}</span><span aria-hidden="true">·</span><span>{`${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}</span></p>
            <p className={`fc-overview-cycle-status${remaining < 0 ? " fc-overview-budget-over" : ""}`}>{status}</p>
            <dl className="fc-overview-budget-stats">
              <div className="fc-overview-budget-stat"><dt>Spent</dt><dd>{summaryMoney(data.period.spent)}</dd></div>
              <div className="fc-overview-budget-stat"><dt>{remaining < 0 ? "Over budget" : "Left to spend"}</dt><dd className={remaining < 0 ? "fc-overview-budget-over" : undefined}>{summaryMoney(Math.abs(remaining))}</dd></div>
            </dl>
            <progress className="fc-overview-budget-track" aria-label="Percentage of budget spent" value={progress} max={100} />
            <div className="fc-overview-budget-caption"><span>Total allocated this month</span><span>{summaryMoney(data.period.allocated)}</span></div>
          </section>

          <section className="fc-overview-card fc-overview-activity-card" aria-labelledby="overview-activity-title">
            <header className="fc-overview-card-heading">
              <h2 id="overview-activity-title">Recent activity</h2>
              {onViewActivity && <button type="button" className="fc-overview-link" onClick={onViewActivity}>See all activity <span aria-hidden="true">→</span></button>}
            </header>
            {data.recentTransactions.length ? (
              <ul className="fc-overview-activity">
                {data.recentTransactions.map(transaction => (
                  <li key={transaction.id}>
                    <span className="fc-overview-merchant-icon"><img src={icons[transaction.icon]} alt="" /></span>
                    <div className="fc-overview-merchant"><strong>{transaction.merchant}</strong><p>{transaction.category} · {transaction.account}</p></div>
                    <time dateTime={transaction.date}>{shortDate.format(parseDay(transaction.date))}</time>
                    <span className={`fc-overview-transaction-amount${transaction.direction === "income" ? " fc-overview-positive" : ""}`}>{transaction.direction === "income" ? "+" : "−"}{money.format(Math.abs(transaction.amount))}</span>
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
              {spending.map((item, index) => <li key={item.category} className="fc-overview-legend-row"><span><span className="fc-overview-swatch" style={{ backgroundColor: chartColors[index % chartColors.length] }} aria-hidden="true" />{item.category}</span><span>{summaryMoney(item.amount)}</span></li>)}
            </ul> : <p className="fc-overview-empty">No spending this cycle.</p>}
          </section>
        </div>
      </div>
      <footer className="fc-overview-footer">{footer}</footer>
    </div>
  );
}
