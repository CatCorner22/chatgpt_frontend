import { beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ measured: { kind: "measured" }, supabase: { kind: "supabase" } }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let middleware: unknown;
    const chain = {
      middleware: (value: unknown) => {
        middleware = value;
        return chain;
      },
      inputValidator: () => chain,
      handler: (fn: object) => Object.assign(fn, { middleware }),
    };
    return chain;
  },
}));
vi.mock("@/lib/measured-auth", () => ({ requireMeasuredAuth: auth.measured }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: auth.supabase }));
vi.mock("@/lib/ai.server", () => ({
  askObject: vi.fn().mockRejectedValue(new Error("AI paused")),
}));
vi.mock("@/lib/signing.server", () => ({ stampStatus: vi.fn().mockResolvedValue("unsigned") }));
vi.mock("@/lib/public-page.server", () => ({
  grabPublicDocument: vi.fn(),
  grabPublicPage: vi.fn(),
}));
vi.mock("@/lib/watchtower.server", () => ({ grabSiteSources: vi.fn() }));

import { critiqueUrl, critiqueShot } from "@/lib/critic.functions";
import { inspireFromSite } from "@/lib/inspire.functions";
import { grabPublicDocument, grabPublicPage } from "@/lib/public-page.server";
import { grabSiteSources } from "@/lib/watchtower.server";
import { AI_SPENDING_ENABLED } from "@/lib/ai-policy";

beforeEach(() => vi.clearAllMocks());
it("routes only measured tools through the hosted-capable identity boundary", () => {
  expect((critiqueUrl as unknown as { middleware: unknown }).middleware).toEqual([auth.measured]);
  expect((inspireFromSite as unknown as { middleware: unknown }).middleware).toEqual([
    auth.measured,
  ]);
  expect((critiqueShot as unknown as { middleware: unknown }).middleware).toEqual([auth.supabase]);
});
it("returns measurable findings and preserved source without paid AI", async () => {
  expect(AI_SPENDING_ENABLED).toBe(false);
  vi.mocked(grabPublicDocument).mockResolvedValue({
    text: '<title>Clay House</title><h1>Book a class</h1><a href="/book">Book now</a>',
    url: "https://example.com/",
    complete: true,
  });
  vi.mocked(grabPublicPage).mockResolvedValue(null);
  const run = critiqueUrl as unknown as (input: {
    data: { url: string };
    context: { userId: string };
  }) => Promise<{
    review: unknown;
    findings: unknown[];
    source: { content: { headline: string } };
    inventory: { links: string[] };
  }>;
  const result = await run({
    data: { url: "https://example.com/" },
    context: { userId: "sites-person-a" },
  });
  expect(result.review).toBeNull();
  expect(result.findings.length).toBeGreaterThan(0);
  expect(result.source.content.headline).toBe("Book a class");
  expect(result.inventory.links).toContain("/book");
});
it("keeps inspiration measured and returns a bounded error when a page cannot be read", async () => {
  vi.mocked(grabSiteSources).mockResolvedValue({
    html: "<h1>Original business copy</h1>",
    css: "body { color: #172432; font-family: Georgia; }",
  } as Awaited<ReturnType<typeof grabSiteSources>>);
  const run = inspireFromSite as unknown as (input: {
    data: { url: string };
  }) => Promise<{ ok: boolean; tokens?: unknown; error?: string }>;
  const result = await run({ data: { url: "example.com" } });
  expect(result.ok).toBe(true);
  expect(result.tokens).toBeDefined();
  expect(JSON.stringify(result)).not.toContain("Original business copy");
  vi.mocked(grabSiteSources).mockRejectedValue(new Error("This address is private"));
  expect(await run({ data: { url: "private.example" } })).toEqual({
    ok: false,
    error: "That doesn't look like a public website address.",
  });
});
