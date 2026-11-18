// Keyed HMAC-SHA256 over a design ID; only the server holds FOCUS_SIGNING_KEY.
export async function signId(id: string): Promise<string> {
  const secret = process.env["FOCUS_SIGNING_KEY"];
  if (!secret) throw new Error("Signing is not set up.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`focus:${id}`));
  return [...new Uint8Array(mac)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function stampStatus(
  stamp: { id: string; sig: string | null } | null,
): Promise<"signed" | "unsigned" | "forged" | null> {
  if (!stamp) return null;
  if (!stamp.sig) return "unsigned";
  try {
    return (await signId(stamp.id)) === stamp.sig ? "signed" : "forged";
  } catch {
    return "unsigned";
  }
}
