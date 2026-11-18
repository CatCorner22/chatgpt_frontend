CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  design_id text NOT NULL,
  tokens jsonb NOT NULL,
  passing boolean NOT NULL DEFAULT true,
  score integer,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  next_check timestamptz NOT NULL DEFAULT now() + interval '7 days',
  lease_until timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY badges_owner ON public.badges FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.get_badge(_id uuid)
RETURNS TABLE(url text, title text, design_id text, passing boolean, score integer, reasons jsonb, history jsonb, issued_at timestamptz, checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.url, b.title, b.design_id, b.passing, b.score, b.reasons, b.history, b.issued_at, b.checked_at
  FROM public.badges b WHERE b.id = _id
$$;
REVOKE ALL ON FUNCTION public.get_badge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_badge(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_badge(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.badges SET lease_until = now() + interval '2 minutes'
  WHERE id = _id AND (lease_until IS NULL OR lease_until < now());
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_badge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_badge(uuid) TO service_role;