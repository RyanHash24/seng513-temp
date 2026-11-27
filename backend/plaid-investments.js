function optionalNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid investment amount');
  return String(value);
}

function investmentFields(transaction, securities) {
  if (!transaction.investment_transaction_id || !transaction.account_id ||
      !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date || '') || !transaction.type ||
      (transaction.iso_currency_code != null && !/^[A-Z]{3}$/.test(transaction.iso_currency_code))) {
    throw new Error('Invalid investment transaction');
  }
  const security = securities.get(transaction.security_id);
  optionalNumber(transaction.amount);
  return {
    amount: transaction.amount == null ? null : optionalNumber(-transaction.amount),
    currency: transaction.iso_currency_code || null,
    unofficialCurrency: transaction.unofficial_currency_code || null,
    quantity: optionalNumber(transaction.quantity), price: optionalNumber(transaction.price),
    fees: optionalNumber(transaction.fees), securityName: security?.name || null,
    ticker: security?.ticker_symbol || null,
  };
}

async function fetchInvestmentActivity(request, connection, accountIds, startDate, endDate) {
  // investment history uses offset pagination, not the transactions sync cursor.
  // restart if history changes while paging. never save a partially fetched batch.
  for (let attempt = 0; attempt < 3; attempt++) {
    const transactions = [], securities = new Map(), seen = new Set();
    let total, changed = false;
    for (let page = 0; page < 1000; page++) {
      const data = await request('/investments/transactions/get', {
        access_token: connection.accessToken, start_date: startDate, end_date: endDate,
        options: { account_ids: accountIds, count: 500, offset: transactions.length },
      });
      if (!Array.isArray(data.investment_transactions) || !Array.isArray(data.securities) ||
          !Number.isSafeInteger(data.total_investment_transactions) || data.total_investment_transactions < 0) {
        throw new Error('Invalid investment history response');
      }
      if (total !== undefined && total !== data.total_investment_transactions) { changed = true; break; }
      total = data.total_investment_transactions;
      for (const security of data.securities) securities.set(security.security_id, security);
      for (const transaction of data.investment_transactions) {
        const key = `${transaction.account_id}:${transaction.investment_transaction_id}`;
        if (seen.has(key)) { changed = true; break; }
        seen.add(key); transactions.push(transaction);
      }
      if (changed) break;
      if (transactions.length > total) throw new Error('Invalid investment pagination');
      if (transactions.length === total) return { transactions, securities };
      if (!data.investment_transactions.length) throw new Error('Investment pagination did not advance');
    }
    if (!changed) throw new Error('Investment pagination did not finish');
  }
  throw new Error('Investment history changed during pagination. Retry shortly.');
}

async function syncInvestments(client, connection, request, now = new Date()) {
  const { rows } = await client.query(`SELECT id,provider_account_id FROM accounts
    WHERE connection_id=$1 AND user_id=$2 AND source='plaid' AND account_type='investment' AND archived_at IS NULL`,
    [connection.id, connection.user_id]);
  if (!rows.length) throw Object.assign(new Error('No investment accounts are saved for this connection.'), { status: 409 });
  const end = now.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()));
  const { transactions, securities } = await fetchInvestmentActivity(request, connection,
    rows.map(account => account.provider_account_id), start.toISOString().slice(0, 10), end);
  const accounts = new Map(rows.map(account => [account.provider_account_id, account]));
  const counts = { added: 0, modified: 0, unchanged: 0, skipped: 0 };
  for (const transaction of transactions) {
    const account = accounts.get(transaction.account_id);
    if (!account) { counts.skipped++; continue; }
    const fields = investmentFields(transaction, securities);
    const values = [connection.user_id, account.id, transaction.investment_transaction_id, transaction.date,
      transaction.name || 'Investment activity', transaction.type, transaction.subtype || null,
      transaction.security_id || null, fields.securityName, fields.ticker, fields.quantity, fields.price,
      fields.fees, fields.amount, fields.currency, fields.unofficialCurrency, transaction.cancel_transaction_id || null];
    const result = await client.query(`INSERT INTO investment_transactions
      (user_id,account_id,provider_transaction_id,booked_on,description,activity_type,activity_subtype,
       security_id,security_name,ticker_symbol,quantity,price,fees,amount,currency,unofficial_currency,cancel_transaction_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (account_id,provider_transaction_id) DO UPDATE SET
        booked_on=EXCLUDED.booked_on,description=EXCLUDED.description,activity_type=EXCLUDED.activity_type,
        activity_subtype=EXCLUDED.activity_subtype,security_id=EXCLUDED.security_id,security_name=EXCLUDED.security_name,
        ticker_symbol=EXCLUDED.ticker_symbol,quantity=EXCLUDED.quantity,price=EXCLUDED.price,fees=EXCLUDED.fees,
        amount=EXCLUDED.amount,currency=EXCLUDED.currency,unofficial_currency=EXCLUDED.unofficial_currency,
        cancel_transaction_id=EXCLUDED.cancel_transaction_id,provider_synced_at=now()
      WHERE investment_transactions.user_id=EXCLUDED.user_id AND
        (investment_transactions.booked_on,investment_transactions.description,investment_transactions.activity_type,
         investment_transactions.activity_subtype,investment_transactions.security_id,investment_transactions.security_name,
         investment_transactions.ticker_symbol,investment_transactions.quantity,investment_transactions.price,
         investment_transactions.fees,investment_transactions.amount,investment_transactions.currency,
         investment_transactions.unofficial_currency,investment_transactions.cancel_transaction_id)
        IS DISTINCT FROM
        (EXCLUDED.booked_on,EXCLUDED.description,EXCLUDED.activity_type,EXCLUDED.activity_subtype,
         EXCLUDED.security_id,EXCLUDED.security_name,EXCLUDED.ticker_symbol,EXCLUDED.quantity,EXCLUDED.price,
         EXCLUDED.fees,EXCLUDED.amount,EXCLUDED.currency,EXCLUDED.unofficial_currency,EXCLUDED.cancel_transaction_id)
      RETURNING (xmax=0) AS inserted`, values);
    if (!result.rows.length) counts.unchanged++;
    else if (result.rows[0].inserted) counts.added++;
    else counts.modified++;
  }
  // missing rows are not deletions. plaid may still be loading older history.
  await client.query(`UPDATE bank_connections SET investments_synced_at=now(),investments_status='available',status='connected'
    WHERE id=$1 AND user_id=$2 AND plaid_environment=$3`, [connection.id, connection.user_id, connection.plaid_environment]);
  return { ...counts, startDate: start.toISOString().slice(0, 10), endDate: end };
}

module.exports = { syncInvestments, fetchInvestmentActivity, investmentFields };
