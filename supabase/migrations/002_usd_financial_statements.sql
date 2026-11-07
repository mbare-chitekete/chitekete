-- Mbare Chitekete Canteen — USD financial statements
-- Apply only after backing up Supabase and reviewing against the live schema.
-- Existing historical records are deliberately NOT assigned an assumed currency or cost.

BEGIN;

-- 1. Currency snapshots: the current canteen currency is captured on NEW records.
ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS currency_code text;

ALTER TABLE public.pos_sale_items
  ADD COLUMN IF NOT EXISTS cost_currency_code text,
  ADD COLUMN IF NOT EXISTS cost_unit numeric(14,4),
  ADD COLUMN IF NOT EXISTS cost_total numeric(14,2),
  ADD COLUMN IF NOT EXISTS cost_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.pos_sale_items
  DROP CONSTRAINT IF EXISTS pos_sale_items_cost_status_check;
ALTER TABLE public.pos_sale_items
  ADD CONSTRAINT pos_sale_items_cost_status_check
  CHECK (cost_status IN ('pending','costed','missing_cost','unclassified_currency'));

CREATE OR REPLACE FUNCTION public.set_financial_currency_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_currency text;
BEGIN
  SELECT currency_code INTO v_currency
  FROM public.canteen_settings
  WHERE id = true;
  IF v_currency NOT IN ('USD','ZAR','ZWG') THEN
    RAISE EXCEPTION 'Canteen currency setting must be USD, ZAR or ZWG';
  END IF;
  NEW.currency_code := v_currency;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pos_sales_currency_snapshot ON public.pos_sales;
CREATE TRIGGER trg_pos_sales_currency_snapshot
BEFORE INSERT ON public.pos_sales
FOR EACH ROW EXECUTE FUNCTION public.set_financial_currency_snapshot();

DROP TRIGGER IF EXISTS trg_expenses_currency_snapshot ON public.expenses;
CREATE TRIGGER trg_expenses_currency_snapshot
BEFORE INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_financial_currency_snapshot();

REVOKE ALL ON FUNCTION public.set_financial_currency_snapshot() FROM PUBLIC, anon, authenticated;

-- 2. Per-product, per-currency moving weighted-average cost pools.
-- These pools start empty: historic purchases and opening stock are not guessed.
CREATE TABLE IF NOT EXISTS public.product_currency_cost_balances (
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  currency_code text NOT NULL CHECK (currency_code IN ('USD','ZAR','ZWG')),
  quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  average_unit_cost numeric(14,4) NOT NULL DEFAULT 0 CHECK (average_unit_cost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (menu_item_id, currency_code)
);

CREATE TABLE IF NOT EXISTS public.product_cost_purchase_posts (
  purchase_id uuid PRIMARY KEY REFERENCES public.purchases(id) ON DELETE RESTRICT,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  currency_code text NOT NULL CHECK (currency_code IN ('USD','ZAR','ZWG')),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost numeric(14,2) NOT NULL CHECK (total_cost >= 0),
  posted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_currency_cost_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_cost_purchase_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_currency_cost_balances, public.product_cost_purchase_posts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.post_purchase_weighted_average_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_currency text;
  v_unit_cost numeric(14,4);
  v_old public.product_cost_purchase_posts%ROWTYPE;
  v_balance public.product_currency_cost_balances%ROWTYPE;
  v_new_qty numeric(14,3);
  v_new_avg numeric(14,4);
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT * INTO v_old FROM public.product_cost_purchase_posts WHERE purchase_id = OLD.id;
    IF FOUND THEN
      RAISE EXCEPTION 'This purchase has been posted to inventory costing and cannot be edited or deleted. Record a correcting purchase/stock adjustment instead.';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;

  IF NEW.menu_item_id IS NULL OR COALESCE(NEW.quantity,0) <= 0 OR COALESCE(NEW.total_purchase,0) < 0 THEN
    RETURN NEW;
  END IF;
  v_currency := NEW.currency_code;
  IF v_currency NOT IN ('USD','ZAR','ZWG') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.menu_item_id::text), hashtext(v_currency));
  v_unit_cost := CASE WHEN COALESCE(NEW.unit_price,0) > 0
    THEN NEW.unit_price
    ELSE NEW.total_purchase / NULLIF(NEW.quantity,0)
  END;

  SELECT * INTO v_balance
  FROM public.product_currency_cost_balances
  WHERE menu_item_id = NEW.menu_item_id AND currency_code = v_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.product_currency_cost_balances(menu_item_id,currency_code,quantity_on_hand,average_unit_cost)
    VALUES (NEW.menu_item_id,v_currency,NEW.quantity,v_unit_cost);
  ELSE
    v_new_qty := v_balance.quantity_on_hand + NEW.quantity;
    v_new_avg := CASE WHEN v_new_qty = 0 THEN 0 ELSE
      ((v_balance.quantity_on_hand * v_balance.average_unit_cost) + (NEW.quantity * v_unit_cost)) / v_new_qty
    END;
    UPDATE public.product_currency_cost_balances
    SET quantity_on_hand = v_new_qty, average_unit_cost = v_new_avg, updated_at = now()
    WHERE menu_item_id = NEW.menu_item_id AND currency_code = v_currency;
  END IF;

  INSERT INTO public.product_cost_purchase_posts(purchase_id,menu_item_id,currency_code,quantity,unit_cost,total_cost)
  VALUES (NEW.id,NEW.menu_item_id,v_currency,NEW.quantity,v_unit_cost,round(NEW.quantity * v_unit_cost,2));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_purchase_weighted_average_cost ON public.purchases;
CREATE TRIGGER trg_purchase_weighted_average_cost
AFTER INSERT OR UPDATE OR DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.post_purchase_weighted_average_cost();
REVOKE ALL ON FUNCTION public.post_purchase_weighted_average_cost() FROM PUBLIC, anon, authenticated;

-- 3. Cost snapshot at sale-line creation. Only the matching sale currency pool
-- is used; if that pool cannot cover the entire line, the line is flagged.
CREATE OR REPLACE FUNCTION public.snapshot_sale_line_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_currency text;
  v_balance public.product_currency_cost_balances%ROWTYPE;
BEGIN
  SELECT currency_code INTO v_currency
  FROM public.pos_sales WHERE id = NEW.sale_id;

  IF v_currency NOT IN ('USD','ZAR','ZWG') THEN
    NEW.cost_status := 'unclassified_currency';
    NEW.cost_currency_code := NULL;
    NEW.cost_unit := NULL;
    NEW.cost_total := NULL;
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.menu_item_id::text), hashtext(v_currency));
  SELECT * INTO v_balance
  FROM public.product_currency_cost_balances
  WHERE menu_item_id = NEW.menu_item_id AND currency_code = v_currency
  FOR UPDATE;

  IF NOT FOUND OR v_balance.quantity_on_hand < NEW.quantity THEN
    NEW.cost_status := 'missing_cost';
    NEW.cost_currency_code := v_currency;
    NEW.cost_unit := NULL;
    NEW.cost_total := NULL;
    RETURN NEW;
  END IF;

  NEW.cost_status := 'costed';
  NEW.cost_currency_code := v_currency;
  NEW.cost_unit := v_balance.average_unit_cost;
  NEW.cost_total := round(NEW.quantity * v_balance.average_unit_cost,2);

  UPDATE public.product_currency_cost_balances
  SET quantity_on_hand = quantity_on_hand - NEW.quantity, updated_at = now()
  WHERE menu_item_id = NEW.menu_item_id AND currency_code = v_currency;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_snapshot_sale_line_cost ON public.pos_sale_items;
CREATE TRIGGER trg_snapshot_sale_line_cost
BEFORE INSERT ON public.pos_sale_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_sale_line_cost();
REVOKE ALL ON FUNCTION public.snapshot_sale_line_cost() FROM PUBLIC, anon, authenticated;

-- Permanent COGS journal: each successfully costed POS line posts once.
CREATE TABLE IF NOT EXISTS public.cogs_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_line_id uuid NOT NULL UNIQUE REFERENCES public.pos_sale_items(id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE RESTRICT,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  currency_code text NOT NULL CHECK (currency_code IN ('USD','ZAR','ZWG')),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost numeric(14,2) NOT NULL CHECK (total_cost >= 0),
  posted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cogs_journal_currency_posted_idx
  ON public.cogs_journal_entries(currency_code, posted_at DESC);
ALTER TABLE public.cogs_journal_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cogs_journal_entries FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.post_cogs_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_sale_currency text;
BEGIN
  IF NEW.cost_status <> 'costed' OR NEW.cost_total IS NULL OR NEW.cost_unit IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT currency_code INTO v_sale_currency FROM public.pos_sales WHERE id = NEW.sale_id;
  INSERT INTO public.cogs_journal_entries(
    sale_line_id,sale_id,menu_item_id,currency_code,quantity,unit_cost,total_cost
  ) VALUES (
    NEW.id,NEW.sale_id,NEW.menu_item_id,v_sale_currency,NEW.quantity,NEW.cost_unit,NEW.cost_total
  ) ON CONFLICT (sale_line_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_post_cogs_journal_entry ON public.pos_sale_items;
CREATE TRIGGER trg_post_cogs_journal_entry
AFTER INSERT ON public.pos_sale_items
FOR EACH ROW EXECUTE FUNCTION public.post_cogs_journal_entry();
REVOKE ALL ON FUNCTION public.post_cogs_journal_entry() FROM PUBLIC, anon, authenticated;

-- Cost snapshots are immutable once recorded. Correct mistakes with a separate
-- reversal/refund workflow rather than rewriting a historical sale's COGS.
CREATE OR REPLACE FUNCTION public.protect_costed_sale_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.cost_status = 'costed' THEN
    RAISE EXCEPTION 'This sale line has a posted cost snapshot and cannot be edited or deleted. Use an auditable refund/reversal workflow.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_costed_sale_line ON public.pos_sale_items;
CREATE TRIGGER trg_protect_costed_sale_line
BEFORE UPDATE OR DELETE ON public.pos_sale_items
FOR EACH ROW EXECUTE FUNCTION public.protect_costed_sale_line();
REVOKE ALL ON FUNCTION public.protect_costed_sale_line() FROM PUBLIC, anon, authenticated;

-- 4. Owner-only reporting functions. Date filters are inclusive and use
-- Africa/Harare local sale dates. Unknown historical currency/costs are counted
-- as exceptions, never silently converted or backfilled.
CREATE OR REPLACE FUNCTION public.owner_profit_loss_report(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_canteen_owner() THEN RAISE EXCEPTION 'Only the Owner can view financial statements'; END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN RAISE EXCEPTION 'Invalid reporting date range'; END IF;

  WITH sales AS (
    SELECT COALESCE(sum(total_amount),0)::numeric(14,2) AS revenue
    FROM public.pos_sales
    WHERE sale_status = 'completed'
      AND currency_code = 'USD'
      AND (sale_datetime AT TIME ZONE 'Africa/Harare')::date BETWEEN p_start_date AND p_end_date
  ), cogs AS (
    SELECT COALESCE(sum(cj.total_cost),0)::numeric(14,2) AS cost
    FROM public.cogs_journal_entries cj
    JOIN public.pos_sales ps ON ps.id = cj.sale_id
    WHERE ps.sale_status = 'completed' AND ps.currency_code = 'USD' AND cj.currency_code = 'USD'
      AND (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date BETWEEN p_start_date AND p_end_date
  ), expenses AS (
    SELECT COALESCE(sum(amount),0)::numeric(14,2) AS total
    FROM public.expenses
    WHERE currency_code = 'USD' AND expense_date BETWEEN p_start_date AND p_end_date
  ), exceptions AS (
    SELECT
      (SELECT count(*) FROM public.pos_sales WHERE sale_status = 'completed' AND currency_code IS NULL AND (sale_datetime AT TIME ZONE 'Africa/Harare')::date BETWEEN p_start_date AND p_end_date) AS unknown_sales,
      (SELECT count(*) FROM public.pos_sale_items psi JOIN public.pos_sales ps ON ps.id=psi.sale_id WHERE ps.sale_status='completed' AND ps.currency_code='USD' AND (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date BETWEEN p_start_date AND p_end_date AND psi.cost_status <> 'costed') AS missing_costs,
      (SELECT count(*) FROM public.expenses WHERE currency_code IS NULL AND expense_date BETWEEN p_start_date AND p_end_date) AS unknown_expenses
  ), totals AS (
    SELECT sales.revenue, cogs.cost, expenses.total,
      (sales.revenue - cogs.cost)::numeric(14,2) AS gross,
      (sales.revenue - cogs.cost - expenses.total)::numeric(14,2) AS net
    FROM sales,cogs,expenses
  )
  SELECT jsonb_build_object(
    'currency_code','USD','start_date',p_start_date,'end_date',p_end_date,
    'sales_revenue',t.revenue,'cost_of_goods_sold',t.cost,'gross_profit',t.gross,
    'operating_expenses',t.total,'net_profit',t.net,
    'gross_profit_margin',CASE WHEN t.revenue=0 THEN 0 ELSE round(t.gross/t.revenue*100,2) END,
    'net_profit_margin',CASE WHEN t.revenue=0 THEN 0 ELSE round(t.net/t.revenue*100,2) END,
    'unclassified_sales_count',e.unknown_sales,'missing_cost_lines',e.missing_costs,
    'unclassified_expenses_count',e.unknown_expenses,
    'is_complete',(e.unknown_sales+e.missing_costs+e.unknown_expenses)=0
  ) INTO v_result
  FROM totals t CROSS JOIN exceptions e;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_product_profitability_report(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_canteen_owner() THEN RAISE EXCEPTION 'Only the Owner can view product profitability'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.product_name),'[]'::jsonb) INTO v_result
  FROM (
    SELECT psi.menu_item_id, psi.item_name AS product_name,
      sum(psi.quantity)::numeric(14,3) AS quantity_sold,
      sum(psi.line_total)::numeric(14,2) AS revenue,
      COALESCE(sum(cj.total_cost),0)::numeric(14,2) AS cost_of_goods_sold,
      (sum(psi.line_total)-COALESCE(sum(cj.total_cost),0))::numeric(14,2) AS gross_profit,
      CASE WHEN bool_and(psi.cost_status='costed' AND psi.cost_currency_code='USD') THEN 'costed' ELSE 'incomplete cost' END AS cost_status
    FROM public.pos_sale_items psi JOIN public.pos_sales ps ON ps.id=psi.sale_id
    LEFT JOIN public.cogs_journal_entries cj ON cj.sale_line_id=psi.id AND cj.currency_code='USD'
    WHERE ps.sale_status='completed' AND ps.currency_code='USD'
      AND (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date BETWEEN p_start_date AND p_end_date
    GROUP BY psi.menu_item_id,psi.item_name
  ) x;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_expense_breakdown_report(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_canteen_owner() THEN RAISE EXCEPTION 'Only the Owner can view expense breakdown'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.total_amount DESC),'[]'::jsonb) INTO v_result
  FROM (
    SELECT COALESCE(category,'Uncategorised') AS category,count(*) AS transaction_count,
      sum(amount)::numeric(14,2) AS total_amount,
      CASE WHEN sum(sum(amount)) OVER ()=0 THEN 0 ELSE round(sum(amount)/sum(sum(amount)) OVER ()*100,2) END AS share_percent
    FROM public.expenses
    WHERE currency_code='USD' AND expense_date BETWEEN p_start_date AND p_end_date
    GROUP BY category
  ) x;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_financial_transactions_report(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_canteen_owner() THEN RAISE EXCEPTION 'Only the Owner can view financial transactions'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.transaction_date DESC),'[]'::jsonb) INTO v_result
  FROM (
    SELECT (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date AS transaction_date,
      'Sale'::text AS transaction_type,'POS sale'::text AS description,
      ps.receipt_number::text AS reference,ps.total_amount::numeric(14,2) AS amount,
      CASE WHEN EXISTS (SELECT 1 FROM public.pos_sale_items psi WHERE psi.sale_id=ps.id AND psi.cost_status <> 'costed') THEN 'Cost review required' ELSE 'Completed' END AS status
    FROM public.pos_sales ps
    WHERE ps.sale_status='completed' AND ps.currency_code='USD'
      AND (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date BETWEEN p_start_date AND p_end_date
    UNION ALL
    SELECT e.expense_date,'Expense',e.description, e.id::text, e.amount::numeric(14,2),'Recorded'
    FROM public.expenses e WHERE e.currency_code='USD' AND e.expense_date BETWEEN p_start_date AND p_end_date
    UNION ALL
    SELECT (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date,'COGS','Cost of goods sold',ps.receipt_number,
      sum(cj.total_cost)::numeric(14,2),'Posted'
    FROM public.cogs_journal_entries cj JOIN public.pos_sales ps ON ps.id=cj.sale_id
    WHERE ps.sale_status='completed' AND ps.currency_code='USD' AND cj.currency_code='USD'
      AND (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date BETWEEN p_start_date AND p_end_date
    GROUP BY ps.id,ps.sale_datetime,ps.receipt_number
  ) x;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_profit_loss_report(date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_product_profitability_report(date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_expense_breakdown_report(date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_financial_transactions_report(date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_profit_loss_report(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_product_profitability_report(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_expense_breakdown_report(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_financial_transactions_report(date,date) TO authenticated;

COMMIT;

-- IMPORTANT OPERATIONAL NOTES:
-- A) Historical pos_sales/expenses currency_code values remain NULL. They are
--    excluded from USD totals and surfaced as unclassified records.
-- B) Historical purchases/opening stock are not loaded into cost pools because
--    their remaining quantities and currency provenance cannot be proven here.
-- C) Purchase rows posted to product_cost_purchase_posts are immutable. Correct
--    them with an auditable stock/purchase adjustment, not an edit/delete.
-- D) Cost pools are separate by currency. A sale is costed only when its own
--    currency pool can cover the entire line. Otherwise the line is flagged.
-- E) Back up and test this migration in staging before production.
