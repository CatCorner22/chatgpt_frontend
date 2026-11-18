// Decision engine: how earlier answers narrow, re-rank and warn about later options.
// Rules only point from earlier layers to later ones (no loops), see AGENTS.md.
import { STEPS, contrast, formatContrast, type Tokens } from "./design";

export const AUDIENCES = [
  "general public",
  "older adults",
  "professionals",
  "young and trend-aware",
  "busy on the go",
] as const;
export const TONES = [
  "calm and trustworthy",
  "editorial and refined",
  "bold and energetic",
  "warm and handmade",
  "precise and technical",
  "playful",
] as const;
export const GOALS = ["buy or book", "get in touch", "sign up", "read and learn"] as const;
export const DEVICES = ["mostly phones", "mostly computers", "both equally"] as const;
export const READING = ["very little text", "some text", "a lot to read"] as const;
export type Purpose = {
  audience: (typeof AUDIENCES)[number] | "";
  tone: (typeof TONES)[number] | "";
  goal?: (typeof GOALS)[number] | "";
  device?: (typeof DEVICES)[number] | "";
  reading?: (typeof READING)[number] | "";
  experience?: "website" | "app";
};

type Effect = { kind: "narrows" | "ranks" | "warns"; score: number; reason: string };
type Rule = {
  id: string;
  when: (p: Purpose) => boolean;
  test: (t: Tokens) => boolean;
  effect: Effect;
};

const SERIF = [
  "Fraunces",
  "Instrument Serif",
  "Playfair Display",
  "DM Serif Display",
  "Libre Caslon Text",
];
export const RULES: Rule[] = [
  {
    id: "older-no-compact",
    when: (p) => p.audience === "older adults",
    test: (t) => t.density === "compact",
    effect: {
      kind: "narrows",
      score: -100,
      reason: "Compact spacing is hard to use for older adults",
    },
  },
  {
    id: "older-airy",
    when: (p) => p.audience === "older adults",
    test: (t) => t.density === "airy",
    effect: { kind: "ranks", score: 2, reason: "Generous space helps older readers" },
  },
  {
    id: "go-no-underline-btn",
    when: (p) => p.audience === "busy on the go",
    test: (t) => t.buttonStyle === "underline",
    effect: {
      kind: "narrows",
      score: -100,
      reason: "Underline buttons are small tap targets on phones",
    },
  },
  {
    id: "editorial-serif",
    when: (p) => p.tone === "editorial and refined",
    test: (t) => SERIF.includes(t.headingFont),
    effect: { kind: "ranks", score: 2, reason: "Serif headings carry an editorial voice" },
  },
  {
    id: "editorial-layout",
    when: (p) => p.tone === "editorial and refined",
    test: (t) => t.heroLayout === "editorial",
    effect: { kind: "ranks", score: 1, reason: "The editorial first screen fits your tone" },
  },
  {
    id: "calm-no-glow",
    when: (p) => p.tone === "calm and trustworthy",
    test: (t) => t.texture === "glow",
    effect: { kind: "warns", score: -2, reason: "A glow pulls against a calm, trustworthy tone" },
  },
  {
    id: "calm-ratio",
    when: (p) => p.tone === "calm and trustworthy",
    test: (t) => t.scale <= 1.3,
    effect: { kind: "ranks", score: 1, reason: "A modest size ratio feels steady" },
  },
  {
    id: "bold-ratio",
    when: (p) => p.tone === "bold and energetic",
    test: (t) => t.scale >= 1.35,
    effect: { kind: "ranks", score: 2, reason: "Big size contrast reads bold" },
  },
  {
    id: "bold-poster",
    when: (p) => p.tone === "bold and energetic",
    test: (t) => t.heroLayout === "poster",
    effect: { kind: "ranks", score: 1, reason: "A poster first screen matches bold energy" },
  },
  {
    id: "technical-sharp",
    when: (p) => p.tone === "precise and technical",
    test: (t) => t.radius <= 6,
    effect: { kind: "ranks", score: 2, reason: "Sharp corners read precise" },
  },
  {
    id: "technical-grid",
    when: (p) => p.tone === "precise and technical",
    test: (t) => t.texture === "grid",
    effect: { kind: "ranks", score: 1, reason: "A fine grid suits a technical voice" },
  },
  {
    id: "warm-round",
    when: (p) => p.tone === "warm and handmade",
    test: (t) => t.radius >= 8,
    effect: { kind: "ranks", score: 1, reason: "Softer corners feel handmade" },
  },
  {
    id: "warm-grain",
    when: (p) => p.tone === "warm and handmade",
    test: (t) => t.texture === "grain",
    effect: { kind: "ranks", score: 1, reason: "Grain adds a tactile, handmade touch" },
  },
  {
    id: "playful-pill",
    when: (p) => p.tone === "playful",
    test: (t) => t.buttonStyle === "pill" || t.radius >= 14,
    effect: { kind: "ranks", score: 2, reason: "Round shapes feel playful" },
  },
  {
    id: "playful-no-caps-serif",
    when: (p) => p.tone === "playful",
    test: (t) => t.headingFont === "Libre Caslon Text",
    effect: {
      kind: "warns",
      score: -1,
      reason: "A classic book face may feel too formal for playful",
    },
  },
  {
    id: "phone-no-underline-btn",
    when: (p) => p.device === "mostly phones",
    test: (t) => t.buttonStyle === "underline",
    effect: {
      kind: "narrows",
      score: -100,
      reason: "Underline buttons are small tap targets on phones",
    },
  },
  {
    id: "phone-no-compact",
    when: (p) => p.device === "mostly phones",
    test: (t) => t.density === "compact",
    effect: { kind: "warns", score: -2, reason: "Compact spacing makes tapping hard on phones" },
  },
  {
    id: "action-filled-btn",
    when: (p) => p.goal === "buy or book" || p.goal === "sign up",
    test: (t) => t.buttonStyle === "solid" || t.buttonStyle === "pill",
    effect: { kind: "ranks", score: 2, reason: "A filled button makes your main action obvious" },
  },
  {
    id: "reading-no-caps",
    when: (p) => p.reading === "a lot to read" || p.goal === "read and learn",
    test: (t) => t.headingCase === "uppercase",
    effect: { kind: "warns", score: -2, reason: "All-caps headings tire readers on long pages" },
  },
  {
    id: "reading-calm-ratio",
    when: (p) => p.reading === "a lot to read",
    test: (t) => t.scale <= 1.33,
    effect: {
      kind: "ranks",
      score: 1,
      reason: "A modest size ratio keeps long reading comfortable",
    },
  },
];

// Measured floors apply regardless of purpose.
function floors(t: Tokens): Effect[] {
  const out: Effect[] = [];
  if (contrast(t.ink, t.bg) < 4.5)
    out.push({ kind: "warns", score: -3, reason: "Text is below 4.5:1 contrast" });
  if (contrast(t.accentInk, t.accent) < 4.5)
    out.push({ kind: "warns", score: -3, reason: "Button text is below 4.5:1 contrast" });
  if (t.headingCase === "uppercase" && t.scale > 1.45)
    out.push({ kind: "warns", score: -1, reason: "Huge uppercase headings slow reading" });
  return out;
}

export function evaluate(p: Purpose, t: Tokens) {
  const effects = [
    ...RULES.filter((r) => r.when(p) && r.test(t)).map((r) => r.effect),
    ...floors(t),
  ];
  return {
    score: effects.reduce((a, e) => a + e.score, 0),
    blocked: effects.some((e) => e.kind === "narrows"),
    effects,
  };
}

// Rank options; drop narrowed ones unless that would leave nothing (then relax and say so).
export function rankOptions<O extends { tokens: Tokens }>(p: Purpose, opts: O[]) {
  const scored = opts.map((o, i) => ({ ...o, i, ev: evaluate(p, o.tokens) }));
  const allowed = scored.filter((o) => !o.ev.blocked);
  const relaxed = allowed.length === 0;
  const list = (relaxed ? scored : allowed).sort((a, b) => b.ev.score - a.ev.score || a.i - b.i);
  return { list, removed: relaxed ? 0 : scored.length - allowed.length, relaxed };
}

// Which later steps read the fields a step changes (derived dependencies).
const DERIVED: Record<string, string[]> = {
  palette: ["accent", "texture"], // accent and texture are judged against the ground
  type: ["scale", "layout"], // face changes how size ratio and layout read
  scale: ["layout"],
  density: ["shape", "layout"],
};
export function affectedSteps(stepId: string) {
  const i = STEPS.findIndex((s) => s.id === stepId);
  return (DERIVED[stepId] ?? []).filter((id) => STEPS.findIndex((s) => s.id === id) > i);
}

// "Fix for me": push text colors toward black or white until they reach 4.5:1.
function toward(fg: string, bg: string) {
  const target = contrast("#000000", bg) >= contrast("#ffffff", bg) ? 0 : 255;
  const n = fg.replace("#", "");
  let rgb = [0, 2, 4].map((k) => parseInt(n.slice(k, k + 2), 16));
  for (let step = 0; step < 20 && contrast(hex(rgb), bg) < 4.5; step++)
    rgb = rgb.map((c) => Math.round(c + (target - c) * 0.2));
  return contrast(hex(rgb), bg) >= 4.5 ? hex(rgb) : target === 0 ? "#000000" : "#ffffff";
}
const hex = (rgb: number[]) =>
  "#" + rgb.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("");
export function fixContrast(t: Tokens): Tokens {
  return {
    ...t,
    ink: toward(t.ink, t.bg),
    muted: toward(t.muted, t.bg),
    accentInk: toward(t.accentInk, t.accent),
  };
}

// Measured checks from tokens (code facts, not opinions). Grades follow the knowledge cards.
export function measuredChecks(t: Tokens) {
  const em = 0.5; // approx. average character width in em for Latin text
  const lineChars = Math.round(34 / em); // reading block max width is 34em
  const levels = [1, Math.pow(t.scale, 1.4), Math.pow(t.scale, 4.4)];
  const distinct = levels.every((v, i) => i === 0 || v / levels[i - 1]! >= 1.15);
  const btnHeight = 16 * (t.buttonStyle === "underline" ? 1.2 + 0.6 : 1.2 + 1.7); // line height + vertical padding, at 16px
  return [
    {
      name: "Line length",
      value: `~${lineChars} characters`,
      ok: lineChars >= 45 && lineChars <= 75,
      grade: "A",
    },
    {
      name: "Clear text levels",
      value: distinct ? "3 distinct" : "too close",
      ok: distinct,
      grade: "B",
    },
    {
      name: "Main button height",
      value: `~${Math.round(btnHeight)}px`,
      ok: btnHeight >= 44,
      grade: "A",
    },
    {
      name: "Uppercase headings",
      value: t.headingCase,
      ok: !(t.headingCase === "uppercase" && t.scale > 1.45),
      grade: "B",
    },
    ...contrastChecks(t),
  ];
}
function contrastChecks(t: Tokens) {
  return [
    {
      name: "Text contrast",
      value: `${formatContrast(contrast(t.ink, t.bg))}:1`,
      ok: contrast(t.ink, t.bg) >= 4.5,
      grade: "A",
    },
    {
      name: "Button text contrast",
      value: `${formatContrast(contrast(t.accentInk, t.accent))}:1`,
      ok: contrast(t.accentInk, t.accent) >= 4.5,
      grade: "A",
    },
  ];
}

// Quality scale. Honest by design: measurements can prove a floor, never taste.
export type Grade = { level: 0 | 1 | 2; name: string; summary: string; missing: string[] };
export function qualityGrade(checks: { name: string; ok: boolean; grade: string }[]): Grade {
  const missingA = checks.filter((c) => c.grade === "A" && !c.ok).map((c) => c.name);
  const missingAll = checks.filter((c) => !c.ok).map((c) => c.name);
  if (missingA.length)
    return {
      level: 0,
      name: "Below the floor",
      summary: "Some hard rules (contrast, size, reading comfort) fail. Fix these before building.",
      missing: missingA,
    };
  if (missingAll.length)
    return {
      level: 1,
      name: "Meets the floor",
      summary: "Every hard rule passes. A few craft guidelines could be tighter.",
      missing: missingAll,
    };
  return {
    level: 2,
    name: "Crafted",
    summary:
      "Every measured rule and craft guideline passes. What's left is taste — and that's yours.",
    missing: [],
  };
}
