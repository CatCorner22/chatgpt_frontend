import { describe, expect, it, vi, afterEach } from "vitest";
import { hasCloudBackend, isCloudConfigured } from "@/lib/runtime-config";

afterEach(() => vi.unstubAllEnvs());

describe("optional cloud configuration", () => {
  it("keeps the local studio usable with absent or partial configuration", () => {
    expect(isCloudConfigured(undefined, undefined)).toBe(false);
    expect(isCloudConfigured("https://example.supabase.co", "")).toBe(false);
    expect(isCloudConfigured("not-a-url", "key")).toBe(false);
    expect(isCloudConfigured("javascript:alert(1)", "key")).toBe(false);
    expect(isCloudConfigured("https://example.supabase.co", "public-key")).toBe(true);
  });

  it("does not use server credentials as browser configuration", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "server-only-key");
    expect(hasCloudBackend()).toBe(false);
  });

  it("does not mix a separate Supabase account with hosted Sites identity", () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-key");
    expect(hasCloudBackend()).toBe(false);
  });
});
