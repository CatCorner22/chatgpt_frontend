CREATE TABLE public.brand_builds (
  user_id uuid NOT NULL,
  build_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled design',
  collection text NOT NULL DEFAULT '',
  favorite boolean NOT NULL DEFAULT false,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_builds TO authenticated;
GRANT ALL ON public.brand_builds TO service_role;
ALTER TABLE public.brand_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_builds_owner ON public.brand_builds FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);