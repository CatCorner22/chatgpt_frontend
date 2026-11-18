import { analyzePage, safeUrl } from "./critic";
import { grabPublicDocument, grabPublicPage } from "./public-page.server";

// No AI calls in recurring checks: deterministic, bounded and no credit surprises.
export async function grabSiteSources(input: string) {
  const u = safeUrl(input);
  if (!u) throw new Error("This address is not a public page.");
  const document = await grabPublicDocument(u.toString(), 400_000);
  const html = document?.text;
  if (!html)
    throw new Error(
      "Could not open this page. The site may block checks; its last score is unchanged.",
    );
  const links = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter((m) => /rel=["']?stylesheet/i.test(m[0]))
    .flatMap((m) => {
      const href = m[0].match(/href=["']([^"']+)/i)?.[1];
      if (!href) return [];
      try {
        // Relative assets belong to the validated final page after redirects.
        const next = safeUrl(new URL(href, document.url).toString());
        return next ? [next.toString()] : [];
      } catch {
        return [];
      }
    })
    .slice(0, 4);
  const css = (await Promise.all(links.map((url) => grabPublicPage(url, 300_000))))
    .filter(Boolean)
    .join("\n");
  return { html, css };
}

export async function measureSite(input: string) {
  const { html, css } = await grabSiteSources(input);
  const r = analyzePage(html, css);
  return { score: r.score, findings: r.findings, title: r.facts.title, designId: r.facts.focusId };
}

export async function checkWatchedSite(id: string, ownerId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("watched_sites")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row || (ownerId && row.user_id !== ownerId))
    throw new Error("Watched page not found.");
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_watchtower", {
    _id: id,
  });
  if (claimError || !claimed) throw new Error("A check is already running. Try again shortly.");
  const now = new Date();
  try {
    const result = await measureSite(row.url);
    const history = Array.isArray(row.history) ? row.history.slice(-11) : [];
    const { error: saveError } = await supabaseAdmin
      .from("watched_sites")
      .update({
        score: result.score,
        findings: result.findings,
        design_id: result.designId,
        history: [
          ...history,
          {
            at: now.toISOString(),
            score: result.score,
            findings: result.findings,
            designId: result.designId,
          },
        ],
        checked_at: now.toISOString(),
        next_check: new Date(now.getTime() + 604800000).toISOString(),
        error: null,
        lease_until: null,
      })
      .eq("id", id);
    if (saveError) throw new Error("The check finished but could not be saved.");
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Check failed.";
    await supabaseAdmin
      .from("watched_sites")
      .update({
        error: message,
        next_check: new Date(now.getTime() + 604800000).toISOString(),
        lease_until: null,
      })
      .eq("id", id);
    throw new Error(message);
  }
}
