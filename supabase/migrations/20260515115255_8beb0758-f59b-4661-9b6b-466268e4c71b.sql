ALTER TABLE public.platform_commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors can insert own withdrawal rows" ON public.platform_commission_ledger;

CREATE POLICY "Vendors can insert own withdrawal rows"
ON public.platform_commission_ledger
FOR INSERT
TO authenticated
WITH CHECK (
  transaction_type = 'WITHDRAWAL'::public.platform_commission_transaction_type
  AND amount < 0
  AND order_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = platform_commission_ledger.vendor_id
      AND v.user_id = auth.uid()
  )
);