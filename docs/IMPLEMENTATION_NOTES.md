# Implementation notes — Retail conversion

## Frontend changes made in this package

- Removed the Chef Dashboard from application navigation and removed `chef` from accepted frontend roles.
- Removed the old `ChefDashboard.jsx` module from the application package.
- Replaced the old ingredient/stock-item inventory screen with a ready-made product inventory screen backed by `menu_items.current_quantity` and `menu_items.minimum_quantity`.
- Replaced the old stock-item purchase screen with supplier purchases linked to `menu_items`.
- Changed the POS to call `cashier_retail_pos_menu` and `process_retail_pos_checkout`, and to enforce the available quantity in the cart UI. The database RPC performs the authoritative stock check.
- Added Owner variance review and employee repayment verification UI using the RPC names/arguments already present in the supplied built Android web bundle.
- Integrated Owner staff-benefit approvals into Owner navigation.
- Rebuilt Manager Dashboard to show attendance, manager variance recommendations, and staff meal/transport benefit requests. The obsolete kitchen stock request interface is not present.
- Updated the Overview stock watch to read the saleable product catalogue rather than `stock_items`.
- Kept the existing cashier receipt and Bluetooth/USB printer workflow, cash-management modules, payroll, expenses, savings, and reporting files.
- Added a first-pass Supabase migration draft for direct retail inventory and POS RPCs.

## Known validation limitation

The source archive did not contain a usable `node_modules` installation. Dependency installation was attempted but did not complete in this environment, so a fresh Vite production build could not be run here. The package lockfile is retained; run `npm ci` and `npm run build` locally before deployment.

The SQL migration has not been executed against Supabase. It must be reviewed against the live function signatures, constraints, grants, policies, and cash tables before execution. No live database changes have been made.

## Legacy database preservation

This first conversion intentionally does not drop legacy stock, recipe, production, Chef request, or historical sales tables. The old purchase-to-`stock_items` trigger is disabled and replaced with the direct product stock trigger. The closed-cash purchase protection trigger is preserved. Further database cleanup should happen only after live validation and a verified backup.
