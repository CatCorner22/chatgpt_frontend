CREATE TABLE public.design_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, design_id uuid NOT NULL, title text NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(), fingerprint text NOT NULL, details jsonb NOT NULL DEFAULT '{}', UNIQUE(user_id, design_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_progress TO authenticated;
GRANT ALL ON public.design_progress TO service_role;
ALTER TABLE public.design_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY progress_owner ON public.design_progress FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE INDEX progress_owner_idx ON public.design_progress(user_id);