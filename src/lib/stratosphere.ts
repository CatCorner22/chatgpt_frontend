import { getAuthoredFontAvailability, AUTHORED_FONT_COVERAGE } from "./authored-font-availability";
import {
  BODY_FONTS,
  BUTTON_STYLES,
  CASES,
  DENSITIES,
  HEADING_FONTS,
  HERO_LAYOUTS,
  TEXTURES,
  contrast,
  formatContrast,
  type Content,
  type Integration,
  type Tokens,
} from "./design";
import { RULES, type Purpose } from "./engine";
import { compactImageFraming, getImageFramingCss, IMAGE_NARROW_BREAKPOINT } from "./image-framing";
import type { PageSettings } from "./page-settings";
import { PAGE_COMPOSITIONS, isPageComposition, type PageComposition } from "./page-compositions";
import type { NavId } from "./nav";

/** Shared control domains; custom form choices use the same constraints and graph as presets. */
export const STRATOSPHERE_FORM = {
  radius: { min: 0, max: 28, step: 1 },
  buttonStyles: BUTTON_STYLES,
} as const;

export type StratosphereInput = {
  tokens: Tokens;
  page: PageSettings;
  purpose: Purpose;
  integration: Integration;
  nav?: NavId;
  content?: Content;
};
export type StratosphereGroupId =
  "composition" | "palette" | "fonts" | "hierarchy" | "spacing" | "form";
export type StratosphereField = `tokens.${keyof Tokens}` | "page.composition";
export type StratosphereProfile =
  "authored-website" | "existing-specification" | "app-specification";
type TokenChange = {
  [K in keyof Tokens]-?: { field: `tokens.${K}`; value: Tokens[K]; effect: string };
}[keyof Tokens];
export type StratosphereChange =
  TokenChange | { field: "page.composition"; value: PageComposition; effect: string };
export type StratosphereOption = {
  id: string;
  label: string;
  description: string;
  lesson: string;
  changes: readonly StratosphereChange[];
};
export type StratosphereGroup = {
  id: StratosphereGroupId;
  label: string;
  description: string;
  lesson: string;
  authoredOnly: boolean;
  recheck: string;
  output: { authored: string; specification: string };
  options: readonly StratosphereOption[];
};
export type StratosphereIssue = {
  id: string;
  kind: "measured" | "scope" | "advisory" | "limitation" | "invalid";
  severity: "block" | "note";
  message: string;
  fields: string[];
};
export type StratosphereResult = {
  accepted: boolean;
  issues: StratosphereIssue[];
  changedFields: StratosphereField[];
  tokens: Tokens;
  page: PageSettings;
};
export type StratosphereNode = {
  id: string;
  kind: "context" | "choice" | "output";
  label: string;
  value: string;
  available: boolean;
  selectedOptionId: string | null;
};
export type StratosphereEdge = {
  id: string;
  from: string;
  to: string;
  kind: "sets" | "affects" | "requires" | "advisory";
  reason: string;
  fields: string[];
  blocked: boolean;
};
export type StratosphereGraph = {
  version: 1;
  profile: StratosphereProfile;
  snapshot: Omit<StratosphereInput, "nav"> & { nav: NavId | null };
  nodes: StratosphereNode[];
  edges: StratosphereEdge[];
  limitations: string[];
  issues: StratosphereIssue[];
};

const layoutFor: Record<PageComposition, Tokens["heroLayout"]> = {
  studio: "split",
  editorial: "editorial",
  product: "stacked",
  showcase: "poster",
  journal: "editorial",
};
const token = <K extends keyof Tokens>(
  key: K,
  value: Tokens[K],
  effect: string,
): StratosphereChange => ({ field: `tokens.${key}`, value, effect }) as StratosphereChange;
const choice = (
  id: string,
  label: string,
  description: string,
  changes: readonly StratosphereChange[],
  lesson = description,
): StratosphereOption => ({ id, label, description, lesson, changes });
const palette = (
  id: string,
  label: string,
  values: Pick<Tokens, "bg" | "surface" | "ink" | "muted" | "accent" | "accentInk">,
): StratosphereOption =>
  choice(
    id,
    label,
    "A complete set of background, surface, text and action colors.",
    (Object.entries(values) as [keyof typeof values, string][]).map(([key, value]) =>
      token(
        key,
        value,
        `Sets the ${key} color role; it does not recolor an external app automatically.`,
      ),
    ),
    "Treat foreground and background colors as pairs. Token calculations do not replace checking the rendered page.",
  );

/** All control mutations and graph field edges come from this bounded registry. */
export const STRATOSPHERE_GROUPS: readonly StratosphereGroup[] = [
  {
    id: "composition",
    recheck:
      "Follow the reading and keyboard order on a phone. Open the primary action and related links.",
    label: "Page layout",
    description: "Choose a structure for the authored website.",
    lesson:
      "Composition changes the reading sequence and arrangement. Preserve an existing app's structure until its owner reviews a scoped implementation.",
    authoredOnly: true,
    output: {
      authored: "Sets the authored HTML structure and its matching hero arrangement.",
      specification:
        "Unavailable: a design specification does not replace the customer's page structure.",
    },
    options: PAGE_COMPOSITIONS.map((item) =>
      choice(item.id, item.title, item.description, [
        {
          field: "page.composition",
          value: item.id,
          effect: "Sets the authored page composition and HTML sections.",
        },
        token(
          "heroLayout",
          layoutFor[item.id],
          "Keeps the earlier hero arrangement consistent with this composition.",
        ),
      ]),
    ),
  },
  {
    id: "palette",
    recheck:
      "Read text on each actual background. Tab to the main action and check its focus indicator.",
    label: "Colors",
    description: "White, cool color, or deep ink with complete readable color pairs.",
    lesson: "Distinguish content, surfaces and actions without requiring many colors.",
    authoredOnly: false,
    output: {
      authored: "Sets page and surface colors. Link colors are derived for readability.",
      specification:
        "Writes color roles into design tokens and specifications; the target app still needs reviewed integration.",
    },
    options: [
      palette("cloud-blue", "Cloud and blue", {
        bg: "#ffffff",
        surface: "#eef4fa",
        ink: "#17202b",
        muted: "#475569",
        accent: "#1d4ed8",
        accentInk: "#ffffff",
      }),
      palette("ink-ice", "Ink and ice", {
        bg: "#0b1220",
        surface: "#152237",
        ink: "#f5f8ff",
        muted: "#bdcbe0",
        accent: "#a4c9ff",
        accentInk: "#101c2e",
      }),
      palette("white-crimson", "White and crimson", {
        bg: "#f8fafc",
        surface: "#ffffff",
        ink: "#17202b",
        muted: "#475569",
        accent: "#b51f41",
        accentInk: "#ffffff",
      }),
    ],
  },
  {
    id: "fonts",
    recheck:
      "Check the exported heading wraps and the longest button label fits on a clean device.",
    label: "Fonts",
    description: "Choose the requested voice of headings and body text.",
    lesson:
      "These three pairs include licensed font files in authored pages. Other choices may use local fallbacks; inspect real words and unsupported characters on the destination device.",
    authoredOnly: false,
    output: {
      authored:
        "Embeds supported font files with the authored page and declares fallbacks for other families or characters.",
      specification:
        "Writes font choices and references. Loading, licensing and customer font policy remain implementation work.",
    },
    options: [
      choice(
        "editorial",
        "Editorial contrast",
        "Instrument Serif headings with Instrument Sans reading text.",
        [
          token("headingFont", "Instrument Serif", "Sets the requested heading family."),
          token("bodyFont", "Instrument Sans", "Sets the requested body family."),
        ],
      ),
      choice(
        "architectural",
        "Architectural sans",
        "Space Grotesk headings with IBM Plex Sans reading text.",
        [
          token("headingFont", "Space Grotesk", "Sets the requested heading family."),
          token("bodyFont", "IBM Plex Sans", "Sets the requested body family."),
        ],
      ),
      choice("literary", "Literary rhythm", "Newsreader headings with Literata reading text.", [
        token("headingFont", "Newsreader", "Sets the requested heading family."),
        token("bodyFont", "Literata", "Sets the requested body family."),
      ]),
    ],
  },
  {
    id: "hierarchy",
    recheck:
      "Read the headings in order and enlarge text to check the price and primary action remain visible.",
    label: "Text size and emphasis",
    description: "Control the scale and case of headings.",
    lesson:
      "The same ratio wraps differently with another font or headline. Inspect real words on narrow screens; advice is not measured usability.",
    authoredOnly: false,
    output: {
      authored:
        "Derives heading CSS sizes and text transformation; responsive rules constrain displayed sizes.",
      specification:
        "Writes type ratio and case instructions. Its generated scale differs from the authored-page renderer.",
    },
    options: [
      choice("quiet", "Quiet hierarchy", "Restrained size contrast and natural heading case.", [
        token("scale", 1.18, "Derives heading sizes."),
        token("headingCase", "normal", "Preserves the owner's letter case."),
      ]),
      choice("balanced", "Balanced hierarchy", "Moderate size contrast and natural heading case.", [
        token("scale", 1.28, "Derives heading sizes."),
        token("headingCase", "normal", "Preserves the owner's letter case."),
      ]),
      choice(
        "expressive",
        "Expressive hierarchy",
        "Larger size contrast and natural heading case.",
        [
          token("scale", 1.45, "Derives heading sizes."),
          token("headingCase", "normal", "Preserves the owner's letter case."),
        ],
      ),
      choice("precise-caps", "Measured capitals", "A moderate ratio with uppercase headings.", [
        token("scale", 1.32, "Derives heading sizes."),
        token("headingCase", "uppercase", "Transforms headings without rewriting saved words."),
      ]),
    ],
  },
  {
    id: "spacing",
    recheck:
      "Resize across the page breakpoints and check for clipped content and crowded touch targets.",
    label: "Spacing",
    description: "Set the space between sections and related content.",
    lesson:
      "More space is not always better. Compare the task and long content on a narrow screen.",
    authoredOnly: false,
    output: {
      authored: "Sets section-spacing multiplier: airy 1.25, balanced 1, compact 0.85.",
      specification:
        "Sets exported spacing unit: airy 1.5rem, balanced 1rem, compact 0.7rem; integration is still required.",
    },
    options: DENSITIES.map((density) =>
      choice(
        density,
        density[0]!.toUpperCase() + density.slice(1),
        `${density} spacing for the selected output.`,
        [token("density", density, "Sets the output-specific spacing scale.")],
      ),
    ),
  },
  {
    id: "form",
    recheck:
      "Activate the real control by keyboard and touch. Check focus, its destination, and recovery after a failed action.",
    label: "Buttons and corners",
    description: "Choose an action treatment and corner preference.",
    lesson:
      "Pills have their own radius and underlined actions have square edges. Some compositions keep image corners square.",
    authoredOnly: false,
    output: {
      authored:
        "Sets actions and applicable corners; authored actions retain a 48px minimum height.",
      specification:
        "Writes action and corner preferences. The optional source-change trial supports filled and pill actions only; outlined and underlined choices need developer-guided integration. Actual target sizes and host components require implementation checks.",
    },
    options: [
      choice("precise", "Precise and filled", "Square corners and a filled primary action.", [
        token("radius", 0, "Sets applicable corners."),
        token("buttonStyle", "solid", "Uses accent and on-accent colors."),
      ]),
      choice("soft", "Soft and outlined", "Ten-pixel corners and an outlined action.", [
        token("radius", 10, "Sets applicable corners."),
        token("buttonStyle", "outline", "Uses a readable link color and outline."),
      ]),
      choice("rounded", "Rounded and filled", "Eighteen-pixel surface corners and a pill action.", [
        token("radius", 18, "Sets surface corners; the pill has its own radius."),
        token("buttonStyle", "pill", "Uses a fully rounded filled action."),
      ]),
      choice("understated", "Understated link", "Square corners and an underlined action.", [
        token("radius", 0, "Sets applicable surface corners."),
        token(
          "buttonStyle",
          "underline",
          "Underlines the action; authored output retains its minimum height.",
        ),
      ]),
    ],
  },
];

const COLOR_PAIRS = [
  { id: "ink-background", foreground: "ink", background: "bg", label: "Text on background" },
  { id: "ink-surface", foreground: "ink", background: "surface", label: "Text on surface" },
  {
    id: "muted-background",
    foreground: "muted",
    background: "bg",
    label: "Quiet text on background",
  },
  {
    id: "muted-surface",
    foreground: "muted",
    background: "surface",
    label: "Quiet text on surface",
  },
  { id: "action", foreground: "accentInk", background: "accent", label: "Text on accent" },
] as const;
const profileOf = (input: StratosphereInput): StratosphereProfile =>
  input.integration === "existing"
    ? "existing-specification"
    : input.purpose.experience === "app"
      ? "app-specification"
      : "authored-website";
const groupFields = (group: StratosphereGroup): StratosphereField[] => [
  ...new Set(group.options.flatMap((option) => option.changes.map((change) => change.field))),
];
function fieldValue(input: StratosphereInput, field: StratosphereField): unknown {
  return field === "page.composition"
    ? input.page.composition
    : input.tokens[field.slice(7) as keyof Tokens];
}
function scopeIssue(input: StratosphereInput, group: StratosphereGroup): StratosphereIssue | null {
  return group.authoredOnly && profileOf(input) !== "authored-website"
    ? {
        id: "composition-scope",
        kind: "scope",
        severity: "block",
        message:
          "Composition applies to new authored websites only. Preserve the existing app or site structure; this output is a design specification.",
        fields: ["integration", "purpose.experience", ...groupFields(group)],
      }
    : null;
}
function inputIssues(input: StratosphereInput): StratosphereIssue[] {
  const issues: StratosphereIssue[] = [];
  const invalid = (field: string) =>
    issues.push({
      id: `invalid-${field}`,
      kind: "invalid",
      severity: "block",
      message: `The current ${field} value is unsupported. Restore a valid design before applying this choice.`,
      fields: [field],
    });
  if (!["new", "existing"].includes(input.integration)) invalid("integration");
  if (
    input.purpose.experience !== undefined &&
    !["website", "app"].includes(input.purpose.experience)
  )
    invalid("purpose.experience");
  if (!isPageComposition(input.page.composition)) invalid("page.composition");
  const t = input.tokens;
  for (const key of ["bg", "surface", "ink", "muted", "accent", "accentInk"] as const)
    if (typeof t[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(t[key])) invalid(`tokens.${key}`);
  const enums = {
    headingFont: HEADING_FONTS,
    bodyFont: BODY_FONTS,
    headingCase: CASES,
    density: DENSITIES,
    heroLayout: HERO_LAYOUTS,
    buttonStyle: BUTTON_STYLES,
    texture: TEXTURES,
  };
  for (const [key, values] of Object.entries(enums))
    if (!(values as readonly unknown[]).includes(t[key as keyof typeof enums]))
      invalid(`tokens.${key}`);
  if (!Number.isFinite(t.scale) || t.scale < 1.1 || t.scale > 1.6) invalid("tokens.scale");
  if (
    !Number.isInteger(t.radius) ||
    t.radius < STRATOSPHERE_FORM.radius.min ||
    t.radius > STRATOSPHERE_FORM.radius.max
  )
    invalid("tokens.radius");
  if (t.card !== undefined && !["plain", "glass"].includes(t.card)) invalid("tokens.card");
  if (t.buttonFinish !== undefined && !["flat", "glow", "gloss"].includes(t.buttonFinish))
    invalid("tokens.buttonFinish");
  if (
    t.accent2 !== undefined &&
    (typeof t.accent2 !== "string" || !/^#[0-9a-fA-F]{6}$/.test(t.accent2))
  )
    invalid("tokens.accent2");
  return issues;
}
function colorIssues(input: StratosphereInput): StratosphereIssue[] {
  return COLOR_PAIRS.flatMap((pair) => {
    const ratio = contrast(input.tokens[pair.foreground], input.tokens[pair.background]);
    return ratio >= 4.5
      ? []
      : [
          {
            id: `contrast-${pair.id}`,
            kind: "measured" as const,
            severity: "block" as const,
            message: `${pair.label} is ${formatContrast(ratio)}:1; these declared text roles require at least 4.5:1. Choose a complete readable palette. This is a token calculation, not a browser audit.`,
            fields: [`tokens.${pair.foreground}`, `tokens.${pair.background}`],
          },
        ];
  });
}
const PURPOSE_TARGETS: Record<string, StratosphereGroupId[]> = {
  "older-no-compact": ["spacing"],
  "older-airy": ["spacing"],
  "go-no-underline-btn": ["form"],
  "editorial-serif": ["fonts"],
  "editorial-layout": ["composition"],
  "calm-no-glow": [],
  "calm-ratio": ["hierarchy"],
  "bold-ratio": ["hierarchy"],
  "bold-poster": ["composition"],
  "technical-sharp": ["form"],
  "technical-grid": [],
  "warm-round": ["form"],
  "warm-grain": [],
  "playful-pill": ["form"],
  "playful-no-caps-serif": ["fonts"],
  "phone-no-underline-btn": ["form"],
  "phone-no-compact": ["spacing"],
  "action-filled-btn": ["form"],
  "reading-no-caps": ["hierarchy"],
  "reading-calm-ratio": ["hierarchy"],
};
function advice(input: StratosphereInput): StratosphereIssue[] {
  const result: StratosphereIssue[] = RULES.filter(
    (rule) => rule.when(input.purpose) && rule.test(input.tokens),
  ).map((rule) => {
    const underline = ["phone-no-underline-btn", "go-no-underline-btn"].includes(rule.id);
    const compact = ["phone-no-compact", "older-no-compact"].includes(rule.id);
    const reason = underline
      ? "An underlined action can have less visual emphasis. The authored page keeps a 48px minimum height; check prominence and target size in the actual delivered interface."
      : compact
        ? "Compact spacing may make a busy page harder to use. Check real content and target spacing with the intended audience."
        : rule.effect.reason;
    return {
      id: `advice-${rule.id}`,
      kind: "advisory",
      severity: "note",
      message: `Design-engine advice, not a measured incompatibility: ${reason}`,
      fields: [
        "purpose",
        ...(PURPOSE_TARGETS[rule.id] ?? []).flatMap((id) =>
          groupFields(STRATOSPHERE_GROUPS.find((group) => group.id === id)!),
        ),
      ],
    };
  });
  if (input.content) {
    const { headline, features, cta } = input.content;
    result.push({
      id: "content-wrapping",
      kind: "advisory",
      severity: "note",
      message: `The saved headline has ${[...headline].length} characters. Review its wrapping with the requested font, case and scale at actual screen widths; character count does not predict fit.`,
      fields: ["content.headline", "tokens.headingFont", "tokens.scale", "tokens.headingCase"],
    });
    result.push({
      id: "content-sequence",
      kind: "advisory",
      severity: "note",
      message: `${features.length} feature entries are supplied. Review their reading order, useful detail and spacing in the chosen composition; a count does not establish a good structure.`,
      fields: ["content.features", "page.composition", "tokens.density"],
    });
    if (!cta.trim())
      result.push({
        id: "content-action",
        kind: "advisory",
        severity: "note",
        message:
          "No main-action label is supplied. The authored renderer uses a fallback; write and test an action label that describes the visitor's task.",
        fields: ["content.cta", "page.actionUrl", "tokens.buttonStyle"],
      });
  }
  return result;
}
function outputLimitations(input: StratosphereInput): StratosphereIssue[] {
  const profile = profileOf(input),
    authored = profile === "authored-website";
  const note = (id: string, message: string, fields: string[]): StratosphereIssue => ({
    id,
    kind: "limitation",
    severity: "note",
    message,
    fields,
  });
  const fontAvailability = getAuthoredFontAvailability(
    input.tokens.headingFont,
    input.tokens.bodyFont,
  );
  const fontNotes = [
    fontAvailability.includedFamilies.length
      ? `Embedded font files: ${fontAvailability.includedFamilies.join(", ")}.`
      : "No bundled font family is selected.",
    fontAvailability.missingFamilies.length
      ? `Local font installation or fallback: ${fontAvailability.missingFamilies.join(", ")}.`
      : "",
    AUTHORED_FONT_COVERAGE,
    "No remote font request is made. Rendered typography still needs a browser check.",
  ]
    .filter(Boolean)
    .join(" ");
  const result = [
    note(
      "font-availability",
      authored
        ? fontNotes
        : "The specification names font families and the design pack supplies references. Loading, licensing, customer policy and fallbacks still need verification.",
      ["tokens.headingFont", "tokens.bodyFont"],
    ),
    note(
      "browser-unverified",
      "This graph describes configured values and generated output. Visual craft, responsive behavior, accessibility, customer tasks and release readiness are not verified by these calculations.",
      [],
    ),
  ];
  const scope = scopeIssue(input, STRATOSPHERE_GROUPS[0]!);
  if (scope) result.push(scope);
  if (profile === "existing-specification")
    result.push(
      note(
        "existing-application",
        "Choices update the Focus design specification and scoped token values. They do not edit customer files, replace page structure, activate a theme bridge, or verify integration and rollback.",
        ["integration"],
      ),
    );
  if (profile === "app-specification")
    result.push(
      note(
        "app-implementation",
        "App output is a design specification and local specimen, not a generated production app. Working states and host components still need implementation and browser tests.",
        ["purpose.experience"],
      ),
    );
  if (authored) {
    const t = input.tokens;
    const omitted = [
      t.accent2 ? "tokens.accent2" : "",
      t.card === "glass" ? "tokens.card" : "",
      ["glow", "gloss"].includes(t.buttonFinish ?? "") ? "tokens.buttonFinish" : "",
      ["glow", "stars"].includes(t.texture) ? "tokens.texture" : "",
    ].filter(Boolean);
    if (omitted.length)
      result.push(
        note(
          "authored-omissions",
          `The authored renderer does not apply these retained choices: ${omitted.join(", ")}. They remain in the saved design; this tool does not silently remove them.`,
          omitted,
        ),
      );
    if (layoutFor[input.page.composition] !== t.heroLayout)
      result.push(
        note(
          "composition-override",
          "The authored composition determines structure instead of the earlier hero arrangement. Choosing a composition here updates both values together.",
          ["page.composition", "tokens.heroLayout"],
        ),
      );
    if (input.nav)
      result.push(
        note(
          "authored-navigation",
          "The authored page builds its own section links. The saved navigation pattern remains a specification preference; this renderer does not apply it.",
          ["nav"],
        ),
      );
    if (["showcase", "journal"].includes(input.page.composition))
      result.push(
        note(
          "square-composition-visuals",
          "This composition keeps image corners square. Journal also keeps quotation-surface corners square. The action treatment still applies; a pill ignores the general corner radius.",
          ["page.composition", "tokens.radius", "tokens.buttonStyle"],
        ),
      );
    if (["grain", "grid"].includes(t.texture))
      result.push(
        note(
          "texture-interpretation",
          "Authored grain is a dotted visual border; grid decorates the visual surface. These details may be absent or covered when there is no visual or a full-cover owner image.",
          ["tokens.texture", "page.composition", "page.imageId"],
        ),
      );
  }
  return result;
}

export function evaluateStratosphereCandidate(
  input: StratosphereInput,
  groupId: string,
  optionId: string,
): StratosphereResult {
  const group = STRATOSPHERE_GROUPS.find((item) => item.id === groupId);
  const option = group?.options.find((item) => item.id === optionId);
  return evaluateChoice(input, group, option?.changes);
}

export function evaluateStratosphereForm(
  input: StratosphereInput,
  field: "radius" | "buttonStyle",
  value: number | string,
): StratosphereResult {
  const changes: StratosphereChange[] | undefined =
    field === "radius" && typeof value === "number"
      ? [token("radius", value, "Sets applicable corners.")]
      : field === "buttonStyle" &&
          STRATOSPHERE_FORM.buttonStyles.includes(value as Tokens["buttonStyle"])
        ? [
            token(
              "buttonStyle",
              value as Tokens["buttonStyle"],
              "Sets the action treatment; preserves its destination and behavior.",
            ),
          ]
        : undefined;
  return evaluateChoice(
    input,
    STRATOSPHERE_GROUPS.find((group) => group.id === "form"),
    changes,
  );
}

function evaluateChoice(
  input: StratosphereInput,
  group: StratosphereGroup | undefined,
  changes: readonly StratosphereChange[] | undefined,
): StratosphereResult {
  const rejected = (issues: StratosphereIssue[]): StratosphereResult => ({
    accepted: false,
    issues,
    changedFields: [],
    tokens: input.tokens,
    page: input.page,
  });
  if (!group || !changes)
    return rejected([
      {
        id: "unknown-choice",
        kind: "invalid",
        severity: "block",
        message: "Choose a supported Stratosphere option. No design values changed.",
        fields: [],
      },
    ]);
  const invalid = inputIssues(input);
  if (invalid.length) return rejected(invalid);
  const scope = scopeIssue(input, group);
  if (scope) return rejected([scope]);
  const tokens = { ...input.tokens },
    page = { ...input.page };
  for (const change of changes) {
    if (change.field === "page.composition") page.composition = change.value;
    else (tokens as unknown as Record<string, unknown>)[change.field.slice(7)] = change.value;
  }
  const candidate = { ...input, tokens, page },
    constraints = [...inputIssues(candidate), ...colorIssues(candidate)];
  if (constraints.length) return rejected(constraints);
  return {
    accepted: true,
    issues: [
      ...advice(candidate),
      ...outputLimitations(candidate).filter((issue) => issue.severity !== "block"),
    ],
    changedFields: changes
      .filter((change) => fieldValue(input, change.field) !== change.value)
      .map((change) => change.field),
    tokens,
    page,
  };
}
export function selectedStratosphereOption(
  input: StratosphereInput,
  groupId: string,
): string | null {
  return (
    STRATOSPHERE_GROUPS.find((group) => group.id === groupId)?.options.find((option) =>
      option.changes.every((change) => fieldValue(input, change.field) === change.value),
    )?.id ?? null
  );
}

/** Canonical ordering stabilizes exports for equivalent inputs, without times or random IDs. */
function ordered<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ) as T;
}
function pageSnapshot(page: PageSettings): PageSettings {
  const snapshot = { ...page },
    framing = compactImageFraming(page.imageFraming);
  delete snapshot.imageFraming;
  if (framing) snapshot.imageFraming = ordered(framing);
  if (page.relatedStory) {
    const story = { ...page.relatedStory };
    delete story.imageFraming;
    const storyFraming = compactImageFraming(page.relatedStory.imageFraming);
    if (storyFraming) story.imageFraming = ordered(storyFraming);
    snapshot.relatedStory = ordered(story);
  }
  return ordered(snapshot);
}
function imageFramingOutput(input: StratosphereInput, invalid: boolean) {
  if (invalid)
    return { available: false, value: "Invalid current values; image framing not evaluated." };
  if (profileOf(input) !== "authored-website")
    return {
      available: false,
      value:
        "Not applied: image framing belongs to the authored website. Existing-site and app specifications do not apply it to customer images.",
    };
  if (
    typeof input.page.imageId !== "string" ||
    !input.page.imageId.trim() ||
    typeof input.page.imageAlt !== "string" ||
    !input.page.imageAlt.trim()
  )
    return {
      available: false,
      value:
        "Not applied: an authored image reference and a nonempty image description are required. Saved framing choices are retained.",
    };
  const framing = getImageFramingCss(input.page.imageFraming);
  return {
    available: true,
    value: `Configured authored image CSS: object-fit: ${framing.fit}; object-position: ${framing.position}; position at or below ${IMAGE_NARROW_BREAKPOINT}px: ${framing.narrowPosition}. ${framing.fit === "contain" ? "The whole image stays centered in the existing frame." : "Cover fills the existing frame and may crop the image."} Image bytes and visual result are not verified by this graph.`,
  };
}
function outputValue(input: StratosphereInput, group: StratosphereGroup): string {
  const t = input.tokens,
    authored = profileOf(input) === "authored-website",
    prefix = input.integration === "existing" ? "--focus-" : "--";
  if (group.id === "composition")
    return authored
      ? `HTML composition: ${input.page.composition}; effective hero: ${layoutFor[input.page.composition]}`
      : "Composition is not applied to this output.";
  if (group.id === "palette")
    return (
      "Declared token pairs: " +
      COLOR_PAIRS.map(
        (pair) =>
          `${pair.label}: ${formatContrast(contrast(t[pair.foreground], t[pair.background]))}:1`,
      ).join("; ")
    );
  if (group.id === "hierarchy")
    return `${authored ? "--type-heading" : `${prefix}text-h2`}: ${Math.pow(t.scale, 2).toFixed(authored ? 4 : 3)}rem; heading case: ${t.headingCase}`;
  if (group.id === "spacing")
    return authored
      ? `--space: ${{ airy: 1.25, balanced: 1, compact: 0.85 }[t.density]}`
      : `${prefix}space-unit: ${{ airy: 1.5, balanced: 1, compact: 0.7 }[t.density]}rem`;
  return groupFields(group)
    .map((field) => `${field}: ${String(fieldValue(input, field) ?? "not set")}`)
    .join("; ");
}
export function deriveStratosphereGraph(input: StratosphereInput): StratosphereGraph {
  const profile = profileOf(input),
    invalid = inputIssues(input),
    constraints = invalid.length ? invalid : colorIssues(input);
  const notes = invalid.length ? [] : advice(input),
    limitations = outputLimitations(input);
  const node = (
    id: string,
    kind: StratosphereNode["kind"],
    label: string,
    value: string,
    available = true,
    selectedOptionId: string | null = null,
  ): StratosphereNode => ({ id, kind, label, value, available, selectedOptionId });
  const nodes: StratosphereNode[] = [
    node("context:output", "context", "Output profile", profile, !invalid.length),
    node(
      "context:purpose",
      "context",
      "Audience and task",
      Object.entries(ordered(input.purpose))
        .map(([key, value]) => `${key}: ${value || "not supplied"}`)
        .join("; "),
    ),
  ];
  const edges: StratosphereEdge[] = [];
  for (const group of STRATOSPHERE_GROUPS) {
    const fields = groupFields(group),
      unavailable = scopeIssue(input, group),
      candidates = group.options.map((option) =>
        evaluateStratosphereCandidate(input, group.id, option.id),
      ),
      available = candidates.some((candidate) => candidate.accepted),
      blockers = available
        ? []
        : (candidates[0]?.issues.filter((issue) => issue.severity === "block") ?? []);
    const reason = [
      profile === "authored-website" ? group.output.authored : group.output.specification,
      ...blockers.map((issue) => issue.message),
    ].join(" ");
    nodes.push(
      node(
        `group:${group.id}`,
        "choice",
        group.label,
        fields
          .map((field) => `${field}: ${String(fieldValue(input, field) ?? "not set")}`)
          .join("; "),
        available,
        selectedStratosphereOption(input, group.id),
      ),
    );
    nodes.push(
      node(
        `output:${group.id}`,
        "output",
        `${group.label} output`,
        invalid.length
          ? "Invalid current values; output not evaluated."
          : outputValue(input, group),
        available,
      ),
    );
    edges.push({
      id: `${group.id}-output`,
      from: `group:${group.id}`,
      to: `output:${group.id}`,
      kind: "affects",
      reason,
      fields,
      blocked: !available,
    });
    if (
      group.id !== "palette" &&
      group.id !== "form" &&
      blockers.some((issue) => issue.kind === "measured")
    )
      edges.push({
        id: `palette-requires-${group.id}`,
        from: "group:palette",
        to: `group:${group.id}`,
        kind: "requires",
        reason: blockers
          .filter((issue) => issue.kind === "measured")
          .map((issue) => issue.message)
          .join(" "),
        fields: blockers.flatMap((issue) => issue.fields),
        blocked: true,
      });
    if (group.authoredOnly)
      edges.push({
        id: `${group.id}-scope`,
        from: "context:output",
        to: `group:${group.id}`,
        kind: "requires",
        reason: unavailable?.message ?? "New website output supports this authored composition.",
        fields: ["integration", "purpose.experience"],
        blocked: !!unavailable,
      });
  }
  if (input.page.relatedStory) {
    const authored = profile === "authored-website" && !invalid.length;
    const story = input.page.relatedStory;
    nodes.push(
      node(
        "output:related-story",
        "output",
        "Related reading",
        authored
          ? `Preview and both website exports place the related story ${story.placement === "after-intro" ? "after the introduction" : "after the article"} once its title, destination and chosen image are ready.`
          : "Saved with this design. Apply and check reading order in the customer project.",
        authored,
      ),
    );
    edges.push({
      id: "composition-related-story",
      from: "group:composition",
      to: "output:related-story",
      kind: "affects",
      reason:
        "Changing the article structure can move the story link. Check reading order, keyboard access, image and credit in the exported page.",
      fields: [
        "page.composition",
        "page.relatedStory.title",
        "page.relatedStory.url",
        "page.relatedStory.placement",
        "page.relatedStory.imageId",
        "page.relatedStory.imageAlt",
        "page.relatedStory.imageCredit",
        "page.relatedStory.imageFraming",
      ],
      blocked: !authored,
    });
  }
  const imageFraming = imageFramingOutput(input, !!invalid.length);
  nodes.push(
    node(
      "output:image-framing",
      "output",
      "Image framing output",
      imageFraming.value,
      imageFraming.available,
    ),
  );
  edges.push({
    id: "composition-image-framing",
    from: "group:composition",
    to: "output:image-framing",
    kind: "affects",
    reason:
      "Composition changes the image frame ratio, which affects the cover crop. Contain keeps the whole image centered in that same frame. Review the subject at wide and narrow widths; a saved image reference and description do not verify image bytes or visual quality.",
    fields: ["page.composition", "page.imageFraming", "page.imageId", "page.imageAlt"],
    blocked: !imageFraming.available,
  });
  edges.push({
    id: "palette-action-contrast",
    from: "group:palette",
    to: "group:form",
    kind: "requires",
    reason:
      "Declared text/action color pairs must reach 4.5:1. Outlined and underlined actions use a separately derived readable link color.",
    fields: [
      ...new Set(
        COLOR_PAIRS.flatMap((pair) => [`tokens.${pair.foreground}`, `tokens.${pair.background}`]),
      ),
    ],
    blocked: constraints.some((issue) => issue.kind === "measured"),
  });
  edges.push({
    id: "fonts-hierarchy-review",
    from: "group:fonts",
    to: "group:hierarchy",
    kind: "advisory",
    reason:
      "Typeface metrics affect wrapping. Review actual words and fallback fonts in a browser; font style alone does not establish incompatibility.",
    fields: ["tokens.headingFont", "tokens.bodyFont", "tokens.scale"],
    blocked: false,
  });
  if (profile === "authored-website")
    edges.push({
      id: "composition-hero",
      from: "group:composition",
      to: "output:composition",
      kind: "sets",
      reason:
        "Composition determines the authored structure; its control also sets the matching earlier hero arrangement.",
      fields: ["page.composition", "tokens.heroLayout"],
      blocked: !nodes.find((item) => item.id === "group:composition")?.available,
    });
  for (const issue of notes.filter((item) => item.id.startsWith("advice-")))
    for (const target of PURPOSE_TARGETS[issue.id.slice(7)] ?? [])
      edges.push({
        id: `${issue.id}-${target}`,
        from: "context:purpose",
        to: `group:${target}`,
        kind: "advisory",
        reason: issue.message,
        fields: issue.fields,
        blocked: false,
      });
  if (input.content) {
    nodes.push(
      node(
        "context:content",
        "context",
        "Current content",
        `Headline: ${[...input.content.headline].length} characters; features: ${input.content.features.length}; action label: ${input.content.cta || "not supplied"}`,
      ),
    );
    const targets: Record<string, StratosphereGroupId[]> = {
      "content-wrapping": ["fonts", "hierarchy"],
      "content-sequence": ["composition", "spacing"],
      "content-action": ["form"],
    };
    for (const issue of notes.filter((item) => item.id.startsWith("content-")))
      for (const target of targets[issue.id] ?? [])
        edges.push({
          id: `${issue.id}-${target}`,
          from: "context:content",
          to: `group:${target}`,
          kind: "advisory",
          reason: issue.message,
          fields: issue.fields,
          blocked: false,
        });
  }
  return {
    version: 1,
    profile,
    snapshot: {
      tokens: ordered({ ...input.tokens }),
      page: pageSnapshot(input.page),
      purpose: ordered({ ...input.purpose }),
      integration: input.integration,
      nav: input.nav ?? null,
      ...(input.content
        ? {
            content: ordered({
              ...input.content,
              features: input.content.features.map((feature) => ordered({ ...feature })),
            }),
          }
        : {}),
    },
    nodes,
    edges,
    limitations: limitations.map((issue) => issue.message),
    issues: [...constraints, ...notes, ...limitations],
  };
}
