import { analyzePage, compareToPrescription, readFocusStamp, sameSiteLinks } from "./critic";
import { normalizeTokens } from "./design";
import { designId } from "./launch";
import { stampStatus } from "./signing.server";
import { grabSiteSources } from "./watchtower.server";
import { siteBadge, type BadgeCheck, type PageCheck } from "./badge";

// Measured only, no AI: the same evidence on issue and on every weekly re-check.
// Covers the page plus up to 9 same-site pages it links to; every one must pass.
export async function evaluateBadge(url: string, rawTokens: unknown) {
  const tokens = normalizeTokens(rawTokens);
  const id = designId(tokens);
  const measure = async (html: string, css: string): Promise<BadgeCheck> => {
    const r = analyzePage(html, css);
    const stamp = readFocusStamp(html, css);
    return {
      stamp: await stampStatus(stamp),
      idMatches: !!stamp && stamp.id === id,
      score: r.score,
      highFails: r.findings.filter((f) => !f.ok && !f.possible && f.severity === "high").length,
      matched: compareToPrescription(r.facts, tokens).matched,
    };
  };
  const first = await grabSiteSources(url);
  const title = analyzePage(first.html, first.css).facts.title;
  const urls = [url, ...sameSiteLinks(first.html, url, 9)];
  const started = Date.now();
  const pages: PageCheck[] = [{ url, check: await measure(first.html, first.css) }];
  for (const u of urls.slice(1)) {
    // A page we ran out of time for is unproven, so it counts as not passing.
    if (Date.now() - started > 25000) {
      pages.push({ url: u, check: null, error: "not checked in time" });
      continue;
    }
    try {
      const src = await grabSiteSources(u);
      pages.push({ url: u, check: await measure(src.html, src.css) });
    } catch {
      pages.push({ url: u, check: null, error: "could not be opened" });
    }
  }
  const site = siteBadge(pages);
  return {
    tokens,
    check: site.check!,
    passing: site.passing,
    reasons: site.reasons,
    pages: site.pages,
    title,
    id,
  };
}

export async function recheckBadge(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("badges").select("*").eq("id", id).maybeSingle();
  if (!row) return;
  const { data: claimed } = await supabaseAdmin.rpc("claim_badge", { _id: id });
  if (!claimed) return;
  const now = new Date();
  const next = new Date(now.getTime() + 604800000).toISOString();
  const history = Array.isArray(row.history) ? row.history.slice(-11) : [];
  try {
    const e = await evaluateBadge(row.url, row.tokens);
    await supabaseAdmin
      .from("badges")
      .update({
        passing: e.passing,
        score: e.check.score,
        reasons: e.reasons,
        history: [...history, { at: now.toISOString(), passing: e.passing, score: e.check.score }],
        checked_at: now.toISOString(),
        next_check: next,
        error: null,
        lease_until: null,
      })
      .eq("id", id);
  } catch (err) {
    // A page that can't be opened no longer proves anything: the badge stops showing as passing.
    await supabaseAdmin
      .from("badges")
      .update({
        passing: false,
        error: err instanceof Error ? err.message : "Check failed.",
        history: [...history, { at: now.toISOString(), passing: false, score: null }],
        checked_at: now.toISOString(),
        next_check: next,
        lease_until: null,
      })
      .eq("id", id);
  }
}
