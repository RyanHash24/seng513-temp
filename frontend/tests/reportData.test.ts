import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareReportFile, reportMoney, validateBusinessReport, type BusinessReport } from '../src/reportData.ts';

const report: BusinessReport = { id: 'report-1', month: '2026-11', scope: 'business', currency: 'CAD',
  periodStart: '2026-11-01', periodEnd: '2026-11-27', generatedAt: '2026-11-27T15:00:00Z',
  moneyInCents: 0, moneyOutCents: 0, netCashFlowCents: 0, categories: [], formats: ['csv', 'pdf'] };

test('a confirmed empty month is distinct from an actual report with zero totals', () => {
  assert.equal(validateBusinessReport(null, '2026-11'), null);
  assert.equal(validateBusinessReport(report, '2026-11'), report);
  assert.throws(() => validateBusinessReport(undefined, '2026-11'));
});

test('report values preserve backend-provided signs, cents and category shares', () => {
  const value = { ...report, moneyInCents: 12345, moneyOutCents: -1025, netCashFlowCents: 13370,
    categories: [{ name: 'Refunds', amountCents: -1025, sharePercent: -10.25 }] };
  assert.deepEqual(validateBusinessReport(value, '2026-11'), value);
  assert.match(reportMoney(-1025, 'USD'), /-USD\s*10\.25/);
});

test('wrong-month, wrong-scope and malformed reports fail instead of displaying misleading totals', () => {
  for (const invalid of [{ ...report, month: '2026-10' }, { ...report, scope: 'personal' },
    { ...report, periodStart: '2026-02-31' }, { ...report, generatedAt: 'invalid' },
    { ...report, moneyOutCents: 10.25 }, { ...report, netCashFlowCents: Infinity },
    { ...report, formats: ['html'] }, { ...report, categories: [{ name: 'Bad', amountCents: 1, sharePercent: NaN }] }]) {
    assert.throws(() => validateBusinessReport(invalid, '2026-11'));
  }
});

test('CSV preparation keeps the original file and normalizes unsafe filenames', async () => {
  const csv = 'metric,amount\r\nIncome,123.45\r\nRefund,-10.25\r\n';
  const prepared = await prepareReportFile({ blob: new Blob([csv], { type: 'text/csv' }), filename: '../private/report.txt' }, 'csv');
  assert.equal(prepared.filename, 'report.csv');
  assert.equal(prepared.previewText, csv);
  assert.equal(await prepared.blob.text(), csv);
  assert.equal(prepared.previewTruncated, false);
});

test('file errors and HTML responses never become downloadable report previews', async () => {
  const prepare = (body: string, type: string, format: 'csv' | 'pdf' = 'csv') => prepareReportFile({ blob: new Blob([body], { type }), filename: 'file' }, format);
  await assert.rejects(prepare('', 'text/csv'), /empty/);
  await assert.rejects(prepare('<html>Service unavailable</html>', 'text/html'), /not a CSV/);
  await assert.rejects(prepare('<!DOCTYPE html><html>Error</html>', 'text/plain'), /not a CSV/);
  await assert.rejects(prepare('{"error":"Expired"}', 'application/json'), /not a CSV/);
  await assert.rejects(prepare('Not a PDF', 'application/pdf', 'pdf'), /not a valid PDF/);
  await assert.rejects(prepare('%PDF-1.7', 'text/html', 'pdf'), /not a valid PDF/);
});

test('truncated CSV previews retain the complete downloadable file and valid PDFs retain their bytes', async () => {
  const csv = 'a'.repeat(200_010);
  const large = await prepareReportFile({ blob: new Blob([csv], { type: 'text/csv' }), filename: 'large.csv' }, 'csv');
  assert.equal(large.previewTruncated, true);
  assert.equal(large.previewText.length, 200_000);
  assert.equal(await large.blob.text(), csv);
  const bytes = '%PDF-1.7\nfixture';
  const pdf = await prepareReportFile({ blob: new Blob([bytes], { type: 'application/octet-stream' }), filename: 'report.pdf' }, 'pdf');
  assert.equal(pdf.blob.type, 'application/pdf');
  assert.equal(await pdf.blob.text(), bytes);
});
