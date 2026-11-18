CREATE OR REPLACE FUNCTION public.owner_counts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN jsonb_build_object(
    'weeks', (SELECT coalesce(jsonb_agg(jsonb_build_object('week', wk, 'visions', n) ORDER BY wk), '[]'::jsonb) FROM (
      SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS wk, count(*) AS n
      FROM public.vision_events WHERE created_at > now() - interval '12 weeks' GROUP BY 1) x),
    'badges', (SELECT count(*) FROM public.badges),
    'passing', (SELECT count(*) FROM public.badges WHERE passing),
    'lost', (SELECT count(*) FROM public.badges WHERE NOT passing)
  );
END $$;