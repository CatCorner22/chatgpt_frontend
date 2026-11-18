CREATE TABLE public.vision_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  design_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  vision text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, design_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_links TO authenticated;
GRANT ALL ON public.vision_links TO service_role;
ALTER TABLE public.vision_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY vision_links_owner ON public.vision_links FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.get_vision(_token text)
RETURNS TABLE(title text, vision text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.title, v.vision, v.updated_at FROM public.vision_links v
  WHERE v.token = _token AND v.enabled AND length(_token) >= 32
$$;
REVOKE ALL ON FUNCTION public.get_vision(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vision(text) TO anon, authenticated;

ALTER TABLE public.badges ADD COLUMN showcase boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.list_showcase()
RETURNS TABLE(id uuid, url text, title text, score integer, issued_at timestamptz, checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.url, b.title, b.score, b.issued_at, b.checked_at FROM public.badges b
  WHERE b.showcase AND b.passing ORDER BY b.checked_at DESC NULLS LAST LIMIT 60
$$;
REVOKE ALL ON FUNCTION public.list_showcase() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_showcase() TO anon, authenticated;

CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_roles_read ON public.user_roles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.vision_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  design_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, design_id)
);
GRANT SELECT, INSERT ON public.vision_events TO authenticated;
GRANT ALL ON public.vision_events TO service_role;
ALTER TABLE public.vision_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_events_insert ON public.vision_events FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY admin_events_read ON public.vision_events FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION public.owner_counts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN jsonb_build_object(
    'weeks', (SELECT coalesce(jsonb_agg(w ORDER BY w->>'week'), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('week', to_char(date_trunc('week', created_at), 'YYYY-MM-DD'), 'visions', count(*)) w
      FROM public.vision_events WHERE created_at > now() - interval '12 weeks' GROUP BY 1 ORDER BY 1) x),
    'badges', (SELECT count(*) FROM public.badges),
    'passing', (SELECT count(*) FROM public.badges WHERE passing),
    'lost', (SELECT count(*) FROM public.badges WHERE NOT passing)
  );
END $$;
REVOKE ALL ON FUNCTION public.owner_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_counts() TO authenticated;