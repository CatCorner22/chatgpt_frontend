import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  request: vi.fn<() => Request>(),
  owner: vi.fn<() => string | null>(),
  portable: { options: { portable: true } },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: fixtures.request }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fixtures.portable,
}));
vi.mock("@/lib/browser-storage", () => ({ getBrowserOwnerId: fixtures.owner }));

function request(overrides: Record<string, string> = {}, method = "POST") {
  return new Request("https://focus.example/_serverFn/test", {
    method,
    headers: {
      origin: "https://focus.example",
      "oai-authenticated-user-id": "sites-person-a",
      "x-focus-user": "sites-person-a",
      ...overrides,
    },
  });
}
async function hosted() {
  vi.stubEnv("VITE_FOCUS_HOSTED", "true");
  const { requireMeasuredAuth } = await import("@/lib/measured-auth");
  return requireMeasuredAuth.options as unknown as {
    server: (input: { next: (value: unknown) => Promise<unknown> }) => Promise<unknown>;
    client: (input: { next: (value: unknown) => Promise<unknown> }) => Promise<unknown>;
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fixtures.request.mockReturnValue(request());
  fixtures.owner.mockReturnValue("sites-person-a");
});
afterEach(() => vi.unstubAllEnvs());

describe("measured checks use the configured identity provider", () => {
  it("keeps the established Supabase authentication in portable mode", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "false");
    expect((await import("@/lib/measured-auth")).requireMeasuredAuth).toBe(fixtures.portable);
  });
  it("passes only the trusted hosted user id to the measured handler", async () => {
    const next = vi.fn().mockResolvedValue("measured result");
    expect(await (await hosted()).server({ next })).toBe("measured result");
    expect(next).toHaveBeenCalledWith({ context: { userId: "sites-person-a" } });
  });
  it.each([
    [{ "oai-authenticated-user-id": "" }, "Sign in"],
    [{ "oai-authenticated-user-id": "x".repeat(1025) }, "Sign in"],
    [{ "x-focus-user": "sites-person-b" }, "account changed"],
    [{ "x-focus-user": "" }, "account changed"],
    [{ origin: "https://attacker.example" }, "this Focus site"],
    [{ origin: "null" }, "this Focus site"],
    [{ origin: "" }, "this Focus site"],
  ])(
    "rejects unverified or mismatched requests without calling the handler: %j",
    async (headers, message) => {
      fixtures.request.mockReturnValue(request(headers));
      const next = vi.fn();
      await expect((await hosted()).server({ next })).rejects.toThrow(message);
      expect(next).not.toHaveBeenCalled();
    },
  );
  it("requires a POST even when identity matches", async () => {
    fixtures.request.mockReturnValue(request({}, "GET"));
    await expect((await hosted()).server({ next: vi.fn() })).rejects.toThrow("this Focus site");
  });
  it("attaches the immutable browser owner, not a caller-supplied identity", async () => {
    const next = vi.fn().mockResolvedValue("measured result");
    expect(await (await hosted()).client({ next })).toBe("measured result");
    expect(next).toHaveBeenCalledWith({ headers: { "X-Focus-User": "sites-person-a" } });
  });
  it("does not send requests from a signed-out preview", async () => {
    fixtures.owner.mockReturnValue(null);
    const next = vi.fn();
    await expect((await hosted()).client({ next })).rejects.toThrow("Sign in");
    expect(next).not.toHaveBeenCalled();
  });
  it("discards a response if the account is locked while it is in flight", async () => {
    const next = vi.fn().mockImplementation(async () => {
      fixtures.owner.mockImplementation(() => {
        throw new Error("Your session needs verification.");
      });
      return "late result";
    });
    await expect((await hosted()).client({ next })).rejects.toThrow("session needs verification");
  });
});
