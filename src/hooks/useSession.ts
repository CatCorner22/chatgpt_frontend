import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hasCloudBackend } from "@/lib/runtime-config";

// Session-aware header state; hydrates after mount so SSR markup stays stable.
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (!hasCloudBackend()) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    }).catch(() => {
      if (active) setUser(null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return user;
}
