/** Optional cloud services must never prevent the browser-only studio from opening. */
export function isCloudConfigured(url: unknown, key: unknown): boolean {
  if (typeof url !== "string" || typeof key !== "string" || !key.trim()) return false;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function hasCloudBackend(): boolean {
  // Sites supplies its own verified identity and storage. Never attach a separate
  // Supabase account (and its automatic sync) to a Sites owner's browser library.
  if (import.meta.env["VITE_FOCUS_HOSTED"] === "true") return false;
  const server = typeof window === "undefined" && typeof process !== "undefined" ? process.env : {};
  return isCloudConfigured(
    import.meta.env["VITE_SUPABASE_URL"] || server["SUPABASE_URL"],
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || server["SUPABASE_PUBLISHABLE_KEY"],
  );
}
