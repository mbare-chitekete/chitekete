-- Mbare Chitekete Canteen: ready-made retail inventory migration
-- IMPORTANT: Review against the live schema and take a database backup before running.
-- This migration is designed for the schema audited in the project handover.
-- It does NOT drop legacy production tables or historical records.

BEGIN;

-- 1. Make menu_items the stock-bearing saleable product catalogue.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS current_quantity numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_quantity numeric(14,3) NOT NULL DEFAULT 0;

ALTER TABLE public.menu_items
  ALTER COLUMN inventory_tracking_mode SET DEFAULT 'none',
  DROP CONSTRAINT IF EXISTS menu_items_current_quantity_nonnegative,
  DROP CONSTRAINT IF EXISTS menu_items_minimum_quantity_nonnegative,
  ADD CONSTRAINT menu_items_minimum_quantity_nonnegative CHECK (minimum_quantity >= 0);

-- The old mode column is retained for compatibility with historical functions,
-- but all products are now explicitly direct-stock retail products.
UPDATE public.menu_items SET inventory_tracking_mode = 'none' WHERE inventory_tracking_mode <> 'none';

-- Legacy recipe-mode automation must no longer rewrite inventory mode.
DROP TRIGGER IF EXISTS trg_set_non_recipe_menu_inventory_mode ON public.menu_items;

-- 2. Keep old stock_items and their historical links intact, but safely carry
-- current balances into menu_items only where a stock name maps unambiguously.
WITH unique_product_names AS (
  SELECT lower(trim(name)) AS normalized_name
  FROM public.menu_items
  GROUP BY lower(trim(name))
  HAVING count(*) = 1
), unique_stock_names AS (
  SELECT lower(trim(name)) AS normalized_name, max(current_quantity) AS current_quantity
  FROM public.stock_items
  WHERE active = true
  GROUP BY lower(trim(name))
  HAVING count(*) = 1
)
UPDATE public.menu_items mi
SET current_quantity = us.current_quantity
FROM unique_product_names upn
JOIN unique_stock_names us ON us.normalized_name = upn.normalized_name
WHERE lower(trim(mi.name)) = upn.normalized_name
  AND mi.current_quantity = 0;

-- Add direct product reference to purchase records; old stock_item_id remains
-- for audit/history and is deliberately not dropped.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS menu_item_id uuid NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT;

WITH matches AS (
  SELECT p.id AS purchase_id, mi.id AS menu_item_id,
         count(*) OVER (PARTITION BY p.id) AS match_count
  FROM public.purchases p
  JOIN public.menu_items mi
    ON lower(trim(p.item_name)) = lower(trim(mi.name))
)
UPDATE public.purchases p
SET menu_item_id = m.menu_item_id
FROM matches m
WHERE m.purchase_id = p.id
  AND m.match_count = 1
  AND p.menu_item_id IS NULL;

CREATE INDEX IF NOT EXISTS purchases_menu_item_date_idx
  ON public.purchases(menu_item_id, purchase_date DESC);

-- 3. Retail stock ledger and adjustments are separate from the legacy
-- ingredient/production stock ledger.
CREATE TABLE IF NOT EXISTS public.product_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('opening_balance','purchase_received','sale','adjustment_in','adjustment_out','purchase_reversal')),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  movement_time timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reference_id uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_stock_movements_item_time_idx
  ON public.product_stock_movements(menu_item_id, movement_time DESC);

CREATE TABLE IF NOT EXISTS public.product_stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('increase','decrease')),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  notes text NULL,
  item_name text NOT NULL,
  unit text NOT NULL,
  recorded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_stock_adjustments_item_date_idx
  ON public.product_stock_adjustments(menu_item_id, adjustment_date DESC);

-- Record an opening-balance movement once for every product whose balance was
-- carried over from the legacy stock table.
INSERT INTO public.product_stock_movements(menu_item_id,movement_type,quantity,movement_date,recorded_by,notes)
SELECT mi.id,'opening_balance',mi.current_quantity,CURRENT_DATE,NULL,'Opening balance carried into retail inventory'
FROM public.menu_items mi
WHERE mi.current_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.product_stock_movements psm
    WHERE psm.menu_item_id = mi.id AND psm.movement_type = 'opening_balance'
  );

ALTER TABLE public.product_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_stock_movements_staff_read ON public.product_stock_movements;
CREATE POLICY product_stock_movements_staff_read
  ON public.product_stock_movements FOR SELECT TO authenticated
  USING (public.is_canteen_owner() OR public.is_active_employee_manager());

DROP POLICY IF EXISTS product_stock_adjustments_management_read ON public.product_stock_adjustments;
CREATE POLICY product_stock_adjustments_management_read
  ON public.product_stock_adjustments FOR SELECT TO authenticated
  USING (public.is_canteen_owner() OR public.is_active_employee_manager());

GRANT SELECT ON public.product_stock_movements, public.product_stock_adjustments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.product_stock_movements, public.product_stock_adjustments FROM anon, authenticated;

-- 4. Retire only the old purchase->stock_items trigger. The cash closing
-- protection trigger remains enabled and untouched.
DROP TRIGGER IF EXISTS purchase_updates_stock ON public.purchases;

CREATE OR REPLACE FUNCTION public.update_menu_item_stock_after_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_old_qty numeric := 0;
  v_new_qty numeric := 0;
  v_old_item uuid;
  v_new_item uuid;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    v_old_item := OLD.menu_item_id;
    v_old_qty := COALESCE(OLD.quantity, 0);
    IF v_old_item IS NOT NULL AND v_old_qty > 0 THEN
      UPDATE public.menu_items
      SET current_quantity = current_quantity - v_old_qty,
          updated_at = now()
      WHERE id = v_old_item
        AND current_quantity >= v_old_qty;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot reverse purchase: product stock would become negative';
      END IF;
      INSERT INTO public.product_stock_movements(menu_item_id,movement_type,quantity,movement_date,recorded_by,reference_id,notes)
      VALUES (v_old_item,'purchase_reversal',v_old_qty,OLD.purchase_date,auth.uid(),OLD.id,'Purchase edit/delete reversal');
    END IF;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_new_item := NEW.menu_item_id;
    v_new_qty := COALESCE(NEW.quantity, 0);
    IF v_new_item IS NOT NULL AND v_new_qty > 0 THEN
      UPDATE public.menu_items
      SET current_quantity = current_quantity + v_new_qty,
          updated_at = now()
      WHERE id = v_new_item;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected retail product does not exist';
      END IF;
      INSERT INTO public.product_stock_movements(menu_item_id,movement_type,quantity,movement_date,recorded_by,reference_id,notes)
      VALUES (v_new_item,'purchase_received',v_new_qty,NEW.purchase_date,auth.uid(),NEW.id,'Supplier purchase received');
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS purchase_updates_menu_item_stock ON public.purchases;
CREATE TRIGGER purchase_updates_menu_item_stock
AFTER INSERT OR UPDATE OR DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.update_menu_item_stock_after_purchase();

REVOKE ALL ON FUNCTION public.update_menu_item_stock_after_purchase() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_menu_item_stock_after_purchase() TO service_role;

-- Notify Owner and active Managers when a product crosses into low stock.
CREATE OR REPLACE FUNCTION public.notify_low_menu_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_enabled boolean := true;
BEGIN
  SELECT COALESCE(low_stock_alert_enabled,true) INTO v_enabled
  FROM public.canteen_settings WHERE id = true;
  IF COALESCE(v_enabled,true) = false OR NEW.active = false THEN RETURN NEW; END IF;
  IF NEW.current_quantity <= NEW.minimum_quantity
     AND ((TG_OP = 'INSERT' AND NEW.minimum_quantity > 0)
       OR (TG_OP = 'UPDATE' AND (OLD.current_quantity > OLD.minimum_quantity OR OLD.minimum_quantity IS DISTINCT FROM NEW.minimum_quantity))) THEN
    INSERT INTO public.app_notifications(user_id,title,message,notification_type,related_table,related_record_id)
    SELECT DISTINCT er.user_id,
      'Low product stock',
      NEW.name || ' is at ' || NEW.current_quantity::text || ' ' || NEW.unit || ' (reorder level: ' || NEW.minimum_quantity::text || ').',
      'low_stock', 'menu_items', NEW.id
    FROM public.employee_roles er
    WHERE er.is_active = true AND er.role = 'manager' AND er.user_id IS NOT NULL
    UNION
    SELECT er.user_id,
      'Low product stock',
      NEW.name || ' is at ' || NEW.current_quantity::text || ' ' || NEW.unit || ' (reorder level: ' || NEW.minimum_quantity::text || ').',
      'low_stock', 'menu_items', NEW.id
    FROM public.employee_roles er
    WHERE er.is_active = true AND er.role = 'owner' AND er.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_notify_low_menu_item_stock ON public.menu_items;
CREATE TRIGGER trg_notify_low_menu_item_stock
AFTER INSERT OR UPDATE OF current_quantity,minimum_quantity,active ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.notify_low_menu_item_stock();
REVOKE ALL ON FUNCTION public.notify_low_menu_item_stock() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_low_menu_item_stock() TO service_role;

-- 5. Stock adjustment RPC. Managers and Owner may use it; cashier cannot.
CREATE OR REPLACE FUNCTION public.adjust_menu_item_stock(
  p_menu_item_id uuid,
  p_adjustment_type text,
  p_quantity numeric,
  p_reason text,
  p_notes text DEFAULT NULL,
  p_adjustment_date date DEFAULT CURRENT_DATE
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_item public.menu_items%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_canteen_owner() OR public.is_active_employee_manager()) THEN
    RAISE EXCEPTION 'Only an active Owner or Manager can adjust product stock';
  END IF;
  IF p_adjustment_type NOT IN ('increase','decrease') OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Invalid stock adjustment';
  END IF;
  IF NULLIF(trim(p_reason),'') IS NULL THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT * INTO v_item FROM public.menu_items WHERE id = p_menu_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  IF p_adjustment_type = 'increase' THEN
    UPDATE public.menu_items SET current_quantity = current_quantity + p_quantity, updated_at = now() WHERE id = p_menu_item_id;
    INSERT INTO public.product_stock_movements(menu_item_id,movement_type,quantity,movement_date,recorded_by,notes)
    VALUES (p_menu_item_id,'adjustment_in',p_quantity,COALESCE(p_adjustment_date,CURRENT_DATE),auth.uid(),p_reason);
  ELSE
    UPDATE public.menu_items SET current_quantity = current_quantity - p_quantity, updated_at = now()
    WHERE id = p_menu_item_id AND current_quantity >= p_quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock for this adjustment'; END IF;
    INSERT INTO public.product_stock_movements(menu_item_id,movement_type,quantity,movement_date,recorded_by,notes)
    VALUES (p_menu_item_id,'adjustment_out',p_quantity,COALESCE(p_adjustment_date,CURRENT_DATE),auth.uid(),p_reason);
  END IF;

  INSERT INTO public.product_stock_adjustments(menu_item_id,adjustment_date,adjustment_type,quantity,reason,notes,item_name,unit,recorded_by)
  VALUES (p_menu_item_id,COALESCE(p_adjustment_date,CURRENT_DATE),p_adjustment_type,p_quantity,trim(p_reason),NULLIF(trim(p_notes),''),v_item.name,v_item.unit,auth.uid());
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.adjust_menu_item_stock(uuid,text,numeric,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_menu_item_stock(uuid,text,numeric,text,text,date) TO authenticated;

-- 6. Cashier menu RPC: returns directly saleable retail products and stock.
CREATE OR REPLACE FUNCTION public.cashier_retail_pos_menu()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_canteen_owner() OR EXISTS (SELECT 1 FROM public.employee_roles er WHERE er.user_id = auth.uid() AND er.role = 'cashier' AND er.is_active = true)) THEN
    RAISE EXCEPTION 'Only an active cashier or Owner can access the POS menu';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menu_item_id',mi.id,
    'item_name',mi.name,
    'category_name',mc.name,
    'unit',mi.unit,
    'selling_price',mi.selling_price,
    'current_quantity',mi.current_quantity
  ) ORDER BY mc.name,mi.name),'[]'::jsonb)
  INTO v_result
  FROM public.menu_items mi
  LEFT JOIN public.menu_categories mc ON mc.id = mi.category_id
  WHERE mi.active = true AND mi.selling_price > 0 AND mi.current_quantity > 0;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.cashier_retail_pos_menu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cashier_retail_pos_menu() TO authenticated;

-- Remove the previous five-argument draft signature if this migration is being upgraded.
DROP FUNCTION IF EXISTS public.process_retail_pos_checkout(jsonb,text,numeric,uuid,text);

-- 7. Direct retail POS checkout. Existing receipt/history RPCs continue to
-- read pos_sales and pos_sale_items; this function no longer touches recipes,
-- stock_items, or production tables.
CREATE OR REPLACE FUNCTION public.process_retail_pos_checkout(
  p_items jsonb,
  p_payment_method text,
  p_amount_paid numeric,
  p_checkout_request_id uuid,
  p_notes text DEFAULT NULL,
  p_physical_stock_confirmed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_business_date date := (now() AT TIME ZONE 'Africa/Harare')::date;
  v_cash_position_id uuid;
  v_existing public.pos_sales%ROWTYPE;
  v_item record;
  v_product public.menu_items%ROWTYPE;
  v_sale_id uuid;
  v_receipt text;
  v_total numeric(14,2) := 0;
  v_paid numeric(14,2) := COALESCE(p_amount_paid,0);
  v_change numeric(14,2) := 0;
  v_quantity numeric(14,3);
  v_line_total numeric(14,2);
  v_cash numeric(14,2) := 0;
  v_mobile numeric(14,2) := 0;
  v_card numeric(14,2) := 0;
  v_physical_stock_confirmed boolean := COALESCE(p_physical_stock_confirmed,false);
BEGIN
  IF v_user IS NULL OR NOT (public.is_canteen_owner() OR EXISTS (SELECT 1 FROM public.employee_roles er WHERE er.user_id = v_user AND er.role = 'cashier' AND er.is_active = true)) THEN
    RAISE EXCEPTION 'Only an active cashier or Owner can complete a sale';
  END IF;
  IF p_checkout_request_id IS NULL THEN RAISE EXCEPTION 'Checkout request ID is required'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) x GROUP BY (x->>'menu_item_id') HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'The cart contains a duplicate product line';
  END IF;
  IF p_payment_method NOT IN ('cash','mobile_money','bank_card') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text),hashtext(p_checkout_request_id::text));
  SELECT * INTO v_existing FROM public.pos_sales WHERE checkout_request_id = p_checkout_request_id AND cashier_user_id = v_user LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('sale_id',v_existing.id,'receipt_number',v_existing.receipt_number,'total_amount',v_existing.total_amount,'amount_paid',v_existing.amount_paid,'change_amount',v_existing.change_amount,'sale_datetime',v_existing.sale_datetime);
  END IF;

  -- Validate and lock every product in stable UUID order to avoid race conditions.
  FOR v_item IN
    SELECT (x->>'menu_item_id')::uuid AS menu_item_id, (x->>'quantity')::numeric AS quantity
    FROM jsonb_array_elements(p_items) x
    ORDER BY (x->>'menu_item_id')::uuid
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
    SELECT * INTO v_product FROM public.menu_items WHERE id = v_item.menu_item_id AND active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A selected product is unavailable'; END IF;
    IF v_product.selling_price <= 0 THEN RAISE EXCEPTION 'Product % has no valid selling price',v_product.name; END IF;
    IF v_product.current_quantity < v_item.quantity AND NOT v_physical_stock_confirmed THEN
      RAISE EXCEPTION 'Physical stock confirmation is required for % (recorded available: %, requested: %)',
        v_product.name,v_product.current_quantity,v_item.quantity;
    END IF;
    v_total := v_total + round(v_product.selling_price * v_item.quantity,2);
  END LOOP;

  IF v_paid < v_total THEN RAISE EXCEPTION 'Amount paid is less than sale total'; END IF;
  IF p_payment_method <> 'cash' AND round(v_paid,2) <> round(v_total,2) THEN
    RAISE EXCEPTION 'Non-cash payment must equal the exact sale total';
  END IF;
  IF p_payment_method = 'cash' THEN v_cash := v_total; v_change := v_paid - v_total;
  ELSIF p_payment_method = 'mobile_money' THEN v_mobile := v_total;
  ELSE v_card := v_total; END IF;

  SELECT id INTO v_cash_position_id FROM public.cash_positions
  WHERE cash_date = v_business_date AND closing_status = 'open'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_cash_position_id IS NULL THEN RAISE EXCEPTION 'No open cash session exists for today. Ask the Manager or Owner to open cash first.'; END IF;

  v_receipt := 'MC-' || to_char(clock_timestamp() AT TIME ZONE 'Africa/Harare','YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  INSERT INTO public.pos_sales(receipt_number,cashier_user_id,sale_datetime,payment_method,total_amount,amount_paid,change_amount,sale_status,notes,checkout_request_id)
  VALUES (v_receipt,v_user,now(),p_payment_method,v_total,v_paid,v_change,'completed',NULLIF(trim(p_notes),''),p_checkout_request_id)
  RETURNING id INTO v_sale_id;

  FOR v_item IN
    SELECT (x->>'menu_item_id')::uuid AS menu_item_id, (x->>'quantity')::numeric AS quantity
    FROM jsonb_array_elements(p_items) x
    ORDER BY (x->>'menu_item_id')::uuid
  LOOP
    SELECT * INTO v_product FROM public.menu_items WHERE id = v_item.menu_item_id FOR UPDATE;
    v_quantity := v_item.quantity;
    v_line_total := round(v_product.selling_price * v_quantity,2);
    INSERT INTO public.pos_sale_items(sale_id,menu_item_id,item_name,unit,quantity,unit_price,line_total)
    VALUES (v_sale_id,v_product.id,v_product.name,v_product.unit,v_quantity,v_product.selling_price,v_line_total);
    UPDATE public.menu_items
    SET current_quantity = current_quantity - v_quantity, updated_at = now()
    WHERE id = v_product.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock update failed for %',v_product.name; END IF;
    INSERT INTO public.product_stock_movements(menu_item_id,movement_type,quantity,movement_date,recorded_by,reference_id,notes)
    VALUES (
      v_product.id,'sale',v_quantity,v_business_date,v_user,v_sale_id,
      'POS sale ' || v_receipt ||
      CASE WHEN v_product.current_quantity < v_quantity
        THEN ' — cashier physically confirmed additional stock; recorded shortage: ' ||
             (v_quantity - v_product.current_quantity)::text
        ELSE ''
      END
    );
  END LOOP;

  UPDATE public.daily_payments
  SET cash_amount = COALESCE(cash_amount,0) + v_cash,
      mobile_money_amount = COALESCE(mobile_money_amount,0) + v_mobile,
      bank_card_amount = COALESCE(bank_card_amount,0) + v_card,
      pos_cash_amount = COALESCE(pos_cash_amount,0) + v_cash,
      pos_mobile_money_amount = COALESCE(pos_mobile_money_amount,0) + v_mobile,
      pos_bank_card_amount = COALESCE(pos_bank_card_amount,0) + v_card,
      updated_at = now()
  WHERE payment_date = v_business_date;
  IF NOT FOUND THEN
    INSERT INTO public.daily_payments(payment_date,cash_amount,mobile_money_amount,bank_card_amount,manual_cash_amount,manual_mobile_money_amount,manual_bank_card_amount,pos_cash_amount,pos_mobile_money_amount,pos_bank_card_amount)
    VALUES (v_business_date,v_cash,v_mobile,v_card,0,0,0,v_cash,v_mobile,v_card);
  END IF;

  RETURN jsonb_build_object('sale_id',v_sale_id,'receipt_number',v_receipt,'total_amount',v_total,'amount_paid',v_paid,'change_amount',v_change,'sale_datetime',now());
END;
$function$;
REVOKE ALL ON FUNCTION public.process_retail_pos_checkout(jsonb,text,numeric,uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_retail_pos_checkout(jsonb,text,numeric,uuid,text,boolean) TO authenticated;

-- 8. Disable the previous recipe/production POS entry points and old Chef stock
-- request/production RPCs for authenticated clients. Tables and history remain.
REVOKE ALL ON FUNCTION public.process_pos_checkout(jsonb,text,numeric,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cashier_pos_menu_v2() FROM PUBLIC, anon, authenticated;
DO $block$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'chef\_%'
        OR p.proname IN ('employee_stock_requests','manager_fulfil_stock_request','manager_review_stock_request','manager_stock_request_history'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.signature);
  END LOOP;
END;
$block$;

-- 9. Unified reporting view: preserve historical manually-entered daily sales
-- and append POS-confirmed retail sale lines. New sales are POS-only.
CREATE OR REPLACE VIEW public.retail_daily_sales WITH (security_invoker = true) AS
SELECT
  ds.id,
  ds.sale_date,
  NULL::timestamptz AS sale_datetime,
  NULL::text AS receipt_number,
  ds.menu_item_id,
  mi.category_id,
  ds.item_name,
  ds.unit,
  ds.selling_price,
  ds.opening_stock,
  ds.stock_added,
  ds.quantity_sold,
  ds.wasted,
  ds.closing_stock,
  ds.sales_value,
  ds.notes
FROM public.daily_sales ds
LEFT JOIN public.menu_items mi ON mi.id = ds.menu_item_id
UNION ALL
SELECT
  psi.id,
  (ps.sale_datetime AT TIME ZONE 'Africa/Harare')::date AS sale_date,
  ps.sale_datetime,
  ps.receipt_number,
  psi.menu_item_id,
  mi.category_id,
  psi.item_name,
  psi.unit,
  psi.unit_price AS selling_price,
  0::numeric AS opening_stock,
  0::numeric AS stock_added,
  psi.quantity AS quantity_sold,
  0::numeric AS wasted,
  NULL::numeric AS closing_stock,
  psi.line_total AS sales_value,
  ps.notes
FROM public.pos_sale_items psi
JOIN public.pos_sales ps ON ps.id = psi.sale_id
LEFT JOIN public.menu_items mi ON mi.id = psi.menu_item_id
WHERE ps.sale_status = 'completed';
GRANT SELECT ON public.retail_daily_sales TO authenticated;

COMMIT;

-- After successful migration, validate balances and POS RPCs before retiring
-- legacy production tables/functions. Those historical objects are intentionally
-- preserved by this first migration.
