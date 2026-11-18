import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ssr = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: ssr.fetch } }));
vi.mock("@/lib/error-capture", () => ({ consumeLastCapturedError: () => undefined }));
import entry from "@/server";

const origin = "https://focus.example";
const bucket = () => ({ get: vi.fn().mockResolvedValue(null), put: vi.fn(), delete: vi.fn() });
function request(path: string, user: string | null = "sites-person-a") {
  const headers = new Headers();
  if (user) {
    headers.set("oai-authenticated-user-id", user);
    headers.set("oai-authenticated-user-email", "person@example.com");
    headers.set("x-focus-user", user);
  }
  return new Request(origin + path, { headers });
}
function nitroRequest(path: string, env: unknown, user: string | null = "sites-person-a") {
  // This is the request shape emitted by Nitro's Cloudflare preset, not the SSR fetch options.
  return Object.assign(request(path, user), { runtime: { cloudflare: { env } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubEnv("VITE_FOCUS_HOSTED", "true");
  vi.stubEnv("DEV", false);
  ssr.fetch.mockResolvedValue(
    new Response("SSR page", { headers: { "content-type": "text/html" } }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the actual server entry dispatches hosted APIs", () => {
  it("uses Nitro's request-attached binding before framework fetch options", async () => {
    const actual = bucket();
    const incorrect = bucket();
    const response = await entry.fetch(
      nitroRequest("/api/hosted/library", { BUCKET: actual }),
      { BUCKET: incorrect },
      {},
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
    expect(actual.get).toHaveBeenCalledOnce();
    expect(actual.get.mock.calls[0]?.[0]).toMatch(
      /^focus-library\/v1\/[0-9a-f]{64}\/latest\.json$/,
    );
    expect(incorrect.get).not.toHaveBeenCalled();
    expect(ssr.fetch).not.toHaveBeenCalled();
  });
  it.each([
    ["identity and usable binding", "sites-person-a", { BUCKET: bucket() }, true],
    ["identity without binding", "sites-person-a", {}, false],
    ["identity with malformed binding", "sites-person-a", { BUCKET: { get: () => null } }, false],
    ["binding without identity", null, { BUCKET: bucket() }, false],
  ] as const)("reports storage truthfully for %s", async (_label, user, bindings, available) => {
    const response = await entry.fetch(nitroRequest("/api/hosted/session", bindings, user), {}, {});
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      user: user ? { id: user, email: "person@example.com" } : null,
      storageAvailable: available,
      mode: "hosted",
    });
    expect(ssr.fetch).not.toHaveBeenCalled();
  });
  it("also accepts the actual env argument for a direct Worker invocation", async () => {
    const response = await entry.fetch(request("/api/hosted/session"), { BUCKET: bucket() }, {});
    expect(await response.json()).toMatchObject({
      user: { id: "sites-person-a" },
      storageAvailable: true,
    });
    expect(ssr.fetch).not.toHaveBeenCalled();
  });
  it("never substitutes an env user or supplied browser owner for missing trusted identity", async () => {
    const incoming = nitroRequest(
      "/api/hosted/library",
      { BUCKET: bucket(), user: { id: "sites-person-a" } },
      null,
    );
    incoming.headers.set("x-focus-user", "sites-person-a");
    const response = await entry.fetch(incoming, { userId: "sites-person-a" }, {});
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthenticated" });
    expect(ssr.fetch).not.toHaveBeenCalled();
  });
  it("does not trust dispatch-looking headers in a non-hosted build", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "false");
    const response = await entry.fetch(
      nitroRequest("/api/hosted/session", { BUCKET: bucket() }),
      {},
      {},
    );
    expect(await response.json()).toEqual({ user: null, storageAvailable: false, mode: "hosted" });
    expect(ssr.fetch).not.toHaveBeenCalled();
  });
  it("returns a bounded API 404 instead of rendering SSR for an unknown hosted endpoint", async () => {
    const response = await entry.fetch(
      nitroRequest("/api/hosted/missing", { BUCKET: bucket() }),
      {},
      {},
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
    expect(ssr.fetch).not.toHaveBeenCalled();
  });
  it.each(["true", "false"])(
    "passes ordinary pages to SSR unchanged when hosted=%s",
    async (hosted) => {
      vi.stubEnv("VITE_FOCUS_HOSTED", hosted);
      const incoming = nitroRequest("/library", { BUCKET: bucket() });
      const options = { context: "framework options" };
      const context = {};
      const response = await entry.fetch(incoming, options, context);
      expect(await response.text()).toBe("SSR page");
      expect(ssr.fetch).toHaveBeenCalledExactlyOnceWith(incoming, options, context);
    },
  );
});
