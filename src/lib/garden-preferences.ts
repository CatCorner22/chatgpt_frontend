import type { GardenGoal, GardenStepId } from "./garden-content";

export type GardenPreferences = {
  version: 1;
  step: GardenStepId;
  goal: GardenGoal;
  brief: boolean;
};

export const GARDEN_KEY = "focus:garden:v1";
export const GARDEN_DEFAULTS: GardenPreferences = {
  version: 1,
  step: "goal",
  goal: "existing",
  brief: true,
};

const MAX_PREFERENCES_LENGTH = 2048;
const STEPS: readonly GardenStepId[] = [
  "goal",
  "content",
  "plan",
  "direction",
  "craft",
  "behavior",
  "responsive",
  "handoff",
  "check",
];
const FIELDS = ["version", "step", "goal", "brief"];
const INVALID_SAVE = "These Garden preferences could not be saved because they are invalid.";

function parsePreferences(value: unknown): GardenPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== FIELDS.length ||
    keys.some((key) => typeof key !== "string" || !FIELDS.includes(key))
  )
    return null;
  const record = value as Record<string, unknown>;
  const step = record["step"];
  const goal = record["goal"];
  const brief = record["brief"];
  if (
    record["version"] !== 1 ||
    !STEPS.some((allowed) => allowed === step) ||
    (goal !== "existing" && goal !== "new") ||
    typeof brief !== "boolean"
  )
    return null;
  return { version: 1, step: step as GardenStepId, goal, brief };
}

/** Preferences only: reads never repair saved data or modify a project or its evidence. */
export function readGardenPreferences(storage: Pick<Storage, "getItem">): {
  value: GardenPreferences;
  issue: string;
} {
  let raw: string | null;
  try {
    raw = storage.getItem(GARDEN_KEY);
  } catch {
    return {
      value: { ...GARDEN_DEFAULTS },
      issue:
        "Garden preferences could not be read from this browser. You can still use your choices in this tab.",
    };
  }
  if (raw === null) return { value: { ...GARDEN_DEFAULTS }, issue: "" };
  try {
    if (raw.length <= MAX_PREFERENCES_LENGTH) {
      const value = parsePreferences(JSON.parse(raw));
      if (value) return { value, issue: "" };
    }
  } catch {
    // Preserve the original saved copy; a fallback is not a repair.
  }
  return {
    value: { ...GARDEN_DEFAULTS },
    issue:
      "Saved Garden preferences could not be read. Default settings are shown; the saved copy has not been changed.",
  };
}

/** Return an empty issue only after the browser retains the exact validated preferences. */
export function writeGardenPreferences(
  storage: Pick<Storage, "getItem" | "setItem">,
  value: GardenPreferences,
): string {
  let parsed: GardenPreferences | null;
  try {
    parsed = parsePreferences(value);
  } catch {
    return INVALID_SAVE;
  }
  if (!parsed) return INVALID_SAVE;
  try {
    const raw = JSON.stringify(parsed);
    storage.setItem(GARDEN_KEY, raw);
    if (storage.getItem(GARDEN_KEY) === raw) return "";
  } catch {
    // A write may have reached storage even when its confirmation failed.
  }
  return "Garden preferences could not be confirmed as saved. Your choices remain available in this tab.";
}
