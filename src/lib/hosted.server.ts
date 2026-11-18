import { MAX_LIBRARY_BACKUP_BYTES, validateCompleteLibraryBackup } from "./transfer";

/** The small subset of the R2 binding used here; no browser or Supabase credentials. */
export type HostedObject = {
  etag: string;
  httpEtag: string;
  size: number;
  body: ReadableStream<Uint8Array>;
};
export type HostedBucket = {
  get(key: string): Promise<HostedObject | null>;
  put(
    key: string,
    value: string,
    options?: { onlyIf?: Headers; httpMetadata?: { contentType: string } },
  ): Promise<{ etag: string; httpEtag: string; size: number } | null>;
  delete(key: string): Promise<void>;
};
type Snapshot = { key: string; bytes: number };
type Pointer = { version: 1; current: Snapshot; previous: Snapshot | null };
type Identity = { id: string; email: string };
type Options = { hosted: boolean; development: boolean };
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const responseHeaders = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...responseHeaders, "content-type": "application/json; charset=utf-8", ...extra },
  });
}
function identity(request: Request, hosted: boolean): Identity | null {
  if (!hosted) return null;
  const id = request.headers.get("oai-authenticated-user-id")?.trim();
  if (
    !id ||
    id.length > 512 ||
    Array.from(id).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return null;
  const email = request.headers.get("oai-authenticated-user-email")?.slice(0, 320) ?? "";
  return { id, email };
}
function bucketFrom(env: unknown): HostedBucket | null {
  const bucket = (env as { BUCKET?: HostedBucket } | null)?.BUCKET;
  return bucket &&
    typeof bucket.get === "function" &&
    typeof bucket.put === "function" &&
    typeof bucket.delete === "function"
    ? bucket
    : null;
}
async function storageHealth(env: unknown): Promise<Response> {
  const bucket = bucketFrom(env);
  if (!bucket)
    return json({ status: "degraded", storageConfigured: false, storageReadable: false }, 503);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      bucket.get("focus-health/v1/probe"),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Storage probe timed out")), 2000);
      }),
    ]);
    return json({ status: "ok", storageConfigured: true, storageReadable: true });
  } catch {
    return json({ status: "degraded", storageConfigured: true, storageReadable: false }, 503);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function userPrefix(id: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return `focus-library/v1/${Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("")}/`;
}
async function readBounded(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<{ text: string; bytes: number }> {
  if (!body) return { text: "", bytes: 0 };
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parts: string[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit)
        throw new ApiError(413, "payload_too_large", "Library backups must be smaller than 20 MB.");
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return { text: parts.join(""), bytes: size };
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
function revision(value: string | null): string | null {
  return value && /^"[^"\s,]{1,200}"$/.test(value) ? value : null;
}
function validatePointer(input: unknown, prefix: string): Pointer {
  const pointer = input as Partial<Pointer> | null;
  const valid = (value: unknown): value is Snapshot => {
    const item = value as Snapshot | null;
    if (!item || typeof item.key !== "string" || !item.key.startsWith(`${prefix}snapshots/`))
      return false;
    return (
      /^[0-9a-f-]{36}\.json$/.test(item.key.slice(`${prefix}snapshots/`.length)) &&
      Number.isInteger(item.bytes) &&
      item.bytes > 0 &&
      item.bytes <= MAX_LIBRARY_BACKUP_BYTES
    );
  };
  if (
    !pointer ||
    pointer.version !== 1 ||
    !valid(pointer.current) ||
    !(pointer.previous === null || valid(pointer.previous))
  )
    throw new Error("Unreadable hosted library pointer");
  if (pointer.previous?.key === pointer.current.key)
    throw new Error("Repeated hosted library pointer");
  return pointer as Pointer;
}
async function readPointer(bucket: HostedBucket, prefix: string) {
  const object = await bucket.get(`${prefix}latest.json`);
  if (!object) return null;
  if (object.size > 4096 || !revision(object.httpEtag))
    throw new Error("Invalid hosted pointer metadata");
  let raw: string;
  try {
    raw = (await readBounded(object.body, 4096)).text;
  } catch {
    throw new Error("Unreadable hosted pointer data");
  }
  return { value: validatePointer(JSON.parse(raw), prefix), etag: object.httpEtag };
}
async function discard(bucket: HostedBucket, key: string) {
  try {
    await bucket.delete(key);
  } catch {
    /* Cleanup failure must not invalidate a committed save. */
  }
}
function enforceSameUser(request: Request, user: Identity) {
  if (request.headers.get("x-focus-user") !== user.id)
    throw new ApiError(
      409,
      "account_changed",
      "Your signed-in account changed. Reload before accessing the online library.",
    );
}
async function getLibrary(bucket: HostedBucket, prefix: string): Promise<Response> {
  // A concurrent save may retire a snapshot after its pointer was read; retry the current pointer.
  for (let attempt = 0; attempt < 2; attempt++) {
    const pointer = await readPointer(bucket, prefix);
    if (!pointer)
      throw new ApiError(
        404,
        "not_found",
        "No library has been saved online for this account yet.",
      );
    const object = await bucket.get(pointer.value.current.key);
    if (!object) continue;
    if (object.size !== pointer.value.current.bytes || object.size > MAX_LIBRARY_BACKUP_BYTES)
      throw new Error("Invalid hosted library size");
    let payload: { text: string; bytes: number };
    try {
      payload = await readBounded(object.body, MAX_LIBRARY_BACKUP_BYTES);
    } catch {
      throw new Error("Unreadable hosted library data");
    }
    const raw = payload.text;
    if (payload.bytes !== pointer.value.current.bytes)
      throw new Error("Hosted library length mismatch");
    await validateCompleteLibraryBackup(raw);
    return new Response(raw, {
      headers: {
        ...responseHeaders,
        "content-type": "application/json; charset=utf-8",
        etag: pointer.etag,
      },
    });
  }
  throw new Error("Hosted library snapshot unavailable");
}
async function putLibrary(
  request: Request,
  bucket: HostedBucket,
  prefix: string,
): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new ApiError(403, "origin_rejected", "Save the library from this Focus site only.");
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
    throw new ApiError(415, "unsupported_media_type", "Send a JSON library backup.");
  const match = revision(request.headers.get("if-match"));
  const first = request.headers.get("if-none-match") === "*";
  if (
    (match && request.headers.has("if-none-match")) ||
    (first && request.headers.has("if-match")) ||
    (!match && !first)
  )
    throw new ApiError(
      428,
      "precondition_required",
      "Check the online library before saving. A current revision is required.",
    );
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_LIBRARY_BACKUP_BYTES))
    throw new ApiError(413, "payload_too_large", "Library backups must be smaller than 20 MB.");
  let payload: { text: string; bytes: number };
  try {
    payload = await readBounded(request.body, MAX_LIBRARY_BACKUP_BYTES);
    await validateCompleteLibraryBackup(payload.text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "invalid_backup",
      "This is not a complete valid library backup. Back up the library again with all its images and history.",
    );
  }
  const prior = await readPointer(bucket, prefix);
  if ((first && prior) || (match && prior?.etag !== match))
    throw new ApiError(
      409,
      "conflict",
      "The online library changed. Check the latest version before saving again.",
    );
  const snapshot = {
    key: `${prefix}snapshots/${crypto.randomUUID()}.json`,
    bytes: payload.bytes,
  };
  const uploaded = await bucket.put(snapshot.key, payload.text, {
    onlyIf: new Headers({ "if-none-match": "*" }),
    httpMetadata: { contentType: "application/json" },
  });
  if (!uploaded || uploaded.size !== snapshot.bytes)
    throw new Error("Library snapshot upload was not confirmed");
  const pointer: Pointer = {
    version: 1,
    current: snapshot,
    previous: prior?.value.current ?? null,
  };
  const conditions = new Headers(prior ? { "if-match": prior.etag } : { "if-none-match": "*" });
  let result;
  try {
    result = await bucket.put(`${prefix}latest.json`, JSON.stringify(pointer), {
      onlyIf: conditions,
      httpMetadata: { contentType: "application/json" },
    });
  } catch (error) {
    // A binding error can be ambiguous. Never delete a payload that may already be committed.
    const committed = await readPointer(bucket, prefix).catch(() => null);
    if (committed?.value.current.key === snapshot.key) {
      if (prior?.value.previous) await discard(bucket, prior.value.previous.key);
      return json({ saved: true, revision: committed.etag }, 200, { etag: committed.etag });
    }
    throw error;
  }
  if (!result) {
    await discard(bucket, snapshot.key);
    throw new ApiError(
      409,
      "conflict",
      "The online library changed while saving. Check the latest version before saving again.",
    );
  }
  if (!revision(result.httpEtag)) throw new Error("Missing saved library revision");
  if (prior?.value.previous) await discard(bucket, prior.value.previous.key);
  return json({ saved: true, revision: result.httpEtag }, 200, { etag: result.httpEtag });
}

/** Only Sites dispatch-provided identity is used, and only in an explicitly hosted build. */
export async function handleHostedRequest(
  request: Request,
  env: unknown,
  options: Options = { hosted: true, development: false },
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/hosted/")) return null;
  const user = identity(request, options.hosted);
  const bucket = user ? bucketFrom(env) : null;
  try {
    if (path === "/api/hosted/health") {
      if (request.method !== "GET")
        return json({ code: "method_not_allowed", message: "Use GET." }, 405, { allow: "GET" });
      return await storageHealth(env);
    }
    if (path === "/api/hosted/session") {
      if (request.method !== "GET")
        return json({ code: "method_not_allowed", message: "Use GET." }, 405, { allow: "GET" });
      return json({
        user,
        storageAvailable: !!bucket,
        mode: !user && options.development ? "preview" : "hosted",
      });
    }
    if (path !== "/api/hosted/library")
      throw new ApiError(404, "not_found", "This hosted endpoint does not exist.");
    if (!user) throw new ApiError(401, "unauthenticated", "Sign in to access your online library.");
    enforceSameUser(request, user);
    if (!bucket)
      throw new ApiError(
        503,
        "storage_unavailable",
        "Online storage is unavailable. Your browser library is unchanged.",
      );
    const prefix = await userPrefix(user.id);
    if (request.method === "GET") return await getLibrary(bucket, prefix);
    if (request.method === "PUT") return await putLibrary(request, bucket, prefix);
    return json({ code: "method_not_allowed", message: "Use GET or PUT." }, 405, {
      allow: "GET, PUT",
    });
  } catch (error) {
    if (error instanceof ApiError)
      return json({ code: error.code, message: error.message }, error.status);
    return json(
      {
        code: "storage_unavailable",
        message:
          "The online operation could not be confirmed. Your browser library is unchanged. Check the online library before trying again.",
      },
      503,
    );
  }
}
