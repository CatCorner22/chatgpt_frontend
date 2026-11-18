import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => ({ redirect: options }),
}));
import { Route } from "@/routes/[.]lovable.oauth.consent";
const beforeLoad = (
  Route as unknown as {
    beforeLoad: (input: {
      search: { authorization_id: string };
      location: { pathname: string; searchStr: string };
    }) => Promise<void>;
  }
).beforeLoad;
const input = {
  search: { authorization_id: "fixture-authorization" },
  location: {
    pathname: "/.lovable/oauth/consent",
    searchStr: "?authorization_id=fixture-authorization",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://backend.example.com");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "fixture-public-key");
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: "supabase-fixture" } } } });
});
afterEach(() => vi.unstubAllEnvs());
it("redirects unsupported hosted OAuth before reading any Supabase session, even with stray backend config", async () => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "true");
  await expect(beforeLoad(input)).rejects.toEqual({ redirect: { to: "/auth" } });
  expect(auth.getSession).not.toHaveBeenCalled();
});
it("preserves the portable connected-backend OAuth session check", async () => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  await expect(beforeLoad(input)).resolves.toBeUndefined();
  expect(auth.getSession).toHaveBeenCalledOnce();
});
it("redirects an unconfigured portable install without touching the lazy Supabase client", async () => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  await expect(beforeLoad(input)).rejects.toEqual({ redirect: { to: "/auth" } });
  expect(auth.getSession).not.toHaveBeenCalled();
});
