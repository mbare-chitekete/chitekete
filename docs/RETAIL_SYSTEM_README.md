# Mbare Chitekete Canteen — Ready-Made Retail Edition

This edition is for buying finished products from suppliers and reselling them. It has no food preparation, recipes, ingredient consumption, production batches, production reservations, Chef dashboard, or Chef stock-request workflow in the application.

## Retail operating flow

1. Owner maintains product categories, product catalogue, units, selling prices, and reorder levels.
2. Owner or Manager records supplier purchases against an existing product.
3. The database purchase trigger increases that product's `menu_items.current_quantity` and writes a stock movement.
4. Cashier selects available products in POS and checks out.
5. The retail checkout RPC locks product rows, verifies stock, creates the sale and sale lines, deducts quantities, and writes stock movements in one database transaction.
6. Owner or Manager records stock adjustments for damage, expiry, missing stock, or count corrections.

## Important setup order

- Do not run SQL against production before making a Supabase backup.
- The SQL in `supabase/migrations/001_ready_made_retail_inventory.sql` is a first migration draft based on the schema and trigger/function information supplied during the audit. Review it against the current live database before execution.
- It intentionally preserves old `stock_items`, recipes, production batches, Chef request tables, old stock movements, and historical sales. They are not dropped by this migration.
- After migration, validate product balances, purchase posting/reversal, POS stock deduction, receipts, daily payment totals, cash closing, and RLS before retiring legacy database objects.

## Environment

Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable/anon key. Never commit `.env.local` or service-role keys.

## Run locally

```bash
npm ci
npm run dev
npm run build
```

## Roles in this frontend

- Owner: full administration, product catalogue and prices, finance, payroll, reports, cash controls, purchases, inventory, POS.
- Manager: Manager Dashboard, purchases, inventory and the existing manager-enabled staff module.
- Cashier: POS only.

The frontend role gate is not a substitute for Supabase RLS and RPC authorization. Keep the database permissions authoritative.
