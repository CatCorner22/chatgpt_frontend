import type { GardenStepId } from "@/lib/garden-content";
import type { StratosphereGroupId } from "@/lib/stratosphere";

type GardenFormula = {
  do: string;
  changes: string;
  check: string;
  primaryGroup?: StratosphereGroupId;
  primaryLabel?: string;
  details?: readonly { group: StratosphereGroupId; label: string }[];
  scopeNote?: string;
};

/** Planning guidance, never a completion record or a source of design mutations. */
export const GARDEN_FORMULA: Record<GardenStepId, GardenFormula> = {
  goal: {
    do: "Choose a starting point and name one thing your visitor should be able to do.",
    changes: "Your starting point is remembered in this browser; your app stays unchanged.",
    check: "Can you describe the person, the page, and the task in one sentence?",
  },
  content: {
    do: "Gather the real words, images, and destination for the main action.",
    changes: "Content you edit in the studio becomes part of its draft and handoff.",
    check: "Read the headline, details, and action together; mark every missing fact.",
  },
  plan: {
    do: "Plan the reading order around the visitor’s main task.",
    changes: "An available composition choice changes the authored website’s structure.",
    check: "Can someone find the offer, essential details, and next action in that order?",
    primaryGroup: "composition",
    primaryLabel: "Arrange the page",
    scopeNote:
      "Composition controls apply to authored websites. Existing apps and app specifications keep their structure; plan structural changes in a scoped handoff.",
  },
  direction: {
    do: "Choose one visual direction that fits your content and audience.",
    changes: "A direction selected in the studio updates its design values.",
    check: "Compare the same real content in each direction before choosing.",
  },
  craft: {
    do: "Start with readable color pairs, then refine one detail at a time.",
    changes: "Each accepted workshop choice updates the draft and its design specification.",
    check: "Compare headings, body text, links, and controls on their actual backgrounds.",
    primaryGroup: "palette",
    primaryLabel: "Explore color pairs",
    details: [
      { group: "fonts", label: "Font pairs" },
      { group: "hierarchy", label: "Text size and emphasis" },
      { group: "spacing", label: "Spacing" },
      { group: "form", label: "Buttons and corners" },
    ],
    scopeNote:
      "For an existing app, these choices prepare a style study and specification. Applying and testing them in the app is a separate step.",
  },
  behavior: {
    do: "Choose a control appearance, then list the states its real task needs.",
    changes: "Workshop controls change visual tokens; they do not build form logic or save data.",
    check:
      "Test keyboard focus, validation, loading, success, and recovery in the implemented app.",
    primaryGroup: "form",
    primaryLabel: "Choose button appearance",
    scopeNote:
      "Control appearance is a style choice. Real forms, validation, and backend behavior still need implementation and testing.",
  },
  responsive: {
    do: "Review one real page at narrow and wide widths.",
    changes: "Quality tools help inspect the design; opening them does not repair your page.",
    check: "Complete the main task on a phone-sized screen and with a keyboard.",
  },
  handoff: {
    do: "Prepare a bounded handoff with the page, intended change, and preservation checks.",
    changes: "Target prepares instructions and files for a reviewed implementation.",
    check: "Confirm the scope, original files, preview steps, and a way to undo the change.",
  },
  check: {
    do: "Inspect the implemented page and repeat its main task.",
    changes: "Telescope records review findings; a visit or download is not launch evidence.",
    check:
      "Check real behavior and recovery, then have the owner review the result before release.",
  },
};
