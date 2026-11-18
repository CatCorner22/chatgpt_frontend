CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled design',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shares TO anon;
GRANT SELECT, INSERT, DELETE ON public.shares TO authenticated;
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone with the link can view" ON public.shares FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners create shares" ON public.shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners delete shares" ON public.shares FOR DELETE TO authenticated USING (auth.uid() = user_id);