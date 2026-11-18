// Plain words for every design term the app shows. One source, so wording stays consistent.
export const GLOSSARY = {
  prescription: {
    plain: "Vision",
    def: "A written recipe of every design decision, which you paste into an AI builder so it builds exactly what you chose.",
  },
  tokens: {
    plain: "design values",
    def: "The exact colors, fonts, sizes and corner shapes of your design, written as code your builder can copy.",
  },
  lens: {
    plain: "question",
    def: "One small question in Focus. Each question decides one thing, like colors or fonts, so you never juggle everything at once.",
  },
  direction: {
    plain: "Direction",
    def: "A starting look. You pick the closest of three, then fine-tune it one question at a time.",
  },
  contrast: {
    plain: "how readable",
    def: "How much the text stands out from what's behind it. 4.5 to 1 or more is readable for almost everyone.",
  },
  density: {
    plain: "breathing room",
    def: "How much space sits between things. More space feels calm; less fits more on screen.",
  },
  floor: {
    plain: "the floor",
    def: "Hard rules every good page meets: readable text, big enough buttons, clear headings.",
  },
  evidence: {
    plain: "evidence grade",
    def: "A = law, standard or repeated study. B = solid but limited research. C = what experienced designers agree on.",
  },
  critic: {
    plain: "Critic",
    def: "Checks any public web page against the same rules and names the fixes that matter most.",
  },
  fitter: {
    plain: "repair brief",
    def: "A ready-to-paste list of fixes for your AI builder, most important first.",
  },
  checks: {
    plain: "quality checks",
    def: "Measurements of your design — text readability, button size, line length — each passing or failing a known rule.",
  },
} as const;
export type Term = keyof typeof GLOSSARY;
