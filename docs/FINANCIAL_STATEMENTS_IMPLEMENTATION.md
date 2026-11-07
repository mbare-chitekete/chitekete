# USD Financial Statements — implementation and rollout

## Included in this revision
- Owner-only Financial Statements navigation: Profit & Loss, Detailed Transactions, Product Profitability, Expense Breakdown.
- Reporting filters: today, yesterday, this week, this month, previous month, this year, custom date range.
- USD-only reporting with USD currency display.
- Four reporting RPCs in `supabase/migrations/002_usd_financial_statements.sql`.
- New-sale and new-expense currency snapshots taken from `canteen_settings.currency_code`.
- Per-product/per-currency moving weighted-average cost pools.
- Sale-line cost snapshots and a permanent COGS journal; a line is costed only if its matching currency cost pool can cover the entire line.
- Historical currency/cost gaps are flagged instead of being assigned guessed values.

## Required rollout
1. Back up the Supabase database.
2. Apply the retail inventory migration `001_ready_made_retail_inventory.sql` first if it has not already been applied.
3. Review and apply `002_usd_financial_statements.sql` in Supabase SQL Editor or staging.
4. Run one small USD purchase for a test product, then a USD POS sale of that product. Confirm the sale line has `cost_status = 'costed'` and that its cost snapshot equals quantity × weighted-average cost.
5. Test a ZAR/ZWG purchase and sale. Confirm neither enters USD P&L.
6. Test an expense in USD and another in ZAR/ZWG. Confirm only the USD expense enters USD P&L.
7. Test historical records with null currency and verify they appear in the exception banner, not USD totals.
8. Verify that non-Owner users cannot execute the reporting RPCs.

## Important accounting limitations / decisions
- The current app did not save a currency snapshot on POS sales or expenses. Existing rows are left with `currency_code = NULL` because their historical currency cannot be proven. New rows receive a currency snapshot automatically.
- Existing purchases and opening inventory are not imported into weighted-average pools automatically. Their remaining quantities and cost provenance cannot be proven from the supplied frontend project alone. Consequently, early sales may be flagged `missing_cost` until new costed stock receipts replenish the matching currency pool.
- Cost pools are separated by currency. No FX conversion is performed. A sale line is costed only from inventory recorded in the same currency pool; otherwise it is flagged. This avoids silently treating ZAR/ZWG costs as USD.
- A purchase already posted to costing is immutable. A costed POS sale line is also immutable. A future correction/refund workflow should use explicit reversal records so the historical P&L remains auditable.
- The current P&L includes completed POS sales and rows in `expenses`. It does not independently pull payroll disbursements, owner funding, savings movements, cash transfers, or purchase totals as expenses. If salaries are paid through payroll rather than recorded in Expenses, a separately approved payroll-expense posting design is still required to include them without double counting.
- The net profit is provisional while the report's exception counts are non-zero. Review missing cost and unclassified currency records before relying on it as a final accounting result.

## Verification status
- Source files and SQL migration have been added to the project archive.
- A production build was not verified in this environment because `npm ci` timed out before Vite and the project build toolchain were installed.
- The SQL migration has not been executed against the live Supabase database. Do not treat the feature as production-active until it is applied and tested against the actual schema.
