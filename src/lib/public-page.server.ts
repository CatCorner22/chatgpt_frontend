import { safeUrl } from "./critic";
import { allPublic } from "./netguard";

// Resolve A and AAAA over DNS-over-HTTPS; refuse names that point at private machines.
// DNS rebinding between this lookup and fetch remains a known risk without an egress proxy.
async function resolvesPublic(host: string, signal: AbortSignal): Promise<boolean> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return allPublic([host], []);
  const ask = async (type: "A" | "AAAA") => {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      { signal, headers: { Accept: "application/dns-json" } },
    );
    if (!r.ok) throw new Error("dns");
    const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
    return (j.Answer ?? []).filter((a) => a.type === (type === "A" ? 1 : 28)).map((a) => a.data);
  };
  const [v4, v6] = await Promise.all([ask("A"), ask("AAAA")]);
  return allPublic(v4, v6);
}

export type PublicDocument = { text: string; url: string; complete: boolean };

// Validate every hop before fetching; never let fetch follow a redirect implicitly.
export async function grabPublicDocument(
  input: string,
  limit: number,
): Promise<PublicDocument | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let url = safeUrl(input);
    for (let hop = 0; url && hop <= 4; hop++) {
      if (!(await resolvesPublic(url.hostname, controller.signal))) return null;
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "FocusCritic/1.0", Accept: "text/html,text/css" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) return null;
        url = safeUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        return null;
      }
      const type = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!/^(text\/(html|css|plain)|application\/xhtml\+xml)\b/.test(type)) {
        await response.body.cancel();
        return null;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let remaining = limit;
      let result = "";
      let complete = false;
      try {
        while (remaining > 0) {
          const { done, value } = await reader.read();
          if (done) {
            complete = true;
            break;
          }
          const chunk = value.subarray(0, remaining);
          result += decoder.decode(chunk, { stream: true });
          remaining -= chunk.byteLength;
          if (chunk.byteLength < value.byteLength) break;
          // An exact-size response is complete only after its stream ends.
          if (remaining === 0) {
            complete = (await reader.read()).done === true;
            break;
          }
        }
        return { text: result + decoder.decode(), url: url.toString(), complete };
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Text-only compatibility for callers that do not extract relative page resources. */
export async function grabPublicPage(input: string, limit: number): Promise<string | null> {
  return (await grabPublicDocument(input, limit))?.text ?? null;
}
