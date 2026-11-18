DROP POLICY IF EXISTS "Anyone with the link can view" ON public.shares;
REVOKE SELECT ON public.shares FROM anon;
CREATE POLICY "Owners read shares" ON public.shares FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.get_share(_id uuid)
RETURNS TABLE (title text, snapshot jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT s.title, s.snapshot FROM public.shares s WHERE s.id = _id $$;
REVOKE EXECUTE ON FUNCTION public.get_share(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share(uuid) TO anon, authenticated, service_role;