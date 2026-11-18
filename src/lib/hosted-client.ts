import { MAX_LIBRARY_BACKUP_BYTES } from "./transfer";
import { getBrowserOwnerId } from "./browser-storage";

export class HostedClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HostedClientError";
  }
}

const messages: Record<string, string> = {
  unauthenticated: "Your sign-in has expired. Sign in again before using your online library.",
  account_changed: "The signed-in account changed. Reload Focus before using your online library.",
  conflict:
    "Your online library changed on another device. Check the online library, restore its latest copy, then save again. Your browser designs are unchanged.",
  storage_unavailable:
    "Online storage is unavailable. Your browser designs are still here; download a library backup and try again later.",
  precondition_required:
    "The online revision could not be checked. Check the online library again before saving.",
  invalid_backup:
    "This library could not be saved online because its designs or images are invalid. Your existing online copy is unchanged.",
  payload_too_large:
    "This library exceeds the 20 MB online backup limit. Keep a downloaded backup of your work.",
  origin_rejected:
    "This save could not be verified. Reopen Focus at its original address and try again.",
  unsupported_media_type:
    "This library could not be sent in the required format. Reload Focus and try again.",
};

const validRevision = (value: string | null): value is string =>
  value !== null && /^"[\x21\x23-\x7e]+"$/.test(value) && value.length <= 200;

function assertCurrentOwner(userId: string): void {
  let owner: string | null;
  try {
    owner = getBrowserOwnerId();
  } catch {
    throw new HostedClientError(
      "Account verification is paused. Retry account verification, then check your online library. Your browser copy is still here.",
      "session_unverified",
      409,
    );
  }
  if (!userId || owner !== userId)
    throw new HostedClientError(messages["account_changed"]!, "account_changed", 409);
}

/** Bound the whole response, including a stalled body, not only the initial fetch. */
async function withDeadline<T>(
  external: AbortSignal | undefined,
  timeoutMs: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (external?.aborted) throw external.reason ?? new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  let rejectWaiting!: (error: unknown) => void;
  const waiting = new Promise<never>((_resolve, reject) => {
    rejectWaiting = reject;
  });
  const abort = () => {
    const reason: unknown = external?.reason ?? new DOMException("Aborted", "AbortError");
    controller.abort(reason);
    rejectWaiting(reason);
  };
  external?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => {
      const error = new HostedClientError(
        "The online request took too long. Your browser copy is still here. Check the online library before saving again; an interrupted save may already have reached the server.",
        "timeout",
        408,
      );
      controller.abort(error);
      rejectWaiting(error);
    },
    Math.max(1, Math.min(timeoutMs, 60_000)),
  );
  try {
    return await Promise.race([work(controller.signal), waiting]);
  } finally {
    clearTimeout(timeout);
    external?.removeEventListener("abort", abort);
  }
}

async function responseError(response: Response): Promise<HostedClientError> {
  let code = "request_failed";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "code" in body && typeof body.code === "string")
      code = body.code;
  } catch {
    // A proxy error can be HTML. Do not expose its body as an application message.
  }
  return new HostedClientError(
    messages[code] ??
      "The online library could not be reached. Your browser designs are unchanged. Try checking again.",
    code,
    response.status,
  );
}

function checkBackupSize(raw: string) {
  if (
    raw.length > MAX_LIBRARY_BACKUP_BYTES ||
    new TextEncoder().encode(raw).length > MAX_LIBRARY_BACKUP_BYTES
  )
    throw new HostedClientError(messages["payload_too_large"]!, "payload_too_large", 413);
}

async function boundedText(response: Response, signal: AbortSignal): Promise<string> {
  const length = Number(response.headers.get("Content-Length"));
  if (length > MAX_LIBRARY_BACKUP_BYTES)
    throw new HostedClientError(messages["payload_too_large"]!, "payload_too_large", 413);
  if (!response.body) {
    const raw = await response.text();
    checkBackupSize(raw);
    return raw;
  }
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel(signal.reason).catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let raw = "",
    size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_LIBRARY_BACKUP_BYTES) {
        await reader.cancel();
        throw new HostedClientError(messages["payload_too_large"]!, "payload_too_large", 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    return raw + decoder.decode();
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

/** Read only: opening this panel never replaces browser work. */
export async function readOnlineLibrary(
  userId: string,
  signal?: AbortSignal,
  timeoutMs = 20_000,
): Promise<{ raw: string; etag: string } | null> {
  assertCurrentOwner(userId);
  return withDeadline(signal, timeoutMs, async (requestSignal) => {
    const response = await fetch("/api/hosted/library", {
      headers: { "X-Focus-User": userId },
      credentials: "same-origin",
      cache: "no-store",
      signal: requestSignal,
    });
    if (!response.ok) {
      const error = await responseError(response);
      if (response.status === 404 && error.code === "not_found") return null;
      throw error;
    }
    const etag = response.headers.get("ETag");
    if (!validRevision(etag))
      throw new HostedClientError(
        "The online copy has no valid revision. It has not been restored or replaced. Try checking again.",
        "invalid_revision",
        response.status,
      );
    const raw = await boundedText(response, requestSignal);
    try {
      const body: unknown = JSON.parse(raw);
      if (
        !body ||
        typeof body !== "object" ||
        !("version" in body) ||
        body.version !== 1 ||
        !("entries" in body) ||
        !Array.isArray(body.entries)
      )
        throw new Error("Invalid envelope");
    } catch {
      throw new HostedClientError(
        "The online copy could not be read as a Focus library. Your browser designs are unchanged.",
        "invalid_backup",
        response.status,
      );
    }
    return { raw, etag };
  });
}

/** Conditional write only. A conflict is returned to the person, never retried. */
export async function saveOnlineLibrary(
  userId: string,
  raw: string,
  revision: string | null,
  signal?: AbortSignal,
  timeoutMs = 20_000,
): Promise<string> {
  assertCurrentOwner(userId);
  checkBackupSize(raw);
  if (revision !== null && !validRevision(revision))
    throw new HostedClientError(messages["precondition_required"]!, "invalid_revision", 428);
  return withDeadline(signal, timeoutMs, async (requestSignal) => {
    const response = await fetch("/api/hosted/library", {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Focus-User": userId,
        ...(revision === null ? { "If-None-Match": "*" } : { "If-Match": revision }),
      },
      body: raw,
      signal: requestSignal,
    });
    if (!response.ok) throw await responseError(response);
    const etag = response.headers.get("ETag");
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (
      !validRevision(etag) ||
      !body ||
      typeof body !== "object" ||
      !("saved" in body) ||
      body.saved !== true ||
      !("revision" in body) ||
      body.revision !== etag
    )
      throw new HostedClientError(
        "The server did not confirm this save. Check the online library before trying again; keep your browser copy.",
        "unconfirmed_save",
        response.status,
      );
    return etag;
  });
}
