import { useRef, useState } from 'react';
import downloadIcon from './assets/reports/download.svg';
import calendarIcon from './assets/overview/calendar.svg';
import { currentMonth } from './activityData';
import { reportMoney, reportMonth, type ReportFormat, type ReportSource } from './reportData';
import { useBusinessReport } from './useBusinessReport';
import ReportExportPreview from './ReportExportPreview';
import './BusinessReports.css';

type Props = {
  onViewBudget: () => void;
  onViewAccounts: () => void;
  hasLinkedAccounts: boolean;
  accountsLoading?: boolean;
  accountsError?: string;
  onRetryAccounts?: () => void;
  // Deliberately unconfigured until the API owner supplies the authenticated adapter.
  source?: ReportSource | null;
};

export default function BusinessReports({ onViewBudget, onViewAccounts, hasLinkedAccounts,
  accountsLoading = false, accountsError = '', onRetryAccounts, source = null }: Props) {
  const [month, setMonth] = useState(currentMonth);
  const result = useBusinessReport(source, month);
  const report = result.report;
  const [preferredFormat, setPreferredFormat] = useState<ReportFormat>('csv');
  const format = report?.formats.includes(preferredFormat) ? preferredFormat : report?.formats[0] ?? 'csv';
  const [preview, setPreview] = useState<{ reportId: string; month: string; format: ReportFormat } | null>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const exportExplanation = result.kind === 'loading' ? 'Wait for the report to finish loading.' : result.kind === 'error'
    ? 'Retry loading the report before exporting.' : 'A generated report is needed before export is available.';
  const cashFlow = report ? [
    { key: 'income', label: 'Money in', amount: report.moneyInCents, note: `Business income · ${reportMonth(report.month)}` },
    { key: 'expenses', label: 'Money out', amount: report.moneyOutCents, note: `Business expenses · ${reportMonth(report.month)}` },
    { key: 'net', label: 'Net cash flow', amount: report.netCashFlowCents, note: 'Money in minus money out' },
  ] : [];
  const chartScale = Math.max(1, ...cashFlow.map(item => Math.abs(item.amount)));
  const flowMoney = (amount: number, net = false) => `${net && amount > 0 ? '+' : ''}${reportMoney(amount, report!.currency)}`;
  function closePreview() { setPreview(null); exportButton.current?.focus(); }
  return <div className="fc-business-reports">
    <header className="fcr-header"><div><h1>Business reports</h1><p className="fcr-muted">A clearer picture of your business.</p></div><div className="fcr-tools">
      <label className="fcr-month"><img src={calendarIcon} alt="" /><span className="fcr-sr-only">Report month</span><input type="month" aria-label="Report month" min="0001-01" max="9999-12" value={month} disabled={!source} onInput={event => {
        if (event.currentTarget.validity.valid && /^\d{4}-\d{2}$/.test(event.currentTarget.value)) { setMonth(event.currentTarget.value); setPreview(null); }
      }} /></label>
      {source && <button type="button" onClick={result.reload} disabled={result.kind === 'loading'}>Refresh report</button>}
      {report && report.formats.length > 1 && <label className="fcr-format"><span className="fcr-sr-only">Report file format</span><select aria-label="Report file format" value={format} onChange={event => setPreferredFormat(event.currentTarget.value as ReportFormat)}>{[...new Set<ReportFormat>(report.formats)].map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>}
      <button type="button" ref={exportButton} className="fcr-primary" disabled={result.kind !== 'ready'} aria-describedby={result.kind !== 'ready' ? 'fcr-export-unavailable' : undefined} onClick={() => report && setPreview({ reportId: report.id, month, format })}><img src={downloadIcon} alt="" />Export report · {format.toUpperCase()}</button>
    </div></header>
    {result.kind !== 'ready' && <p id="fcr-export-unavailable" className="fcr-sr-only">{exportExplanation}</p>}
    {result.kind === 'unavailable' && <section className="fcr-card fcr-state" aria-labelledby="fcr-unavailable-title"><h2 id="fcr-unavailable-title">Reports aren’t available yet</h2><p>Your monthly business reports and exports will appear here once reporting is connected.</p><button type="button" onClick={onViewBudget}>View your budget</button></section>}
    {result.kind === 'loading' && <section className="fcr-card fcr-state" role="status" aria-live="polite"><h2>Loading your report…</h2><p>{reportMonth(month)} · Business transactions</p><div className="fcr-loading-bars" aria-hidden="true"><span /><span /><span /></div></section>}
    {result.kind === 'error' && <section className="fcr-card fcr-state" role="alert"><h2>Couldn’t load your report</h2><p>{result.error}</p><button type="button" className="fcr-primary" onClick={result.reload}>Try again</button></section>}
    {result.kind === 'empty' && <section className="fcr-card fcr-state"><h2>No business reports yet</h2><p>No generated business report is available for {reportMonth(month)}. Manage your accounts or choose another month.</p><button type="button" onClick={onViewAccounts}>Manage accounts</button></section>}
    {result.kind === 'ready' && report && <>
      <p className="fcr-scope"><span className="fcr-badge">Business</span>Business transactions only · {reportMonth(report.month)} · {report.currency}</p>
      <section className="fcr-summary" aria-label="Reported cash flow">{cashFlow.map(item => <article key={item.key} className={`fcr-card${item.key === 'net' ? ' fcr-highlight' : ''}`}><p className="fcr-muted">{item.label}</p><strong className={`fcr-amount${item.amount < 0 ? ' fcr-negative' : ''}`}>{flowMoney(item.amount, item.key === 'net')}</strong><p className="fcr-muted">{item.note}</p></article>)}</section>
      <div className="fcr-content"><section className="fcr-card fcr-table-card" aria-labelledby="fcr-categories"><header className="fcr-heading"><h2 id="fcr-categories">Spending by category</h2><span className="fcr-muted">{reportMonth(report.month)}</span></header><div className="fcr-table-scroll" tabIndex={0} role="region" aria-label="Report category breakdown"><table className="fcr-table"><caption className="fcr-sr-only">Reported business category amounts and shares in {report.currency}.</caption><thead><tr><th scope="col">Category</th><th scope="col">Amount</th><th scope="col">Share</th></tr></thead><tbody>{report.categories.length ? report.categories.map((category, index) => <tr key={`${category.name}-${index}`}><th scope="row">{category.name}{category.sharePercent !== undefined && <div className="fcr-track" aria-hidden="true"><span className="fcr-fill" style={{ width: `${Math.min(100, Math.max(0, category.sharePercent))}%` }} /></div>}</th><td>{reportMoney(category.amountCents, report.currency)}</td><td>{category.sharePercent === undefined ? '—' : `${category.sharePercent.toFixed(1)}%`}</td></tr>) : <tr><td colSpan={3}>No category breakdown was supplied for this report.</td></tr>}</tbody><tfoot><tr><th scope="row">Total money out</th><td colSpan={2}>{reportMoney(report.moneyOutCents, report.currency)}</td></tr></tfoot></table></div></section>
        <section className="fcr-card" aria-labelledby="fcr-comparison"><h2 id="fcr-comparison">In, out, and what’s left</h2><p className="fcr-muted fcr-comparison-subtitle">{reportMonth(report.month)} · Reported totals</p>{cashFlow.map(item => <div className="fcr-bar" key={item.key}><div className="fcr-bar-label"><span className="fcr-muted">{item.label}</span><span>{flowMoney(item.amount, item.key === 'net')}</span></div><div className="fcr-track" aria-hidden="true"><span className="fcr-fill" data-series={item.key} data-negative={item.amount < 0 ? 'true' : undefined} style={{ width: `${Math.abs(item.amount) / chartScale * 100}%` }} /></div></div>)}</section>
      </div>
      <p className="fcr-footer">Business transactions only · {report.periodStart} – {report.periodEnd} · Amounts in {report.currency} · Percentages rounded.{` Generated ${new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.generatedAt))}`}</p>
    </>}
    {!accountsLoading && !accountsError && !hasLinkedAccounts && result.kind === 'unavailable' && <section className="fcr-card fcr-state"><h2>Start with your accounts</h2><p>Manage connected accounts and imported transaction history in Accounts.</p><button type="button" onClick={onViewAccounts}>Manage accounts</button></section>}
    {accountsError && <p className="fcr-account-error" role="status">Account status is unavailable. {onRetryAccounts && <button type="button" onClick={onRetryAccounts}>Retry account status</button>}</p>}
    {preview && source && report && preview.reportId === report.id && preview.month === month && <ReportExportPreview key={`${report.id}:${month}:${preview.format}`} report={report} format={preview.format} source={source} onClose={closePreview} />}
  </div>;
}
