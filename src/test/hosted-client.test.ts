import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostedClientError, readOnlineLibrary, saveOnlineLibrary } from "@/lib/hosted-client";

const owner = vi.hoisted(() => ({ getId: vi.fn<() => string | null>() }));
vi.mock("@/lib/browser-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/browser-storage")>()),
  getBrowserOwnerId: owner.getId,
}));

const USER = "colleague-a";
const REVISION = '"revision-a"';
const NEXT_REVISION = '"revision-b"';
const MAX_BYTES = 20 * 1024 * 1024;
const RAW = '{\n  "version": 1, "entries": [], "note": "Café 🧱"\n}\n';
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockRejectedValue(new Error("Unexpected additional request"));
  owner.getId.mockReset().mockReturnValue(USER);
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

function backup(raw = RAW, etag: string | null = REVISION) {
  return new Response(raw, {
    headers: {
      "Content-Type": "application/json",
      ...(etag === null ? {} : { ETag: etag }),
    },
  });
}

function confirmation(etag = NEXT_REVISION) {
  return Response.json({ saved: true, revision: etag }, { headers: { ETag: etag } });
}

function request() {
  expect(fetcher).toHaveBeenCalledOnce();
  const [target, init] = fetcher.mock.calls[0]!;
  expect(target).toBe("/api/hosted/library");
  expect(init?.credentials).toBe("same-origin");
  expect(init?.cache).toBe("no-store");
  const headers = new Headers(init?.headers);
  expect(headers.get("X-Focus-User")).toBe(USER);
  return { init, headers };
}

async function expectHostedError(promise: Promise<unknown>, code: string, status: number) {
  const result = await promise.catch((error: unknown) => error);
  expect(result).toBeInstanceOf(HostedClientError);
  expect(result).toMatchObject({ code, status });
  return result as HostedClientError;
}

describe("reading a private online library", () => {
  it("preserves exact backup text and a strong quoted revision with owner-bound request options", async () => {
    const signal = new AbortController().signal;
    fetcher.mockResolvedValueOnce(backup());
    await expect(readOnlineLibrary(USER, signal)).resolves.toEqual({ raw: RAW, etag: REVISION });
    const { init, headers } = request();
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);
    expect(headers.has("If-Match")).toBe(false);
    expect(headers.has("If-None-Match")).toBe(false);
  });

  it("retains Unicode when UTF-8 characters cross streamed chunk boundaries", async () => {
    const bytes = new TextEncoder().encode(RAW);
    const split = bytes.indexOf(0xf0) + 2;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });
    fetcher.mockResolvedValueOnce(new Response(stream, { headers: { ETag: REVISION } }));
    await expect(readOnlineLibrary(USER)).resolves.toEqual({ raw: RAW, etag: REVISION });
    request();
  });

  it("treats only an explicit not_found 404 as an absent online copy", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ code: "not_found" }, { status: 404 }));
    await expect(readOnlineLibrary(USER)).resolves.toBeNull();
    request();
  });

  it.each([
    [404, "storage_unavailable"],
    [503, "not_found"],
    [401, "unauthenticated"],
    [403, "account_changed"],
    [409, "conflict"],
  ])("does not turn HTTP %i / %s into an empty library or retry", async (status, code) => {
    fetcher.mockResolvedValueOnce(Response.json({ code, message: "Server detail" }, { status }));
    await expectHostedError(readOnlineLibrary(USER), code, status);
    request();
  });

  it("does not expose a proxy HTML error or mistake it for an empty copy", async () => {
    fetcher.mockResolvedValueOnce(
      new Response("<html>Private proxy details</html>", { status: 404 }),
    );
    const error = await expectHostedError(readOnlineLibrary(USER), "request_failed", 404);
    expect(error.message).not.toContain("Private proxy details");
    request();
  });

  it.each([null, "revision-a", 'W/"revision-a"', '""', `"${"x".repeat(200)}"`])(
    "rejects an absent or invalid read revision %s",
    async (etag) => {
      fetcher.mockResolvedValueOnce(backup(RAW, etag));
      await expectHostedError(readOnlineLibrary(USER), "invalid_revision", 200);
      request();
    },
  );

  it.each(["{broken", "null", "[]", '{"version":2,"entries":[]}', '{"version":1,"entries":{}}'])(
    "rejects a malformed or unsupported library envelope %s",
    async (raw) => {
      fetcher.mockResolvedValueOnce(backup(raw));
      await expectHostedError(readOnlineLibrary(USER), "invalid_backup", 200);
      request();
    },
  );

  it("rejects a declared oversized response before treating it as a library", async () => {
    fetcher.mockResolvedValueOnce(
      new Response(RAW, {
        headers: { ETag: REVISION, "Content-Length": String(MAX_BYTES + 1) },
      }),
    );
    await expectHostedError(readOnlineLibrary(USER), "payload_too_large", 413);
    request();
  });

  it("bounds actual streamed bytes even when Content-Length understates them and cancels the reader", async () => {
    const cancel = vi.fn();
    let chunk = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(
          chunk++ === 0 ? new Uint8Array(MAX_BYTES).fill(32) : new Uint8Array([32]),
        );
      },
      cancel,
    });
    fetcher.mockResolvedValueOnce(
      new Response(stream, { headers: { ETag: REVISION, "Content-Length": "10" } }),
    );
    await expectHostedError(readOnlineLibrary(USER), "payload_too_large", 413);
    expect(cancel).toHaveBeenCalledOnce();
    request();
  });
});

describe("saving a private online library", () => {
  it("creates only if absent, sends exact JSON text, and requires a matching confirmed revision", async () => {
    const signal = new AbortController().signal;
    fetcher.mockResolvedValueOnce(confirmation());
    await expect(saveOnlineLibrary(USER, RAW, null, signal)).resolves.toBe(NEXT_REVISION);
    const { init, headers } = request();
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(RAW);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("If-None-Match")).toBe("*");
    expect(headers.has("If-Match")).toBe(false);
  });

  it("updates only the exact checked revision without stripping or doubling quotes", async () => {
    fetcher.mockResolvedValueOnce(confirmation());
    await expect(saveOnlineLibrary(USER, RAW, REVISION)).resolves.toBe(NEXT_REVISION);
    const { headers } = request();
    expect(headers.get("If-Match")).toBe(REVISION);
    expect(headers.has("If-None-Match")).toBe(false);
  });

  it.each([
    [409, "conflict"],
    [403, "account_changed"],
    [401, "unauthenticated"],
    [503, "storage_unavailable"],
    [428, "precondition_required"],
    [422, "invalid_backup"],
  ])("returns HTTP %i / %s without an automatic overwrite or retry", async (status, code) => {
    fetcher.mockResolvedValueOnce(Response.json({ code }, { status }));
    await expectHostedError(saveOnlineLibrary(USER, RAW, REVISION), code, status);
    const { headers } = request();
    expect(headers.get("If-Match")).toBe(REVISION);
  });

  it.each(["revision-a", 'W/"revision-a"', '""', "*", '"bad\nrevision"'])(
    "rejects an invalid update revision %s before sending bytes",
    async (revision) => {
      await expectHostedError(saveOnlineLibrary(USER, RAW, revision), "invalid_revision", 428);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("rejects an oversized UTF-8 body before any write, even when character count is below the limit", async () => {
    const raw = "é".repeat(MAX_BYTES / 2 + 1);
    expect(raw.length).toBeLessThan(MAX_BYTES);
    await expectHostedError(saveOnlineLibrary(USER, raw, null), "payload_too_large", 413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [null, { saved: true, revision: NEXT_REVISION }],
    ["revision-b", { saved: true, revision: "revision-b" }],
    ['W/"revision-b"', { saved: true, revision: 'W/"revision-b"' }],
    [NEXT_REVISION, {}],
    [NEXT_REVISION, { saved: false, revision: NEXT_REVISION }],
    [NEXT_REVISION, { saved: true }],
    [NEXT_REVISION, { saved: true, revision: REVISION }],
  ])("does not acknowledge an incomplete or contradictory save receipt %#", async (etag, body) => {
    fetcher.mockResolvedValueOnce(
      Response.json(body, { headers: etag === null ? {} : { ETag: etag } }),
    );
    await expectHostedError(saveOnlineLibrary(USER, RAW, REVISION), "unconfirmed_save", 200);
    request();
  });

  it("rejects a successful HTTP status with malformed acknowledgement JSON", async () => {
    fetcher.mockResolvedValueOnce(new Response("not-json", { headers: { ETag: NEXT_REVISION } }));
    await expectHostedError(saveOnlineLibrary(USER, RAW, REVISION), "unconfirmed_save", 200);
    request();
  });
});

describe("online request interruption", () => {
  it.each(["read", "save"] as const)(
    "does not retry a network failure during %s",
    async (action) => {
      const error = new TypeError("Network unavailable");
      fetcher.mockRejectedValueOnce(error);
      const result =
        action === "read" ? readOnlineLibrary(USER) : saveOnlineLibrary(USER, RAW, REVISION);
      await expect(result).rejects.toBe(error);
      request();
    },
  );

  it.each(["read", "save"] as const)(
    "forwards external abort reason and does not retry an aborted %s",
    async (action) => {
      const controller = new AbortController();
      const error = new DOMException("Stopped", "AbortError");
      fetcher.mockRejectedValueOnce(error);
      const result =
        action === "read"
          ? readOnlineLibrary(USER, controller.signal)
          : saveOnlineLibrary(USER, RAW, REVISION, controller.signal);
      controller.abort(error);
      await expect(result).rejects.toBe(error);
      expect(request().init?.signal?.aborted).toBe(true);
      expect(request().init?.signal?.reason).toBe(error);
    },
  );
});

describe("online requests stay inside the verified browser owner", () => {
  it.each(["read", "save"] as const)(
    "does not fetch for a different owner during %s",
    async (action) => {
      owner.getId.mockReturnValue("colleague-b");
      const result =
        action === "read" ? readOnlineLibrary(USER) : saveOnlineLibrary(USER, RAW, REVISION);
      await expectHostedError(result, "account_changed", 409);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each(["read", "save"] as const)(
    "does not fetch without a verified owner during %s",
    async (action) => {
      owner.getId.mockReturnValue(null);
      const result =
        action === "read" ? readOnlineLibrary(USER) : saveOnlineLibrary(USER, RAW, REVISION);
      await expectHostedError(result, "account_changed", 409);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each(["read", "save"] as const)(
    "does not fetch when browser-owner access is locked during %s",
    async (action) => {
      owner.getId.mockImplementation(() => {
        throw new Error("Session needs verification");
      });
      const result =
        action === "read" ? readOnlineLibrary(USER) : saveOnlineLibrary(USER, RAW, REVISION);
      await expectHostedError(result, "session_unverified", 409);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});

describe("online requests have a deadline across fetch and response body", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("times out and aborts a read even when fetch ignores the signal", async () => {
    fetcher.mockReturnValueOnce(new Promise<Response>(() => {}));
    let settled = false;
    const result = readOnlineLibrary(USER, undefined, 50).catch((error: unknown) => {
      settled = true;
      return error;
    });
    const signal = request().init?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    await vi.advanceTimersByTimeAsync(49);
    expect(settled).toBe(false);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await result;
    expect(error).toBeInstanceOf(HostedClientError);
    expect(error).toMatchObject({ code: "timeout", status: 408 });
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(error);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out an already-started GET body and cancels its reader", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"version":1,"entries":'));
      },
      cancel,
    });
    const response = new Response(stream, { headers: { ETag: REVISION } });
    const readBody = vi.spyOn(response.body!, "getReader");
    fetcher.mockResolvedValueOnce(response);
    const result = readOnlineLibrary(USER, undefined, 50).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(readBody).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(50);
    const error = await result;
    expect(error).toBeInstanceOf(HostedClientError);
    expect(error).toMatchObject({ code: "timeout", status: 408 });
    expect(request().init?.signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    readBody.mockRestore();
  });

  it("does not acknowledge or retry an ambiguous PUT whose receipt body stalls", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"saved":true,"revision":'));
      },
    });
    const response = new Response(stream, { headers: { ETag: NEXT_REVISION } });
    const readBody = vi.spyOn(response, "json");
    fetcher.mockResolvedValueOnce(response);
    const result = saveOnlineLibrary(USER, RAW, REVISION, undefined, 50).catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(readBody).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(50);
    const error = await result;
    expect(error).toBeInstanceOf(HostedClientError);
    expect(error).toMatchObject({ code: "timeout", status: 408 });
    expect((error as HostedClientError).message).toMatch(/check the online library/i);
    expect((error as HostedClientError).message).toMatch(/may already have reached the server/i);
    const { init, headers } = request();
    expect(init?.signal?.aborted).toBe(true);
    expect(headers.get("If-Match")).toBe(REVISION);
    expect(vi.getTimerCount()).toBe(0);
    readBody.mockRestore();
  });

  it("forwards external cancellation while a fetch ignores abort and removes its deadline", async () => {
    const controller = new AbortController();
    const reason = new DOMException("The owner changed", "AbortError");
    fetcher.mockReturnValueOnce(new Promise<Response>(() => {}));
    const result = readOnlineLibrary(USER, controller.signal, 50).catch((error: unknown) => error);
    controller.abort(reason);
    await expect(result).resolves.toBe(reason);
    const signal = request().init?.signal;
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });
});
