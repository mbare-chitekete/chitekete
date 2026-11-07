# Retail edition acceptance checklist

Run these after the Supabase migration has been reviewed and applied in a non-production environment first.

## Owner
- [ ] Can add/edit categories and ready-made products.
- [ ] Can change selling prices; Manager cannot change prices.
- [ ] Can view all product stock, purchase history, stock adjustments and low-stock alerts.
- [ ] Can review staff variance cases and confirm/reject repayments.
- [ ] Can approve/reject staff meal and transport requests.
- [ ] Can access cash management, expenses, savings, payroll and reports.

## Manager
- [ ] Can view attendance and staff attendance history.
- [ ] Can submit staff meal and transport requests for an individual or team.
- [ ] Can submit variance recommendations to the Owner.
- [ ] Can record supplier purchases and product stock adjustments.
- [ ] Cannot see payroll navigation or access Owner-only approvals and payroll payment/rate functions.

## Cashier / POS
- [ ] Can access POS and only cashier-authorized personal records.
- [ ] Can see active products with a configured selling price, including products with zero/negative recorded stock.
- [ ] Cart quantity may exceed recorded stock, but checkout requires an explicit physical-stock confirmation.
- [ ] If physical confirmation is declined, no sale or stock movement is written.
- [ ] If physical confirmation is accepted, checkout records the sale and allows the stock balance to become negative.
- [ ] The stock movement records the cashier, receipt reference and physically-confirmed shortage.
- [ ] Database rejects an over-stock checkout when the physical-confirmation flag is false, including requests bypassing the frontend.
- [ ] Server row locks prevent concurrent checkouts from using stale balances; an oversell still requires physical confirmation at the authoritative checkout step.
- [ ] Cash checkout permits change; mobile money and card require exact payment.
- [ ] Checkout requires an open cash session for the Africa/Harare business date.
- [ ] Sale, receipt, payment totals and stock movement commit atomically.
- [ ] Retrying the same checkout request ID does not create a duplicate sale.
- [ ] Receipt reprint works from Recent Sales.
- [ ] Bluetooth and USB thermal printing work on the Android build.

## Stock and purchase accounting
- [ ] A purchase increases exactly one linked product's stock.
- [ ] Editing a purchase reverses its previous stock impact and applies the new one.
- [ ] Deleting a purchase is blocked by closed-cash protection where applicable and cannot make stock negative.
- [ ] Increasing/decreasing stock requires an Owner/Manager, a positive quantity and a reason.
- [ ] Low-stock transition creates Owner/Manager notifications.
- [ ] Product movement ledger reconciles opening balance + receipts - sales +/- adjustments.

## Reports and cash
- [ ] Daily Sales combines historical daily sales with POS sale lines without changing historical rows.
- [ ] Reports show POS sales by Africa/Harare business date.
- [ ] Daily payment totals include POS cash/mobile money/card totals.
- [ ] Cash close/reopen controls and closed-period edit protections still work.
