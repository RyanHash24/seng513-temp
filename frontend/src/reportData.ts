/** Presentation model only. The report API owner maps its authenticated response here. */
export type ReportFormat = 'csv' | 'pdf';
export type BusinessReport = {
  id: string;
  month: string;
  scope: 'business';
  currency: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  moneyInCents: number;
  moneyOutCents: number;
  netCashFlowCents: number;
  categories: { name: string; amountCents: number; sharePercent?: number }[];
  formats: ReportFormat[];
};
export type ReportFile = { blob: Blob; filename: string };
// Supply one stable adapter instance per signed-in account. Authenticate in the adapter.
export type ReportSource = {
  // null means a confirmed empty month. Unavailable services must reject instead.
  // Implementations supply complete business-only totals, not the first page of transactions.
  load: (request: { month: string; signal: AbortSignal }) => Promise<BusinessReport | null>;
  // Resolve fresh file access for every request; fetch the full original file in this adapter.
  // The file must match the immutable reportId and month returned by load.
  export: (request: { reportId: string; month: string; format: ReportFormat; signal: AbortSignal }) => Promise<ReportFile>;
};

export function validateBusinessReport(value: unknown, month: string): BusinessReport | null {
  if (value === null) return null;
  const report = value as BusinessReport | undefined;
  const validDay = (day: unknown) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
  if (!report || typeof report.id !== 'string' || !report.id.trim() || report.month !== month ||
    report.scope !== 'business' || !/^[A-Z]{3}$/.test(report.currency) ||
    !validDay(report.periodStart) || !validDay(report.periodEnd) || report.periodStart > report.periodEnd ||
    typeof report.generatedAt !== 'string' || !Number.isFinite(Date.parse(report.generatedAt)) ||
    ![report.moneyInCents, report.moneyOutCents, report.netCashFlowCents].every(Number.isSafeInteger) ||
    !Array.isArray(report.categories) || report.categories.some(category => !category ||
      typeof category.name !== 'string' || !category.name.trim() || !Number.isSafeInteger(category.amountCents) ||
      (category.sharePercent !== undefined && !Number.isFinite(category.sharePercent))) ||
    !Array.isArray(report.formats) || !report.formats.length || report.formats.some(format => !['csv', 'pdf'].includes(format))) {
    throw new Error('The report could not be read. Please try again.');
  }
  return report;
}

export const reportMoney = (cents: number, currency: string) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency, currencyDisplay: 'code',
}).format(cents / 100);
export const reportMonth = (month: string) => new Intl.DateTimeFormat('en-CA', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(month + '-01T00:00:00Z'));

export async function prepareReportFile(file: ReportFile, format: ReportFormat) {
  if (!(file?.blob instanceof Blob) || !file.blob.size) throw new Error('The report file is empty. Please try again.');
  const mime = file.blob.type.split(';')[0].toLowerCase();
  let previewText = '';
  if (format === 'pdf') {
    const header = await file.blob.slice(0, 5).text();
    if (header !== '%PDF-' || !['', 'application/pdf', 'application/octet-stream'].includes(mime))
      throw new Error('The file is not a valid PDF report. Please try again.');
  } else {
    if (!['', 'text/csv', 'application/csv', 'text/plain', 'application/octet-stream'].includes(mime))
      throw new Error('The file is not a CSV report. Please try again.');
    previewText = await file.blob.slice(0, 200_000).text();
    if (previewText.includes('\0') || /^\s*(?:<!doctype\s+html|<html|%PDF-)/i.test(previewText))
      throw new Error('The file is not a CSV report. Please try again.');
  }
  const leaf = (typeof file.filename === 'string' ? file.filename : '').split(/[/\\]/).at(-1) || 'finclear-business-report';
  const clean = leaf.replace(/[\p{Cc}<>:"|?*]/gu, '').replace(/^\.+/, '').slice(0, 160) || 'finclear-business-report';
  const filename = clean.toLowerCase().endsWith('.' + format) ? clean : clean.replace(/\.[^.]+$/, '') + '.' + format;
  return {
    blob: new Blob([file.blob], { type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8' }),
    filename, previewText, previewTruncated: format === 'csv' && file.blob.size > 200_000,
  };
}
