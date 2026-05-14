ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS admin_settled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_vendor_admin_collection
ON public.orders (vendor_id, status, admin_settled)
WHERE status = 'cash_transferred_to_vendor';