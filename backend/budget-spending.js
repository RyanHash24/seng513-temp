const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function spendingQuery(query) {
  const { start, end, accountIds } = query;
  if (!validDate(start) || !validDate(end) || start > end ||
      (Date.parse(end) - Date.parse(start)) / 86400000 > 366 || typeof accountIds !== 'string') return null;
  const ids = [...new Set(accountIds.split(','))];
  if (!ids.length || ids.length > 100 || !ids.every(uuid)) return null;
  return { start, end, accountIds: ids };
}

// Plaid personal-finance categories are mapped to the monthly-plan catalogue.
// A saved user category always takes precedence; unknown categories remain visible.
function spendingCategory(provider = '', group, category) {
  if (group && category) return { name: group, subcategory: category };
  const code = provider || '';
  const mappings = [
    ['GENERAL_MERCHANDISE_CLOTHING', 'Shopping', 'Clothing & shoes'],
    ['GENERAL_MERCHANDISE_ELECTRONICS', 'Shopping', 'Electronics'],
    ['GENERAL_MERCHANDISE_SUPERSTORES', 'Shopping', 'Home goods'],
    ['GENERAL_MERCHANDISE', 'Shopping', 'Other spending'],
    ['FOOD_AND_DRINK_GROCERIES', 'Food & drink', 'Groceries'],
    ['FOOD_AND_DRINK_COFFEE', 'Food & drink', 'Cafes'],
    ['FOOD_AND_DRINK_BEER', 'Food & drink', 'Alcohol'],
    ['FOOD_AND_DRINK', 'Food & drink', 'Dining out'],
    ['RENT_AND_UTILITIES_RENT', 'Home & bills', 'Rent'],
    ['RENT_AND_UTILITIES_TELEPHONE', 'Home & bills', 'Phone'],
    ['RENT_AND_UTILITIES_INTERNET', 'Home & bills', 'Wi-Fi'],
    ['RENT_AND_UTILITIES_GAS', 'Home & bills', 'Heating & gas'],
    ['RENT_AND_UTILITIES_WATER', 'Home & bills', 'Water & sewer'],
    ['RENT_AND_UTILITIES_ELECTRIC', 'Home & bills', 'Electricity'],
    ['RENT_AND_UTILITIES', 'Home & bills', 'Other spending'],
    ['HOME_IMPROVEMENT', 'Home & bills', 'Home repairs'],
    ['TRANSPORTATION_GAS', 'Transportation', 'Fuel'],
    ['TRANSPORTATION_PUBLIC', 'Transportation', 'Public transit'],
    ['TRANSPORTATION_TAXIS', 'Transportation', 'Rideshare & taxis'],
    ['TRANSPORTATION_PARKING', 'Transportation', 'Parking'],
    ['TRANSPORTATION_TOLLS', 'Transportation', 'Tolls'],
    ['TRANSPORTATION', 'Transportation', 'Other spending'],
    ['TRAVEL_FLIGHTS', 'Travel', 'Flights'],
    ['TRAVEL_LODGING', 'Travel', 'Accommodation'],
    ['TRAVEL', 'Travel', 'Other spending'],
    ['ENTERTAINMENT_TV', 'Subscriptions', 'TV & music streaming'],
    ['ENTERTAINMENT', 'Entertainment & recreation', 'Other spending'],
    ['MEDICAL_PHARMACIES', 'Health & wellness', 'Pharmacy'],
    ['MEDICAL_DENTAL', 'Health & wellness', 'Dental care'],
    ['MEDICAL_EYE', 'Health & wellness', 'Vision care'],
    ['MEDICAL', 'Health & wellness', 'Medical care'],
    ['PERSONAL_CARE', 'Personal care', 'Other spending'],
    ['BANK_FEES', 'Fees & taxes', 'Bank fees'],
    ['GOVERNMENT_AND_NON_PROFIT_DONATIONS', 'Gifts & giving', 'Charity & donations'],
    ['GOVERNMENT_AND_NON_PROFIT', 'Fees & taxes', 'Government fees'],
  ];
  const match = mappings.find(([prefix]) => code.startsWith(prefix));
  return match ? { name: match[1], subcategory: match[2] }
    : { name: 'Other expenses', subcategory: category || 'Other expenses' };
}

function spendingEntry(row) {
  // Sync normalizes BOTH card and checking purchases to negative cash flow.
  // Reverse that sign once: expenses consume the budget, refunds restore it.
  const amount = Number(row.spendingCents);
  if (!Number.isSafeInteger(amount)) throw new Error('Unsupported transaction amount');
  return { id: row.id, accountId: row.accountId, date: row.date, amount,
    merchant: row.merchantName || row.description,
    ...spendingCategory(row.providerCategory, row.groupName, row.categoryName), color: '#61d98f' };
}

async function readBudgetSpending(pool, userId, environment, filter) {
  const { rows } = await pool.query(`SELECT t.id,a.id AS "accountId",t.description,
    t.merchant_name AS "merchantName",(-t.amount*100)::text AS "spendingCents",
    to_char(t.booked_on,'YYYY-MM-DD') AS date,t.provider_category AS "providerCategory",
    c.name AS "categoryName",g.name AS "groupName"
    FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
    JOIN bank_connections b ON b.id=a.connection_id AND b.user_id=t.user_id
    LEFT JOIN categories c ON c.id=t.category_id AND c.user_id=t.user_id
    LEFT JOIN category_groups g ON g.id=c.group_id AND g.user_id=t.user_id
    WHERE t.user_id=$1 AND b.plaid_environment=$2 AND b.provider='plaid'
    AND a.id=ANY($3::uuid[]) AND a.archived_at IS NULL AND a.source='plaid'
    AND a.account_type IN ('cash','chequing','savings','credit_card')
    AND b.status IN ('connected','reconnect_required')
    AND t.currency='CAD' AND t.status='posted' AND t.kind IN ('expense','refund')
    AND COALESCE(t.provider_category,'') !~ '^(TRANSFER_IN|TRANSFER_OUT|LOAN_PAYMENTS|INCOME)(_|$)'
    AND t.booked_on >= $4::date AND t.booked_on <= $5::date AND t.booked_on <= CURRENT_DATE
    ORDER BY t.booked_on DESC,t.id DESC LIMIT 10001`,
  [userId, environment, filter.accountIds, filter.start, filter.end]);
  // Refuse an oversized response instead of presenting a partially counted budget.
  if (rows.length > 10000) throw new Error('Too many transactions in this period');
  const entries = rows.map(spendingEntry);
  const spent = entries.reduce((sum, entry) => sum + entry.amount, 0);
  if (!Number.isSafeInteger(spent)) throw new Error('Unsupported spending total');
  return { entries, spent };
}

module.exports = { spendingQuery, spendingCategory, spendingEntry, readBudgetSpending };
