// "Crafted with Focus" badge rules. One table so issuance and the weekly re-check agree.
export const BADGE_MIN_SCORE = 80;
export type BadgeCheck = {
  stamp: "signed" | "unsigned" | "forged" | null;
  idMatches: boolean; // the page's signed design code belongs to the design the badge was issued for
  score: number;
  highFails: number; // failed high-severity measured findings
  matched: number; // of 5 Vision values found on the page
};
export type BadgeReason = { ok: boolean; text: string };

export function badgeReasons(c: BadgeCheck): BadgeReason[] {
  return [
    {
      ok: c.stamp === "signed",
      text:
        c.stamp === "signed"
          ? "Signed Focus design code found"
          : c.stamp === "forged"
            ? "Design code signature does not match"
            : "No signed Focus design code on the page",
    },
    {
      ok: c.idMatches,
      text: c.idMatches ? "Code matches this design" : "Code belongs to a different design",
    },
    { ok: c.score >= BADGE_MIN_SCORE, text: `Quality score ${c.score} (needs ${BADGE_MIN_SCORE})` },
    {
      ok: c.highFails === 0,
      text: c.highFails
        ? `${c.highFails} serious problem${c.highFails === 1 ? "" : "s"} found`
        : "No serious problems found",
    },
    { ok: c.matched === 5, text: `${c.matched} of 5 Vision colors and fonts used` },
  ];
}
export const badgePasses = (c: BadgeCheck) => badgeReasons(c).every((r) => r.ok);

/** One site page: its measured check, or why it could not be checked. */
export type PageCheck = { url: string; check: BadgeCheck | null; error?: string };

/** The site's weakest value for every rule, so it passes only when every page passes every rule. */
export function mergeChecks(checks: BadgeCheck[]): BadgeCheck {
  return {
    stamp: checks.every((c) => c.stamp === "signed")
      ? "signed"
      : checks.find((c) => c.stamp !== "signed")!.stamp,
    idMatches: checks.every((c) => c.idMatches),
    score: Math.min(...checks.map((c) => c.score)),
    highFails: checks.reduce((n, c) => n + c.highFails, 0),
    matched: Math.min(...checks.map((c) => c.matched)),
  };
}

const short = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.host : u.pathname;
  } catch {
    return url;
  }
};

/** Whole-site badge: every checked page must pass; a page that can't be opened fails the site. */
export function siteBadge(pages: PageCheck[]) {
  const measured = pages.filter((p): p is PageCheck & { check: BadgeCheck } => !!p.check);
  const failing = pages.filter((p) => !p.check || !badgePasses(p.check));
  const whole: BadgeReason = {
    ok: pages.length > 0 && failing.length === 0,
    text: failing.length
      ? `${failing.length} of ${pages.length} page${pages.length === 1 ? "" : "s"} not passing: ${failing
          .slice(0, 4)
          .map(
            (p) =>
              `${short(p.url)} (${p.check ? badgeReasons(p.check).find((r) => !r.ok)!.text : (p.error ?? "could not be opened")})`,
          )
          .join("; ")}${failing.length > 4 ? "; …" : ""}`
      : `All ${pages.length} page${pages.length === 1 ? "" : "s"} pass`,
  };
  const check = measured.length ? mergeChecks(measured.map((p) => p.check)) : null;
  const reasons = [whole, ...(check ? badgeReasons(check) : [])];
  return {
    check,
    reasons,
    passing: whole.ok && !!check && badgePasses(check),
    pages: pages.length,
  };
}

/** Plain, dated status line shared by the proof page and the badge image. */
export function badgeLabel(passing: boolean, checkedAt: string | null) {
  const d = checkedAt ? new Date(checkedAt).toISOString().slice(0, 10) : "not yet";
  return passing ? `Crafted with Focus · checked ${d}` : `Focus check not passing · ${d}`;
}
