function transactionFields(transaction, account) {
  const amount = -transaction.amount;
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)) ||
      !transaction.transaction_id || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date || '') ||
      transaction.iso_currency_code !== account.currency) throw new Error('Unsupported transaction data');
  const primary = transaction.personal_finance_category?.primary;
  const kind = ['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'].includes(primary) ? 'transfer'
    : amount <= 0 ? 'expense' : primary && primary !== 'INCOME' ? 'refund' : 'income';
  return { amount: amount.toFixed(2), kind, status: transaction.pending ? 'pending' : 'posted',
    category: transaction.personal_finance_category?.detailed || primary || null };
}

async function fetchUpdates(request, connection) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let cursor = connection.sync_cursor || '', pages = 0;
    const updates = { added: [], modified: [], removed: [] };
    try {
      while (true) {
        const page = await request('/transactions/sync', { access_token: connection.accessToken, cursor, count: 500 });
        if (!Array.isArray(page.added) || !Array.isArray(page.modified) || !Array.isArray(page.removed) ||
            typeof page.next_cursor !== 'string' || typeof page.has_more !== 'boolean') throw new Error('Invalid sync response');
        updates.added.push(...page.added); updates.modified.push(...page.modified); updates.removed.push(...page.removed);
        if (++pages > 1000 || (page.has_more && page.next_cursor === cursor)) throw new Error('Sync pagination did not finish');
        cursor = page.next_cursor;
        if (!page.has_more) return { ...updates, cursor, updateStatus: page.transactions_update_status || 'TRANSACTIONS_UPDATE_STATUS_UNKNOWN' };
      }
    } catch (error) {
      if (error.plaidCode !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' || attempt === 2) throw error;
    }
  }
}

async function syncTransactions(client, connection, request) {
  const updates = await fetchUpdates(request, connection);
  const { rows } = await client.query(`SELECT id, provider_account_id, currency, scope FROM accounts
    WHERE connection_id=$1 AND user_id=$2 AND source='plaid'`, [connection.id, connection.user_id]);
  const accounts = new Map(rows.map(account => [account.provider_account_id, account]));
  const counts = { added: 0, modified: 0, removed: 0, skipped: 0 };
  const replacements = [];
  for (const operation of ['added', 'modified']) {
    for (const transaction of updates[operation]) {
      const account = accounts.get(transaction.account_id);
      if (!account) { counts.skipped++; continue; }
      const fields = transactionFields(transaction, account);
      await client.query(`INSERT INTO transactions
        (user_id,account_id,provider_transaction_id,pending_provider_transaction_id,amount,currency,kind,status,
         scope,description,merchant_name,booked_on,authorized_on,provider_category,imported_at,provider_synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
        ON CONFLICT (account_id,provider_transaction_id) DO UPDATE SET
          pending_provider_transaction_id=EXCLUDED.pending_provider_transaction_id,amount=EXCLUDED.amount,
          kind=EXCLUDED.kind,status=EXCLUDED.status,description=EXCLUDED.description,merchant_name=EXCLUDED.merchant_name,
          booked_on=EXCLUDED.booked_on,authorized_on=EXCLUDED.authorized_on,
          provider_category=EXCLUDED.provider_category,provider_synced_at=now()
        WHERE transactions.user_id=EXCLUDED.user_id AND transactions.currency=EXCLUDED.currency`,
        [connection.user_id, account.id, transaction.transaction_id, transaction.pending_transaction_id || null,
          fields.amount, account.currency, fields.kind, fields.status, account.scope,
          transaction.name || transaction.merchant_name || 'Bank transaction', transaction.merchant_name || null,
          transaction.date, transaction.authorized_date || null, fields.category]);
      if (!transaction.pending && transaction.pending_transaction_id && transaction.pending_transaction_id !== transaction.transaction_id) {
        replacements.push({ account, transaction });
      }
      counts[operation]++;
    }
  }
  // resolve replacements after all pages are saved, regardless of provider ordering.
  for (const { account, transaction } of replacements) {
    await client.query(`UPDATE transactions posted SET category_id=COALESCE(posted.category_id,pending.category_id),
      original_category_id=COALESCE(posted.original_category_id,pending.original_category_id),
      category_overridden=posted.category_overridden OR pending.category_overridden,
      notes=COALESCE(posted.notes,pending.notes),scope=pending.scope
      FROM transactions pending WHERE posted.user_id=$1 AND pending.user_id=$1
      AND posted.account_id=$2 AND pending.account_id=$2
      AND posted.provider_transaction_id=$3 AND pending.provider_transaction_id=$4
      AND NOT posted.category_overridden`,
      [connection.user_id, account.id, transaction.transaction_id, transaction.pending_transaction_id]);
    const result = await client.query(`UPDATE transactions SET status='removed',provider_synced_at=now()
      WHERE user_id=$1 AND account_id=$2 AND provider_transaction_id=$3 AND status<>'removed'`,
      [connection.user_id, account.id, transaction.pending_transaction_id]);
    counts.removed += result.rowCount;
  }
  for (const transaction of updates.removed) {
    const account = accounts.get(transaction.account_id);
    if (!account) { counts.skipped++; continue; }
    const result = await client.query(`UPDATE transactions SET status='removed',provider_synced_at=now()
      WHERE user_id=$1 AND account_id=$2 AND provider_transaction_id=$3 AND status<>'removed'`,
      [connection.user_id, account.id, transaction.transaction_id]);
    counts.removed += result.rowCount;
  }
  await client.query(`UPDATE bank_connections SET sync_cursor=$1,transactions_synced_at=now(),
    transactions_update_status=$2,status='connected' WHERE id=$3 AND user_id=$4 AND plaid_environment=$5`,
    [updates.cursor, updates.updateStatus, connection.id, connection.user_id, connection.plaid_environment]);
  return { ...counts, updateStatus: updates.updateStatus };
}

module.exports = { syncTransactions, transactionFields, fetchUpdates };
