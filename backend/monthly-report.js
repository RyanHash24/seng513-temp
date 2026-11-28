const path = require('node:path');
const { PDFDocument } = require('pdfkit');
const { spendingCategory, readBudgetSpending } = require('./budget-spending');

function monthRange(month, now = new Date(), timeZone = 'UTC') {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 80) return null;
  let localDay;
  try {
    localDay = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch { return null; }
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month.startsWith('0000') || month > localDay.slice(0, 7)) return null;
  const [year, number] = month.split('-').map(Number);
  const next = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
  return { month, start: `${month}-01`, end: `${next.padStart(7, '0')}-01` };
}

// Compare the plan saved by the end of the statement month, through that date
// (or today for an in-progress statement). Preserve month-end anchors such as Jan 31.
function cycleAt(anchor, day) {
  if (anchor > day) return null;
  const date = new Date(day + 'T00:00:00Z');
  const anchorDay = Number(anchor.slice(8));
  const anniversary = offset => {
    const month = date.getUTCMonth() + offset;
    const last = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(date.getUTCFullYear(), month, Math.min(anchorDay, last)));
  };
  const offset = anniversary(0) > date ? -1 : 0;
  return { start: anniversary(offset).toISOString().slice(0, 10),
    end: new Date(anniversary(offset + 1).getTime() - 86400000).toISOString().slice(0, 10) };
}

async function readReportBudget(pool, userId, environment, range, timeZone = 'UTC') {
  const { rows: [plan] } = await pool.query(`SELECT to_char(starts_on,'YYYY-MM-DD') AS start,
    limit_cents AS budget, categories, account_ids AS "accountIds",
    to_char(LEAST((now() AT TIME ZONE $4)::date, $3::date - 1),'YYYY-MM-DD') AS "asOf"
    FROM monthly_budget_plans WHERE user_id=$1 AND environment=$2
    AND saved_at < ($3::date::timestamp AT TIME ZONE $4) ORDER BY revision DESC LIMIT 1`,
    [userId, environment, range.end, timeZone]);
  if (!plan) return null;
  const cycle = cycleAt(plan.start, plan.asOf);
  if (!cycle) return null;
  const { entries, spent } = plan.accountIds.length
    ? await readBudgetSpending(pool, userId, environment, { accountIds: plan.accountIds, start: cycle.start, end: plan.asOf })
    : { entries: [], spent: 0 };
  const actuals = new Map();
  for (const entry of entries) {
    addCategorySpending(actuals, entry.name, entry.subcategory, BigInt(entry.amount), entry.name.trim().toLowerCase());
  }
  return { ...plan, cycle, spent: BigInt(spent), actuals };
}

async function readMonthlyTransactions(pool, userId, environment, range, timeZone = 'UTC') {
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
    AND t.booked_on >= $3::date AND t.booked_on < $4::date AND t.booked_on <= (now() AT TIME ZONE $5)::date
    ORDER BY t.booked_on, t.id LIMIT 10001`, [userId, environment, range.start, range.end, timeZone]);
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

function addCategorySpending(categories, name, subcategory, amount, key = name) {
  const detail = categories.get(key) || { name, amount: 0n, subcategories: new Map() };
  detail.amount += amount;
  detail.subcategories.set(subcategory, (detail.subcategories.get(subcategory) || 0n) + amount);
  categories.set(key, detail);
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
      const { name, subcategory } = spendingCategory(row.providerCategory, row.groupName, row.categoryName);
      addCategorySpending(summary.categories, name, subcategory, -amount);
    }
    currencies.set(row.currency, summary);
  }
  return currencies;
}

function clean(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

async function monthlyReportPdf(user, range, environment, rows, budget = null) {
  rows = [...rows].sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  const summaries = summarize(rows);
  const doc = new PDFDocument({ size: 'A4', margin: 42,
    info: { Title: `FinClear Monthly Budget Report ${range.month}`, Author: 'FinClear' } });
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.registerFont('Body', path.join(__dirname, 'fonts/NotoSans-Regular.ttf'));
  const logoPath = path.join(__dirname, 'assets/finclear-logo.png');
  const C = { ink: '#132720', muted: '#718078', green: '#147A52', dark: '#0E3026', mint: '#E7F4EC', pale: '#F5F8F5', line: '#DCE6DF', white: '#FFFFFF', amber: '#A15C12', red: '#A43E36' };
  const left = 42;
  const right = 553;
  const contentWidth = right - left;
  let page = 0;
  function header() {
    page += 1;
    doc.save().rect(0, 0, 595.28, 10).fill(C.green).restore();
    doc.image(logoPath, left, 20, { cover: [18, 23], align: 'center', valign: 'center' });
    doc.font('Body').fontSize(11).fillColor('#0B1512').text('FinClear', left + 25, 25, { characterSpacing: 0 });
    doc.fontSize(8).fillColor(C.muted).text(`${range.month}  ·  MONTHLY STATEMENT  ·  ${page}`, left, 27, { width: contentWidth, align: 'right' });
    doc.save().moveTo(left, 43).lineTo(right, 43).strokeColor(C.line).lineWidth(0.7).stroke().restore();
    doc.y = 58;
    doc.x = left;
    doc.fillColor(C.ink).fontSize(9);
  }
  doc.on('pageAdded', header);
  header();
  function ensure(height = 55) {
    if (doc.y + height > 748) doc.addPage();
  }
  function heading(title, subtitle = '') {
    ensure(58);
    doc.moveDown(0.6).fontSize(12).fillColor(C.ink).text(title, left, doc.y, { width: contentWidth });
    if (subtitle) doc.moveDown(0.2).fontSize(8).fillColor(C.muted).text(subtitle, left, doc.y, { width: contentWidth });
    doc.moveDown(0.4);
  }
  function card(x, y, width, height, fill = C.pale) {
    doc.save().roundedRect(x, y, width, height, 8).fill(fill).restore();
  }
  function metric(x, y, width, label, value, tint = C.ink, note = '') {
    const valueText = String(value);
    doc.fontSize(7).fillColor(C.muted).text(label.toUpperCase(), x + 12, y + 12, { width: width - 24, characterSpacing: 0.5 });
    const valueFontSize = valueText.length > 14 ? 8 : valueText.length > 11 ? 9 : 12;
    doc.fontSize(valueFontSize).fillColor(tint)
      .text(valueText, x + 12, y + 31, { width: width - 24, lineBreak: false, ellipsis: true });
    if (note) doc.fontSize(7).fillColor(C.muted).text(note, x + 12, y + 51, { width: width - 24, lineBreak: false, ellipsis: true });
  }
  function rowLine(y) {
    doc.save().moveTo(left, y).lineTo(right, y).strokeColor(C.line).lineWidth(0.45).stroke().restore();
  }
  function budgetMeter(x, y, width, value, total) {
    doc.save().roundedRect(x, y, width, 6, 3).fill(C.line).restore();
    const ratio = total > 0n ? Number(value > 0n ? value : 0n) / Number(total) : 0;
    if (ratio > 0) doc.save().roundedRect(x, y, width * Math.min(ratio, 1), 6, 3).fill(ratio > 1 ? C.red : C.green).restore();
  }

  const monthLabel = new Intl.DateTimeFormat('en-CA', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${range.start}T00:00:00Z`));
  // Cover summary panel
  const heroY = doc.y;
  doc.save().roundedRect(left, heroY, contentWidth, 116, 10).fill(C.dark).restore();
  doc.fontSize(8).fillColor('#BCE4CC').text('PERSONAL FINANCE  /  MONTHLY OVERVIEW', left + 18, heroY + 16, { characterSpacing: 0.6 });
  doc.fontSize(22).fillColor(C.white).text(monthLabel, left + 18, heroY + 35, { width: 330 });
  doc.fontSize(9).fillColor('#E1EEE6').text(`Prepared for ${clean(user.firstName)} ${clean(user.lastName)}`, left + 18, heroY + 68);
  doc.fontSize(8).fillColor('#B9CEC1').text(`${rows.length} posted transactions  ·  Generated ${new Date().toISOString().slice(0, 10)}`, left + 18, heroY + 86);
  doc.save().roundedRect(right - 90, heroY + 17, 72, 22, 11).fill(environment === 'sandbox' ? '#765325' : '#1D6149').restore();
  doc.fontSize(7).fillColor(C.white).text(environment === 'sandbox' ? 'SANDBOX' : 'PERSONAL', right - 90, heroY + 24, { width: 72, align: 'center', characterSpacing: 0.4 });
  doc.y = heroY + 132;
  doc.fontSize(8).fillColor(C.muted).text('A personalized view of posted cash, chequing, savings and credit card activity. Archived account history is included. Pending and removed transactions are excluded.', left, doc.y, { width: contentWidth, lineGap: 2 });
  doc.moveDown(0.65);
  if (environment === 'sandbox') {
    doc.save().roundedRect(left, doc.y, contentWidth, 26, 5).fill('#FFF4DE').restore();
    doc.fontSize(8).fillColor(C.amber).text('SANDBOX DATA  ·  Connected bank transactions in this statement are test data.', left + 10, doc.y + 8, { width: contentWidth - 20 });
    doc.y += 36;
  }

  const cad = summaries.get('CAD');
  const netSpend = (cad?.expenses || 0n) - (cad?.refunds || 0n);
  const cardY = doc.y;
  const gap = 9;
  const cardW = (contentWidth - gap * 4) / 5;
  [
    ['EXPENSES', money(cad?.expenses || 0n, 'CAD'), C.ink],
    ['REFUNDS', money(cad?.refunds || 0n, 'CAD'), C.ink],
    ['NET SPENDING', money(netSpend, 'CAD'), netSpend > 0n ? C.ink : C.green],
    ['INCOME', money(cad?.income || 0n, 'CAD'), C.green],
    ['TRANSACTIONS', String(rows.length), C.ink],
  ].forEach(([label, value, tint], index) => {
    const x = left + index * (cardW + gap);
    card(x, cardY, cardW, 69, label === 'NET SPENDING' ? C.mint : C.pale);
    metric(x, cardY, cardW, label, value, tint);
  });
  doc.y = cardY + 82;

  if (budget) {
    const { cycle, spent } = budget;
    heading('Monthly budget', `Plan cycle ${cycle.start} to ${cycle.end} · ${budget.accountIds.length} selected accounts`);
    const statementEnd = new Date(`${range.end}T00:00:00Z`);
    statementEnd.setUTCDate(statementEnd.getUTCDate() - 1);
    const statementEndLabel = statementEnd.toISOString().slice(0, 10);
    doc.fontSize(7).fillColor(C.muted).text(`The statement covers all eligible personal accounts from ${range.start} to ${statementEndLabel}. The budget includes spending on selected accounts from ${cycle.start} through ${budget.asOf}.`, left, doc.y, { width: contentWidth });
    doc.moveDown(0.5);
    const remaining = BigInt(budget.budget) - spent;
    const overviewY = doc.y;
    card(left, overviewY, contentWidth, 76, C.pale);
    metric(left + 4, overviewY, 155, 'Monthly target', money(BigInt(budget.budget), 'CAD'));
    metric(left + 174, overviewY, 155, 'Actual net spending', money(spent, 'CAD'), spent > BigInt(budget.budget) ? C.red : C.ink);
    metric(left + 348, overviewY, 155, 'Budget remaining', money(remaining, 'CAD'), remaining < 0n ? C.red : C.green);
    budgetMeter(left + 14, overviewY + 62, contentWidth - 28, spent, BigInt(budget.budget));
    doc.y = overviewY + 88;
    heading('Category breakdown', 'Actuals reflect posted expenses less refunds, compared with your saved category targets.');
    const comparisons = new Map(budget.categories.map(category => [category.name.trim().toLowerCase(), { ...category }]));
    for (const [key, detail] of budget.actuals) {
      const category = comparisons.get(key) || { name: detail.name, allocation: 0 };
      category.detail = detail;
      comparisons.set(key, category);
    }
    for (const category of comparisons.values()) {
      const detail = category.detail;
      const subcategories = [...(detail?.subcategories || [])].filter(([, amount]) => amount !== 0n);
      ensure(35 + (subcategories.length ? 24 : 0));
      const target = BigInt(category.allocation);
      const actual = detail?.amount || 0n;
      const y = doc.y;
      doc.fontSize(8).fillColor(C.ink).text(clean(category.name), left, y, { width: 190, lineBreak: false, ellipsis: true });
      doc.fontSize(7).fillColor(C.muted).text(`Target ${money(target, 'CAD')}   ·   Actual ${money(actual, 'CAD')}`, left + 214, y, { width: contentWidth - 214, align: 'right' });
      budgetMeter(left, y + 17, contentWidth, actual, target);
      doc.y = y + 29;
      for (const [subcategory, amount] of subcategories.sort(([a], [b]) => a.localeCompare(b))) {
        ensure(18);
        doc.fontSize(7).fillColor(C.muted).text(clean(subcategory), left + 18, doc.y, { width: 254, lineBreak: false, ellipsis: true });
        doc.fontSize(7).fillColor(C.ink).text(money(amount, 'CAD'), right - 110, doc.y, { width: 110, align: 'right' });
        doc.y += 15;
      }
      doc.y += 5;
    }
    if (!budget.actuals.size) {
      ensure(28);
      doc.fontSize(7).fillColor(C.muted).text('No posted purchases or refunds counted toward this budget cycle.', left, doc.y, { width: contentWidth });
      doc.moveDown(0.5);
    }
  }
  if (!rows.length) {
    heading('No activity recorded', 'No posted transactions were found for your accounts in this calendar month.');
  }
  for (const [currency, summary] of [...summaries].sort(([a], [b]) => a.localeCompare(b))) {
    ensure(currency === 'CAD' ? 76 : 125);
    if (currency !== 'CAD') heading(`Other currency · ${currency}`, 'Currencies are reported separately and are not converted.');
    const overviewY = doc.y;
    const metrics = [
      ['Expenses', summary.expenses], ['Refunds', summary.refunds], ['Income', summary.income], ['Net spending', summary.expenses - summary.refunds],
      ['Cash flow', summary.income - summary.expenses + summary.refunds],
    ];
    const metricGap = 7;
    const metricW = (contentWidth - metricGap * (metrics.length - 1)) / metrics.length;
    metrics.forEach(([label, amount], index) => {
      const x = left + index * (metricW + metricGap);
      card(x, overviewY, metricW, 61, C.pale);
      metric(x, overviewY, metricW, label, money(amount, currency));
    });
    doc.y = overviewY + 71;
    if (summary.categories.size) {
      const categories = [...summary.categories].sort((a, b) => a[1].amount > b[1].amount ? -1 : a[1].amount < b[1].amount ? 1 : a[0].localeCompare(b[0]));
      const max = categories.reduce((largest, [, detail]) => detail.amount > largest ? detail.amount : largest, 1n);
      ensure(110);
      heading(`Spending by category · ${currency}`);
      for (const [category, detail] of categories) {
        ensure(55);
        const y = doc.y;
        doc.fontSize(8).fillColor(C.ink).text(clean(category), left, y, { width: 190, lineBreak: false, ellipsis: true });
        doc.fontSize(8).fillColor(C.ink).text(money(detail.amount, currency), right - 115, y, { width: 115, align: 'right' });
        doc.save().roundedRect(left, y + 14, contentWidth, 4, 2).fill(C.line).restore();
        const ratio = Number(detail.amount > 0n ? detail.amount : 0n) / Number(max);
        doc.save().roundedRect(left, y + 14, contentWidth * ratio, 4, 2).fill(C.green).restore();
        doc.y = y + 21;
        for (const [subcategory, amount] of [...detail.subcategories].sort(([a], [b]) => a.localeCompare(b))) {
          ensure(18);
          doc.fontSize(7).fillColor(C.muted).text(clean(subcategory), left + 18, doc.y, { width: 314, lineBreak: false, ellipsis: true });
          doc.fontSize(7).fillColor(C.muted).text(money(amount, currency), right - 110, doc.y, { width: 110, align: 'right' });
          doc.y += 14;
        }
        doc.y += 4;
      }
    }
    if (summary.transfers !== 0n) {
      ensure(28);
      doc.fontSize(8).fillColor(C.muted).text(`Transfers (excluded from spending)   ${money(summary.transfers, currency)}`, left, doc.y, { width: contentWidth });
      doc.moveDown(0.5);
    }
  }
  if (rows.length) {
    if (doc.y + 100 > 748) doc.addPage();
    heading('Transaction ledger', `${rows.length} posted transactions · Sorted by transaction date · Amounts shown in source currency`);
    function ledgerHeader() {
      const y = doc.y;
      doc.save().roundedRect(left, y, contentWidth, 23, 4).fill(C.dark).restore();
      doc.fontSize(7).fillColor(C.white);
      doc.text('DATE', left + 9, y + 8, { width: 55 });
      doc.text('DESCRIPTION', left + 69, y + 8, { width: 207 });
      doc.text('ACCOUNT / CATEGORY', left + 286, y + 8, { width: 125 });
      doc.text('AMOUNT', left + 416, y + 8, { width: 85, align: 'right' });
      doc.y = y + 29;
    }
    ledgerHeader();
    for (const [index, row] of rows.entries()) {
      const desc = clean(row.merchantName || row.description);
      const classification = spendingCategory(row.providerCategory, row.groupName, row.categoryName);
      const label = row.kind === 'expense' || row.kind === 'refund'
        ? `${classification.name} / ${classification.subcategory}` : row.kind;
      const detail = `${clean(row.accountName)} · ${clean(label)}`;
      const additional = row.merchantName && row.merchantName !== row.description ? clean(row.description) : '';
      const descHeight = Math.min(230, doc.fontSize(8).heightOfString(desc, { width: 196, lineGap: 1 }));
      const extraHeight = additional ? Math.min(250, doc.fontSize(6.5).heightOfString(additional, { width: 196, lineGap: 1 })) : 0;
      const detailHeight = Math.min(480, doc.fontSize(6.5).heightOfString(detail, { width: 119, lineGap: 1 }));
      const height = Math.max(44, descHeight + extraHeight + 20, detailHeight + 12);
      if (doc.y + height > 750) {
        doc.addPage();
        heading('Transaction ledger · continued');
        ledgerHeader();
      }
      const y = doc.y;
      if (index % 2 === 1) doc.save().rect(left, y - 4, contentWidth, height).fill('#F7FAF8').restore();
      doc.fontSize(7).fillColor(C.muted).text(row.date, left + 8, y + 4, { width: 55 });
      const kindLabel = ({ expense: 'Purchase', refund: 'Refund', income: 'Income', transfer: 'Transfer' })[row.kind] || 'Activity';
      doc.fontSize(6.5).fillColor(row.kind === 'refund' ? C.green : C.muted).text(kindLabel.toUpperCase(), left + 69, y + 2, { width: 196 });
      doc.fontSize(8).fillColor(C.ink).text(desc, left + 69, y + 12, { width: 196, height: descHeight + 1, ellipsis: true, lineGap: 1 });
      if (additional) {
        doc.fontSize(6.5).fillColor(C.muted).text(additional, left + 69, y + 13 + descHeight, { width: 196, height: extraHeight + 1, ellipsis: true, lineGap: 1 });
      }
      doc.fontSize(6.5).fillColor(C.muted).text(detail, left + 286, y + 3, { width: 119, height: detailHeight + 1, ellipsis: true, lineGap: 1 });
      doc.fontSize(8).fillColor(row.kind === 'income' || row.kind === 'refund' ? C.green : C.ink)
        .text(money(BigInt(row.cents), row.currency), left + 410, y + 3, { width: 91, align: 'right', lineBreak: false, ellipsis: true });
      doc.y = y + height;
      rowLine(doc.y);
      doc.y += 5;
    }
  }
  doc.end();
  return result;
}

async function reportData(pool, userId, environment, range, timeZone) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const budget = await readReportBudget(client, userId, environment, range, timeZone);
    const rows = await readMonthlyTransactions(client, userId, environment, range, timeZone);
    await client.query('COMMIT');
    return { budget, rows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function monthlyReportHandler(pool, environment) {
  return async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const timeZone = req.query.timeZone ?? 'UTC';
    const range = monthRange(req.query.month, new Date(), timeZone);
    if (!range) return res.status(400).json({ error: 'Choose a valid month in YYYY-MM format, up to the current month.' });
    if (!['sandbox', 'production'].includes(environment) || req.get('X-Plaid-Environment') !== environment) {
      return res.status(409).json({ error: 'The bank environment changed. Reload this page before downloading.' });
    }
    const expectedUser = req.get('X-FinClear-User');
    if (expectedUser && expectedUser !== req.user.id) {
      return res.status(409).json({ error: 'Your sign-in changed. Reload before downloading.' });
    }
    try {
      const { budget, rows } = await reportData(pool, req.user.id, environment, range, timeZone);
      const pdf = await monthlyReportPdf(req.user, range, environment, rows, budget);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="FinClear_Monthly_Budget_${range.month}.pdf"`);
      res.send(pdf);
    } catch (error) {
      res.status(error.status === 422 ? 422 : 503).json({ error: error.status === 422 ? error.message : 'Unable to generate your monthly report. Please try again.' });
    }
  };
}

module.exports = { monthRange, cycleAt, readReportBudget, readMonthlyTransactions, summarize, monthlyReportPdf, monthlyReportHandler };
