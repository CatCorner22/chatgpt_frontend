import { designId } from "./launch";
import JSZip from "jszip";
import {
  cleanText,
  contrast,
  contrastNotes,
  EXISTING_RULES,
  markdownText,
  RESTYLE_SCOPE,
  scopedTokensCss,
  tokensCss,
  type Integration,
  type Tokens,
} from "./design";
import { fontLinkTags, fontStack, fontsUrl } from "./fonts";
export { scopedTokensCss } from "./design";

export function tailwindTheme(t: Tokens) {
  return `/* NEW projects only (Tailwind v4): add inside your main stylesheet. For an existing app use focus-bridge.css from the existing-site pack. */
@theme {
  --color-background: ${t.bg};
  --color-card: ${t.surface};
  --color-foreground: ${t.ink};
  --color-muted-foreground: ${t.muted};
  --color-primary: ${t.accent};
  --color-primary-foreground: ${t.accentInk};
  --font-display: ${fontStack(t.headingFont)};
  --font-sans: ${fontStack(t.bodyFont)};
  --radius: ${t.radius}px;
}`;
}

// Design Tokens Community Group format, readable by Figma plugins and token tools.
export function dtcgTokens(t: Tokens) {
  const c = (v: string) => ({ $type: "color", $value: v });
  return {
    color: {
      background: c(t.bg),
      surface: c(t.surface),
      text: c(t.ink),
      muted: c(t.muted),
      accent: c(t.accent),
      "on-accent": c(t.accentInk),
    },
    font: {
      heading: { $type: "fontFamily", $value: t.headingFont },
      body: { $type: "fontFamily", $value: t.bodyFont },
    },
    radius: { base: { $type: "dimension", $value: `${t.radius}px` } },
    scale: { ratio: { $type: "number", $value: t.scale } },
  };
}

// Compact version for small or local models that lose track of long instructions.
export function shortPrompt(t: Tokens, brand: string, mode: Integration = "new") {
  const project = markdownText(brand, 80) || "your project";
  if (mode === "existing")
    return `Review and restyle one existing page of ${project} with the owner.
Keep its words, routes, controls, validation, data, permissions and working tasks unchanged. Work in an isolated branch or duplicate with a local or staging preview; never apply the trial directly to production. Save a named backup and record the original tasks before applying the supplied scoped files. Use test accounts and sandbox integrations so trial actions cannot send real messages, charge money or change production data.
Visual values for reviewed components: background ${t.bg}, surfaces ${t.surface}, text ${t.ink}, quiet text ${t.muted}, primary action ${t.accent} with ${t.accentInk} text.
Fonts: headings "${t.headingFont}", body "${t.bodyFont}". Preferred corners ${t.radius}px, spacing ${t.density}, type scale ${t.scale}.
Adding data-focus-restyle exposes namespaced values only. The bridge stays inactive until the same wrapper also has data-focus-theme="semantic", after reviewing every affected component's actual foreground and background together. The bridge maps complete known semantic color pairs; it does not directly repaint the wrapper or set fonts, native-control styling or focus indicators. Mixed fixed/semantic colors and inherited text can still regress when semantic mapping is activated: keep that mode off for incompatible wrappers and review individual components instead. Portals and root-resolved theme aliases can retain their original appearance. Do not force a global theme or move portals.
If a visual change would alter behavior, content, readable contrast, clipping or the original tasks, keep that part unchanged and report it. Test the recorded tasks on desktop, phone and keyboard, compare the original screenshots, demonstrate rollback, then stop for the owner's review. Deploy only after the owner accepts the tested changes and a rollback plan.`;
  return `Build the UI for ${project} using ONLY these values.
Colors: background ${t.bg}, cards ${t.surface}, text ${t.ink}, quiet text ${t.muted}, accent ${t.accent} with ${t.accentInk} text on it.
Fonts: headings "${t.headingFont}"${t.headingCase === "uppercase" ? " in capitals" : ""}, body "${t.bodyFont}", 16px minimum.
Corners ${t.radius}px. Spacing ${t.density}. Buttons ${t.buttonStyle}. Type scale ratio ${t.scale}.
${t.accent2 ? `Second color ${t.accent2}: thin bands and small shapes only, never text or buttons.\n` : ""}${t.card === "glass" ? "Cards are frosted glass: translucent card color with a 14px background blur.\n" : ""}${t.buttonFinish === "glow" ? "The main button has a soft glow in the accent color.\n" : t.buttonFinish === "gloss" ? "The main button has a soft top highlight.\n" : ""}Avoid unrelated styling defaults: unrequested purple gradients, fonts other than those selected, ${t.card === "glass" ? "" : "glass cards, "}emoji icons, ${t.accent2 ? "a third accent color" : "more than one accent color"}.
Check: readable at 390px wide, visible focus rings, 44px tap targets.\nEasy to use: words beside every icon, real labels above form fields, buttons named for their result, status in words, plain "No thanks" decline, buttons wrap instead of cutting off text, waits over 10s show progress and Cancel, set the page language.`;
}

// Stamp linking a built page back to the exact design that produced it (same fingerprint as launch evidence).
export function provenance(t: Tokens, sig?: string) {
  return `Focus design ${designId(t)}${sig ? `.${sig}` : ""}`;
}

/** "#336699" -> "210 50% 40%" (the space-separated form older shadcn themes expect). */
export function hslTriplet(hex: string) {
  let h6 = hex.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h6))
    h6 = h6
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-f]{6}$/.test(h6)) throw new PackError([`Invalid color ${hex.slice(0, 20)}`]);
  const n = parseInt(h6, 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min;
  let h = 0;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  h = r1((h * 60 + 360) % 360);
  return `${h} ${r1(sat * 100)}% ${r1(l * 100)}%`;
}

const SEMANTIC_SCOPE = `${RESTYLE_SCOPE}[data-focus-theme="semantic"]`;

/** Reviewed semantic mapping changes host theme variables only after a separate opt-in. */
export function themeBridge(t: Tokens, legacy = false) {
  const color = (key: string, hex: string) =>
    legacy ? hslTriplet(hex) : `var(--focus-color-${key})`;
  // The muted background is a surface, which can differ from the page background.
  // Use the already-validated body text color if the quiet color would lose contrast there.
  const mutedOnSurface = contrast(t.muted, t.surface) >= 4.5;
  return `/* Apply data-focus-restyle to ONE existing page wrapper after saving a backup.
   This bridge is inactive until data-focus-theme="semantic" is also present,
   after auditing all affected components for paired runtime theme colors.
   Never put these on html/body; root elements are excluded. Remove data-focus-theme to disable mapping.
   Use this file OR focus-bridge-legacy.css, never both. */
${SEMANTIC_SCOPE} {
  --background: ${color("bg", t.bg)};
  --foreground: ${color("ink", t.ink)};
  --card: ${color("surface", t.surface)};
  --card-foreground: ${color("ink", t.ink)};
  --popover: ${color("surface", t.surface)};
  --popover-foreground: ${color("ink", t.ink)};
  --primary: ${color("accent", t.accent)};
  --primary-foreground: ${color("accent-ink", t.accentInk)};
  --muted: ${color("surface", t.surface)};
  --muted-foreground: ${mutedOnSurface ? color("muted", t.muted) : color("ink", t.ink)};
}
/* Existing utilities must resolve colors at runtime via var(--background),
   or hsl(var(--background)) for the legacy bridge. Do not replace a theme.
   Review each component's actual foreground AND background before opting in.
   This bridge does not directly paint the wrapper or set fonts, native-control
   color schemes and focus indicators. Changing theme variables can still alter
   inherited text. Do not activate on wrappers mixing fixed colors with semantic
   variables; those need a separate component review.
   Quiet text uses the body text color on surfaces when its chosen color would
   fall below 4.5:1 contrast. Verify actual components after applying the bridge.
   Root-resolved aliases, outside portals and fixed-color components can keep
   their original look. Apply font/radius preferences only after reviewing them.
   Do not move portals or change behavior to make them inherit these values. */
`;
}

export type PackFiles = Record<string, string>;

/** AI-written guide text: drop raw HTML and control characters, keep Markdown. */
export function cleanMarkdown(md: string, max = 60_000) {
  return (
    String(md ?? "")
      // Keep Markdown whitespace while removing the other ASCII controls.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\/?[a-z][^>]*>/gi, "")
      .replace(/javascript:/gi, "")
      .slice(0, max)
  );
}

// Patterns no pack file may contain (the font/generator tags in START-HERE are the only HTML allowed).
const FORBIDDEN: [RegExp, string][] = [
  [/<script\b/i, "a script"],
  [/<iframe\b/i, "an iframe"],
  [/\son[a-z]+\s*=/i, "an event handler"],
  [/javascript:/i, "a javascript: link"],
  [/!important/i, "!important"],
  [/@import\s+(?:url\()?["']?(?:https?:)?\/\//i, "an outside @import"],
];

const TOKEN_PROPERTIES = new Set(
  [
    "color-bg",
    "color-surface",
    "color-ink",
    "color-muted",
    "color-accent",
    "color-accent-ink",
    "color-link",
    "color-surface-link",
    "font-heading",
    "font-body",
    "text-body",
    "text-h3",
    "text-h2",
    "text-h1",
    "space-unit",
    "radius",
    "color-accent-2",
    "glass-bg",
    "glass-blur",
    "button-glow",
  ].map((name) => `--focus-${name}`),
);
const BRIDGE_PROPERTIES = new Set([
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--muted",
  "--muted-foreground",
]);

/** The exported CSS grammar is intentionally tiny: one opted-in rule, custom values only. */
function hasScopedValueContract(css: string, selector: string, properties: Set<string>) {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const rule = /^([^{}]+)\{([^{}]*)\}$/.exec(uncommented);
  if (!rule || rule[1]!.trim() !== selector) return false;
  const declarations = rule[2]!
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!declarations.length) return false;
  const seen = new Set<string>();
  return declarations.every((declaration) => {
    const match = /^(--[a-z0-9-]+)\s*:\s*([^;]+)$/.exec(declaration);
    if (!match || !properties.has(match[1]!) || seen.has(match[1]!)) return false;
    seen.add(match[1]!);
    return true;
  });
}

/** Every file in the pack, as text. Pure, so it can be validated and tested before download. */
export function packFiles(
  md: string,
  t: Tokens,
  brandIn = "your project",
  sig?: string,
  mode: Integration = "new",
): PackFiles {
  const brand = cleanText(brandIn, 80) || "your project";
  const title = markdownText(brand, 80);
  if (sig && !/^[0-9a-f]{16}$/.test(sig)) throw new PackError(["Invalid design signature"]);
  const stamp = provenance(t, sig);
  const meta = `<meta name="generator" content="${stamp}">`;
  const links = fontLinkTags([t.headingFont, t.bodyFont]);
  const files: PackFiles = {
    "DESIGN.md": cleanMarkdown(md),
    "PROMPT-SHORT.md": `${mode === "existing" ? EXISTING_RULES + "\n\n" : ""}${shortPrompt(t, brand, mode)}`,
    "design-tokens.json": JSON.stringify(dtcgTokens(t), null, 2),
    "tokens.json": JSON.stringify(t, null, 2),
    "font-links.html": links,
  };
  if (mode === "existing") {
    files["focus-tokens.css"] = `/* ${stamp} */\n${scopedTokensCss(t)}\n`;
    files["focus-bridge.css"] = themeBridge(t);
    files["focus-bridge-legacy.css"] = themeBridge(t, true);
    const rule = `Read FOCUS-RULES.md before changing any screen. This is an existing project: change looks only, never remove features or content, never overwrite existing files.\nKeep ${meta} in the page head.\n`;
    files["FOCUS-RULES.md"] =
      `# Focus design rules (existing project)\n\n${rule}\n${EXISTING_RULES}\n`;
    files["ADD-TO-YOUR-RULES.md"] =
      `# Optional rule reminder\n\nAppend ONLY this marked block to your existing rule file; do not replace it. If you already have this block, update it once instead of duplicating it.\n\n<!-- FOCUS-RESTYLE:BEGIN -->\nRead focus-restyle/FOCUS-RULES.md and focus-restyle/DESIGN.md. Preserve all existing functionality.\n<!-- FOCUS-RESTYLE:END -->\n`;
    files["PRESERVE.md"] =
      `# Before changing anything\n\n- Work in an isolated branch or duplicate with a local or staging preview. Never apply the trial directly to the production app. Disconnect production writes and use test accounts/sandbox integrations; trial tasks must not send real messages, charge money or alter production data.\n- Save a named backup or commit and record its exact name/hash. Keep uncommitted work too. Never use a hard reset or delete customer work.\n- If focus-restyle already exists, STOP. Pick a fresh folder name and update the paths; never merge or overwrite an earlier pack.\n- List all routes, links and destinations, forms and fields, validation, buttons and actions, permissions, analytics, data calls and images. Record a working task on desktop, phone and keyboard.\n- Capture before screenshots at the same size used after.\n- Do not upgrade packages, change routing, alter auth/data/validation, replace configuration, or remove customer rules.\n- Apply data-focus-restyle to ONE wrapper, not html/body; this only exposes namespaced values. Keep portals where they are. Audit every affected component for paired runtime foreground/background variables before additionally setting data-focus-theme="semantic". Leave semantic mapping off for fixed/mixed-color wrappers; review those components individually.\n- Run the same tasks and compare the inventory and actual text contrast after each page. If anything fails, remove data-focus-theme and stop; remove data-focus-restyle to clear its local values too. Restore only your own restyle edits from the backup.\n\nFocus can flag missing public HTML links/forms/fields. It cannot prove private app actions or unseen pages are preserved. Test those in the isolated preview before continuing. Deploy only after the owner reviews the results and approves the tested changes and rollback plan.\n`;
    files["READ-FIRST.txt"] =
      "STOP if a folder named focus-restyle already exists in your project. Choose a new folder name instead; never unzip over existing files. Then open START-HERE.md.\n";
    files["UNDO.md"] =
      `# How to undo Focus\n\n1. Remove data-focus-theme from the trial wrapper to disable semantic mapping. Remove data-focus-restyle too to clear the local Focus values. If components were explicitly styled with --focus-* values, selectively revert those component edits before removing their values.\n2. For bundlers, remove ONLY the new CSS imports from the entry file. For HTML, remove ONLY the new stylesheet links. For CSS imports, remove ONLY their new @import lines at the top. These point to focus-restyle/focus-bridge.css (or focus-bridge-legacy.css) and focus-tokens.css.\n3. Remove ONLY the new font links and Focus generator tag you added. Keep all pre-existing links and generator tags.\n4. Remove the optional block between FOCUS-RESTYLE:BEGIN and FOCUS-RESTYLE:END from your rule file. Keep its original contents.\n5. If the tool also edited components, selectively restore those restyle changes from the named backup. Preserve any later unrelated work; never hard-reset or delete files blindly.\n6. Repeat the original visitor tasks and compare screenshots. Removing these CSS additions removes their styling effect; component changes need their own selective rollback.\n\nThe unused focus-restyle folder can remain, or be removed after confirming it contains only files added for this transfer.\n`;
    files["START-HERE.md"] =
      `# Restyle ${title} with Focus — safely\n\n1. **Make an isolated trial first.** Use a separate branch or duplicate and a local or staging preview, never the live production app. Read PRESERVE.md; save a copy as a named backup, preserve uncommitted work and record the original tasks. Use test accounts and sandbox integrations for tasks that write data, send messages or charge money.\n2. Extract into a NEW focus-restyle folder. If that name exists, stop and choose another; never unzip over customer files.\n3. Choose ONE bridge: focus-bridge.css for components that resolve full CSS colors from semantic variables at runtime; focus-bridge-legacy.css ONLY for hsl(var(--background)) consumers. Check the actual compiled component styles, not just a framework name. Keep the existing theme untouched.\n4. Load focus-tokens.css and your chosen bridge after existing styles. Plain HTML: add two stylesheet links. Bundlers: add separate CSS imports in the entry file after existing imports. CSS @import lines must be at the TOP, before any declarations; never paste them at the end or inside @theme. Do not import the HTML font file as CSS.\n5. Add data-focus-restyle to ONE existing page wrapper (not html/body). This exposes --focus-* values without changing the host theme. After checking every affected component uses paired foreground/background theme variables at runtime, add data-focus-theme="semantic" to that SAME wrapper to activate the chosen bridge. Mixed fixed/semantic colors or inherited text can regress: leave semantic mapping off for incompatible wrappers and style reviewed components individually. The bridge does not directly set wrapper appearance, fonts, native-control styling or focus indicators. Root-resolved aliases and outside portals may retain their original look. Apply --focus-* font/radius preferences only to reviewed components; do not rewrite functionality.\n6. Add these font links and a separate generator tag to the page head without replacing existing tags (frameworks: use their head API):\n\n\`\`\`html\n${links}\n${meta}\n\`\`\`\n\n7. Give DESIGN.md and FOCUS-RULES.md to your tool. Restyle one page, rerun all recorded tasks, then wait for approval. Optional reminder: ADD-TO-YOUR-RULES.md.\n8. Run Check a site in Focus against an owner-approved public preview if available. Do not make a private staging app public just for this check. A public HTML comparison is partial, not a guarantee that your app works. Test authenticated tasks in the preview and demonstrate selective rollback.\n9. Deploy only after the owner reviews the before/after evidence, accepts the tested changes and approves the rollback plan. A download, passing score or successful CSS import is not release approval.\n\nNo new dependencies or package upgrades are needed. Fonts use Google Fonts; if blocked by privacy rules, CSP or offline use, self-host approved fonts or keep the documented fallback. See UNDO.md for every reversal.\n`;
  } else {
    const rule = `Read DESIGN.md before changing any screen. Use only the values in tokens.css. Never fall back to default styling.\nKeep ${meta} in the page head so Focus can match the built page to this design.\n`;
    files["tokens.css"] = `/* ${stamp} */\n${tokensCss(t)}\n`;
    files["tailwind-theme.css"] = tailwindTheme(t);
    files["AGENTS.md"] = `# Design rules\n\n${rule}`;
    files[".cursorrules"] = rule;
    files[".windsurfrules"] = rule;
    files[".github/copilot-instructions.md"] = rule;
    files["START-HERE.md"] =
      `# Build ${title} with Focus\n\nFor a NEW project. Restyling a site that already exists? Download the "existing site" pack for additive files and preservation/rollback instructions. The download does not automatically edit your project; follow its folder-collision checks before extracting.\n\n1. Add to the page head:\n\n\`\`\`html\n${links}\n${meta}\n\`\`\`\n\n2. Import tokens.css once, globally (Tailwind v4: use tailwind-theme.css in your main stylesheet).\n3. Give DESIGN.md to your AI builder. Small or local model? Start with PROMPT-SHORT.md.\n4. AGENTS.md, .cursorrules, .windsurfrules and .github/copilot-instructions.md keep coding tools on the design for every later edit.\n5. Run Check a site in Focus on the result.\n`;
  }
  return files;
}

/** Problems that would make a pack unsafe or broken. Empty means it can ship. */
export function validatePack(files: PackFiles, t: Tokens, mode: Integration): string[] {
  const errs: string[] = [];
  const need =
    mode === "existing"
      ? [
          "DESIGN.md",
          "START-HERE.md",
          "UNDO.md",
          "focus-tokens.css",
          "focus-bridge.css",
          "FOCUS-RULES.md",
          "PRESERVE.md",
          "ADD-TO-YOUR-RULES.md",
          "focus-bridge-legacy.css",
          "font-links.html",
          "PROMPT-SHORT.md",
          "design-tokens.json",
          "tokens.json",
          "READ-FIRST.txt",
        ]
      : [
          "DESIGN.md",
          "START-HERE.md",
          "tokens.css",
          "tailwind-theme.css",
          "font-links.html",
          "PROMPT-SHORT.md",
          "design-tokens.json",
          "tokens.json",
        ];
  const allowed = new Set(
    mode === "existing"
      ? [...need, "ADD-TO-YOUR-RULES.md", "PRESERVE.md", "focus-bridge-legacy.css"]
      : [...need, "AGENTS.md", ".cursorrules", ".windsurfrules", ".github/copilot-instructions.md"],
  );
  for (const n of Object.keys(files))
    if (!allowed.has(n)) errs.push(`${n} is not an allowed pack file`);
  for (const n of need) if (!files[n]?.trim()) errs.push(`${n} is missing`);
  for (const [n, body] of Object.entries(files)) {
    for (const [re, what] of FORBIDDEN) if (re.test(body)) errs.push(`${n} contains ${what}`);
    if (n.endsWith(".json")) {
      try {
        JSON.parse(body);
      } catch {
        errs.push(`${n} is not valid JSON`);
      }
    }
    if (n.endsWith(".css")) {
      const open = (body.match(/{/g) ?? []).length,
        close = (body.match(/}/g) ?? []).length;
      if (open !== close) errs.push(`${n} has unbalanced braces`);
      if (/undefined|NaN|\[object /.test(body)) errs.push(`${n} has an empty value`);
    }
  }
  if (mode === "existing") {
    for (const n of [
      "AGENTS.md",
      ".cursorrules",
      ".windsurfrules",
      ".github/copilot-instructions.md",
      "tokens.css",
      "tailwind-theme.css",
    ])
      if (n in files) errs.push(`${n} could replace a customer file`);
    for (const n of ["focus-bridge.css", "focus-bridge-legacy.css"]) {
      const css = files[n] ?? "";
      if (!hasScopedValueContract(css, SEMANTIC_SCOPE, BRIDGE_PROPERTIES))
        errs.push(`${n} changes screens without opt-in`);
    }
    const tok = files["focus-tokens.css"] ?? "";
    if (!hasScopedValueContract(tok, RESTYLE_SCOPE, TOKEN_PROPERTIES))
      errs.push("focus-tokens.css must contain only scoped Focus values");
    const bad = [...tok.matchAll(/(--[a-z0-9-]+)\s*:/g)]
      .map((m) => m[1])
      .filter((v) => !v?.startsWith("--focus-"));
    if (bad.length) errs.push(`focus-tokens.css sets non-Focus names: ${bad.join(", ")}`);
  }
  if (!(files["START-HERE.md"] ?? "").includes("fonts.googleapis.com"))
    errs.push("Font loading is missing");
  if (
    !(files[mode === "existing" ? "focus-tokens.css" : "tokens.css"] ?? "").startsWith(
      `/* Focus design ${designId(t)}`,
    )
  )
    errs.push("Token file design code does not match");
  if (!(files["START-HERE.md"] ?? "").includes(designId(t)))
    errs.push("Design code does not match this design");
  for (const n of contrastNotes(t)) if (!n.ok) errs.push(`Contrast too low: ${n.pair}`);
  return errs;
}

/** Builds the downloadable zip. Throws (and nothing downloads) if the pack fails validation. */
export async function buildPack(
  md: string,
  t: Tokens,
  brand = "your project",
  sig?: string,
  mode: Integration = "new",
) {
  const files = packFiles(md, t, brand, sig, mode);
  const errs = validatePack(files, t, mode);
  if (errs.length) throw new PackError(errs);
  const zip = new JSZip();
  for (const [n, body] of Object.entries(files))
    zip.file(mode === "existing" ? `focus-restyle/${n}` : n, body);
  return zip.generateAsync({ type: "blob" });
}

export class PackError extends Error {
  constructor(public problems: string[]) {
    super(`The design pack failed its safety check: ${problems.join("; ")}`);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
