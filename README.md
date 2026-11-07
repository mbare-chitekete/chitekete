# Mbare Chitekete Canteen Management System — Retail Edition

This project is being converted to a **ready-made retail canteen**. The business buys finished products from suppliers and sells them directly. No food preparation, recipes, ingredients, cooking, production batches, production reservations, Chef role, or Chef stock-request workflow is included in the application.

## Main modules

- Owner overview and administration
- Manager dashboard: attendance, staff variance recommendations, and staff meal/transport benefit requests
- Owner staff variance reviews and repayment confirmation
- Owner staff benefit approvals
- Product catalogue and owner-managed selling prices
- Supplier purchases
- Product inventory, reorder levels, low-stock alerts, and stock adjustments
- Cashier POS, receipt history, and existing Android thermal-printer integration
- Daily sales, cash management, expenses, reports, business savings, staff and payroll modules
- Multi-currency support: USD, ZAR and ZWG

## Retail stock lifecycle

**Supplier purchase → product stock increases → POS sale → product stock decreases.**

Damaged, expired, missing or count-correction quantities are recorded through stock adjustments. The database checkout function locks product rows and validates stock at checkout. When the cart exceeds recorded stock, the cashier must explicitly confirm a physical count; the database independently requires that confirmation and records the shortage in the stock ledger. Negative balances are therefore permitted only through a confirmed POS sale, not through an unapproved stock adjustment.

## First setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the values for your Supabase project.
3. Install dependencies and run the frontend:

```bash
npm ci
npm run dev
```

4. Build the web application:

```bash
npm run build
```

5. When ready to update the Android project, run:

```bash
npx cap sync android
```

## Supabase migration

The first migration draft is in `supabase/migrations/001_ready_made_retail_inventory.sql`.

**Do not run it yet.** Make a database backup and review the script against the live schema first. It adds direct product quantities, a retail stock ledger, product stock adjustments, a purchase-to-product stock trigger, low-stock notifications, and retail POS RPCs. It deliberately preserves historical stock, recipe, production, and Chef-related database records; those will only be retired after all references and historical reporting have been verified.

The project ZIP is frontend-first as requested. Supabase migration, RLS verification, and live RPC validation are the next phase after the new ZIP is in place.

## Important security note

Frontend role-based navigation is only a user-interface boundary. Supabase RLS policies and SECURITY DEFINER RPC authorization must remain the authoritative access controls. Never put a Supabase service-role key in this frontend or in `.env.local`.
