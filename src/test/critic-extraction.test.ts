import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  },
}));
vi.mock("@/lib/measured-auth", () => ({ requireMeasuredAuth: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/ai.server", () => ({
  askObject: vi.fn().mockRejectedValue(new Error("AI paused")),
}));
vi.mock("@/lib/signing.server", () => ({
  stampStatus: vi.fn().mockResolvedValue({ kind: "unsigned" }),
}));
vi.mock("@/lib/public-page.server", () => ({
  grabPublicDocument: vi.fn(),
  grabPublicPage: vi.fn(),
}));
import { critiqueUrl } from "@/lib/critic.functions";
import { grabPublicDocument, grabPublicPage } from "@/lib/public-page.server";

beforeEach(() => vi.clearAllMocks());
it("carries redirected document provenance and partial source status into the critique", async () => {
  const html =
    '<title>Shop</title><link data-note=">" data-href="wrong.css" href="style.css" rel="stylesheet"><h1>Shop</h1><a href="checkout">Checkout</a>';
  vi.mocked(grabPublicDocument).mockResolvedValue({
    text: html,
    url: "https://example.com/shop/",
    complete: false,
  });
  vi.mocked(grabPublicPage).mockResolvedValue(html);
  const run = critiqueUrl as unknown as (input: {
    data: { url: string };
    context: { userId: string };
  }) => Promise<{
    source: { url: string };
    inventory: { url: string; links: string[]; completeness: string };
  }>;
  const result = await run({
    data: { url: "https://example.com/old" },
    context: { userId: "fixture-user" },
  });
  expect(result.source.url).toBe("https://example.com/shop/");
  expect(result.inventory).toMatchObject({
    url: "https://example.com/shop/",
    links: ["/shop/checkout"],
    completeness: "partial",
  });
  expect(grabPublicPage).toHaveBeenCalledWith("https://example.com/shop/style.css", 300_000);
});
