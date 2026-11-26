import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleHostedRequest } from "@/lib/hosted.server";
import { normalizeTokens } from "@/lib/design";
import { pngAsset } from "./image-asset.fixture";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type MutationDocument = {
  assets: { images: Record<string, string> };
  entries: [{ state: { content: { features: unknown }; past: unknown } }];
};
const origin = "https://focus.example";
const { id: imageId, src: image } = pngAsset();
const backup = (title = "Workshop") =>
  JSON.stringify({
    kind: "focus-library-backup",
    version: 1,
    entries: [
      {
        id: "one",
        title,
        collection: "",
        favorite: false,
        created: "2026-11-18",
        updated: "2026-11-18",
        state: {
          libraryId: "one",
          stage: "rx",
          tokens: normalizeTokens({}),
          content: {
            brand: title,
            headline: "Make a cup.",
            sub: "",
            cta: "Learn",
            quote: "",
            features: [],
          },
          page: { imageId, imageAlt: "A cup" },
          past: [{ page: { imageId } }],
          future: [],
        },
      },
    ],
    assets: { version: 1, images: { [imageId]: image } },
  });
class Bucket {
  values = new Map<string, { text: string; etag: string }>();
  writes = 0;
  reads: string[] = [];
  deletes: string[] = [];
  failSnapshot = false;
  failPointer = false;
  failDelete = false;
  failAfterCommit = false;
  counter = 0;
  async get(key: string) {
    this.reads.push(key);
    const value = this.values.get(key);
    if (!value) return null;
    return {
      etag: value.etag,
      httpEtag: `"${value.etag}"`,
      size: Buffer.byteLength(value.text),
      body: new Response(value.text).body!,
      text: async () => value.text,
    };
  }
  async put(key: string, value: string, options?: { onlyIf?: Headers }) {
    if (
      (key.endsWith("latest.json") && this.failPointer) ||
      (!key.endsWith("latest.json") && this.failSnapshot)
    )
      throw new Error("storage failure");
    const prior = this.values.get(key);
    const conditions = options?.onlyIf;
    if (conditions?.get("if-none-match") === "*" && prior) return null;
    if (
      conditions?.has("if-match") &&
      conditions.get("if-match") !== (prior ? `"${prior.etag}"` : null)
    )
      return null;
    const etag = `revision-${++this.counter}`;
    this.values.set(key, { text: value, etag });
    this.writes++;
    if (key.endsWith("latest.json") && this.failAfterCommit)
      throw new Error("response interrupted after commit");
    return { etag, httpEtag: `"${etag}"`, size: Buffer.byteLength(value) };
  }
  async delete(key: string) {
    if (this.failDelete) throw new Error("delete failure");
    this.deletes.push(key);
    this.values.delete(key);
  }
}
function request(
  path: string,
  {
    user = "alice",
    expectedUser = user,
    method = "GET",
    body,
    revision,
    first = false,
    source = origin,
    contentType = "application/json",
  }: {
    user?: string;
    expectedUser?: string;
    method?: string;
    body?: string;
    revision?: string;
    first?: boolean;
    source?: string;
    contentType?: string;
  } = {},
) {
  const headers = new Headers({ "content-type": contentType, origin: source });
  if (user) {
    headers.set("oai-authenticated-user-id", user);
    headers.set("oai-authenticated-user-email", `${user}@example.com`);
  }
  if (expectedUser) headers.set("X-Focus-User", expectedUser);
  if (revision) headers.set("If-Match", revision);
  if (first) headers.set("If-None-Match", "*");
  return new Request(origin + path, { method, headers, ...(body === undefined ? {} : { body }) });
}
const api = (bucket: Bucket, req: Request) => handleHostedRequest(req, { BUCKET: bucket });
async function save(bucket: Bucket, title = "Workshop", revision?: string) {
  return (await api(
    bucket,
    request("/api/hosted/library", {
      method: "PUT",
      body: backup(title),
      ...(revision ? { revision } : { first: true }),
    }),
  ))!;
}
describe("read-only hosted storage health", () => {
  it("checks only the reserved probe key without requiring visitor identity or writing data", async () => {
    const bucket = new Bucket();
    const result = (await api(bucket, request("/api/hosted/health", { user: "" })))!;
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      status: "ok",
      storageConfigured: true,
      storageReadable: true,
    });
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(bucket.reads).toEqual(["focus-health/v1/probe"]);
    expect(bucket.writes).toBe(0);
    expect(bucket.deletes).toEqual([]);
  });
  it("reports a missing binding or a failed read without exposing internal errors", async () => {
    const missing = (await handleHostedRequest(request("/api/hosted/health", { user: "" }), {}))!;
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({
      status: "degraded",
      storageConfigured: false,
      storageReadable: false,
    });
    const bucket = new Bucket();
    bucket.get = async () => {
      throw new Error("internal credential detail");
    };
    const failed = (await api(bucket, request("/api/hosted/health", { user: "" })))!;
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({
      status: "degraded",
      storageConfigured: true,
      storageReadable: false,
    });
  });
  it("bounds an unresponsive read and permits GET only", async () => {
    vi.useFakeTimers();
    const bucket = new Bucket();
    bucket.get = () => new Promise(() => {});
    const pending = api(bucket, request("/api/hosted/health", { user: "" }));
    await vi.advanceTimersByTimeAsync(2000);
    const result = (await pending)!;
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({
      status: "degraded",
      storageConfigured: true,
      storageReadable: false,
    });
    const unsupported = (await api(
      bucket,
      request("/api/hosted/health", { user: "", method: "POST" }),
    ))!;
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("allow")).toBe("GET");
  });
});

describe("hosted user-owned library storage", () => {
  it("reports preview only in development and never invents identity or storage", async () => {
    const anonymous = request("/api/hosted/session", { user: "" });
    const preview = await handleHostedRequest(anonymous, {}, { hosted: true, development: true });
    expect(await preview!.json()).toEqual({ user: null, storageAvailable: false, mode: "preview" });
    const production = await handleHostedRequest(
      anonymous,
      {},
      { hosted: true, development: false },
    );
    expect(await production!.json()).toEqual({
      user: null,
      storageAvailable: false,
      mode: "hosted",
    });
    expect(production!.headers.get("cache-control")).toBe("no-store");
    const local = await handleHostedRequest(
      request("/api/hosted/session"),
      { BUCKET: new Bucket() },
      { hosted: false, development: false },
    );
    expect((await local!.json()).user).toBeNull();
  });
  it("round trips exact complete backup bytes, supplies revision and isolates identities", async () => {
    const bucket = new Bucket();
    const saved = await save(bucket);
    expect(saved.status).toBe(200);
    const revision = saved.headers.get("etag");
    expect(await saved.json()).toEqual({ saved: true, revision });
    const loaded = (await api(bucket, request("/api/hosted/library")))!;
    expect(loaded.status).toBe(200);
    expect(loaded.headers.get("etag")).toBe(revision);
    expect(await loaded.text()).toBe(backup());
    expect((await api(bucket, request("/api/hosted/library", { user: "bob" })))!.status).toBe(404);
    expect([...bucket.values.keys()].every((key) => !key.includes("alice"))).toBe(true);
  });
  it("counts UTF-8 bytes correctly for non-ASCII owner content", async () => {
    const bucket = new Bucket();
    const result = await save(bucket, "陶器の工房");
    expect(result.status).toBe(200);
    const restored = (await api(bucket, request("/api/hosted/library")))!;
    expect(restored.status).toBe(200);
    expect(await restored.text()).toBe(backup("陶器の工房"));
  });
  it("rejects anonymous, account-changed, cross-origin and missing precondition writes before any storage write", async () => {
    const bucket = new Bucket();
    for (const [overrides, status] of [
      [{ user: "" }, 401],
      [{ expectedUser: "bob" }, 409],
      [{ source: "https://evil.example" }, 403],
      [{ contentType: "text/plain" }, 415],
    ] as const) {
      const result = await api(
        bucket,
        request("/api/hosted/library", {
          method: "PUT",
          body: backup(),
          first: true,
          ...overrides,
        }),
      );
      expect(result!.status).toBe(status);
      expect(result!.headers.get("cache-control")).toBe("no-store");
    }
    expect(
      (await api(bucket, request("/api/hosted/library", { expectedUser: "bob" })))!.status,
    ).toBe(409);
    expect(
      (await api(bucket, request("/api/hosted/library", { method: "PUT", body: backup() })))!
        .status,
    ).toBe(428);
    expect(bucket.writes).toBe(0);
  });
  it("rejects missing images, changed image hashes and malformed current/history states without writes", async () => {
    for (const mutate of [
      (value: MutationDocument) => {
        value.assets.images = {};
      },
      (value: MutationDocument) => {
        value.assets.images[imageId] = image.replace(/=+$/, "AAAA");
      },
      (value: MutationDocument) => {
        value.entries[0].state.content.features = null;
      },
      (value: MutationDocument) => {
        value.entries[0].state.past = [{ content: { features: null } }];
      },
    ]) {
      const bucket = new Bucket();
      const value = JSON.parse(backup());
      mutate(value);
      const result = await api(
        bucket,
        request("/api/hosted/library", { method: "PUT", body: JSON.stringify(value), first: true }),
      );
      expect(result!.status).toBe(400);
      expect(bucket.writes).toBe(0);
    }
  });
  it("retains only current and previous snapshots and rejects stale saves without changing the winner", async () => {
    const bucket = new Bucket();
    const one = await save(bucket, "One");
    const first = one.headers.get("etag")!;
    const two = await save(bucket, "Two", first);
    const second = two.headers.get("etag")!;
    const stale = await save(bucket, "Stale", first);
    expect(stale.status).toBe(409);
    const three = await save(bucket, "Three", second);
    expect(three.status).toBe(200);
    expect(bucket.values.size).toBe(3);
    const snapshotTexts = [...bucket.values]
      .filter(([key]) => !key.endsWith("latest.json"))
      .map(([, value]) => value.text);
    expect(snapshotTexts).toEqual(expect.arrayContaining([backup("Two"), backup("Three")]));
    expect(await (await api(bucket, request("/api/hosted/library")))!.text()).toBe(backup("Three"));
  });
  it("keeps the prior committed backup after snapshot or pointer failures", async () => {
    const bucket = new Bucket();
    const first = (await save(bucket)).headers.get("etag")!;
    bucket.failSnapshot = true;
    expect((await save(bucket, "New", first)).status).toBe(503);
    bucket.failSnapshot = false;
    bucket.failPointer = true;
    expect((await save(bucket, "New", first)).status).toBe(503);
    expect(await (await api(bucket, request("/api/hosted/library")))!.text()).toBe(backup());
    // The failed pointer write may be ambiguous; preserving an unconfirmed payload is safer than breaking a committed pointer.
    expect(bucket.values.size).toBe(3);
  });
  it("does not turn a successful save into failure when cleanup fails", async () => {
    const bucket = new Bucket();
    const first = (await save(bucket)).headers.get("etag")!;
    const second = (await save(bucket, "Two", first)).headers.get("etag")!;
    bucket.failDelete = true;
    expect((await save(bucket, "Three", second)).status).toBe(200);
    expect(await (await api(bucket, request("/api/hosted/library")))!.text()).toBe(backup("Three"));
  });
  it("distinguishes unavailable storage from an empty library and rejects oversized requests", async () => {
    expect((await handleHostedRequest(request("/api/hosted/library"), {}))!.status).toBe(503);
    const bucket = new Bucket();
    expect((await api(bucket, request("/api/hosted/library")))!.status).toBe(404);
    const oversized = request("/api/hosted/library", { method: "PUT", body: "{}", first: true });
    oversized.headers.set("content-length", String(20 * 1024 * 1024 + 1));
    expect((await api(bucket, oversized))!.status).toBe(413);
    expect(bucket.writes).toBe(0);
  });
  it("accepts only one winner when two writers race on the same revision", async () => {
    const bucket = new Bucket();
    const first = (await save(bucket)).headers.get("etag")!;
    const results = await Promise.all([
      save(bucket, "Writer one", first),
      save(bucket, "Writer two", first),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(bucket.values.size).toBe(3);
    const result = (await api(bucket, request("/api/hosted/library")))!;
    expect([backup("Writer one"), backup("Writer two")]).toContain(await result.text());
  });
  it("reconciles an interrupted pointer response without deleting its committed snapshot", async () => {
    const bucket = new Bucket();
    const first = (await save(bucket)).headers.get("etag")!;
    bucket.failAfterCommit = true;
    const result = await save(bucket, "Committed", first);
    expect(result.status).toBe(200);
    expect(await (await api(bucket, request("/api/hosted/library")))!.text()).toBe(
      backup("Committed"),
    );
  });
  it("bounds actual streamed request bytes even when content-length is missing", async () => {
    const bucket = new Bucket();
    const result = await api(
      bucket,
      request("/api/hosted/library", {
        method: "PUT",
        body: "x".repeat(20 * 1024 * 1024 + 1),
        first: true,
      }),
    );
    expect(result!.status).toBe(413);
    expect(bucket.writes).toBe(0);
  });
  it("rejects corrupted stored content without returning it or deleting recoverable bytes", async () => {
    const bucket = new Bucket();
    await save(bucket);
    const snapshot = [...bucket.values.entries()].find(([key]) => !key.endsWith("latest.json"))![1];
    snapshot.text = snapshot.text.replace('"features":[]', '"features":{}');
    expect((await api(bucket, request("/api/hosted/library")))!.status).toBe(503);
    expect(bucket.values.size).toBe(2);
  });
  it("uses the Worker binding attached by Nitro's request runtime", async () => {
    vi.stubEnv("VITE_FOCUS_HOSTED", "true");
    const { default: server } = await import("@/server");
    const req = Object.assign(request("/api/hosted/session"), {
      runtime: { cloudflare: { env: { BUCKET: new Bucket() } } },
    });
    const result = await server.fetch(req, undefined, undefined);
    expect(await result.json()).toMatchObject({
      user: { id: "alice" },
      storageAvailable: true,
      mode: "hosted",
    });
  });
  it("rejects malformed stored pointers without following a different user's object", async () => {
    const bucket = new Bucket();
    await save(bucket);
    const pointerKey = [...bucket.values.keys()].find((key) => key.endsWith("latest.json"))!;
    bucket.values.get(pointerKey)!.text = JSON.stringify({
      version: 1,
      current: { key: "other-user/snapshot", bytes: 1 },
      previous: null,
    });
    expect((await api(bucket, request("/api/hosted/library")))!.status).toBe(503);
  });
});
