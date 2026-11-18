CREATE TABLE public.ai_request_guards (user_id uuid PRIMARY KEY, starts timestamptz[] NOT NULL DEFAULT '{}', lease_id uuid, lease_until timestamptz);
GRANT ALL ON public.ai_request_guards TO service_role;
REVOKE ALL ON public.ai_request_guards FROM anon, authenticated;
ALTER TABLE public.ai_request_guards ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reserve_ai_request(_user_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.ai_request_guards; stamp timestamptz := clock_timestamp(); ticket uuid := gen_random_uuid();
BEGIN
 IF _user_id IS NULL THEN RAISE EXCEPTION 'Account required'; END IF;
 INSERT INTO public.ai_request_guards(user_id) VALUES(_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.ai_request_guards WHERE user_id = _user_id FOR UPDATE;
 stamp := clock_timestamp();
 IF r.lease_until > stamp THEN RAISE EXCEPTION 'One AI request is already running. Wait for it to finish.'; END IF;
 SELECT COALESCE(array_agg(s ORDER BY s), '{}') INTO r.starts FROM unnest(r.starts) s WHERE s > stamp - interval '1 minute';
 IF cardinality(r.starts) >= 6 THEN RAISE EXCEPTION 'Six AI requests started in the last minute. Wait one minute and try again.'; END IF;
 UPDATE public.ai_request_guards SET starts = array_append(r.starts,stamp), lease_id=ticket, lease_until=stamp + interval '120 seconds' WHERE user_id=_user_id;
 RETURN ticket;
END $$;
CREATE OR REPLACE FUNCTION public.release_ai_request(_user_id uuid, _ticket uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.ai_request_guards SET lease_id=NULL,lease_until=NULL WHERE user_id=_user_id AND lease_id=_ticket;
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_request(uuid), public.release_ai_request(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request(uuid), public.release_ai_request(uuid,uuid) TO service_role;