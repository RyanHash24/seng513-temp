# FinClear schema milestone design

## Intent and approved scope

Implement the full proposal scope approved in chat on November 5, 2026 using the existing PostgreSQL backend. Deliver separate schema and seed scripts, README instructions, a copy of the instructions as `seng513-schema-pg-8.pdf`, a submission ZIP, and a local milestone commit and tag. D2L upload remains a manual submission.

## Approach

Use plain PostgreSQL SQL executed with psql. This fits the existing node-postgres and PostgreSQL 15 Compose setup. An ORM would add an unrelated application dependency. JSON documents would weaken the ownership and financial relationships that this milestone must demonstrate.

## Model

Users have guest, free, trial, or premium access. Per-user settings and notification preferences back the settings screens. Bank connections hold provider identifiers, sync state and a reference to an externally stored secret. Accounts support manual, sample and Plaid sources, currency, balances and personal/business scope. Disconnecting changes connection status and preserves accounts and transactions.

Category groups contain user-owned categories. Monthly budgets contain expected income, reserved savings and category allocations. Group totals are sums of allocations, avoiding double-counting parent and child budgets. Transactions have signed exact decimal amounts, posted/pending status, import identifiers and editable categorization. Ownership and currency foreign keys reject cross-user and cross-currency links. Budgets and transactions remain independent when a plan is replaced.

Savings goals have contribution records. Notifications support budget alerts and read timestamps. Monthly cash-flow, budget-spending and goal-progress views provide reporting inputs. Forecasting and CSV exports derive from transaction history. Authentication, role authorization, Plaid sync, notifications delivery, forecasts and billing execution remain application work, while the schema stores their required core data.

## Implementation choices

Use UUID keys, NUMERIC(18,2) monetary columns, three-letter currency codes, timestamptz audit dates and date-valued budget months. CAD is the default. Positive income/refunds and negative expenses are the transaction sign convention. Transfers are excluded from income and spending views. Posted expenses less refunds determine actual spending. Account balances are bank snapshots rather than sums of incomplete imported history. Liability balances represent amounts owed.

Seed fictional users matching the proposal personas. Include David's October 2026 UI budget, Morgan's business report, a guest sample workspace and a Free user. Demo registered users receive documented scrypt hashes. No real bank credentials or Plaid tokens are seeded. Rerunning scripts must preserve existing data and user edits. Initial schema reruns support the same version only, rather than migrating arbitrary prior schemas.

## Validation

Run schema and seeds on an isolated PostgreSQL instance. Verify reruns, exact UI totals, all access roles, ownership and currency constraints, import deduplication, invalid amounts, pending/transfer exclusion, retained history after disconnect, and budget deletion preserving transactions. Validate both Compose configurations. Render and inspect PDF pages and inspect the ZIP manifest.
