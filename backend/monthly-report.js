const path = require('node:path');
const { PDFDocument } = require('pdfkit');
const { spendingCategory } = require('./budget-spending');

function monthRange(month, now = new Date()) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month.startsWith('0000') || month > now.toISOString().slice(0, 7)) return null;
  const [year, number] = month.split('-').map(Number);
  const next = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
  return { month, start: `${month}-01`, end: `${next.padStart(7, '0')}-01` };
}

function budgetSnapshot(value, range) {
  if (value == null) return null;
  if (!value || typeof value.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.start) ||
      !Number.isFinite(Date.parse(value.start)) || new Date(value.start).toISOString().slice(0, 10) !== value.start ||
      value.start.slice(0, 7) > range.month || !Number.isSafeInteger(value.budget) || value.budget <= 0 ||
      !Array.isArray(value.categories) || value.categories.length > 100 ||
      value.categories.some(category => !category || typeof category.name !== 'string' ||
        !category.name.trim() || category.name.length > 100 || !Number.isSafeInteger(category.allocation) || category.allocation < 0) ||
      new Set(value.categories.map(category => category.name.trim().toLowerCase())).size !== value.categories.length ||
      value.categories.reduce((total, category) => total + BigInt(category.allocation), 0n) !== BigInt(value.budget) ||
      !Array.isArray(value.accountIds) || !value.accountIds.length || value.accountIds.length > 100 ||
      !value.accountIds.every(id => typeof id === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))) {
    throw Object.assign(new Error('Save a valid, fully allocated budget with selected accounts before downloading its report.'), { status: 422 });
  }
  return { start: value.start, budget: value.budget, categories: value.categories, accountIds: [...new Set(value.accountIds)] };
}

async function readMonthlyTransactions(pool, userId, environment, range, budget = null) {
  if (budget) {
    const { rows: accounts } = await pool.query(`SELECT a.id FROM accounts a
      LEFT JOIN bank_connections b ON b.id=a.connection_id AND b.user_id=a.user_id
      WHERE a.user_id=$1 AND a.id=ANY($3::uuid[]) AND a.scope='personal' AND a.currency='CAD'
      AND a.account_type IN ('cash','chequing','savings','credit_card')
      AND (a.source='manual' OR (a.source='plaid' AND b.provider='plaid' AND b.plaid_environment=$2))`,
    [userId, environment, budget.accountIds]);
    if (accounts.length !== budget.accountIds.length) {
      throw Object.assign(new Error('Some budget accounts are unavailable. Review your selected accounts.'), { status: 422 });
    }
  }
  const { rows } = await pool.query(`SELECT t.id, t.description, t.merchant_name AS "merchantName",
    (t.amount * 100)::numeric(20,0)::text AS cents, t.currency, t.kind,
    to_char(t.booked_on, 'YYYY-MM-DD') AS date, a.name AS "accountName",
    c.name AS "categoryName", g.name AS "groupName", t.provider_category AS "providerCategory"
    FROM transactions t
    JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
    LEFT JOIN bank_connections b ON b.id=a.connection_id AND b.user_id=t.user_id
    LEFT JOIN categories c ON c.id=t.category_id AND c.user_id=t.user_id
    LEFT JOIN category_groups g ON g.id=c.group_id AND g.user_id=t.user_id
    WHERE t.user_id=$1 AND t.status='posted' AND t.scope='personal'
    AND a.scope='personal' AND a.account_type IN ('cash','chequing','savings','credit_card')
    AND (a.source='manual' OR (a.source='plaid' AND b.provider='plaid' AND b.plaid_environment=$2))
    AND ($5::uuid[] IS NULL OR a.id=ANY($5::uuid[]))
    AND t.booked_on >= $3::date AND t.booked_on < $4::date AND t.booked_on <= CURRENT_DATE
    ORDER BY t.booked_on, t.id LIMIT 10001`, [userId, environment, range.start, range.end, budget?.accountIds ?? null]);
  if (rows.length > 10000) {
    throw Object.assign(new Error('This month exceeds the 10,000 transaction report limit. Contact support for an export.'), { status: 422 });
  }
  return rows;
}

function money(cents, currency) {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  return `${currency} ${sign}${(absolute / 100n).toLocaleString('en-CA')}.${String(absolute % 100n).padStart(2, '0')}`;
}

function summarize(rows) {
  const currencies = new Map();
  for (const row of rows) {
    const amount = BigInt(row.cents);
    const summary = currencies.get(row.currency) || { income: 0n, expenses: 0n, refunds: 0n, transfers: 0n, categories: new Map() };
    if (row.kind === 'income') summary.income += amount;
    if (row.kind === 'transfer') summary.transfers += amount;
    if (row.kind === 'expense') summary.expenses -= amount;
    if (row.kind === 'refund') summary.refunds += amount;
    if (['expense', 'refund'].includes(row.kind)) {
      const category = spendingCategory(row.providerCategory, row.groupName, row.categoryName).name;
      summary.categories.set(category, (summary.categories.get(category) || 0n) - amount);
    }
    currencies.set(row.currency, summary);
  }
  return currencies;
}

function clean(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

async function monthlyReportPdf(user, range, environment, rows, budget = null) {
  const summaries = summarize(rows);
  const doc = new PDFDocument({ size: 'A4', margin: 48,
    info: { Title: `FinClear Monthly Budget Report ${range.month}`, Author: 'FinClear' } });
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.registerFont('Body', path.join(__dirname, 'fonts/NotoSans-Regular.ttf'));
  let page = 0;
  function header() {
    page += 1;
    doc.font('Body').fontSize(10).fillColor('#21734a')
      .text(`FINCLEAR  /  ${range.month}  /  Page ${page}`, 48, 26, { width: 499 });
    doc.y = 58;
    doc.x = 48;
    doc.fillColor('#182b22').fontSize(10);
  }
  doc.on('pageAdded', header);
  header();
  function heading(title) {
    if (doc.y > 720) doc.addPage();
    doc.moveDown().fontSize(15).fillColor('#21734a').text(title);
    doc.moveDown(0.5).fontSize(10).fillColor('#182b22');
  }
  doc.fontSize(23).text('Monthly Budget Report');
  doc.moveDown(0.4).fontSize(12).text(new Intl.DateTimeFormat('en-CA', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${range.start}T00:00:00Z`)));
  doc.moveDown().fontSize(10).text(`Prepared for ${clean(user.firstName)} ${clean(user.lastName)}`);
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)} | ${rows.length} posted transactions`);
  doc.moveDown().fillColor('#52645a').text('Personal cash, chequing, savings and credit card activity. Includes saved history from archived accounts. Pending and removed transactions are excluded. Each currency is totaled separately.');
  if (environment === 'sandbox') doc.moveDown(0.5).text('Bank environment: Sandbox. Connected bank transactions in this report are test data.');
  if (budget) {
    heading('Your budget - CAD');
    doc.text(`Plan starts ${budget.start}. Comparison uses your current browser-saved plan and its selected accounts. Targets may differ from historical plans. Activity covers the full calendar month.`);
    const summary = summaries.get('CAD');
    const spent = (summary?.expenses || 0n) - (summary?.refunds || 0n);
    const remaining = BigInt(budget.budget) - spent;
    doc.moveDown(0.5).text(`Monthly target    ${money(BigInt(budget.budget), 'CAD')}`);
    doc.text(`Actual net spending    ${money(spent, 'CAD')}`);
    doc.text(`Remaining budget    ${money(remaining, 'CAD')}`);
    heading('Category budget comparison');
    const actuals = new Map([...(summary?.categories || [])].map(([name, amount]) => [name.toLowerCase(), amount]));
    for (const category of budget.categories) {
      doc.text(`${clean(category.name)} | Target ${money(BigInt(category.allocation), 'CAD')} | Actual ${money(actuals.get(category.name.trim().toLowerCase()) || 0n, 'CAD')}`);
    }
  }
  if (!rows.length) {
    heading('No transactions this month');
    doc.text('No posted transactions were found for your accounts in the selected month.');
  }
  for (const [currency, summary] of [...summaries].sort(([a], [b]) => a.localeCompare(b))) {
    heading(`Summary - ${currency}`);
    for (const [label, amount] of [
      ['Income', summary.income], ['Expenses', summary.expenses], ['Refunds', summary.refunds],
      ['Net spending', summary.expenses - summary.refunds],
      ['Income less net spending', summary.income - summary.expenses + summary.refunds],
      ['Transfers (separate from spending)', summary.transfers],
    ]) doc.text(`${label}    ${money(amount, currency)}`);
    if (summary.categories.size) {
      heading(`Spending by category - ${currency}`);
      for (const [category, amount] of [...summary.categories].sort(([a], [b]) => a.localeCompare(b))) {
        doc.text(`${clean(category)}    ${money(amount, currency)}`);
      }
    }
  }
  if (rows.length) {
    heading('Transaction history');
    for (const row of rows) {
      if (doc.y > 680) doc.addPage();
      doc.fillColor('#21734a').text(`${row.date}  |  ${row.kind}  |  ${money(BigInt(row.cents), row.currency)}`);
      doc.fillColor('#182b22').text(clean(row.description));
      if (row.merchantName && row.merchantName !== row.description) doc.text(`Merchant: ${clean(row.merchantName)}`);
      const category = row.categoryName || row.providerCategory || 'Uncategorized';
      doc.fillColor('#52645a').text(`${clean(row.accountName)}  |  ${clean(category)}`).moveDown(0.8);
    }
  }
  doc.end();
  return result;
}

function monthlyReportHandler(pool, environment) {
  return async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const range = monthRange(req.query.month);
    if (!range) return res.status(400).json({ error: 'Choose a valid month in YYYY-MM format, up to the current month.' });
    if (!['sandbox', 'production'].includes(environment) || req.get('X-Plaid-Environment') !== environment) {
      return res.status(409).json({ error: 'The bank environment changed. Reload this page before downloading.' });
    }
    try {
      const budget = budgetSnapshot(req.body?.budget, range);
      const rows = await readMonthlyTransactions(pool, req.user.id, environment, range, budget);
      const pdf = await monthlyReportPdf(req.user, range, environment, rows, budget);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="FinClear_Monthly_Budget_${range.month}.pdf"`);
      res.send(pdf);
    } catch (error) {
      res.status(error.status === 422 ? 422 : 503).json({ error: error.status === 422 ? error.message : 'Unable to generate your monthly report. Please try again.' });
    }
  };
}

module.exports = { monthRange, budgetSnapshot, readMonthlyTransactions, summarize, monthlyReportPdf, monthlyReportHandler };
