# Rebuild audit — 6 November 2026

## Scope
Reviewed the supplied `Mbare-Chitekete-Canteen-Retail-Edition.zip` and made a first correction pass. This archive was already a partial retail conversion; it is not a pristine legacy project. Existing React/Vite, Supabase, Capacitor Android, POS receipt printing, payroll, cash-management, benefits, variance and reporting modules were retained.

## Changes in this revision
- POS now allows an active, priced product to be added even when its recorded stock is zero or negative.
- Cart quantities are no longer capped at the frontend's potentially stale stock number.
- Checkout asks the cashier to explicitly confirm a physical stock check whenever cart quantity exceeds the displayed product balance.
- Checkout sends the physical-confirmation flag to the database RPC.
- The retail checkout RPC independently rejects an over-stock sale unless the flag is true, locks product rows, subtracts the sold quantity, and records the physically-confirmed shortage in the stock movement notes.
- The migration drops the nonnegative `current_quantity` check so a confirmed sale can produce a negative balance. The minimum/reorder quantity remains nonnegative.
- The migration drops the old five-argument draft RPC before creating its six-argument replacement.
- Low-stock notifications now resolve active Owner users from `employee_roles` rather than using a hardcoded user UUID.
- Manager payroll navigation and its direct route were removed from the Manager workspace.
- Owner Settings navigation was added.
- Removed the remaining in-app “Cook” role/job examples and changed “Kitchen & Operations” to “Operations”.

## Validation performed
- TypeScript transpile/syntax check: all 21 source `.js`/`.jsx` files parsed with zero diagnostics.
- Dependency installation (`npm ci`) timed out in this environment. A Vite production build therefore has not been verified.
- The Supabase migration has not been executed. Live schema compatibility, RLS, RPC grants, trigger behavior and cash-closing protections still require review against the actual Supabase project and a database backup.
- Android APK and Bluetooth thermal printing have not been built or device-tested in this revision.

## Important remaining work before production
1. Complete the three role navigation and page permissions against the full Owner / Manager / Cashier requirements. In this revision, Manager navigation is still limited to Manager Dashboard, Purchases and Inventory; Cashier navigation is still POS-only. The requested My Sales, My Attendance, Notifications, Profile, manager-facing Products, Daily Sales, Cash Management, Expenses and other operational pages need to be completed and checked against database RLS—not merely hidden in React.
2. Verify every role-sensitive database table and RPC. Frontend navigation is not a security boundary.
3. Review the migration against the live Supabase schema. In particular, confirm `employee_roles` Owner rows, purchase triggers, `cash_positions`, `daily_payments`, `pos_sales`, `pos_sale_items`, and all pre-existing constraints/functions.
4. Test stock lifecycle end-to-end in a non-production database: purchase +100, sale -15, expected 105; oversell with no physical confirmation rejected; oversell with physical confirmation accepted and ledgered; retry same request ID does not double-deduct; concurrent checkouts lock correctly.
5. Verify multi-currency transaction snapshots and reporting currency behavior.
6. Test the Android POS and Bluetooth printer on the target devices.

## Deployment warning
Do not run the migration against production or deploy this archive as production-ready yet. Back up Supabase first, apply the migration in a staging project, complete the acceptance checklist, and perform a security review.
