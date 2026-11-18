/** A namespace is fixed for the lifetime of a document, including delayed callbacks. */
let documentOwner: string | null = null;
let sessionLocked = false;

export function isHostedBuild(): boolean {
  return import.meta.env["VITE_FOCUS_HOSTED"] === "true";
}

export function createOwnerStorage(storage: Storage, ownerId: string): Storage {
  if (!ownerId || ownerId.length > 1024) throw new Error("A valid storage identity is required.");
  const prefix = `focus:owner:v1:${encodeURIComponent(ownerId)}:`;
  const keys = () => {
    const result: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) result.push(key.slice(prefix.length));
    }
    return result;
  };
  return {
    get length() {
      return keys().length;
    },
    getItem(key) {
      return storage.getItem(prefix + key);
    },
    setItem(key, value) {
      storage.setItem(prefix + key, value);
    },
    removeItem(key) {
      storage.removeItem(prefix + key);
    },
    key(index) {
      return keys()[index] ?? null;
    },
    clear() {
      for (const key of keys()) storage.removeItem(prefix + key);
    },
  };
}

export function initializeBrowserOwner(ownerId: string): void {
  if (!isHostedBuild()) return;
  if (
    (sessionLocked && documentOwner !== null) ||
    (documentOwner !== null && documentOwner !== ownerId)
  ) {
    throw new Error("Your account changed. Reload before opening another account's work.");
  }
  if (!ownerId || ownerId.length > 1024) throw new Error("A valid storage identity is required.");
  documentOwner = ownerId;
  sessionLocked = false;
}

/** Call only after fresh server verification of the same immutable document identity. */
export function resumeBrowserOwner(ownerId: string): void {
  if (!isHostedBuild()) return;
  if (documentOwner === null || documentOwner !== ownerId) {
    throw new Error("Your account changed. Reload before opening another account's work.");
  }
  sessionLocked = false;
}

/** Server requests must bind to the same authenticated owner as this document. */
export function getBrowserOwnerId(): string | null {
  if (!isHostedBuild()) return null;
  if (sessionLocked) throw new Error("Your session needs verification. Reload to continue.");
  return documentOwner?.startsWith("sites:") ? documentOwner.slice("sites:".length) : null;
}

/** Block late callbacks after a failed or changed session; no browser work is removed. */
export function lockBrowserOwner(): void {
  sessionLocked = true;
}

function storageFor(kind: "localStorage" | "sessionStorage"): Storage {
  if (isHostedBuild()) {
    if (sessionLocked) throw new Error("Your session needs verification. Reload to continue.");
    if (!documentOwner)
      throw new Error("Your identity must be verified before opening saved work.");
    return createOwnerStorage(window[kind], documentOwner);
  }
  return window[kind];
}

function documentStorage(kind: "localStorage" | "sessionStorage"): Storage {
  return {
    get length() {
      return storageFor(kind).length;
    },
    getItem(key) {
      return storageFor(kind).getItem(key);
    },
    setItem(key, value) {
      storageFor(kind).setItem(key, value);
    },
    removeItem(key) {
      storageFor(kind).removeItem(key);
    },
    key(index) {
      return storageFor(kind).key(index);
    },
    clear() {
      storageFor(kind).clear();
    },
  };
}

export const focusLocalStorage: Storage = documentStorage("localStorage");
export const focusSessionStorage: Storage = documentStorage("sessionStorage");
