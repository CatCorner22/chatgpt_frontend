// Deterministic page measurements for the Design Critic. Pure functions: no network, fully tested.
export type Finding = {
  id: string;
  area: string;
  ok: boolean;
  severity: "high" | "medium" | "low";
  detail: string;
  fix: string;
  /** Needs a person to confirm; shown as "Possible issue" and left out of the score. */
  possible?: boolean;
};

const GENERIC_FONTS = ["inter", "poppins", "roboto", "open sans", "montserrat", "lato"];
const CLICHES = [
  "unlock",
  "elevate",
  "seamless",
  "revolutionize",
  "supercharge",
  "empower",
  "next-level",
  "game-changer",
  "cutting-edge",
  "unleash",
];

// Blocks requests to local or private networks so the Critic cannot be used to probe internal systems.
export function safeUrl(input: string): URL | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || (u.port && u.port !== "80" && u.port !== "443")) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal"))
    return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number) as [number, number];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0)
    )
      return null;
  }
  if (h.startsWith("[") || h.includes(":")) return null;
  return u;
}

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Reads the hidden "Focus design f-xxxxxxxxxx" tag from a page's head or its stylesheet comment.
const TAG = /^Focus design (f-[0-9a-f]{10})(?:\.([0-9a-f]{16}))?$/;
export function readFocusTag(html: string, css = ""): string | null {
  return readFocusStamp(html, css)?.id ?? null;
}
/** Design ID plus its optional server signature, from a generator meta tag or tokens.css comment. */
export function readFocusStamp(html: string, css = ""): { id: string; sig: string | null } | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/name=["']generator["']/i.test(m[0])) continue;
    const v = m[0].match(/content=["']([^"']*)["']/i)?.[1]?.trim() ?? "";
    const hit = v.match(TAG);
    if (hit) return { id: hit[1]!, sig: hit[2] ?? null };
  }
  for (const m of css.matchAll(/\/\*\s*([^*]*?)\s*\*\//g)) {
    const hit = m[1]!.match(TAG);
    if (hit) return { id: hit[1]!, sig: hit[2] ?? null };
  }
  return null;
}

export function analyzePage(rawHtml: string, css: string) {
  const html = rawHtml.replace(/&quot;|&#34;|&#x27;|&#39;/g, '"');
  const all = `${html}\n${css}`.toLowerCase();
  const fonts = [
    ...new Set(
      [...all.matchAll(/font-family\s*:\s*["']?([^;}"',]+)/g)]
        .map((m) => (m[1] ?? "").trim())
        .filter(
          (f) =>
            f &&
            !f.startsWith("var(") &&
            !["inherit", "sans-serif", "serif", "monospace", "system-ui", "-apple-system"].includes(
              f,
            ),
        ),
    ),
  ];
  const gfonts = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi)].map(
    (m) => {
      const family = m[1] ?? "";
      let decoded = family;
      try {
        decoded = decodeURIComponent(family);
      } catch {
        /* malformed third-party markup */
      }
      return (decoded.split(":")[0] ?? "").replace(/\+/g, " ").toLowerCase();
    },
  );
  // Focus packs put fonts in custom properties (--font-heading: "X"); read those too.
  const varFonts = [...all.matchAll(/--font-[\w-]+\s*:\s*["']?([^;}"',]+)/g)]
    .map((m) => (m[1] ?? "").trim())
    .filter(
      (f) =>
        f &&
        !f.startsWith("var(") &&
        !["sans-serif", "serif", "monospace", "system-ui"].includes(f),
    );
  const fontList = [...new Set([...fonts, ...gfonts, ...varFonts])];
  const sizes = new Set(
    [...all.matchAll(/font-size\s*:\s*([\d.]+(?:px|rem|em))/g)].map((m) => m[1]),
  );
  const hex2 = (n: string) =>
    Math.max(0, Math.min(255, Math.round(Number(n))))
      .toString(16)
      .padStart(2, "0");
  const colors = new Set([
    ...[...all.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/g)].map((m) => m[0]),
    ...[...all.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)].map(
      (m) => `#${hex2(m[1] ?? "0")}${hex2(m[2] ?? "0")}${hex2(m[3] ?? "0")}`,
    ),
  ]);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAlt = imgs.filter((i) => !/\balt\s*=/.test(i)).length;
  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  const h1 = headings.filter((n) => n === 1).length;
  const skipped = headings.some((n, i) => i > 0 && n - (headings[i - 1] ?? n) > 1);
  const body = text(html).toLowerCase();
  const words = body ? body.split(" ").length : 0;
  const cliches = CLICHES.filter((c) => body.includes(c));
  const purpleGrad =
    /gradient\([^)]*(#(?:8b5cf6|7c3aed|a855f7|6366f1|4f46e5|9333ea)|purple|violet|indigo)/.test(
      all,
    );
  const generic = fontList.filter((f) => GENERIC_FONTS.includes(f));
  const ctas = [...html.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => text(m[2] ?? "").toLowerCase())
    .filter((t) => t && t.length < 30);
  const vague = ctas.filter((t) =>
    ["learn more", "click here", "get started", "submit", "read more"].includes(t),
  ).length;
  const f = (x: Finding) => x;
  const findings: Finding[] = [
    f({
      id: "viewport",
      area: "Phones",
      ok: /<meta[^>]+name=["']viewport/i.test(html),
      severity: "high",
      detail: /<meta[^>]+name=["']viewport/i.test(html)
        ? "Set up for phone screens."
        : "No phone screen setting; the page will look tiny on phones.",
      fix: "Add a viewport meta tag (width=device-width, initial-scale=1).",
    }),
    f({
      id: "lang",
      area: "Accessibility",
      ok: /<html[^>]+lang=/i.test(html),
      severity: "medium",
      detail: /<html[^>]+lang=/i.test(html)
        ? "Page language is declared."
        : "Page language is missing, so screen readers may mispronounce it.",
      fix: 'Add lang="en" (or the right language) to the html tag.',
    }),
    f({
      id: "alt",
      area: "Accessibility",
      ok: noAlt === 0,
      severity: "high",
      detail: noAlt
        ? `${noAlt} of ${imgs.length} images have no description.`
        : imgs.length
          ? `All ${imgs.length} images have descriptions.`
          : "No images to check.",
      fix: 'Give every meaningful image alt text; decorative ones alt="".',
    }),
    f({
      id: "h1",
      area: "Structure",
      ok: h1 === 1,
      severity: "medium",
      detail: h1 === 1 ? "One main heading." : `${h1} main headings; there should be exactly one.`,
      fix: "Use one h1 for the page's main promise; use h2/h3 below it.",
    }),
    f({
      id: "order",
      area: "Structure",
      ok: !skipped,
      severity: "low",
      detail: skipped
        ? "Heading levels skip (e.g. h2 to h4), which confuses scanning and screen readers."
        : "Heading levels step down in order.",
      fix: "Step headings down one level at a time.",
    }),
    f({
      id: "fonts",
      area: "Typography",
      ok: fontList.length > 0 && fontList.length <= 3,
      severity: "medium",
      detail: fontList.length
        ? `${fontList.length} font families: ${fontList.slice(0, 5).join(", ")}.`
        : "No custom fonts found; the page uses device defaults.",
      fix: "Use one display face and one text face; at most three families.",
    }),
    f({
      id: "generic",
      area: "Distinctiveness",
      ok: generic.length === 0,
      severity: "medium",
      detail: generic.length
        ? `Uses ${generic.join(", ")}, the default faces of most template and AI sites.`
        : "Typeface choice avoids the most common defaults.",
      fix: "Pick a typeface with character that fits the brand (Focus's Type Lens).",
    }),
    f({
      id: "sizes",
      area: "Typography",
      ok: sizes.size === 0 || sizes.size <= 10,
      severity: "low",
      detail: `${sizes.size} different text sizes found.`,
      fix: "Use a type scale of 5–7 sizes from one ratio.",
    }),
    f({
      id: "colors",
      area: "Color",
      ok: colors.size <= 24,
      severity: "low",
      detail: `${colors.size} distinct hard-coded colors.`,
      fix: "Reduce to a token palette: ground, surface, ink, muted, one accent.",
    }),
    f({
      id: "gradient",
      area: "Distinctiveness",
      ok: !purpleGrad,
      severity: "medium",
      detail: purpleGrad
        ? "Purple/indigo gradient detected — the most recognisable 'AI template' look."
        : "No stock purple gradient.",
      fix: "Use one confident brand accent instead of a stock gradient.",
    }),
    f({
      id: "cliche",
      area: "Writing",
      ok: cliches.length === 0,
      severity: "medium",
      detail: cliches.length
        ? `Stock marketing words: ${cliches.join(", ")}.`
        : "Copy avoids common filler words.",
      fix: "Say concretely what the product does and for whom.",
    }),
    f({
      id: "cta",
      area: "Writing",
      ok: vague === 0,
      severity: "low",
      detail: vague
        ? `${vague} buttons or links use vague labels like "Learn more".`
        : "Action labels are specific.",
      fix: "Name the outcome: 'Book a class', 'See pricing'.",
    }),
    f({
      id: "length",
      area: "Content",
      ok: words >= 80,
      severity: "low",
      detail: `About ${words} words of visible text.`,
      fix: "Most first pages need enough words to answer what, who, and why.",
    }),
    ...usabilityFindings(html, css),
    ...briefFindings(rawHtml, css),
  ];
  const scored = findings.filter((x) => !x.possible);
  const score = Math.round(
    (100 *
      scored.reduce((s, x) => s + (x.ok ? 1 : 0) * { high: 3, medium: 2, low: 1 }[x.severity], 0)) /
      scored.reduce((s, x) => s + { high: 3, medium: 2, low: 1 }[x.severity], 0),
  );
  return {
    findings,
    score,
    facts: {
      fonts: fontList.slice(0, 8),
      colors: [...colors].slice(0, 80),
      words,
      title: (html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "").trim().slice(0, 120),
      excerpt: text(html).slice(0, 1500),
      focusId: readFocusTag(rawHtml, css),
    },
  };
}

// Compares what a page actually uses with the owner's Vision tokens.
export function compareToPrescription(
  facts: { fonts: string[]; colors: string[] },
  t: { headingFont: string; bodyFont: string; bg: string; ink: string; accent: string },
) {
  const fonts = facts.fonts.map((f) => f.toLowerCase());
  const full = (c: string) => {
    const h = c.toLowerCase();
    return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
  };
  const colors = new Set(facts.colors.map(full));
  const hasFont = (f: string) => fonts.some((x) => x.includes(f.toLowerCase()));
  const items = [
    { name: `Heading font: ${t.headingFont}`, ok: hasFont(t.headingFont) },
    { name: `Body font: ${t.bodyFont}`, ok: hasFont(t.bodyFont) },
    { name: `Background ${t.bg}`, ok: colors.has(full(t.bg)) },
    { name: `Text color ${t.ink}`, ok: colors.has(full(t.ink)) },
    { name: `Button and link color ${t.accent}`, ok: colors.has(full(t.accent)) },
  ];
  return { items, matched: items.filter((i) => i.ok).length };
}

// The Fitter: turns failed findings (and Vision mismatches) into a repair brief an AI builder can follow.
export function fitterBrief(
  host: string,
  findings: Finding[],
  mismatches: string[],
  priorities: { title: string; fix: string }[] = [],
) {
  const order = { high: 0, medium: 1, low: 2 } as const;
  const fails = findings.filter((f) => !f.ok).sort((a, b) => order[a.severity] - order[b.severity]);
  if (!fails.length && !mismatches.length && !priorities.length) return "";
  const lines = [
    `# Repair brief for ${host}`,
    "",
    "Change only what is listed. Keep all content, routes and working behavior. After each fix, re-check that nothing else moved.",
    "",
  ];
  if (priorities.length)
    lines.push(
      "## Highest-impact fixes (art director)",
      ...priorities.map((p, i) => `${i + 1}. ${p.title} — ${p.fix}`),
      "",
    );
  if (fails.length)
    lines.push(
      "## Measured problems",
      ...fails.map((f) => `- [${f.severity}] ${f.area}: ${f.detail} Fix: ${f.fix}`),
      "",
    );
  if (mismatches.length)
    lines.push("## Match the Vision exactly", ...mismatches.map((m) => `- Use ${m}`), "");
  lines.push(
    "## Done when",
    "- Every item above is fixed.",
    "- Text contrast is at least 4.5:1 and buttons are at least 44px tall.",
    "- No new fonts, colors or sections were added.",
  );
  return lines.join("\n");
}

// Ease-of-use checks from the owner's evidence brief (WCAG 2.4.7, 3.3.2; Wiedenbeck 1999; Mathur 2019).
const SHAME = [
  "no thanks, i",
  "i don't want",
  "i dont want",
  "i prefer to pay full",
  "i hate saving",
  "no, i like",
];
export function usabilityFindings(html: string, css: string): Finding[] {
  const controls = [...html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
  const iconOnly = controls.filter((m) => {
    const attrs = m[2] ?? "";
    if (/aria-label\s*=\s*["'][^"']+|title\s*=\s*["'][^"']+/i.test(attrs)) return false;
    const inner = m[3] ?? "";
    const alt = /<img\b[^>]*alt\s*=\s*["'][^"']+/i.test(inner);
    return !alt && text(inner).replace(/[^\p{L}\p{N}]/gu, "").length === 0;
  }).length;
  const labelled = new Set(
    [...html.matchAll(/<label\b[^>]*for\s*=\s*["']([^"']+)/gi)].map((m) => m[1]),
  );
  const placeholderOnly = [...html.matchAll(/<(input|textarea)\b([^>]*)>/gi)].filter((m) => {
    const a = m[2] ?? "";
    if (!/placeholder\s*=/i.test(a) || /type\s*=\s*["']?(hidden|submit|button)/i.test(a))
      return false;
    if (/aria-label(ledby)?\s*=/i.test(a)) return false;
    const id = a.match(/\bid\s*=\s*["']([^"']+)/i)?.[1];
    return !(id && labelled.has(id));
  }).length;
  const all = `${html}\n${css}`.toLowerCase();
  const killsFocus = /outline\s*:\s*(none|0)\b/.test(all) && !/:focus-visible|:focus\b/.test(all);
  const lower = text(html).toLowerCase();
  const shame = SHAME.filter((p) => lower.includes(p));
  return [
    {
      id: "icon-label",
      area: "Ease of use",
      ok: iconOnly === 0,
      severity: "medium",
      detail: iconOnly
        ? iconOnly === 1
          ? "1 button or link shows only an icon, with no words or label."
          : `${iconOnly} buttons or links show only an icon, with no words or label.`
        : "Every button and link has words or a label.",
      fix: "Put a short word next to each icon; first-time visitors find labelled icons faster.",
    },
    {
      id: "placeholder-label",
      area: "Ease of use",
      ok: placeholderOnly === 0,
      severity: "medium",
      detail: placeholderOnly
        ? placeholderOnly === 1
          ? "1 form field uses grey hint text as its only label; it disappears when typing."
          : `${placeholderOnly} form fields use grey hint text as their only label; it disappears when typing.`
        : "Form fields have real labels.",
      fix: "Give each field a visible label above it and keep the hint separate.",
    },
    {
      id: "focus",
      area: "Accessibility",
      ok: !killsFocus,
      severity: "high",
      detail: killsFocus
        ? "The focus outline is turned off with no replacement, so keyboard users can't see where they are."
        : "Keyboard focus is not hidden.",
      fix: "Keep a visible :focus-visible style on every button, link and field.",
    },
    {
      id: "shame",
      area: "Trust",
      ok: shame.length === 0,
      severity: "medium",
      detail: shame.length
        ? `Decline wording shames the visitor ("${shame[0]}…").`
        : "No guilt-trip wording on decline choices.",
      fix: 'Label the decline choice plainly, like "No thanks" or "Not now".',
    },
  ];
}

// Checks added from the second evidence brief (WCAG 2.5.8, 3.1.1; Material localization; Baymard; NN/G).
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
export function briefFindings(html: string, css: string): Finding[] {
  const all = `${html}\n${css}`;
  const htmlTag = html.match(/<html\b([^>]*)>/i)?.[1] ?? "";
  const lang = htmlTag.match(/\blang\s*=\s*["']?([a-z-]+)/i)?.[1]?.toLowerCase() ?? "";
  const rtlLang = /^(ar|he|fa|ur|yi|ps|sd|ug|ckb|dv)\b/.test(lang);
  const hasDir = /\bdir\s*=\s*["']?rtl/i.test(htmlTag);
  const truncates =
    /text-overflow\s*:\s*ellipsis/i.test(all) &&
    /(button|\.btn|nav)[^{]*\{[^}]*(white-space\s*:\s*nowrap|text-overflow)/i.test(
      css + html.replace(/[\s\S]*?<style[^>]*>([\s\S]*?)<\/style>[\s\S]*?/gi, "$1"),
    );
  const hardLR = rtlLang
    ? (
        all.match(
          /text-align\s*:\s*(left|right)|margin-(left|right)\s*:|padding-(left|right)\s*:/gi,
        ) ?? []
      ).length
    : 0;
  const pw = [...html.matchAll(/<input\b([^>]*)>/gi)].filter((m) =>
    /type\s*=\s*["']?password/i.test(m[1] ?? ""),
  );
  const pasteBlocked =
    pw.some((m) => /onpaste\s*=\s*["'][^"']*(return\s+false|preventDefault)/i.test(m[1] ?? "")) ||
    /addEventListener\(\s*["']paste["'][\s\S]{0,120}preventDefault/i.test(html);
  const small = [...all.matchAll(/(?:^|[;{\s"'])(width|height)\s*:\s*(\d+(?:\.\d+)?)px/gi)];
  const tinyTargets = [...html.matchAll(/<(button|a)\b[^>]*style\s*=\s*["']([^"']*)["']/gi)].filter(
    (m) => {
      const st = m[2] ?? "";
      const w = Number(st.match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1] ?? 99);
      const h = Number(st.match(/(?:^|;)\s*height\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1] ?? 99);
      return w < 24 || h < 24;
    },
  ).length;
  void small;
  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map(
    (m) =>
      (
        m[0].match(/<(input|select|textarea)\b(?![^>]*type\s*=\s*["']?(hidden|submit|button))/gi) ??
        []
      ).length,
  );
  const longest = Math.max(0, ...forms);
  const interrupt =
    /<dialog\b[^>]*\bopen\b/i.test(html) ||
    /(cookie|consent)[-_ ]?(banner|wall|modal|popup)|(newsletter|subscribe)[-_ ]?(modal|popup)/i.test(
      html,
    ) ||
    /intercom|drift\.com|crisp\.chat|tawk\.to|zendesk|livechat/i.test(html);
  const earlyError =
    [...html.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)].some((m) =>
      /aria-invalid\s*=\s*["']?true/i.test(m[2] ?? ""),
    ) ||
    /class\s*=\s*["'][^"']*\b(error|invalid)-?(message|text)?\b[^"']*["'][^>]*>\s*[^<\s][^<]{2,}/i.test(
      html,
    );
  return [
    {
      id: "page-language",
      area: "Language",
      ok: !!lang && (!rtlLang || hasDir),
      severity: "medium",
      detail: !lang
        ? "The page doesn't say which language it is in, so screen readers and translators guess."
        : rtlLang && !hasDir
          ? "The page is in a right-to-left language but isn't marked right-to-left."
          : `The page language is set (${lang}).`,
      fix: rtlLang
        ? 'Add dir="rtl" to the html tag.'
        : 'Add lang="en" (or the real language) to the html tag.',
    },
    {
      id: "wrap-room",
      area: "Language",
      ok: !truncates,
      severity: "low",
      detail: truncates
        ? 'Buttons or menu items cut off long text with "…"; translations can be 30% longer or more.'
        : "Buttons and menu items don't cut off text.",
      fix: "Let button and menu text wrap onto a second line instead of cutting it off.",
    },
    ...(rtlLang
      ? [
          {
            id: "rtl-sides",
            area: "Language",
            ok: hardLR === 0,
            severity: "low" as const,
            possible: true,
            detail: hardLR
              ? `${plural(hardLR, "style uses", "styles use")} fixed left or right on a right-to-left page.`
              : "No fixed left/right styles found.",
            fix: "Use start and end (for example text-align: start) so the layout mirrors; never mirror numbers or logos.",
          },
        ]
      : []),
    {
      id: "password-paste",
      area: "Ease of use",
      ok: !pasteBlocked,
      severity: "medium",
      detail: pasteBlocked
        ? "A password box blocks pasting, which stops password managers."
        : pw.length
          ? "Password boxes allow pasting."
          : "No password boxes.",
      fix: "Remove the paste block so people can use a password manager (WCAG 3.3.8).",
    },
    {
      id: "tap-size",
      area: "Accessibility",
      ok: tinyTargets === 0,
      severity: "medium",
      detail: tinyTargets
        ? `${plural(tinyTargets, "button or link is", "buttons or links are")} set smaller than 24 by 24 pixels.`
        : "No buttons or links are set smaller than 24 by 24 pixels.",
      fix: "Make every button and link at least 24 by 24 pixels (WCAG 2.5.8); 44 is better on phones.",
    },
    {
      id: "form-length",
      area: "Ease of use",
      ok: longest <= 12,
      severity: "low",
      detail:
        longest > 12
          ? `One form asks for ${longest} things on a single step.`
          : longest
            ? `The longest form asks for ${longest} things.`
            : "No forms.",
      fix: "Ask only what this step needs, or split it into steps. Long checkouts are a common reason people leave.",
    },
    {
      id: "early-error",
      area: "Ease of use",
      ok: !earlyError,
      severity: "medium",
      detail: earlyError
        ? "An error message shows before the visitor has typed anything."
        : "No error messages show before anyone types.",
      fix: "Check each field after the visitor leaves it, not before.",
    },
    {
      id: "interruption",
      area: "Ease of use",
      ok: !interrupt,
      severity: "low",
      possible: true,
      detail: interrupt
        ? "The page seems to open a pop-up, cookie wall or chat window on arrival."
        : "No pop-up, cookie wall or chat window found on arrival.",
      fix: "Let people read first. Make refusing cookies one plain step, and keep chat bubbles off the main button.",
    },
  ];
}

/** Up to `max` distinct same-site page addresses linked from a page (no files, no anchors-only links). */
export function sameSiteLinks(html: string, base: string, max = 9): string[] {
  const root = new URL(base);
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)[^"']*["']/gi)) {
    try {
      const u = new URL(m[1]!, root);
      u.hash = "";
      if (u.host !== root.host || !/^https?:$/.test(u.protocol)) continue;
      if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|css|js|xml|ico)$/i.test(u.pathname)) continue;
      if (u.toString() === root.toString()) continue;
      out.add(u.toString());
      if (out.size >= max) break;
    } catch {
      /* bad link */
    }
  }
  return [...out];
}

export type SitePage = { url: string; fonts: string[]; colors: string[]; score: number };
/** Pages whose fonts or main colours differ from most of the site. Pure; no AI. */
export function siteDrift(pages: SitePage[]): { url: string; reason: string }[] {
  if (pages.length < 2) return [];
  const key = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))].sort().join("|");
  const mode = (keys: string[]) => {
    const n = new Map<string, number>();
    keys.forEach((k) => n.set(k, (n.get(k) ?? 0) + 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  };
  const fontMode = mode(pages.map((p) => key(p.fonts)));
  const colorMode = mode(pages.map((p) => key(p.colors.slice(0, 6))));
  return pages.flatMap((p) => {
    const reasons = [
      key(p.fonts) !== fontMode &&
        `uses different fonts (${p.fonts.join(", ") || "device defaults"})`,
      key(p.colors.slice(0, 6)) !== colorMode && "uses different main colors",
    ].filter(Boolean) as string[];
    return reasons.length ? [{ url: p.url, reason: reasons.join(" and ") }] : [];
  });
}
