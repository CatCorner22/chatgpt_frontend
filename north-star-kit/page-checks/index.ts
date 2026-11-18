import {
  checkAutoplay,
  checkVisibleLabels,
  checkReflow,
  checkTargetSize,
  checkImages,
  checkPlaceholderCopy,
  checkTabularNumbers,
  checkTextWrapping,
  checkJustification,
  checkTextContrast,
} from "./checks";

export * from "./checks";
export { collectTokenObservations } from "./tokens";

/** Inject each run function separately; this registry itself stays in the caller. */
export const checkRegistry = [
  { ruleId: "floor-no-autoplay", run: checkAutoplay, needsRealBrowser: false },
  { ruleId: "floor-visible-labels", run: checkVisibleLabels, needsRealBrowser: true },
  { ruleId: "floor-reflow", run: checkReflow, needsRealBrowser: true },
  { ruleId: "floor-target-size", run: checkTargetSize, needsRealBrowser: true },
  { ruleId: "craft-image-dimensions", run: checkImages, needsRealBrowser: false },
  { ruleId: "tells-placeholder-copy", run: checkPlaceholderCopy, needsRealBrowser: false },
  { ruleId: "craft-tabular-numerals", run: checkTabularNumbers, needsRealBrowser: true },
  { ruleId: "craft-text-wrap", run: checkTextWrapping, needsRealBrowser: true },
  { ruleId: "neuro-no-justification", run: checkJustification, needsRealBrowser: true },
  { ruleId: "floor-text-contrast", run: checkTextContrast, needsRealBrowser: true },
] as const;
