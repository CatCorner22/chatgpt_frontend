import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chooseProvider } from "@/lib/ai-provider";

describe("AI provider choice", () => {
  it("defaults to Lovable AI", () => {
    expect(chooseProvider({ LOVABLE_API_KEY: "k" }).provider).toBe("lovable");
  });
  it("switches to Claude with its own key", () => {
    const c = chooseProvider({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    expect(c.provider).toBe("anthropic");
    expect(c.model).toBe("claude-sonnet-5");
  });
  it("refuses when the chosen service has no key", () => {
    expect(() => chooseProvider({ AI_PROVIDER: "anthropic", LOVABLE_API_KEY: "k" })).toThrow("AI is not configured.");
  });
  it("refuses unknown services", () => {
    expect(() => chooseProvider({ AI_PROVIDER: "other", LOVABLE_API_KEY: "k" })).toThrow();
  });
});

describe("Lovable-only AI code stays in one place", () => {
  it("only ai.server.ts names the AI gateway", () => {
    const hits: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "test") walk(p); } else if (/\.(ts|tsx)$/.test(f) && readFileSync(p, "utf8").includes("ai.gateway.lovable.dev")) hits.push(p); } };
    walk("src");
    expect(hits).toEqual(["src/lib/ai.server.ts"]);
  });
});
