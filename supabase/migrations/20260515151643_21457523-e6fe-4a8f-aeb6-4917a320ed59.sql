CREATE OR REPLACE FUNCTION public.increment_campaign_view(campaign_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.site_ads
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = campaign_id_input;
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_campaign_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_campaign_view(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_campaign_view(uuid) TO authenticated;