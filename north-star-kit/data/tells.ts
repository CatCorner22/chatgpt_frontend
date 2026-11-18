import type { RuleRecord } from "../types";
import { builder, reviewed } from "./sources";

export const tellsPolicy =
  "These are prompts for editorial judgment, not evidence that a page was made by AI. They warn and never forbid a design choice.";
export const placeholderPhrases = [
  "lorem ipsum",
  "your tagline here",
  "your headline here",
  "your business",
  "your company",
  "empower your workflow",
  "insert text here",
  "placeholder text",
  "john doe",
  "jane doe",
] as const;
export function findPlaceholder(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  return placeholderPhrases.find((phrase) => {
    if (phrase === "your company" || phrase === "your business") {
      // These phrases are ordinary prose too; only standalone template labels
      // are evidence of placeholder content.
      const label = normalized
        .replace(/^[[\]{}()<>"'“”‘’]+/, "")
        .replace(/[[\]{}()<>"'“”‘’.!?]+$/, "")
        .trim();
      return [phrase, `${phrase} name`, `${phrase} here`, `${phrase} name here`].includes(label);
    }
    return normalized.includes(phrase);
  });
}
const tell = (id: string, plain: string, why: string, ask: string): RuleRecord => ({
  id,
  group: "craft",
  plain,
  why,
  check: { kind: "person", ask },
  overridable: true,
  evidence: "expert-opinion",
  sources: [builder("Subjective editorial warning, not an authorship detector.")],
  reviewed,
});
export const tellRules: RuleRecord[] = [
  tell(
    "tells-generic-gradient",
    "Review whether a purple-to-blue hero gradient belongs to this brand.",
    "A familiar decoration can obscure what is distinctive about the actual product.",
    "Does the gradient express something specific about the brand, or could it be removed without losing meaning?",
  ),
  tell(
    "tells-identical-cards",
    "Review repeated rows of three identical icon cards.",
    "Equal visual weight can hide the most important information and make unrelated ideas appear interchangeable.",
    "Do the items deserve equal treatment, and is a list or another content structure easier to understand?",
  ),
  tell(
    "tells-all-centered",
    "Review pages where every section is centered.",
    "Repeated centered text can reduce scanning cues and make long passages harder to follow.",
    "Does alignment support the reading task in each section, especially longer text?",
  ),
  tell(
    "tells-emoji-icons",
    "Review emoji used as interface icons.",
    "Emoji vary across platforms and may add an unintended tone or spoken label.",
    "Would a stable icon with a clear text label express the action better, or are the emoji deliberate content?",
  ),
  tell(
    "tells-uniform-surfaces",
    "Review using the same corner shape and shadow for every surface.",
    "A single treatment can make primary actions, containers, and decorative elements indistinguishable.",
    "Does the treatment communicate purpose and hierarchy, and would some elements work better without a box?",
  ),
  {
    ...tell(
      "tells-placeholder-copy",
      "Replace leftover placeholder copy with specific, truthful content.",
      "Generic copy conceals the information a visitor needs to make a decision.",
      "Read every content field for placeholders.",
    ),
    check: { kind: "page-check", fn: "checkPlaceholderCopy" },
  },
  tell(
    "tells-stock-headlines",
    "Review stock headline patterns that do not explain the actual offer.",
    "A headline with no concrete subject can leave visitors unsure why the page exists.",
    "Can an intended visitor explain what is offered after reading the headline?",
  ),
  tell(
    "tells-flat-heading-weight",
    "Review headings that all have the same visual emphasis.",
    "A flat hierarchy may hide the difference between a main idea and its supporting details.",
    "Can a reader identify the page structure without reading every heading, and is a restrained hierarchy intentional?",
  ),
];
