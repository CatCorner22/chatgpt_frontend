type SaveStorage = Pick<Storage, "getItem" | "setItem">;

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Validate fields consumed by rendering; missing legacy fields still migrate normally. */
export function assertRestorableStudioState(
  value: unknown,
): asserts value is Record<string, unknown> {
  const fail = () => {
    throw new Error("The saved studio state has an unreadable structure.");
  };
  if (!object(value)) return fail();
  if (
    "integration" in value &&
    value["integration"] !== "new" &&
    value["integration"] !== "existing"
  )
    fail();
  for (const field of ["brief", "direction", "nav"])
    if (field in value && typeof value[field] !== "string") fail();
  for (const field of ["libraryId", "projectId", "savedHash"])
    if (field in value && value[field] !== null && typeof value[field] !== "string") fail();
  for (const field of ["stepIndex", "aiCalls", "version"])
    if (field in value && (typeof value[field] !== "number" || !Number.isFinite(value[field])))
      fail();
  for (const field of ["quick", "fix"])
    if (field in value && typeof value[field] !== "boolean") fail();
  if (
    "stage" in value &&
    !["brief", "directions", "exam", "review", "rx"].includes(String(value["stage"]))
  )
    fail();
  if (value["tokens"] !== undefined && value["tokens"] !== null && !object(value["tokens"])) fail();
  if (value["content"] !== undefined && value["content"] !== null) {
    const c = value["content"];
    if (
      !object(c) ||
      !["brand", "headline", "sub", "cta", "quote"].every(
        (field) => typeof c[field] === "string",
      ) ||
      !Array.isArray(c["features"]) ||
      !c["features"].every(
        (f) => object(f) && typeof f["title"] === "string" && typeof f["body"] === "string",
      )
    )
      fail();
  }
  for (const field of ["history", "directions", "picks", "recheck", "past", "future"])
    if (field in value && !Array.isArray(value[field])) fail();
  if (Array.isArray(value["history"]) && !value["history"].every(object)) fail();
  if (
    Array.isArray(value["directions"]) &&
    !value["directions"].every(
      (d) =>
        object(d) &&
        object(d["tokens"]) &&
        ["name", "mood", "why"].every((field) => typeof d[field] === "string"),
    )
  )
    fail();
  if (
    Array.isArray(value["picks"]) &&
    !value["picks"].every(
      (p) =>
        object(p) &&
        typeof p["step"] === "string" &&
        typeof p["label"] === "string" &&
        (p["reason"] === undefined || typeof p["reason"] === "string"),
    )
  )
    fail();
  if (Array.isArray(value["recheck"]) && !value["recheck"].every((x) => typeof x === "string"))
    fail();
  if (
    "purpose" in value &&
    (!object(value["purpose"]) ||
      !Object.values(value["purpose"]).every((x) => typeof x === "string"))
  )
    fail();
  if ("page" in value && !object(value["page"])) fail();
  if (
    "cache" in value &&
    (!object(value["cache"]) ||
      !Object.values(value["cache"]).every(
        (options) =>
          Array.isArray(options) &&
          options.every(
            (o) =>
              object(o) &&
              object(o["tokens"]) &&
              typeof o["label"] === "string" &&
              typeof o["why"] === "string",
          ),
      ))
  )
    fail();
}

export type StudioRestore<T> =
  | { status: "ready"; state: T; recoveryKey?: string }
  | { status: "blocked"; raw: string | null; message: string };

/** Identify history that migration would discard while keeping the current design usable. */
export function studioHistoryNeedsRecovery(value: unknown): boolean {
  if (!object(value)) return true;
  return ["past", "future"].some((field) => {
    const steps = value[field];
    if (steps === undefined) return false;
    if (!Array.isArray(steps) || steps.length > 30) return true;
    return steps.some((step) => {
      try {
        assertRestorableStudioState(step);
        // Snapshots intentionally have no nested undo/redo. Preserve any legacy
        // nested data before migration flattens it, without recursively walking it.
        return ["past", "future"].some((key) => Array.isArray(step[key]) && step[key].length > 0);
      } catch {
        return true;
      }
    });
  });
}

/** Never replace unreadable owner data before a second, verified copy exists. */
export function restoreStudioSave<T>(
  storage: SaveStorage,
  key: string,
  parse: (raw: string) => T,
  fallback: T,
  recoveryKey: string,
  needsRecovery?: (raw: string) => boolean,
): StudioRestore<T> {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return {
      status: "blocked",
      raw: null,
      message:
        "This browser is not allowing access to saved designs. Allow site storage, then try again.",
    };
  }
  if (raw === null) return { status: "ready", state: fallback };
  let state = fallback;
  try {
    state = parse(raw);
    if (!needsRecovery?.(raw)) return { status: "ready", state };
  } catch {
    // Unreadable current data uses the fallback; a usable migration above keeps
    // its repaired state. Both paths must preserve the original before saving.
  }
  try {
    // A collision must not overwrite an older recovery copy.
    if (storage.getItem(recoveryKey) !== null) throw new Error("Recovery key already exists");
    storage.setItem(recoveryKey, raw);
    if (storage.getItem(recoveryKey) !== raw) throw new Error("Recovery copy was not retained");
    return { status: "ready", state, recoveryKey };
  } catch {
    return {
      status: "blocked",
      raw,
      message:
        "The saved design could not be read, and this browser could not keep a recovery copy. Your original data has not been replaced. Download it below, free some browser storage, then try again.",
    };
  }
}

export function readStudioRecoveries(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  key: string,
) {
  const copies: { key: string; raw: string }[] = [];
  for (let index = 0; index < storage.length; index++) {
    const savedKey = storage.key(index);
    if (!savedKey?.startsWith(`${key}:recovery:`)) continue;
    const raw = storage.getItem(savedKey);
    if (raw !== null) copies.push({ key: savedKey, raw });
  }
  return copies.sort((a, b) => b.key.localeCompare(a.key));
}
